"""Helpers de permissão por perfil e menu."""
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .deps import get_current_user
from .models import AccessLevel, Profile, ProfilePermission, User

_LEVEL_RANK = {AccessLevel.hidden: 0, AccessLevel.read: 1, AccessLevel.write: 2}


def user_is_admin(user: User) -> bool:
    return bool(user.profile and user.profile.is_admin)


def user_is_management(user: User) -> bool:
    return bool(user.profile and (user.profile.is_admin or user.profile.is_management))


def get_profile_permissions(db: Session, profile_id: int) -> dict[str, str]:
    profile = db.query(Profile).filter_by(id=profile_id).first()
    if not profile:
        return {}
    if profile.is_admin:
        return {p.menu_key: "write" for p in db.query(ProfilePermission).all()}
    rows = db.query(ProfilePermission).filter_by(profile_id=profile_id).all()
    return {r.menu_key: r.access_level.value for r in rows}


def get_user_permissions(db: Session, user: User) -> dict[str, str]:
    return get_profile_permissions(db, user.profile_id)


def has_menu_access(permissions: dict[str, str], menu_key: str, min_level: AccessLevel, is_admin=False) -> bool:
    if is_admin:
        return True
    level_str = permissions.get(menu_key, "hidden")
    try:
        level = AccessLevel(level_str)
    except ValueError:
        level = AccessLevel.hidden
    return _LEVEL_RANK[level] >= _LEVEL_RANK[min_level]


def require_menu_access(menu_key: str, min_level: AccessLevel):
    def checker(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        if user_is_admin(user):
            return user
        perms = get_user_permissions(db, user)
        if not has_menu_access(perms, menu_key, min_level):
            raise HTTPException(403, "Acesso negado")
        return user
    return checker


def assert_menu_access(db: Session, user: User, menu_key: str, min_level: AccessLevel) -> None:
    if user_is_admin(user):
        return
    perms = get_user_permissions(db, user)
    if not has_menu_access(perms, menu_key, min_level):
        raise HTTPException(403, "Acesso negado")


def profile_to_dict(profile: Profile) -> dict:
    return {
        "id": profile.id,
        "name": profile.name,
        "slug": profile.slug,
        "is_admin": profile.is_admin,
        "is_management": profile.is_management,
    }
