"""Notebook model — rich text documents with metadata."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.core.database import Base, GUID


class Notebook(Base):
    """Rich text notebook / document editor content."""
    __tablename__ = "notebooks"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), default="Untitled document")
    content: Mapped[str | None] = mapped_column(Text, default="<p></p>")
    metadata_json: Mapped[str | None] = mapped_column(Text, default="{}")  # JSON string for colors, tags, etc.

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
