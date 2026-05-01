"""Authentication routes."""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import User, AuthSession
from app.core.config import settings
from app.core.security import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_token, decode_refresh_token,
)
from app.core.rate_limit import limiter
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


class ChangeUsernameRequest(BaseModel):
    password: str
    new_username: str = Field(min_length=3, max_length=50)


class UserInfo(BaseModel):
    id: int
    username: str
    email: str | None

    class Config:
        from_attributes = True


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
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
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days),
    )
    db.add(session_obj)
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    return LoginResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=LoginResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    token_data = decode_refresh_token(body.refresh_token)
    if not token_data or token_data.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = int(token_data["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Find valid sessions for user (not revoked, not expired)
    sessions_result = await db.execute(
        select(AuthSession).where(
            AuthSession.user_id == user_id,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > datetime.now(timezone.utc),
        )
    )
    sessions = sessions_result.scalars().all()

    # Verify refresh token hash against stored session
    matched_session = None
    for session_obj in sessions:
        if session_obj.refresh_token_hash and verify_password(body.refresh_token, session_obj.refresh_token_hash):
            matched_session = session_obj
            break

    if not matched_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session invalid or revoked")

    # Revoke only the current session, not all user sessions
    matched_session.revoked_at = datetime.now(timezone.utc)

    access_token = create_access_token({"sub": str(user.id)})
    new_refresh = create_refresh_token({"sub": str(user.id)})
    db.add(AuthSession(
        user_id=user.id,
        refresh_token_hash=hash_password(new_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days),
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
    # Revoke all existing sessions so old refresh tokens stop working
    await db.execute(
        AuthSession.__table__.update()
        .where(AuthSession.user_id == current_user.id)
        .values(revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return {"message": "Password updated"}


@router.post("/change-username", response_model=UserInfo)
async def change_username(
    body: ChangeUsernameRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    new_username = body.new_username.strip()
    if not new_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New username is required",
        )

    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is incorrect",
        )

    existing_result = await db.execute(
        select(User).where(
            User.username == new_username,
            User.id != current_user.id,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists",
        )

    user.username = new_username
    await db.commit()
    await db.refresh(user)

    return UserInfo.model_validate(user)


@router.post("/logout")
async def logout(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    await db.execute(
        AuthSession.__table__.update()
        .where(AuthSession.user_id == current_user.id)
        .values(revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return {"message": "Logged out"}
