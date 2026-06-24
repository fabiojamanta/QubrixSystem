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


@router.get("")
def list_sales(
    months: int = 1,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assert_menu_access(db, user, "vendas", AccessLevel.read)
    query = (
        db.query(Sale)
        .options(joinedload(Sale.client), joinedload(Sale.user))
        .filter(Sale.company_id == user.company_id)
    )
    if not user_is_management(user):
        query = query.filter(Sale.user_id == user.id)
    if months and months < 36:
        from ..datetime_utils import today_br
        from datetime import timedelta
        start = today_br().replace(day=1)
        for _ in range(months - 1):
            start = (start - timedelta(days=1)).replace(day=1)
        query = query.filter(Sale.sale_date >= start)
    rows = query.order_by(Sale.sale_date.desc()).all()
    return [_serialize_sale(s) for s in rows]


@router.get("/summary")
def sales_summary(months: int = 36, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
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
    return {
        "month_total": float(month_total),
        "last_year_same_period": float(ly_total),
        "monthly": buckets,
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
