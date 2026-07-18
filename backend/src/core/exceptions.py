from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, code: str, message_he: str, status_code: int = 400) -> None:
        self.code = code
        self.message_he = message_he
        self.status_code = status_code
        super().__init__(code)


async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message_he": exc.message_he}},
    )


async def unhandled_error_handler(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message_he": "אירעה תקלה בשרת. נסו שוב בעוד רגע.",
            }
        },
    )
