from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, log_action
from ..models import AccessLevel, Client, User
from ..permissions import assert_menu_access
from ..input_sanitize import sanitize_search_term
from ..schemas import ClientCreate, ClientUpdate

router = APIRouter(prefix="/clients", tags=["clients"])


def _serialize(c: Client) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "document": c.document,
        "phone": c.phone,
        "email": c.email,
        "address": c.address,
        "city": c.city,
        "state": c.state,
        "notes": c.notes,
        "active": c.active,
    }


@router.get("")
def list_clients(q: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_menu_access(db, user, "clientes", AccessLevel.read)
    query = db.query(Client).filter(Client.company_id == user.company_id)
    q = sanitize_search_term(q)
    if q:
        like = f"%{q}%"
        query = query.filter((Client.name.ilike(like)) | (Client.document.ilike(like)))
    return [_serialize(c) for c in query.order_by(Client.name).all()]


@router.post("")
def create_client(payload: ClientCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_menu_access(db, user, "clientes", AccessLevel.write)
    c = Client(company_id=user.company_id, **payload.model_dump())
    db.add(c)
    db.flush()
    log_action(db, user, "create", "clients", c.id, after=_serialize(c), request=request)
    db.commit()
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
    c = db.query(Client).filter(Client.id == client_id, Client.company_id == user.company_id).first()
    if not c:
        raise HTTPException(404, "Cliente não encontrado")
    before = _serialize(c)
    for k, v in payload.model_dump().items():
        setattr(c, k, v)
    log_action(db, user, "update", "clients", c.id, before=before, after=_serialize(c), request=request)
    db.commit()
    return _serialize(c)
