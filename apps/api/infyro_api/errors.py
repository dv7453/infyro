from __future__ import annotations

from fastapi import HTTPException
from fastapi.responses import JSONResponse


class ApiError(HTTPException):
    def __init__(self, status_code: int, message: str, code: str) -> None:
        super().__init__(status_code=status_code, detail={"error": message, "code": code})


def error_response(status_code: int, message: str, code: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": message, "code": code})
