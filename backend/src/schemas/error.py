from pydantic import BaseModel


class ErrorBody(BaseModel):
    code: str
    message_he: str


class ErrorResponse(BaseModel):
    error: ErrorBody
