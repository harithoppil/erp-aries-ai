"""Auth routes — register, login, me."""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.auth import (
    get_password_hash, verify_password, create_access_token, get_current_user
)
from backend.app.models.auth import User, Company

router = APIRouter(prefix="/auth", tags=["Auth"])

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None
    company_name: str | None = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

@router.post("/register", response_model=TokenResponse)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check existing
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")
    # Create company if provided
    company_id = None
    if data.company_name:
        company = Company(name=data.company_name, currency="AED", country="AE")
        db.add(company)
        await db.flush()
        company_id = company.id
    # Create user
    user = User(
        email=data.email,
        password_hash=get_password_hash(data.password),
        full_name=data.full_name,
        phone=data.phone,
        company_id=company_id,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_access_token({"sub": str(user.id), "email": user.email})
    return TokenResponse(
        access_token=token,
        user={"id": str(user.id), "email": user.email, "full_name": user.full_name, "company_id": str(company_id) if company_id else None}
    )

@router.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form_data.username, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    token = create_access_token({"sub": str(user.id), "email": user.email})
    return TokenResponse(
        access_token=token,
        user={"id": str(user.id), "email": user.email, "full_name": user.full_name, "company_id": str(user.company_id) if user.company_id else None}
    )

@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {"data": {"id": str(user.id), "email": user.email, "full_name": user.full_name, "is_superuser": user.is_superuser, "company_id": str(user.company_id) if user.company_id else None}}
