"""Authentication routes."""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import User, AuthSession
from app.core.security import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_token,
)
from app.api.deps import CurrentUser

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=6)


class UserInfo(BaseModel):
    id: int
    username: str
    email: str | None

    class Config:
        from_attributes = True


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is disabled")

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    session_obj = AuthSession(
        user_id=user.id,
        refresh_token_hash=hash_password(refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(session_obj)
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    return LoginResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=LoginResponse)
async def refresh(refresh_token: str, db: AsyncSession = Depends(get_db)):
    token_data = decode_token(refresh_token)
    if not token_data or token_data.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = int(token_data["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    access_token = create_access_token({"sub": str(user.id)})
    new_refresh = create_refresh_token({"sub": str(user.id)})

    # Revoke old sessions
    await db.execute(
        AuthSession.__table__.update()
        .where(AuthSession.user_id == user_id)
        .values(revoked_at=datetime.now(timezone.utc))
    )
    db.add(AuthSession(
        user_id=user.id,
        refresh_token_hash=hash_password(new_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    ))
    await db.commit()

    return LoginResponse(access_token=access_token, refresh_token=new_refresh)


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: CurrentUser):
    return UserInfo.model_validate(current_user)


@router.post("/change-password")
async def change_password(body: ChangePasswordRequest, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Old password is incorrect")
    user.password_hash = hash_password(body.new_password)
    await db.commit()
    return {"message": "Password updated"}


@router.post("/logout")
async def logout(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    await db.execute(
        AuthSession.__table__.update()
        .where(AuthSession.user_id == current_user.id)
        .values(revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return {"message": "Logged out"}
