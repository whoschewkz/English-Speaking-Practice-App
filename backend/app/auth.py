import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXP, REFRESH_TOKEN_EXP

# FIX: bcrypt__rounds=12 terlalu berat untuk dev; truncate_error=False agar tidak crash
# pada passlib 1.7.4 + bcrypt 4.x
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=10,
)
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(plain: str) -> str:
    # FIX: bcrypt max 72 bytes — truncate dulu untuk cegah ValueError
    plain_bytes = plain.encode("utf-8")[:72].decode("utf-8", errors="ignore")
    return pwd_context.hash(plain_bytes)


def verify_password(plain: str, hashed: str) -> bool:
    plain_bytes = plain.encode("utf-8")[:72].decode("utf-8", errors="ignore")
    return pwd_context.verify(plain_bytes, hashed)


def _create_token(data: dict, expires_delta: timedelta) -> str:
    payload = {
        **data,
        "exp": datetime.utcnow() + expires_delta,
        "iat": datetime.utcnow(),
        "jti": secrets.token_hex(16),  # unique ID per token — cegah UNIQUE constraint error
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(user_id: int, username: str, role: str) -> str:
    return _create_token(
        {"sub": str(user_id), "username": username, "role": role, "type": "access"},
        timedelta(minutes=ACCESS_TOKEN_EXP),
    )


def create_refresh_token(user_id: int, username: str) -> str:
    return _create_token(
        {"sub": str(user_id), "username": username, "type": "refresh"},
        timedelta(days=REFRESH_TOKEN_EXP),
    )


def verify_token(token: str, expected_type: str = "access") -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != expected_type:
            raise HTTPException(status_code=401, detail="Tipe token tidak valid")
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid atau sudah kadaluarsa",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token autentikasi diperlukan",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_token(credentials.credentials, expected_type="access")


def require_role(*roles: str):
    def _check(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Akses ditolak. Diperlukan role: {', '.join(roles)}",
            )
        return current_user
    return _check


require_admin  = require_role("admin")
require_rater  = require_role("rater1", "rater2")   # kedua rater bisa akses endpoint rater
require_rater1 = require_role("rater1")
require_rater2 = require_role("rater2")
require_user   = require_role("admin", "user", "rater1", "rater2")
