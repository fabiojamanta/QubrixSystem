from fastapi import HTTPException
from sqlalchemy.orm import Session

from .config import settings
from .datetime_utils import now_br
from .models import LoginLockout


def check_login_allowed(db: Session, email: str) -> None:
    row = db.query(LoginLockout).filter_by(email=email.lower().strip()).first()
    if not row or not row.locked_until:
        return
    if row.locked_until > now_br():
        raise HTTPException(
            status_code=429,
            detail=f"Conta temporariamente bloqueada. Tente novamente em alguns minutos.",
        )
    row.failed_count = 0
    row.locked_until = None
    db.flush()


def record_failed_login(db: Session, email: str) -> None:
    key = email.lower().strip()
    row = db.query(LoginLockout).filter_by(email=key).first()
    if not row:
        row = LoginLockout(email=key, failed_count=0)
        db.add(row)
        db.flush()
    row.failed_count = (row.failed_count or 0) + 1
    row.last_attempt = now_br()
    if row.failed_count >= settings.LOGIN_MAX_ATTEMPTS:
        row.locked_until = now_br() + settings.login_lockout_timedelta()
    db.flush()


def clear_login_lockout(db: Session, email: str) -> None:
    row = db.query(LoginLockout).filter_by(email=email.lower().strip()).first()
    if row:
        row.failed_count = 0
        row.locked_until = None
        db.flush()
