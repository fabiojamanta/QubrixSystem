from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, log_action
from ..models import AccessLevel, InfoBoardItem, User
from ..permissions import assert_menu_access, user_is_management
from ..schemas import InfoBoardItemCreate, InfoBoardItemUpdate

router = APIRouter(prefix="/info-board", tags=["info-board"])


def _serialize(i: InfoBoardItem) -> dict:
    return {"id": i.id, "title": i.title, "content": i.content, "active": i.active}


@router.get("")
def list_items(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_menu_access(db, user, "informacoes", AccessLevel.read)
    rows = (
        db.query(InfoBoardItem)
        .filter(InfoBoardItem.company_id == user.company_id)
        .order_by(InfoBoardItem.created_at.desc())
        .all()
    )
    return [_serialize(i) for i in rows]


@router.post("")
def create_item(payload: InfoBoardItemCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not user_is_management(user):
        raise HTTPException(403, "Quadro de informações permitido somente para Gerência")
    assert_menu_access(db, user, "informacoes", AccessLevel.write)
    item = InfoBoardItem(company_id=user.company_id, **payload.model_dump())
    db.add(item)
    db.flush()
    log_action(db, user, "create", "info_board", item.id, request=request)
    db.commit()
    return _serialize(item)


@router.put("/{item_id}")
def update_item(
    item_id: int,
    payload: InfoBoardItemUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user_is_management(user):
        raise HTTPException(403, "Quadro de informações permitido somente para Gerência")
    item = db.query(InfoBoardItem).filter(InfoBoardItem.id == item_id, InfoBoardItem.company_id == user.company_id).first()
    if not item:
        raise HTTPException(404, "Informação não encontrada")
    for k, v in payload.model_dump().items():
        setattr(item, k, v)
    log_action(db, user, "update", "info_board", item.id, request=request)
    db.commit()
    return _serialize(item)
