"""Pydantic schemas for request/response validation."""
from pydantic import BaseModel
from typing import Generic, TypeVar, List

T = TypeVar("T")

class ListResponse(BaseModel, Generic[T]):
    data: list
    total: int = 0
    page: int = 1
    page_size: int = 20

class ItemResponse(BaseModel):
    data: dict | None = None
    message: str = "success"

class ApiResponse(BaseModel):
    message: str = "success"
