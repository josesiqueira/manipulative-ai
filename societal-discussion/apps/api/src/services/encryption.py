"""
Encryption service for securely storing API keys.

Uses Fernet symmetric encryption with a key derived from ENCRYPTION_SECRET
using PBKDF2.
"""

import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from ..config import get_settings


# Salt for key derivation (fixed for consistency)
_SALT = b"societal_discussion_api_key_salt"


def _get_encryption_key() -> bytes:
    """
    Derive a Fernet-compatible key from the ENCRYPTION_SECRET environment variable.

    Uses PBKDF2 with SHA256 to derive a 32-byte key, then base64 encodes it
    for Fernet compatibility.
    """
    settings = get_settings()
    secret = settings.encryption_secret

    if not secret:
        raise ValueError(
            "ENCRYPTION_SECRET environment variable is not set. "
            "Please set it to a secure random string."
        )

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_SALT,
        iterations=480000,
    )

    key = kdf.derive(secret.encode())
    return base64.urlsafe_b64encode(key)


def encrypt_api_key(plaintext: str) -> str:
    """
    Encrypt an API key using Fernet encryption.

    Args:
        plaintext: The API key to encrypt

    Returns:
        The encrypted API key as a base64-encoded string
    """
    if not plaintext:
        raise ValueError("Cannot encrypt empty API key")

    key = _get_encryption_key()
    fernet = Fernet(key)
    encrypted = fernet.encrypt(plaintext.encode())
    return encrypted.decode()


def decrypt_api_key(ciphertext: str) -> str:
    """
    Decrypt an encrypted API key.

    Args:
        ciphertext: The encrypted API key (base64-encoded)

    Returns:
        The decrypted API key
    """
    if not ciphertext:
        raise ValueError("Cannot decrypt empty ciphertext")

    key = _get_encryption_key()
    fernet = Fernet(key)
    decrypted = fernet.decrypt(ciphertext.encode())
    return decrypted.decode()


def generate_key_preview(api_key: str) -> str:
    """
    Generate a preview of an API key for display purposes.

    Shows the first 6 characters followed by asterisks.

    Args:
        api_key: The API key to generate a preview for

    Returns:
        A preview string like "sk-abc1******"
    """
    if not api_key:
        return ""

    if len(api_key) <= 6:
        return "*" * len(api_key)

    return api_key[:6] + "******"
