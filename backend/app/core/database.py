"""Database foundation — async SQLAlchemy with PostgreSQL types."""
import uuid
from sqlalchemy import Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import TypeDecorator, CHAR
from datetime import datetime, timezone

# Use SQLite for dev, PostgreSQL for production
DATABASE_URL = "sqlite+aiosqlite:///./aries_marine.db"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """Base for all ORM models."""
    pass


class GUID(TypeDecorator):
    """Platform-independent UUID. Uses native UUID for PostgreSQL, CHAR(36) for SQLite."""
    impl = CHAR(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID as PG_UUID
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if not isinstance(value, uuid.UUID):
            return uuid.UUID(value)
        return value


class Money(TypeDecorator):
    """Numeric(18,2) for exact decimal precision. Never use Float for money."""
    impl = Numeric(18, 2)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return None if value is None else float(value)

    def process_result_value(self, value, dialect):
        return None if value is None else float(value)


# ── Mixins ────────────────────────────────────────────────────

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

class AuditMixin:
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
