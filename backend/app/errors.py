from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError


def _error_payload(detail, code: str):
    if isinstance(detail, dict):
        return {
            "detail": detail.get("detail", "Request failed"),
            "code": detail.get("code", code),
        }
    return {"detail": str(detail), "code": code}


async def http_exception_handler(_: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_payload(exc.detail, "HTTP_ERROR"),
    )


async def validation_exception_handler(_: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_message = errors[0].get("msg", "Validation failed") if errors else "Validation failed"
    return JSONResponse(
        status_code=422,
        content={
            "detail": first_message,
            "code": "VALIDATION_ERROR",
            "errors": errors,
        },
    )
