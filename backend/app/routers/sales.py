from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import get_current_user, log_action
from ..models import AccessLevel, Order, OrderItem, OrderStatus, Product, Quote, QuoteStatus, Sale, SaleItem, User
from ..permissions import assert_menu_access, user_is_management
from ..resource_checks import get_client_in_company, get_product_in_company
from ..schemas import SaleCreate

router = APIRouter(prefix="/sales", tags=["sales"])


def _serialize_sale(s: Sale, include_items=False) -> dict:
    data = {
        "id": s.id,
        "client_id": s.client_id,
        "client_name": s.client.name if s.client else "",
        "user_id": s.user_id,
        "user_name": s.user.name if s.user else "",
        "order_id": s.order_id,
        "invoice_number": s.invoice_number,
        "sale_date": s.sale_date.isoformat() if s.sale_date else None,
        "total_amount": float(s.total_amount or 0),
        "notes": s.notes,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }
    if include_items:
        data["items"] = [
            {
                "id": i.id,
                "product_id": i.product_id,
                "product_name": i.product.short_description if i.product else "",
                "code": i.product.code if i.product else "",
                "quantity": float(i.quantity or 0),
                "unit_price": float(i.unit_price or 0),
                "total_price": float(i.total_price or 0),
            }
            for i in s.items
        ]
    return data


def _apply_list_filters(
    query,
    *,
    user: User,
    db: Session,
    user_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    months: int | None = None,
):
    seller_name = "Todos"
    if not user_is_management(user):
        query = query.filter(Sale.user_id == user.id)
        seller_name = user.name
    elif user_id:
        seller = db.query(User).filter(User.id == user_id, User.company_id == user.company_id, User.active == True).first()
        if not seller:
            raise HTTPException(400, "Vendedor inválido")
        query = query.filter(Sale.user_id == user_id)
        seller_name = seller.name

    if date_from:
        query = query.filter(Sale.sale_date >= date_from)
    if date_to:
        query = query.filter(Sale.sale_date <= date_to)
    elif not date_from and months and months < 36:
        from ..datetime_utils import today_br
        from datetime import timedelta

        start = today_br().replace(day=1)
        for _ in range(months - 1):
            start = (start - timedelta(days=1)).replace(day=1)
        query = query.filter(Sale.sale_date >= start)

    return query, seller_name


def _format_period_label(date_from: str | None, date_to: str | None) -> str:
    if date_from and date_to:
        return f"{date_from} — {date_to}"
    if date_from:
        return f"A partir de {date_from}"
    if date_to:
        return f"Até {date_to}"
    return "Todo o período"


@router.get("")
def list_sales(
    months: int | None = None,
    user_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assert_menu_access(db, user, "vendas", AccessLevel.read)
    query = (
        db.query(Sale)
        .options(joinedload(Sale.client), joinedload(Sale.user))
        .filter(Sale.company_id == user.company_id)
    )
    query, _ = _apply_list_filters(
        query,
        user=user,
        db=db,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
        months=months,
    )
    rows = query.order_by(Sale.sale_date.desc()).all()
    return [_serialize_sale(s) for s in rows]


@router.get("/summary")
def sales_summary(
    months: int = 36,
    user_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assert_menu_access(db, user, "vendas", AccessLevel.read)
    from ..datetime_utils import today_br
    from datetime import timedelta

    today = today_br()
    query = db.query(Sale).filter(Sale.company_id == user.company_id)
    if not user_is_management(user):
        query = query.filter(Sale.user_id == user.id)

    month_start = today.replace(day=1)
    month_sales = query.filter(Sale.sale_date >= month_start, Sale.sale_date <= today).all()
    month_total = sum(Decimal(str(s.total_amount or 0)) for s in month_sales)

    ly_start = month_start.replace(year=month_start.year - 1)
    ly_end = today.replace(year=today.year - 1)
    ly_sales = query.filter(Sale.sale_date >= ly_start, Sale.sale_date <= ly_end).all()
    ly_total = sum(Decimal(str(s.total_amount or 0)) for s in ly_sales)

    buckets = []
    ref = month_start
    for _ in range(min(months, 36)):
        nxt = (ref.replace(day=28) + timedelta(days=4)).replace(day=1)
        total = sum(
            Decimal(str(s.total_amount or 0))
            for s in query.filter(Sale.sale_date >= ref, Sale.sale_date < nxt).all()
        )
        buckets.append({"month": ref.strftime("%Y-%m"), "total": float(total)})
        ref = (ref - timedelta(days=1)).replace(day=1)

    buckets.reverse()

    filtered_query = db.query(Sale).filter(Sale.company_id == user.company_id)
    filtered_query, seller_name = _apply_list_filters(
        filtered_query,
        user=user,
        db=db,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )
    filtered_total = sum(Decimal(str(s.total_amount or 0)) for s in filtered_query.all())

    return {
        "month_total": float(month_total),
        "last_year_same_period": float(ly_total),
        "monthly": buckets,
        "filtered_total": float(filtered_total),
        "filtered_seller_name": seller_name,
        "filtered_period_label": _format_period_label(date_from, date_to),
    }


@router.get("/{sale_id}")
def get_sale(sale_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_menu_access(db, user, "vendas", AccessLevel.read)
    s = (
        db.query(Sale)
        .options(joinedload(Sale.client), joinedload(Sale.user), joinedload(Sale.items).joinedload(SaleItem.product))
        .filter(Sale.id == sale_id, Sale.company_id == user.company_id)
        .first()
    )
    if not s:
        raise HTTPException(404, "Venda não encontrada")
    if not user_is_management(user) and s.user_id != user.id:
        raise HTTPException(403, "Acesso negado")
    return _serialize_sale(s, include_items=True)


@router.post("")
def create_sale(payload: SaleCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_menu_access(db, user, "vendas", AccessLevel.write)
    if not user_is_management(user):
        raise HTTPException(403, "Faturamento permitido somente para perfil gerencial")
    get_client_in_company(db, user, payload.client_id)
    total = Decimal("0")
    sale = Sale(
        company_id=user.company_id,
        client_id=payload.client_id,
        user_id=user.id,
        order_id=payload.order_id,
        invoice_number=payload.invoice_number,
        sale_date=payload.sale_date,
        notes=payload.notes,
    )
    db.add(sale)
    db.flush()
    for row in payload.items:
        get_product_in_company(db, user, row.product_id)
        line_total = Decimal(str(row.quantity)) * Decimal(str(row.unit_price))
        total += line_total
        db.add(SaleItem(
            sale_id=sale.id,
            product_id=row.product_id,
            quantity=row.quantity,
            unit_price=row.unit_price,
            total_price=line_total,
        ))
    sale.total_amount = total
    if payload.order_id:
        order = db.query(Order).filter(Order.id == payload.order_id, Order.company_id == user.company_id).first()
        if not order:
            raise HTTPException(400, "Pedido inválido")
        order.status = OrderStatus.faturado
    log_action(db, user, "create", "sales", sale.id, request=request)
    db.commit()
    return get_sale(sale.id, db, user)
