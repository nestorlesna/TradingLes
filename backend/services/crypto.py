"""
Fernet encryption for private keys.
Salt is stored in app_config table; master password is never persisted.
"""
import os
import base64
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


def generate_salt() -> bytes:
    return os.urandom(16)


def salt_to_hex(salt: bytes) -> str:
    return salt.hex()


def salt_from_hex(hex_str: str) -> bytes:
    return bytes.fromhex(hex_str)


def _derive_fernet(master_password: str, salt: bytes) -> Fernet:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=480_000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(master_password.encode("utf-8")))
    return Fernet(key)


def encrypt_key(plaintext: str, master_password: str, salt: bytes) -> str:
    """Encrypt a private key string. Returns base64 Fernet token."""
    fernet = _derive_fernet(master_password, salt)
    return fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_key(token: str, master_password: str, salt: bytes) -> str:
    """Decrypt a Fernet token. Raises ValueError on wrong password."""
    try:
        fernet = _derive_fernet(master_password, salt)
        return fernet.decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        raise ValueError("Contraseña maestra incorrecta")
