from fastapi import Depends, HTTPException, status, Request, Cookie
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, joinedload
import json

from .database import get_db
from .security import decode_token
from .models import User, AuditLog
from .datetime_utils import now_br

_bearer = HTTPBearer(auto_error=False)


def _extract_token(credentials: HTTPAuthorizationCredentials | None, access_token: str | None) -> str | None:
    if credentials and credentials.credentials:
        return credentials.credentials
    if access_token:
        return access_token
    return None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    access_token: str | None = Cookie(None, alias="access_token"),
    db: Session = Depends(get_db),
):
    token = _extract_token(credentials, access_token)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado")
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    user = (
        db.query(User)
        .options(joinedload(User.profile))
        .filter(User.id == user_id, User.active == True)
        .first()
    )
    if not user:
        raise HTTPException(401, detail="Usuário não encontrado ou inativo")
    return user


def log_action(db, user, action, entity, entity_id, before=None, after=None, request=None, company_id=None):
    ip = request.client.host if request and request.client else None
    db.add(AuditLog(
        company_id=company_id or (user.company_id if user else 1),
        user_id=user.id if user else None,
        action=action,
        entity=entity,
        entity_id=entity_id,
        before_data=json.dumps(before, default=str, ensure_ascii=False) if before is not None else None,
        after_data=json.dumps(after, default=str, ensure_ascii=False) if after is not None else None,
        ip_address=ip,
        created_at=now_br(),
    ))


def log_failed_login(db, email, request=None):
    ip = request.client.host if request and request.client else None
    masked = email[:2] + "***" if email else "?"
    db.add(AuditLog(
        company_id=1,
        user_id=None,
        action="login_failed",
        entity="users",
        entity_id=None,
        after_data=json.dumps({"email_hint": masked}, ensure_ascii=False),
        ip_address=ip,
        created_at=now_br(),
    ))
