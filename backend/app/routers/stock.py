from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import get_current_user, log_action
from ..models import AccessLevel, Product, StockLot, User
from ..permissions import assert_menu_access
from ..resource_checks import get_product_in_company
from ..input_sanitize import sanitize_search_term
from ..schemas import StockLotCreate, StockLotUpdate

router = APIRouter(prefix="/stock", tags=["stock"])


def _product_manufacturer(product: Product | None) -> str:
    return (product.brand or "").strip() if product else ""


def _serialize_lot(lot: StockLot) -> dict:
    p = lot.product
    return {
        "id": lot.id,
        "product_id": lot.product_id,
        "code": p.code if p else "",
        "short_description": p.short_description if p else "",
        "brand": p.brand if p else "",
        "lot_number": lot.lot_number,
        "manufacturer": _product_manufacturer(p) or lot.manufacturer or "",
        "quantity": float(lot.quantity or 0),
        "expiry_date": lot.expiry_date.isoformat() if lot.expiry_date else None,
        "active": lot.active,
    }


@router.get("")
def list_stock(
    q: str | None = None,
    zero_stock: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assert_menu_access(db, user, "estoque", AccessLevel.read)
    query = (
        db.query(StockLot)
        .options(joinedload(StockLot.product))
        .join(Product)
        .filter(StockLot.company_id == user.company_id, StockLot.active == True)
    )
    q = sanitize_search_term(q)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (Product.code.ilike(like))
            | (Product.short_description.ilike(like))
            | (Product.brand.ilike(like))
        )
    if zero_stock == "yes":
        query = query.filter(StockLot.quantity <= 0)
    elif zero_stock == "no":
        query = query.filter(StockLot.quantity > 0)
    rows = query.order_by(Product.code, StockLot.lot_number).all()
    return [_serialize_lot(r) for r in rows]


@router.get("/products")
def search_products_for_stock(
    q: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assert_menu_access(db, user, "estoque", AccessLevel.read)
    query = db.query(Product).filter(Product.company_id == user.company_id, Product.active == True)
    q = sanitize_search_term(q)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (Product.code.ilike(like)) | (Product.short_description.ilike(like)) | (Product.brand.ilike(like))
        )
    rows = query.order_by(Product.code).limit(50).all()
    return [
        {
            "id": p.id,
            "code": p.code,
            "short_description": p.short_description,
            "brand": p.brand,
        }
        for p in rows
    ]


@router.post("")
def create_lot(payload: StockLotCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_menu_access(db, user, "estoque", AccessLevel.write)
    product = get_product_in_company(db, user, payload.product_id)
    lot = StockLot(
        company_id=user.company_id,
        product_id=payload.product_id,
        lot_number=payload.lot_number,
        manufacturer=_product_manufacturer(product) or None,
        quantity=payload.quantity,
        expiry_date=payload.expiry_date,
        active=payload.active,
    )
    db.add(lot)
    db.flush()
    db.refresh(lot, ["product"])
    log_action(db, user, "create", "stock_lots", lot.id, after=_serialize_lot(lot), request=request)
    db.commit()
    return _serialize_lot(lot)


@router.put("/{lot_id}")
def update_lot(
    lot_id: int,
    payload: StockLotUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assert_menu_access(db, user, "estoque", AccessLevel.write)
    lot = (
        db.query(StockLot)
        .options(joinedload(StockLot.product))
        .filter(StockLot.id == lot_id, StockLot.company_id == user.company_id)
        .first()
    )
    if not lot:
        raise HTTPException(404, "Lote não encontrado")
    product = get_product_in_company(db, user, payload.product_id)
    before = _serialize_lot(lot)
    lot.product_id = payload.product_id
    lot.lot_number = payload.lot_number
    lot.manufacturer = _product_manufacturer(product) or None
    lot.quantity = payload.quantity
    lot.expiry_date = payload.expiry_date
    lot.active = payload.active
    db.flush()
    db.refresh(lot, ["product"])
    log_action(db, user, "update", "stock_lots", lot.id, before=before, after=_serialize_lot(lot), request=request)
    db.commit()
    return _serialize_lot(lot)
