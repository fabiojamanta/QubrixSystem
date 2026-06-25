from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..business_rules import product_display_description, profitability_for_price, resolve_unit_price
from ..database import get_db
from ..deps import get_current_user, log_action
from ..models import (
    AccessLevel,
    DescriptionChoice,
    LostReason,
    Product,
    ProductClientPrice,
    Quote,
    QuoteItem,
    QuoteStatus,
    User,
)
from ..permissions import assert_menu_access, user_is_management
from ..resource_checks import assert_owner_or_management, get_client_in_company, get_product_in_company, get_quote_in_company
from ..schemas import QuoteApprove, QuoteCreate, QuoteStatusUpdate

router = APIRouter(prefix="/quotes", tags=["quotes"])


def _client_prices_map(db: Session) -> dict[tuple[int, int], Decimal]:
    rows = db.query(ProductClientPrice).all()
    return {(r.product_id, r.client_id): Decimal(str(r.price)) for r in rows}


def _serialize_item(item: QuoteItem, product: Product) -> dict:
    desc_choice = item.description_choice.value if item.description_choice else "curta"
    unit = float(item.unit_price or 0)
    qty = float(item.quantity or 0)
    prof = profitability_for_price(product, Decimal(str(item.unit_price)))
    return {
        "id": item.id,
        "product_id": item.product_id,
        "code": product.code,
        "description": product_display_description(product, desc_choice, item.extra_info),
        "description_choice": desc_choice,
        "extra_info": item.extra_info,
        "quantity": qty,
        "sale_unit": product.sale_unit.value,
        "unit_price": unit,
        "total_price": unit * qty,
        "profitability": prof,
    }


def _serialize_quote(q: Quote, db: Session, include_items=False) -> dict:
    data = {
        "id": q.id,
        "client_id": q.client_id,
        "client_name": q.client.name if q.client else "",
        "user_id": q.user_id,
        "user_name": q.user.name if q.user else "",
        "status": q.status.value,
        "lost_reason": q.lost_reason.value if q.lost_reason else None,
        "lost_reason_detail": q.lost_reason_detail,
        "response_deadline": q.response_deadline.isoformat() if q.response_deadline else None,
        "notes": q.notes,
        "based_on_quote_id": q.based_on_quote_id,
        "requires_management_approval": q.requires_management_approval,
        "management_approved": q.management_approved,
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "total_amount": 0.0,
    }
    if include_items:
        items = []
        total = Decimal("0")
        for item in q.items:
            product = item.product or db.query(Product).get(item.product_id)
            if not product:
                continue
            ser = _serialize_item(item, product)
            items.append(ser)
            total += Decimal(str(ser["total_price"]))
        data["items"] = items
        data["total_amount"] = float(total)
    return data


@router.get("")
def list_quotes(
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    client_id: int | None = None,
    user_id: int | None = None,
    approval: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assert_menu_access(db, user, "cotacoes", AccessLevel.read)
    query = (
        db.query(Quote)
        .options(joinedload(Quote.client), joinedload(Quote.user))
        .filter(Quote.company_id == user.company_id)
    )
    if not user_is_management(user):
        query = query.filter(Quote.user_id == user.id)
    elif user_id:
        seller = db.query(User).filter(User.id == user_id, User.company_id == user.company_id, User.active == True).first()
        if not seller:
            raise HTTPException(400, "Vendedor inválido")
        query = query.filter(Quote.user_id == user_id)
    if status:
        query = query.filter(Quote.status == QuoteStatus(status))
    if client_id:
        get_client_in_company(db, user, client_id)
        query = query.filter(Quote.client_id == client_id)
    if date_from:
        query = query.filter(Quote.created_at >= date_from)
    if date_to:
        query = query.filter(Quote.created_at <= f"{date_to} 23:59:59")
    if approval == "pendente":
        query = query.filter(Quote.requires_management_approval == True, Quote.management_approved == False)
    elif approval == "autorizada":
        query = query.filter(Quote.requires_management_approval == True, Quote.management_approved == True)
    elif approval == "nao_aplicavel":
        query = query.filter(Quote.requires_management_approval == False)
    rows = query.order_by(Quote.created_at.desc()).all()
    return [_serialize_quote(q, db) for q in rows]


@router.get("/products")
def search_products_for_quote(
    q: str | None = None,
    client_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assert_menu_access(db, user, "cotacoes", AccessLevel.read)
    from ..input_sanitize import sanitize_search_term

    query = db.query(Product).filter(Product.company_id == user.company_id, Product.active == True)
    q = sanitize_search_term(q)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (Product.code.ilike(like)) | (Product.short_description.ilike(like)) | (Product.brand.ilike(like))
        )
    prices = _client_prices_map(db)
    rows = query.order_by(Product.code).limit(50).all()
    return [
        {
            "id": p.id,
            "code": p.code,
            "short_description": p.short_description,
            "brand": p.brand,
            "sale_unit": p.sale_unit.value if p.sale_unit else "UNIT",
            "general_price": float(p.general_price or 0),
            "suggested_price": float(resolve_unit_price(p, client_id, prices)),
        }
        for p in rows
    ]


@router.get("/next-number")
def next_quote_number(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_menu_access(db, user, "cotacoes", AccessLevel.read)
    max_id = (
        db.query(func.max(Quote.id))
        .filter(Quote.company_id == user.company_id)
        .scalar()
    ) or 0
    return {"next_number": max_id + 1}


@router.get("/{quote_id}")
def get_quote(quote_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_menu_access(db, user, "cotacoes", AccessLevel.read)
    q = (
        db.query(Quote)
        .options(joinedload(Quote.client), joinedload(Quote.user), joinedload(Quote.items).joinedload(QuoteItem.product))
        .filter(Quote.id == quote_id, Quote.company_id == user.company_id)
        .first()
    )
    if not q:
        raise HTTPException(404, "Cotação não encontrada")
    if not user_is_management(user) and q.user_id != user.id:
        raise HTTPException(403, "Acesso negado")
    return _serialize_quote(q, db, include_items=True)


@router.get("/{quote_id}/clone-data")
def clone_quote_data(quote_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return get_quote(quote_id, db, user)


@router.post("")
def create_quote(payload: QuoteCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_menu_access(db, user, "cotacoes", AccessLevel.write)
    if not payload.items:
        raise HTTPException(400, "Informe ao menos um item")
    get_client_in_company(db, user, payload.client_id)
    if payload.based_on_quote_id:
        get_quote_in_company(db, user, payload.based_on_quote_id, owner_only=not user_is_management(user))
    prices = _client_prices_map(db)
    requires_approval = False
    quote = Quote(
        company_id=user.company_id,
        client_id=payload.client_id,
        user_id=user.id,
        response_deadline=payload.response_deadline,
        notes=payload.notes,
        based_on_quote_id=payload.based_on_quote_id,
        status=QuoteStatus.aberta,
    )
    db.add(quote)
    db.flush()

    for row in payload.items:
        product = get_product_in_company(db, user, row.product_id)
        unit_price = row.unit_price if row.unit_price is not None else resolve_unit_price(product, payload.client_id, prices)
        prof = profitability_for_price(product, Decimal(str(unit_price)))
        if prof == "vermelho":
            requires_approval = True
        db.add(QuoteItem(
            quote_id=quote.id,
            product_id=row.product_id,
            description_choice=DescriptionChoice(row.description_choice),
            extra_info=row.extra_info,
            quantity=row.quantity,
            unit_price=unit_price,
        ))

    quote.requires_management_approval = requires_approval
    if requires_approval and not user_is_management(user):
        quote.management_approved = False

    db.flush()
    log_action(db, user, "create", "quotes", quote.id, request=request)
    db.commit()
    return get_quote(quote.id, db, user)


@router.patch("/{quote_id}/status")
def update_status(
    quote_id: int,
    payload: QuoteStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assert_menu_access(db, user, "cotacoes", AccessLevel.write)
    q = db.query(Quote).filter(Quote.id == quote_id, Quote.company_id == user.company_id).first()
    if not q:
        raise HTTPException(404, "Cotação não encontrada")
    assert_owner_or_management(user, q.user_id)
    q.status = QuoteStatus(payload.status)
    if payload.status == QuoteStatus.perdida.value:
        if not payload.lost_reason:
            raise HTTPException(400, "Informe o motivo da perda")
        if payload.lost_reason == LostReason.outro.value and not (payload.lost_reason_detail or "").strip():
            raise HTTPException(400, "Descreva o motivo da perda")
        q.lost_reason = LostReason(payload.lost_reason)
        q.lost_reason_detail = (payload.lost_reason_detail or "").strip() or None
    else:
        q.lost_reason = None
        q.lost_reason_detail = None
    log_action(db, user, "update_status", "quotes", q.id, after={"status": payload.status}, request=request)
    db.commit()
    db.refresh(q)
    return _serialize_quote(q, db, include_items=True)


@router.post("/{quote_id}/approve")
def approve_quote(
    quote_id: int,
    payload: QuoteApprove,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user_is_management(user):
        raise HTTPException(403, "Autorização permitida somente para Gerência/Supervisão")
    q = db.query(Quote).filter(Quote.id == quote_id, Quote.company_id == user.company_id).first()
    if not q:
        raise HTTPException(404, "Cotação não encontrada")
    q.management_approved = payload.approved
    log_action(db, user, "approve", "quotes", q.id, after={"approved": payload.approved}, request=request)
    db.commit()
    return _serialize_quote(q, db)
