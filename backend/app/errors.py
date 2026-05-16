from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

try:
    import sentry_sdk
except ImportError:
    sentry_sdk = None


def _error_payload(detail, code: str):
    if isinstance(detail, dict):
        return {
            "detail": detail.get("detail", "Request failed"),
            "code": detail.get("code", code),
        }
    return {"detail": str(detail), "code": code}


async def http_exception_handler(request: Request, exc: HTTPException):
    status_code = exc.status_code

    if sentry_sdk and status_code >= 500:
        with sentry_sdk.push_scope() as scope:
            scope.set_context("http", {
                "method": request.method,
                "url": str(request.url),
                "status_code": status_code,
            })
            sentry_sdk.capture_exception(exc)

    return JSONResponse(
        status_code=status_code,
        content=_error_payload(exc.detail, "HTTP_ERROR"),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_message = errors[0].get("msg", "Validation failed") if errors else "Validation failed"

    if sentry_sdk:
        with sentry_sdk.push_scope() as scope:
            scope.set_context("validation", {
                "error_count": len(errors),
                "first_error": first_message,
                "method": request.method,
                "url": str(request.url),
            })
            sentry_sdk.capture_exception(exc)

    return JSONResponse(
        status_code=422,
        content={
            "detail": first_message,
            "code": "VALIDATION_ERROR",
            "errors": errors,
        },
    )
