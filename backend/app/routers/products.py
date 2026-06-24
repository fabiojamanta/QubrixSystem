from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, log_action
from ..models import AccessLevel, Product, ProductClientPrice, SaleUnit, User
from ..permissions import assert_menu_access, user_is_management
from ..input_sanitize import sanitize_search_term
from ..schemas import ProductClientPriceIn, ProductCreate, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


def _serialize(p: Product, db: Session) -> dict:
    stock_qty = sum(Decimal(str(l.quantity or 0)) for l in p.stock_lots if l.active)
    return {
        "id": p.id,
        "code": p.code,
        "short_description": p.short_description,
        "long_description": p.long_description,
        "brand": p.brand,
        "qty_per_package": p.qty_per_package,
        "sale_unit": p.sale_unit.value if p.sale_unit else "UNIT",
        "general_price": float(p.general_price or 0),
        "max_discount_pct": float(p.max_discount_pct or 0),
        "cost_price": float(p.cost_price or 0),
        "active": p.active,
        "stock_qty": float(stock_qty),
        "client_prices": [
            {"id": cp.id, "client_id": cp.client_id, "client_name": cp.client.name, "price": float(cp.price)}
            for cp in p.client_prices
        ],
    }


@router.get("")
def list_products(
    q: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assert_menu_access(db, user, "produtos", AccessLevel.read)
    query = db.query(Product).filter(Product.company_id == user.company_id)
    q = sanitize_search_term(q)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (Product.code.ilike(like)) | (Product.short_description.ilike(like)) | (Product.brand.ilike(like))
        )
    rows = query.order_by(Product.code).all()
    return [_serialize(p, db) for p in rows]


@router.get("/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assert_menu_access(db, user, "produtos", AccessLevel.read)
    p = db.query(Product).filter(Product.id == product_id, Product.company_id == user.company_id).first()
    if not p:
        raise HTTPException(404, "Produto não encontrado")
    return _serialize(p, db)


@router.post("")
def create_product(
    payload: ProductCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user_is_management(user):
        raise HTTPException(403, "Inclusão de produtos permitida somente para Gerência/Supervisão")
    assert_menu_access(db, user, "produtos", AccessLevel.write)
    if db.query(Product).filter(Product.company_id == user.company_id, Product.code == payload.code).first():
        raise HTTPException(400, "Código já cadastrado")
    p = Product(
        company_id=user.company_id,
        code=payload.code.strip(),
        short_description=payload.short_description.strip(),
        long_description=payload.long_description,
        brand=payload.brand,
        qty_per_package=payload.qty_per_package,
        sale_unit=SaleUnit(payload.sale_unit),
        general_price=payload.general_price,
        max_discount_pct=payload.max_discount_pct,
        cost_price=payload.cost_price,
        active=payload.active,
    )
    db.add(p)
    db.flush()
    log_action(db, user, "create", "products", p.id, after=_serialize(p, db), request=request)
    db.commit()
    return _serialize(p, db)


@router.put("/{product_id}")
def update_product(
    product_id: int,
    payload: ProductUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user_is_management(user):
        raise HTTPException(403, "Alteração de produtos permitida somente para Gerência/Supervisão")
    assert_menu_access(db, user, "produtos", AccessLevel.write)
    p = db.query(Product).filter(Product.id == product_id, Product.company_id == user.company_id).first()
    if not p:
        raise HTTPException(404, "Produto não encontrado")
    before = _serialize(p, db)
    p.code = payload.code.strip()
    p.short_description = payload.short_description.strip()
    p.long_description = payload.long_description
    p.brand = payload.brand
    p.qty_per_package = payload.qty_per_package
    p.sale_unit = SaleUnit(payload.sale_unit)
    p.general_price = payload.general_price
    p.max_discount_pct = payload.max_discount_pct
    p.cost_price = payload.cost_price
    p.active = payload.active
    log_action(db, user, "update", "products", p.id, before=before, after=_serialize(p, db), request=request)
    db.commit()
    return _serialize(p, db)


@router.post("/{product_id}/client-prices")
def set_client_price(
    product_id: int,
    payload: ProductClientPriceIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user_is_management(user):
        raise HTTPException(403, "Tabela por cliente permitida somente para Gerência/Supervisão")
    assert_menu_access(db, user, "produtos", AccessLevel.write)
    p = db.query(Product).filter(Product.id == product_id, Product.company_id == user.company_id).first()
    if not p:
        raise HTTPException(404, "Produto não encontrado")
    row = db.query(ProductClientPrice).filter_by(product_id=product_id, client_id=payload.client_id).first()
    if row:
        row.price = payload.price
    else:
        row = ProductClientPrice(product_id=product_id, client_id=payload.client_id, price=payload.price)
        db.add(row)
    db.commit()
    return {"ok": True}
