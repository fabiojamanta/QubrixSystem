from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import get_current_user, log_action
from ..models import AccessLevel, Client, ClientContact, Profile, User
from ..permissions import assert_menu_access, user_is_management
from ..input_sanitize import sanitize_search_term
from ..schemas import ClientCreate, ClientUpdate

router = APIRouter(prefix="/clients", tags=["clients"])


def _serialize_contact(contact: ClientContact) -> dict:
    return {
        "id": contact.id,
        "name": contact.name,
        "phone": contact.phone,
        "email": contact.email,
        "sort_order": contact.sort_order,
    }


def _serialize(c: Client) -> dict:
    return {
        "id": c.id,
        "registration_number": c.registration_number,
        "name": c.name,
        "document": c.document,
        "phone": c.phone,
        "email": c.email,
        "address": c.address,
        "city": c.city,
        "state": c.state,
        "notes": c.notes,
        "responsible_user_id": c.responsible_user_id,
        "responsible_user_name": c.responsible_user.name if c.responsible_user else None,
        "contacts": [_serialize_contact(contact) for contact in c.contacts],
        "active": c.active,
    }


def _validate_responsible_user(db: Session, user: User, responsible_user_id: int | None) -> None:
    if responsible_user_id is None:
        return
    seller = (
        db.query(User)
        .join(Profile)
        .filter(
            User.id == responsible_user_id,
            User.company_id == user.company_id,
            User.active == True,
            Profile.slug == "vendedor",
        )
        .first()
    )
    if not seller:
        raise HTTPException(400, "Vendedor responsável inválido")


def _sync_contacts(client: Client, contacts: list) -> None:
    client.contacts.clear()
    for index, contact in enumerate(contacts[:3]):
        data = contact.model_dump() if hasattr(contact, "model_dump") else contact
        if not any(data.get(field) for field in ("name", "phone", "email")):
            continue
        client.contacts.append(
            ClientContact(
                name=data.get("name"),
                phone=data.get("phone"),
                email=data.get("email"),
                sort_order=index,
            )
        )


@router.get("/sellers")
def list_sellers(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_menu_access(db, user, "clientes", AccessLevel.read)
    rows = (
        db.query(User)
        .join(Profile)
        .filter(
            User.company_id == user.company_id,
            User.active == True,
            Profile.slug == "vendedor",
        )
        .order_by(User.name)
        .all()
    )
    return [{"id": u.id, "name": u.name} for u in rows]


@router.get("")
def list_clients(q: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_menu_access(db, user, "clientes", AccessLevel.read)
    query = (
        db.query(Client)
        .options(joinedload(Client.contacts), joinedload(Client.responsible_user))
        .filter(Client.company_id == user.company_id)
    )
    if not user_is_management(user):
        query = query.filter(Client.responsible_user_id == user.id)
    q = sanitize_search_term(q)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (Client.name.ilike(like))
            | (Client.document.ilike(like))
            | (Client.registration_number.ilike(like))
        )
    return [_serialize(c) for c in query.order_by(Client.name).all()]


@router.post("")
def create_client(payload: ClientCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_menu_access(db, user, "clientes", AccessLevel.write)
    _validate_responsible_user(db, user, payload.responsible_user_id)
    data = payload.model_dump(exclude={"contacts"})
    c = Client(company_id=user.company_id, **data)
    db.add(c)
    db.flush()
    c.registration_number = f"{c.id:06d}"
    _sync_contacts(c, payload.contacts)
    db.flush()
    log_action(db, user, "create", "clients", c.id, after=_serialize(c), request=request)
    db.commit()
    db.refresh(c, ["contacts", "responsible_user"])
    return _serialize(c)


@router.put("/{client_id}")
def update_client(
    client_id: int,
    payload: ClientUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assert_menu_access(db, user, "clientes", AccessLevel.write)
    c = (
        db.query(Client)
        .options(joinedload(Client.contacts), joinedload(Client.responsible_user))
        .filter(Client.id == client_id, Client.company_id == user.company_id)
        .first()
    )
    if not c:
        raise HTTPException(404, "Cliente não encontrado")
    _validate_responsible_user(db, user, payload.responsible_user_id)
    before = _serialize(c)
    data = payload.model_dump(exclude={"contacts"})
    for key, value in data.items():
        setattr(c, key, value)
    _sync_contacts(c, payload.contacts)
    log_action(db, user, "update", "clients", c.id, before=before, after=_serialize(c), request=request)
    db.commit()
    db.refresh(c, ["contacts", "responsible_user"])
    return _serialize(c)
