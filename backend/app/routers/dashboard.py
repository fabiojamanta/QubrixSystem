from datetime import timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..business_rules import profitability_for_price
from ..database import get_db
from ..datetime_utils import now_br, today_br
from ..deps import get_current_user
from ..models import (
    Campaign, InfoBoardItem, Product, Quote, QuoteItem, QuoteStatus, Sale, StockLot, User, LostReason
)
from ..permissions import require_menu_access, user_is_management
from ..models import AccessLevel

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def dashboard_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("dashboard", AccessLevel.read)),
):
    today = today_br()
    company_id = user.company_id

    campaigns = (
        db.query(Campaign)
        .filter(
            Campaign.company_id == company_id,
            Campaign.active == True,
            Campaign.start_date <= today,
            Campaign.end_date >= today,
        )
        .order_by(Campaign.end_date)
        .all()
    )

    info_items = (
        db.query(InfoBoardItem)
        .filter(InfoBoardItem.company_id == company_id, InfoBoardItem.active == True)
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

    expiry_buckets = {30: 0, 90: 0, 180: 0}
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
            expiry_buckets[30] += 1
        elif days <= 90:
            expiry_buckets[90] += 1
        elif days <= 180:
            expiry_buckets[180] += 1

    return {
        "campaigns": [
            {
                "id": c.id,
                "title": c.title,
                "description": c.description,
                "special_price_info": c.special_price_info,
                "start_date": c.start_date.isoformat(),
                "end_date": c.end_date.isoformat(),
            }
            for c in campaigns
        ],
        "info_board": [{"id": i.id, "title": i.title, "content": i.content} for i in info_items],
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
        "expiry_alerts": expiry_buckets,
    }
