import hashlib
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select as sa_select
from sqlalchemy.orm import Session

from ..config import REFRESH_TOKEN_EXP
from ..database import get_db
from ..models import UserORM, RefreshTokenORM
from ..schemas import RegisterIn, LoginIn, TokenOut, RefreshIn, UserOut
from ..auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    verify_token, get_current_user,
)
from ..limiter import limiter

router = APIRouter(prefix="/auth")


@router.post("/register", response_model=UserOut, status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if db.execute(sa_select(UserORM).where(UserORM.username == payload.username)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username sudah digunakan")
    if db.execute(sa_select(UserORM).where(UserORM.email == payload.email)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")

    user = UserORM(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role="user",
        is_active=True,
    )
    db.add(user); db.commit(); db.refresh(user)
    return UserOut(id=user.id, username=user.username, email=user.email,
                   full_name=user.full_name, role=user.role, is_active=user.is_active)


@router.post("/login", response_model=TokenOut)
@limiter.limit("5/minute")
def login(request: Request, payload: LoginIn, db: Session = Depends(get_db)):
    user = db.execute(sa_select(UserORM).where(UserORM.username == payload.username)).scalar_one_or_none()
    # Pesan error generik (OWASP: jangan reveal apakah username/password yang salah)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan. Hubungi administrator.")

    user.last_login_at = datetime.utcnow()
    access_token  = create_access_token(user.id, user.username, user.role)
    refresh_token = create_refresh_token(user.id, user.username)

    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    db.add(RefreshTokenORM(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXP),
    ))
    db.commit()

    return TokenOut(access_token=access_token, refresh_token=refresh_token,
                    role=user.role, username=user.username)


@router.post("/refresh", response_model=TokenOut)
def refresh_token_endpoint(payload: RefreshIn, db: Session = Depends(get_db)):
    data    = verify_token(payload.refresh_token, expected_type="refresh")
    user_id = int(data["sub"])

    token_hash = hashlib.sha256(payload.refresh_token.encode()).hexdigest()
    rt_row = db.execute(
        sa_select(RefreshTokenORM).where(
            RefreshTokenORM.token_hash == token_hash,
            RefreshTokenORM.user_id   == user_id,
            RefreshTokenORM.revoked   == False,
        )
    ).scalar_one_or_none()
    if not rt_row:
        raise HTTPException(status_code=401, detail="Refresh token tidak valid atau sudah digunakan")

    user = db.get(UserORM, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User tidak ditemukan atau dinonaktifkan")

    # Rotate token (revoke lama, buat baru)
    rt_row.revoked = True
    new_access  = create_access_token(user.id, user.username, user.role)
    new_refresh = create_refresh_token(user.id, user.username)
    new_hash    = hashlib.sha256(new_refresh.encode()).hexdigest()
    db.add(RefreshTokenORM(
        user_id=user.id,
        token_hash=new_hash,
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXP),
    ))
    db.commit()

    return TokenOut(access_token=new_access, refresh_token=new_refresh,
                    role=user.role, username=user.username)


@router.post("/logout")
def logout(payload: RefreshIn, db: Session = Depends(get_db)):
    token_hash = hashlib.sha256(payload.refresh_token.encode()).hexdigest()
    rt_row = db.execute(
        sa_select(RefreshTokenORM).where(RefreshTokenORM.token_hash == token_hash)
    ).scalar_one_or_none()
    if rt_row:
        rt_row.revoked = True
        db.commit()
    return {"ok": True, "message": "Logout berhasil"}


@router.get("/me", response_model=UserOut)
def me(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.get(UserORM, int(current_user["sub"]))
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    return UserOut(id=user.id, username=user.username, email=user.email,
                   full_name=user.full_name, role=user.role, is_active=user.is_active)
