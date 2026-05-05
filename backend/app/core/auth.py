"""JWT authentication with RBAC.

Replaces the static API Key middleware with OAuth2PasswordBearer + JWT.
All routes require a valid bearer token except public paths.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db, async_session
from backend.app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

# Public paths that never require authentication
PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc", "/api/v1/auth/login", "/api/v1/auth/register"}


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=settings.access_token_expire_hours))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    from backend.app.models.auth import User
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


async def require_role(role_name: str):
    async def checker(user=Depends(get_current_user)):
        from backend.app.models.auth import Role, UserRole
        from sqlalchemy import select
        async with async_session() as db:
            result = await db.execute(
                select(Role).join(UserRole).where(
                    UserRole.user_id == user.id,
                    Role.name == role_name,
                )
            )
            role = result.scalar_one_or_none()
            if not role and not user.is_superuser:
                raise HTTPException(status_code=403, detail=f'Role "{role_name}" required')
        return user
    return checker


class JWTAuthMiddleware:
    """FastAPI dependency-based auth is preferred; this middleware is a fallback
    that injects the current user into request.state for websocket/SSE paths.
    """
    async def __call__(self, request: Request, call_next):
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if token:
            payload = decode_token(token)
            if payload:
                request.state.user_id = payload.get("sub")
        return await call_next(request)
