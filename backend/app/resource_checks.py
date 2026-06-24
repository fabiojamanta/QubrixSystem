"""Validações anti-IDOR e escopo por empresa."""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import Client, Product, Quote, User
from .permissions import user_is_management


def assert_owner_or_management(user: User, owner_user_id: int) -> None:
    if user_is_management(user):
        return
    if user.id != owner_user_id:
        raise HTTPException(403, "Acesso negado")


def get_client_in_company(db: Session, user: User, client_id: int) -> Client:
    client = db.query(Client).filter(Client.id == client_id, Client.company_id == user.company_id).first()
    if not client:
        raise HTTPException(400, "Cliente inválido")
    return client


def get_product_in_company(db: Session, user: User, product_id: int) -> Product:
    product = db.query(Product).filter(Product.id == product_id, Product.company_id == user.company_id).first()
    if not product:
        raise HTTPException(400, "Produto inválido")
    return product


def get_quote_in_company(db: Session, user: User, quote_id: int, *, owner_only: bool = False) -> Quote:
    quote = db.query(Quote).filter(Quote.id == quote_id, Quote.company_id == user.company_id).first()
    if not quote:
        raise HTTPException(404, "Cotação não encontrada")
    if owner_only:
        assert_owner_or_management(user, quote.user_id)
    return quote
