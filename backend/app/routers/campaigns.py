from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, log_action
from ..models import AccessLevel, Campaign, User
from ..permissions import assert_menu_access, user_is_management
from ..schemas import CampaignCreate, CampaignUpdate

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def _serialize(c: Campaign) -> dict:
    return {
        "id": c.id,
        "title": c.title,
        "description": c.description,
        "special_price_info": c.special_price_info,
        "start_date": c.start_date.isoformat(),
        "end_date": c.end_date.isoformat(),
        "active": c.active,
    }


@router.get("")
def list_campaigns(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_menu_access(db, user, "campanhas", AccessLevel.read)
    rows = db.query(Campaign).filter(Campaign.company_id == user.company_id).order_by(Campaign.start_date.desc()).all()
    return [_serialize(c) for c in rows]


@router.post("")
def create_campaign(payload: CampaignCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not user_is_management(user):
        raise HTTPException(403, "Campanhas permitidas somente para Gerência")
    assert_menu_access(db, user, "campanhas", AccessLevel.write)
    c = Campaign(company_id=user.company_id, **payload.model_dump())
    db.add(c)
    db.flush()
    log_action(db, user, "create", "campaigns", c.id, request=request)
    db.commit()
    return _serialize(c)


@router.put("/{campaign_id}")
def update_campaign(
    campaign_id: int,
    payload: CampaignUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user_is_management(user):
        raise HTTPException(403, "Campanhas permitidas somente para Gerência")
    c = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.company_id == user.company_id).first()
    if not c:
        raise HTTPException(404, "Campanha não encontrada")
    for k, v in payload.model_dump().items():
        setattr(c, k, v)
    log_action(db, user, "update", "campaigns", c.id, request=request)
    db.commit()
    return _serialize(c)
