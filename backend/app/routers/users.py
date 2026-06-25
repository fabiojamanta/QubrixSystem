from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import get_current_user, log_action
from ..datetime_utils import now_br
from ..models import AccessLevel, Profile, User
from ..permissions import assert_menu_access, user_is_management, profile_to_dict
from ..input_sanitize import sanitize_search_term
from ..schemas import UserCreate, UserUpdate
from ..security import get_password_hash, validate_password_strength

router = APIRouter(prefix="/users", tags=["users"])


def _serialize(u: User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "active": u.active,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "updated_at": u.updated_at.isoformat() if u.updated_at else None,
        "profile": profile_to_dict(u.profile) if u.profile else None,
    }


@router.get("/profiles")
def list_profiles(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_menu_access(db, user, "usuarios", AccessLevel.read)
    rows = db.query(Profile).filter(Profile.company_id == user.company_id, Profile.active == True).all()
    return [profile_to_dict(p) for p in rows]


@router.get("")
def list_users(
    q: str | None = None,
    profile_id: int | None = None,
    active: bool | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assert_menu_access(db, user, "usuarios", AccessLevel.read)
    query = (
        db.query(User)
        .options(joinedload(User.profile))
        .filter(User.company_id == user.company_id)
    )
    q = sanitize_search_term(q)
    if q:
        like = f"%{q}%"
        query = query.filter((User.name.ilike(like)) | (User.email.ilike(like)))
    if profile_id:
        query = query.filter(User.profile_id == profile_id)
    if active is not None:
        query = query.filter(User.active == active)
    rows = query.order_by(User.name).all()
    return [_serialize(u) for u in rows]


@router.post("")
def create_user(payload: UserCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not user_is_management(user):
        raise HTTPException(403, "Usuários permitidos somente para Gerência")
    assert_menu_access(db, user, "usuarios", AccessLevel.write)
    if db.query(User).filter(User.company_id == user.company_id, User.email == payload.email).first():
        raise HTTPException(400, "Email já cadastrado")
    profile = db.query(Profile).filter(Profile.id == payload.profile_id, Profile.company_id == user.company_id).first()
    if not profile:
        raise HTTPException(400, "Perfil inválido")
    validate_password_strength(payload.password)
    now = now_br()
    u = User(
        company_id=user.company_id,
        name=payload.name,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        profile_id=payload.profile_id,
        active=payload.active,
        created_at=now,
        updated_at=now,
    )
    db.add(u)
    db.flush()
    db.refresh(u, ["profile"])
    log_action(db, user, "create", "users", u.id, request=request)
    db.commit()
    return _serialize(u)


@router.put("/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user_is_management(user):
        raise HTTPException(403, "Usuários permitidos somente para Gerência")
    assert_menu_access(db, user, "usuarios", AccessLevel.write)
    u = (
        db.query(User)
        .options(joinedload(User.profile))
        .filter(User.id == user_id, User.company_id == user.company_id)
        .first()
    )
    if not u:
        raise HTTPException(404, "Usuário não encontrado")
    data = payload.model_dump(exclude_unset=True)
    if "password" in data and data["password"]:
        validate_password_strength(data["password"])
        u.password_hash = get_password_hash(data.pop("password"))
    elif "password" in data:
        data.pop("password")
    for k, v in data.items():
        if k == "profile_id" and v is not None:
            profile = db.query(Profile).filter(Profile.id == v, Profile.company_id == user.company_id).first()
            if not profile:
                raise HTTPException(400, "Perfil inválido")
        setattr(u, k, v)
    u.updated_at = now_br()
    log_action(db, user, "update", "users", u.id, request=request)
    db.commit()
    return _serialize(u)
