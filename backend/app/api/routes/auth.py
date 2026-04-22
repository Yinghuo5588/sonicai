"""Authentication routes."""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import User, AuthSession, SystemSettings
from app.core.security import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_token,
)
from app.api.deps import CurrentUser

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


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
async def login(body: LoginRequest, db: AsyncSession = get_db.__wrapped__()):
    async with db as session:
        result = await session.execute(select(User).where(User.username == body.username))
        user = result.scalar_one_or_none()

        if not user or not verify_password(body.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is disabled")

        access_token = create_access_token({"sub": str(user.id)})
        refresh_token = create_refresh_token({"sub": str(user.id)})

        # Store refresh token hash
        from app.core.security import hash_password as _hash
        session_obj = AuthSession(
            user_id=user.id,
            refresh_token_hash=_hash(refresh_token),
            expires_at=__import__("datetime").datetime.now().__add__(__import__("datetime").timedelta(days=7)),
        )
        session.add(session_obj)
        user.last_login_at = __import__("datetime").datetime.now()
        await session.commit()

        return LoginResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=LoginResponse)
async def refresh(refresh_token: str, db: AsyncSession = get_db.__wrapped__()):
    token_data = decode_token(refresh_token)
    if not token_data or token_data.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    async with db as session:
        user_id = int(token_data["sub"])
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

        access_token = create_access_token({"sub": str(user.id)})
        new_refresh = create_refresh_token({"sub": str(user.id)})

        # Replace session
        from app.core.security import hash_password as _hash
        # Revoke old sessions for this user
        await session.execute(
            AuthSession.__table__.update()
            .where(AuthSession.user_id == user_id)
            .values(revoked_at=__import__("datetime").datetime.now())
        )
        session.add(AuthSession(
            user_id=user.id,
            refresh_token_hash=_hash(new_refresh),
            expires_at=__import__("datetime").datetime.now().__add__(__import__("datetime").timedelta(days=7)),
        ))
        await session.commit()

        return LoginResponse(access_token=access_token, refresh_token=new_refresh)


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: CurrentUser):
    return UserInfo.model_validate(current_user)


@router.post("/change-password")
async def change_password(body: ChangePasswordRequest, current_user: CurrentUser, db: AsyncSession = get_db.__wrapped__):
    async with db as session:
        result = await session.execute(select(User).where(User.id == current_user.id))
        user = result.scalar_one()
        if not verify_password(body.old_password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Old password is incorrect")
        user.password_hash = hash_password(body.new_password)
        await session.commit()
        return {"message": "Password updated"}


@router.post("/logout")
async def logout(current_user: CurrentUser, db: AsyncSession = get_db.__wrapped__):
    async with db as session:
        await session.execute(
            AuthSession.__table__.update()
            .where(AuthSession.user_id == current_user.id)
            .values(revoked_at=__import__("datetime").datetime.now())
        )
        await session.commit()
        return {"message": "Logged out"}