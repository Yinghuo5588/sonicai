"""Symmetric encryption for sensitive settings (e.g. Navidrome password)."""

import base64
import hashlib
import logging
import os

from cryptography.fernet import Fernet
from app.core.config import settings

logger = logging.getLogger(__name__)


def _fernet_from_secret(secret: str) -> Fernet:
    raw = hashlib.sha256(secret.encode()).digest()
    key = base64.urlsafe_b64encode(raw)
    return Fernet(key)


def _primary_secret() -> str:
    """
    Primary encryption secret.

    production: ENCRYPTION_KEY is required.
    development: ENCRYPTION_KEY is preferred, fallback to JWT_SECRET_KEY.
    """
    env = os.getenv("ENV", "development").lower()
    secret = settings.encryption_key

    if env == "production":
        if not secret:
            raise RuntimeError("ENCRYPTION_KEY must be set in production!")
        default_markers = ("dev-only", "change-in-production")
        if any(m in secret for m in default_markers):
            raise RuntimeError(
                "ENCRYPTION_KEY contains default marker — replace it for production!"
            )

    if not secret:
        secret = settings.jwt_secret_key or "fallback-dev-key"

    return secret


def _legacy_secret() -> str:
    """
    Legacy secret used by old versions:
    Navidrome password was encrypted using JWT_SECRET_KEY.
    """
    return settings.jwt_secret_key or "fallback-dev-key"


_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = _fernet_from_secret(_primary_secret())
    return _fernet


def encrypt_value(plain_text: str) -> str:
    """Encrypt a string, return base64-encoded ciphertext."""
    if not plain_text:
        return ""
    return _get_fernet().encrypt(plain_text.encode()).decode()


def decrypt_value(cipher_text: str) -> str:
    """
    Decrypt ciphertext.

    Try current ENCRYPTION_KEY first.
    If failed, fallback to legacy JWT_SECRET_KEY-derived key.
    """
    if not cipher_text:
        return ""

    try:
        return _get_fernet().decrypt(cipher_text.encode()).decode()
    except Exception:
        pass

    try:
        legacy = _fernet_from_secret(_legacy_secret())
        value = legacy.decrypt(cipher_text.encode()).decode()
        logger.warning(
            "Decrypted value using legacy JWT_SECRET_KEY-derived key. "
            "Please re-save settings to re-encrypt with ENCRYPTION_KEY."
        )
        return value
    except Exception:
        logger.warning("Decryption failed — returning empty string instead of ciphertext")
        return ""