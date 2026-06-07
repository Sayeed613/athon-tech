"""Pagination schemas and utilities for list endpoints.

Provides a generic Page model that wraps a list of items with
pagination metadata (total, page, page_size, pages).
"""

from math import ceil
from typing import Generic, Sequence, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Generic paginated response wrapper.

    Attributes:
        items: The list of items for the current page.
        total: Total number of items matching the query.
        page: Current page number (1-indexed).
        page_size: Number of items per page.
        pages: Total number of pages.
    """

    items: list[T]
    total: int
    page: int = 1
    page_size: int = 50
    pages: int = 0

    def __init__(self, **data):
        super().__init__(**data)
        if self.pages == 0 and self.page_size > 0:
            self.pages = max(1, ceil(self.total / self.page_size))


class PaginationParams:
    """FastAPI dependency for parsing pagination query parameters.

    Usage::

        @router.get("/items")
        async def list_items(p: PaginationParams = Depends()):
            skip, limit = p.skip, p.limit
    """

    def __init__(self, page: int = 1, page_size: int = 50):
        self.page = max(1, page)
        self.page_size = min(max(1, page_size), 200)
        self.skip = (self.page - 1) * self.page_size
        self.limit = self.page_size
