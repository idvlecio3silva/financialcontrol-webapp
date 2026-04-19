from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    UserResponse,
)
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_client_ip,
)
from app.core.dependencies import get_current_user
from app.services.audit_service import log_action
from app.models.audit_log import AuditAction

router = APIRouter(prefix="/auth", tags=["Autenticação"])

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(User).where(User.email == payload.email.lower())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email já registado",
        )

    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        is_active=True,
        is_superuser=False,
        mfa_enabled=False,
        failed_login_attempts=0,
    )

    db.add(user)
    await db.flush()
    await db.refresh(user)

    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        mfa_enabled=user.mfa_enabled,
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = get_client_ip(request)

    r = await db.execute(
        select(User).where(User.email == payload.email.lower())
    )
    user = r.scalar_one_or_none()

    if not user:
        await log_action(
            db,
            user_id=None,
            action=AuditAction.LOGIN_FAILED,
            entity_type="auth",
            new_values={"email": payload.email},
            ip_address=ip,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )

    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        await log_action(
            db,
            user_id=user.id,
            action=AuditAction.LOGIN_LOCKED,
            entity_type="auth",
            ip_address=ip,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Conta bloqueada até {user.locked_until.isoformat()}",
        )

    if not verify_password(payload.password, user.hashed_password):
        user.failed_login_attempts += 1

        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = datetime.now(timezone.utc) + timedelta(
                minutes=LOCKOUT_MINUTES
            )

        await log_action(
            db,
            user_id=user.id,
            action=AuditAction.LOGIN_FAILED,
            entity_type="auth",
            new_values={"attempts": user.failed_login_attempts},
            ip_address=ip,
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta inactiva",
        )

    if user.mfa_enabled:
        if not payload.mfa_code:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Código MFA obrigatório",
            )

        import pyotp

        totp = pyotp.TOTP(user.mfa_secret)
        if not totp.verify(payload.mfa_code, valid_window=1):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Código MFA inválido",
            )

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = ip

    await log_action(
        db,
        user_id=user.id,
        action=AuditAction.LOGIN,
        entity_type="auth",
        ip_address=ip,
    )

    token_data = {"sub": str(user.id)}

    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user_id=str(user.id),
        full_name=user.full_name,
        email=user.email,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    decoded = decode_token(payload.refresh_token)

    if decoded.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de refresh inválido",
        )

    import uuid

    r = await db.execute(
        select(User).where(User.id == uuid.UUID(decoded["sub"]))
    )
    user = r.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilizador inválido",
        )

    token_data = {"sub": str(user.id)}

    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user_id=str(user.id),
        full_name=user.full_name,
        email=user.email,
    )


@router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await log_action(
        db,
        user_id=current_user.id,
        action=AuditAction.LOGOUT,
        entity_type="auth",
        ip_address=get_client_ip(request),
    )

    return {"message": "Sessão terminada com sucesso"}


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
