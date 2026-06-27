from datetime import timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..datetime_utils import today_br
from ..deps import get_current_user
from ..models import (
    AccessLevel,
    Campaign,
    InfoBoardItem,
    Product,
    Quote,
    QuoteStatus,
    Sale,
    StockLot,
    User,
    LostReason,
)
from ..permissions import require_menu_access, user_is_management

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _campaigns_for_dashboard(db: Session, company_id: int, today) -> list[dict]:
    rows = (
        db.query(Campaign)
        .filter(Campaign.company_id == company_id, Campaign.active == True)
        .order_by(Campaign.start_date)
        .all()
    )
    items = []
    for campaign in rows:
        is_active = campaign.start_date <= today <= campaign.end_date
        is_early_notice = False
        starts_in_days = None
        if not is_active and campaign.show_early_notice and campaign.early_notice_days and campaign.start_date > today:
            notice_start = campaign.start_date - timedelta(days=campaign.early_notice_days)
            if notice_start <= today < campaign.start_date:
                is_early_notice = True
                starts_in_days = (campaign.start_date - today).days
        if not is_active and not is_early_notice:
            continue
        items.append(
            {
                "id": campaign.id,
                "title": campaign.title,
                "description": campaign.description,
                "special_price_info": campaign.special_price_info,
                "start_date": campaign.start_date.isoformat(),
                "end_date": campaign.end_date.isoformat(),
                "is_early_notice": is_early_notice,
                "starts_in_days": starts_in_days,
            }
        )
    return items


@router.get("")
def dashboard_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("dashboard", AccessLevel.read)),
):
    today = today_br()
    company_id = user.company_id

    campaigns = _campaigns_for_dashboard(db, company_id, today)

    info_items = (
        db.query(InfoBoardItem)
        .filter(
            InfoBoardItem.company_id == company_id,
            InfoBoardItem.active == True,
            or_(InfoBoardItem.start_date.is_(None), InfoBoardItem.start_date <= today),
            or_(InfoBoardItem.end_date.is_(None), InfoBoardItem.end_date >= today),
        )
        .order_by(InfoBoardItem.created_at.desc())
        .limit(10)
        .all()
    )

    since_30 = today - timedelta(days=30)
    quotes_q = db.query(Quote).filter(Quote.company_id == company_id, Quote.created_at >= since_30)
    if not user_is_management(user):
        quotes_q = quotes_q.filter(Quote.user_id == user.id)

    quotes_30 = quotes_q.count()
    open_quotes = quotes_q.filter(Quote.status == QuoteStatus.aberta).count()
    lost_quotes = quotes_q.filter(Quote.status == QuoteStatus.perdida).count()

    lost_by_reason = {}
    for reason in LostReason:
        lost_by_reason[reason.value] = quotes_q.filter(
            Quote.status == QuoteStatus.perdida, Quote.lost_reason == reason
        ).count()

    sales_q = db.query(Sale).filter(Sale.company_id == company_id)
    if not user_is_management(user):
        sales_q = sales_q.filter(Sale.user_id == user.id)

    month_start = today.replace(day=1)
    sales_month = sales_q.filter(Sale.sale_date >= month_start).all()
    month_total = sum(Decimal(str(s.total_amount or 0)) for s in sales_month)

    last_year_start = month_start.replace(year=month_start.year - 1)
    last_year_end = today.replace(year=today.year - 1)
    sales_last_year = sales_q.filter(Sale.sale_date >= last_year_start, Sale.sale_date <= last_year_end).all()
    last_year_total = sum(Decimal(str(s.total_amount or 0)) for s in sales_last_year)

    sales_3m = []
    for i in range(2, -1, -1):
        ref = (today.replace(day=1) - timedelta(days=i * 28)).replace(day=1)
        nxt = (ref.replace(day=28) + timedelta(days=4)).replace(day=1)
        total = sum(
            Decimal(str(s.total_amount or 0))
            for s in sales_q.filter(Sale.sale_date >= ref, Sale.sale_date < nxt).all()
        )
        sales_3m.append({"month": ref.strftime("%Y-%m"), "total": float(total)})

    expiry_alerts = {30: 0, 90: 0, 180: 0}
    expiry_items = []
    lots = (
        db.query(StockLot)
        .join(Product)
        .filter(StockLot.company_id == company_id, StockLot.active == True, StockLot.quantity > 0)
        .all()
    )
    for lot in lots:
        if not lot.expiry_date:
            continue
        days = (lot.expiry_date - today).days
        if days < 0:
            continue
        if days <= 30:
            bucket = 30
        elif days <= 90:
            bucket = 90
        elif days <= 180:
            bucket = 180
        else:
            continue
        expiry_alerts[bucket] += 1
        p = lot.product
        expiry_items.append(
            {
                "id": lot.id,
                "code": p.code if p else "",
                "short_description": p.short_description if p else "",
                "lot_number": lot.lot_number,
                "quantity": float(lot.quantity or 0),
                "expiry_date": lot.expiry_date.isoformat(),
                "days_until_expiry": days,
                "bucket": bucket,
            }
        )
    expiry_items.sort(key=lambda x: x["days_until_expiry"])

    return {
        "campaigns": campaigns,
        "info_board": [
            {
                "id": i.id,
                "title": i.title,
                "content": i.content,
                "start_date": i.start_date.isoformat() if i.start_date else None,
                "end_date": i.end_date.isoformat() if i.end_date else None,
            }
            for i in info_items
        ],
        "quotes_summary": {
            "generated_30_days": quotes_30,
            "open_without_finish": open_quotes,
            "expired_lost": lost_quotes,
            "lost_by_reason": lost_by_reason,
        },
        "sales_summary": {
            "month_total": float(month_total),
            "last_year_same_period": float(last_year_total),
            "last_3_months": sales_3m,
        },
        "expiry_alerts": expiry_alerts,
        "expiry_items": expiry_items,
    }
