"""Security utilities: password hashing and JWT handling."""

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

ACCESS_SECRET, REFRESH_SECRET = settings.get_jwt_secrets()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.jwt_access_token_expire_minutes))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, ACCESS_SECRET, algorithm="HS256")


def create_refresh_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=settings.jwt_refresh_token_expire_days))
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, REFRESH_SECRET, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, ACCESS_SECRET, algorithms=["HS256"])
    except JWTError:
        return None

def decode_refresh_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, REFRESH_SECRET, algorithms=["HS256"])
    except JWTError:
        return None

def decode_token(token: str) -> dict[str, Any] | None:
    return decode_access_token(token) or decode_refresh_token(token)