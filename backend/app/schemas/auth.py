from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
import re


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

   @field_validator("password")
@classmethod
def validate_password(cls, v: str) -> str:
    if len(v) < 10:
        raise ValueError("Password deve ter pelo menos 10 caracteres")
    if len(v.encode("utf-8")) > 72:
        raise ValueError("Password não pode exceder 72 bytes")
    if not re.search(r"[A-Z]", v):
        raise ValueError("Password deve conter pelo menos uma maiúscula")
    if not re.search(r"[a-z]", v):
        raise ValueError("Password deve conter pelo menos uma minúscula")
    if not re.search(r"\d", v):
        raise ValueError("Password deve conter pelo menos um número")
    if not re.search(r"[^A-Za-z0-9]", v):
        raise ValueError("Password deve conter pelo menos um caractere especial")
    return v

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Nome deve ter pelo menos 2 caracteres")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    mfa_code: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    full_name: str
    email: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    is_active: bool
    mfa_enabled: bool

    class Config:
        from_attributes = True


class MFASetupResponse(BaseModel):
    secret: str
    qr_code: str
    backup_codes: list[str]


class MFAVerifyRequest(BaseModel):
    code: str
