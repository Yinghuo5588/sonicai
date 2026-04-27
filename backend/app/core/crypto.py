"""Symmetric encryption for sensitive settings (e.g. Navidrome password)."""

import base64
import hashlib

from cryptography.fernet import Fernet
from app.core.config import settings


def _derive_key() -> bytes:
    """Derive Fernet key from JWT secret (deterministic, 32-byte base64)."""
    secret = settings.jwt_secret_key or "fallback-dev-key"
    raw = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(raw)


_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = Fernet(_derive_key())
    return _fernet


def encrypt_value(plain_text: str) -> str:
    """Encrypt a string, return base64-encoded ciphertext."""
    if not plain_text:
        return ""
    return _get_fernet().encrypt(plain_text.encode()).decode()


def decrypt_value(cipher_text: str) -> str:
    """Decrypt a base64-encoded ciphertext back to plain string."""
    if not cipher_text:
        return ""
    try:
        return _get_fernet().decrypt(cipher_text.encode()).decode()
    except Exception:
        # Backward compatibility: treat plaintext as plaintext
        return cipher_text
