from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os

SECRET_KEY = os.getenv("CRYPTO_KEY", "default-secret-key").encode("utf-8")


def get_fernet_key(key: bytes) -> bytes:
    # Generate a secure key using PBKDF2
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"static_salt",  # In production, use a proper salt
        iterations=100000,
    )
    key = base64.b64encode(kdf.derive(key))
    return key


def decrypt_text(encrypted_text: str) -> str:
    if not encrypted_text:
        return ""

    try:
        key = get_fernet_key(SECRET_KEY)
        f = Fernet(key)
        decrypted = f.decrypt(encrypted_text.encode())
        return decrypted.decode("utf-8")
    except Exception as e:
        print(f"Decryption error: {str(e)}")
        return ""
