from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import get_current_user, log_action
from ..models import AccessLevel, Order, OrderItem, OrderStatus, Product, Quote, QuoteStatus, User
from ..permissions import assert_menu_access, user_is_management
from ..resource_checks import assert_owner_or_management, get_client_in_company, get_product_in_company, get_quote_in_company
from ..schemas import OrderCreate, OrderStatusUpdate

router = APIRouter(prefix="/orders", tags=["orders"])


def _serialize_order(o: Order, include_items=False) -> dict:
    data = {
        "id": o.id,
        "client_id": o.client_id,
        "client_name": o.client.name if o.client else "",
        "user_id": o.user_id,
        "user_name": o.user.name if o.user else "",
        "quote_id": o.quote_id,
        "status": o.status.value,
        "notes": o.notes,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "total_amount": 0.0,
    }
    if include_items:
        items = []
        total = Decimal("0")
        for item in o.items:
            p = item.product
            line = float(item.quantity or 0) * float(item.unit_price or 0)
            total += Decimal(str(line))
            items.append({
                "id": item.id,
                "product_id": item.product_id,
                "product_name": p.short_description if p else "",
                "code": p.code if p else "",
                "quantity": float(item.quantity or 0),
                "unit_price": float(item.unit_price or 0),
                "total_price": line,
            })
        data["items"] = items
        data["total_amount"] = float(total)
    return data


@router.get("")
def list_orders(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_menu_access(db, user, "pedidos", AccessLevel.read)
    query = (
        db.query(Order)
        .options(joinedload(Order.client), joinedload(Order.user))
        .filter(Order.company_id == user.company_id)
    )
    if not user_is_management(user):
        query = query.filter(Order.user_id == user.id)
    return [_serialize_order(o) for o in query.order_by(Order.created_at.desc()).all()]


@router.get("/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_menu_access(db, user, "pedidos", AccessLevel.read)
    o = (
        db.query(Order)
        .options(joinedload(Order.client), joinedload(Order.user), joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order_id, Order.company_id == user.company_id)
        .first()
    )
    if not o:
        raise HTTPException(404, "Pedido não encontrado")
    if not user_is_management(user) and o.user_id != user.id:
        raise HTTPException(403, "Acesso negado")
    return _serialize_order(o, include_items=True)


@router.post("")
def create_order(payload: OrderCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_menu_access(db, user, "pedidos", AccessLevel.write)
    get_client_in_company(db, user, payload.client_id)
    if payload.quote_id:
        quote = get_quote_in_company(db, user, payload.quote_id, owner_only=not user_is_management(user))
        if quote.requires_management_approval and not quote.management_approved:
            raise HTTPException(400, "Proposta requer autorização da Gerência/Supervisão")
        if quote.status != QuoteStatus.ganha:
            quote.status = QuoteStatus.ganha
    order = Order(
        company_id=user.company_id,
        client_id=payload.client_id,
        user_id=user.id,
        quote_id=payload.quote_id,
        notes=payload.notes,
        status=OrderStatus.recebido,
    )
    db.add(order)
    db.flush()
    for row in payload.items:
        get_product_in_company(db, user, row.product_id)
        db.add(OrderItem(order_id=order.id, product_id=row.product_id, quantity=row.quantity, unit_price=row.unit_price))
    log_action(db, user, "create", "orders", order.id, request=request)
    db.commit()
    return get_order(order.id, db, user)


@router.patch("/{order_id}/status")
def update_order_status(
    order_id: int,
    payload: OrderStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assert_menu_access(db, user, "pedidos", AccessLevel.write)
    o = db.query(Order).filter(Order.id == order_id, Order.company_id == user.company_id).first()
    if not o:
        raise HTTPException(404, "Pedido não encontrado")
    assert_owner_or_management(user, o.user_id)
    o.status = OrderStatus(payload.status)
    log_action(db, user, "update_status", "orders", o.id, after={"status": payload.status}, request=request)
    db.commit()
    return _serialize_order(o)
