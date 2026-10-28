"""Static frontend-to-FastAPI route contract checks.

The test intentionally covers the shared frontend ``api`` client. External
services such as Supabase Auth and the separate CRM host have their own clients
and contracts.
"""

import re
from collections import Counter
from pathlib import Path

from app.main import app


REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_SOURCE = REPO_ROOT / "frontend" / "src"
API_CALL = re.compile(
    r"api\.(get|post|put|patch|delete)\(\s*(['\"`])(/[^'\"`]+?)\2"
)
TEMPLATE_VALUE = re.compile(r"\$\{[^}]+\}")
FASTAPI_PARAM = re.compile(r"\{[^}]+\}")


def _frontend_calls():
    for path in FRONTEND_SOURCE.rglob("*"):
        if path.suffix not in {".js", ".jsx", ".ts", ".tsx"}:
            continue
        source = path.read_text(encoding="utf-8")
        for match in API_CALL.finditer(source):
            request_path = TEMPLATE_VALUE.sub("fixture-value", match.group(3)).split("?", 1)[0]
            yield match.group(1).upper(), request_path, path.relative_to(REPO_ROOT)


def _backend_routes():
    for route in app.routes:
        methods = getattr(route, "methods", None)
        route_path = getattr(route, "path", None)
        if not methods or not route_path:
            continue
        pattern = re.compile(f"^{FASTAPI_PARAM.sub('[^/]+', route_path)}$")
        yield methods, pattern


def test_every_frontend_api_call_has_a_matching_backend_method_and_path():
    routes = list(_backend_routes())
    missing = sorted(
        {
            f"{method} {request_path} ({source})"
            for method, request_path, source in _frontend_calls()
            if not any(method in methods and pattern.match(request_path) for methods, pattern in routes)
        }
    )

    assert not missing, "Frontend calls missing from FastAPI:\n" + "\n".join(missing)


def test_fastapi_has_no_ambiguous_duplicate_method_and_path():
    registered = [
        (method, route.path)
        for route in app.routes
        for method in (getattr(route, "methods", None) or set())
        if method not in {"HEAD", "OPTIONS"}
    ]
    duplicates = sorted(key for key, count in Counter(registered).items() if count > 1)

    assert not duplicates, f"Duplicate FastAPI routes are order-dependent: {duplicates}"


def test_openapi_operation_ids_are_unique():
    operation_ids = [
        operation["operationId"]
        for path_item in app.openapi()["paths"].values()
        for operation in path_item.values()
        if isinstance(operation, dict) and operation.get("operationId")
    ]
    duplicates = sorted(key for key, count in Counter(operation_ids).items() if count > 1)

    assert not duplicates, f"Duplicate OpenAPI operation IDs: {duplicates}"
