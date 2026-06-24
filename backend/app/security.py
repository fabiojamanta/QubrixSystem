import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .config import settings
from .datetime_utils import now_br
from .models import RefreshToken, User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"
_PASSWORD_RE = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,}$")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def validate_password_strength(password: str) -> None:
    if not password or len(password) < 8:
        raise HTTPException(400, "Senha deve ter pelo menos 8 caracteres")
    if len(password) > 128:
        raise HTTPException(400, "Senha deve ter no máximo 128 caracteres")
    if not _PASSWORD_RE.match(password):
        raise HTTPException(400, "Senha deve conter letras e números")


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") not in (None, "access"):
            return None
        return payload
    except JWTError:
        return None


def generate_refresh_token_plain() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def store_refresh_token(db: Session, user_id: int, plain_token: str) -> RefreshToken:
    expires_at = now_br() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    row = RefreshToken(
        user_id=user_id,
        token_hash=hash_refresh_token(plain_token),
        expires_at=expires_at,
    )
    db.add(row)
    db.flush()
    return row


def revoke_refresh_token(db: Session, plain_token: str) -> None:
    token_hash = hash_refresh_token(plain_token)
    row = db.query(RefreshToken).filter_by(token_hash=token_hash, revoked_at=None).first()
    if row:
        row.revoked_at = now_br()


def revoke_all_user_refresh_tokens(db: Session, user_id: int) -> None:
    now = now_br()
    for row in db.query(RefreshToken).filter_by(user_id=user_id, revoked_at=None).all():
        row.revoked_at = now


def validate_refresh_token(db: Session, plain_token: str) -> User | None:
    token_hash = hash_refresh_token(plain_token)
    row = db.query(RefreshToken).filter_by(token_hash=token_hash, revoked_at=None).first()
    if not row or row.expires_at < now_br():
        return None
    user = db.query(User).filter_by(id=row.user_id, active=True).first()
    if not user:
        return None
    row.revoked_at = now_br()
    db.flush()
    return user
