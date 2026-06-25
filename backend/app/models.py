from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Text, Enum, Numeric, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from .database import Base


class AccessLevel(str, enum.Enum):
    hidden = "hidden"
    read = "read"
    write = "write"


class SaleUnit(str, enum.Enum):
    cx = "CX"
    pct = "PCT"
    kit = "KIT"
    unit = "UNIT"


class QuoteStatus(str, enum.Enum):
    aberta = "aberta"
    ganha = "ganha"
    perdida = "perdida"


class LostReason(str, enum.Enum):
    preco = "preco"
    prazo_entrega = "prazo_entrega"
    prazo_pagamento = "prazo_pagamento"
    outra_marca = "outra_marca"
    ma_fe = "ma_fe"
    outro = "outro"


class OrderStatus(str, enum.Enum):
    recebido = "recebido"
    processando = "processando"
    faturado = "faturado"
    cancelado = "cancelado"


class DescriptionChoice(str, enum.Enum):
    curta = "curta"
    longa = "longa"


class ProfitabilityLevel(str, enum.Enum):
    verde = "verde"
    amarelo = "amarelo"
    vermelho = "vermelho"


class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True)
    name = Column(String(180), nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class Profile(Base):
    __tablename__ = "profiles"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, default=1)
    name = Column(String(120), nullable=False)
    slug = Column(String(80), nullable=False, index=True)
    is_system = Column(Boolean, default=False, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    is_management = Column(Boolean, default=False, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    permissions = relationship("ProfilePermission", back_populates="profile", cascade="all, delete-orphan")
    users = relationship("User", back_populates="profile")


class MenuItemRecord(Base):
    __tablename__ = "menu_items"
    menu_key = Column(String(60), primary_key=True)
    label = Column(String(120), nullable=False)
    route_paths = Column(Text, nullable=False)
    nav_group = Column(String(40), nullable=True)
    sort_order = Column(Integer, default=0)
    active = Column(Boolean, default=True)


class ProfilePermission(Base):
    __tablename__ = "profile_permissions"
    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    menu_key = Column(String(60), ForeignKey("menu_items.menu_key"), nullable=False)
    access_level = Column(Enum(AccessLevel), default=AccessLevel.hidden, nullable=False)
    profile = relationship("Profile", back_populates="permissions")
    menu_item = relationship("MenuItemRecord")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("company_id", "email", name="uq_users_company_email"),)
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, default=1)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    name = Column(String(160), nullable=False)
    email = Column(String(160), index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    profile = relationship("Profile", back_populates="users")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class LoginLockout(Base):
    __tablename__ = "login_lockouts"
    email = Column(String(160), primary_key=True)
    failed_count = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    last_attempt = Column(DateTime, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, default=1)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(40), nullable=False)
    entity = Column(String(60), nullable=False)
    entity_id = Column(Integer, nullable=True)
    before_data = Column(Text)
    after_data = Column(Text)
    ip_address = Column(String(64))
    created_at = Column(DateTime, nullable=False)


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("company_id", "code", name="uq_products_company_code"),)
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, default=1)
    code = Column(String(40), nullable=False)
    short_description = Column(String(180), nullable=False)
    long_description = Column(Text)
    brand = Column(String(120))
    qty_per_package = Column(Integer, default=1)
    sale_unit = Column(Enum(SaleUnit), default=SaleUnit.unit, nullable=False)
    general_price = Column(Numeric(12, 2), default=0)
    max_discount_pct = Column(Numeric(5, 2), default=0)
    cost_price = Column(Numeric(12, 2), default=0)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    client_prices = relationship("ProductClientPrice", back_populates="product", cascade="all, delete-orphan")
    stock_lots = relationship("StockLot", back_populates="product", cascade="all, delete-orphan")


class ProductClientPrice(Base):
    __tablename__ = "product_client_prices"
    __table_args__ = (UniqueConstraint("product_id", "client_id", name="uq_product_client_price"),)
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    price = Column(Numeric(12, 2), nullable=False)
    product = relationship("Product", back_populates="client_prices")
    client = relationship("Client", back_populates="product_prices")


class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, default=1)
    registration_number = Column(String(40), index=True)
    name = Column(String(180), nullable=False)
    document = Column(String(40))
    phone = Column(String(40))
    email = Column(String(160))
    address = Column(String(255))
    city = Column(String(120))
    state = Column(String(2))
    notes = Column(Text)
    responsible_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    responsible_user = relationship("User", foreign_keys=[responsible_user_id])
    contacts = relationship(
        "ClientContact",
        back_populates="client",
        cascade="all, delete-orphan",
        order_by="ClientContact.sort_order",
    )
    product_prices = relationship("ProductClientPrice", back_populates="client", cascade="all, delete-orphan")


class ClientContact(Base):
    __tablename__ = "client_contacts"
    id = Column(Integer, primary_key=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    name = Column(String(120))
    phone = Column(String(40))
    email = Column(String(160))
    sort_order = Column(Integer, default=0, nullable=False)
    client = relationship("Client", back_populates="contacts")


class StockLot(Base):
    __tablename__ = "stock_lots"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, default=1)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    lot_number = Column(String(60), nullable=False)
    manufacturer = Column(String(120))
    quantity = Column(Numeric(12, 2), default=0)
    expiry_date = Column(Date)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    product = relationship("Product", back_populates="stock_lots")


class Campaign(Base):
    __tablename__ = "campaigns"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, default=1)
    title = Column(String(180), nullable=False)
    description = Column(Text)
    special_price_info = Column(Text)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    show_early_notice = Column(Boolean, default=False, nullable=False)
    early_notice_days = Column(Integer, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class InfoBoardItem(Base):
    __tablename__ = "info_board_items"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, default=1)
    title = Column(String(180), nullable=False)
    content = Column(Text, nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class Quote(Base):
    __tablename__ = "quotes"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, default=1)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(QuoteStatus), default=QuoteStatus.aberta, nullable=False)
    lost_reason = Column(Enum(LostReason), nullable=True)
    lost_reason_detail = Column(Text, nullable=True)
    response_deadline = Column(Date)
    notes = Column(Text)
    based_on_quote_id = Column(Integer, ForeignKey("quotes.id"), nullable=True)
    requires_management_approval = Column(Boolean, default=False)
    management_approved = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    client = relationship("Client")
    user = relationship("User")
    items = relationship("QuoteItem", back_populates="quote", cascade="all, delete-orphan")


class QuoteItem(Base):
    __tablename__ = "quote_items"
    id = Column(Integer, primary_key=True)
    quote_id = Column(Integer, ForeignKey("quotes.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    description_choice = Column(Enum(DescriptionChoice), default=DescriptionChoice.curta)
    extra_info = Column(Text)
    quantity = Column(Numeric(12, 2), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    quote = relationship("Quote", back_populates="items")
    product = relationship("Product")


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, default=1)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    quote_id = Column(Integer, ForeignKey("quotes.id"), nullable=True)
    status = Column(Enum(OrderStatus), default=OrderStatus.recebido, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    client = relationship("Client")
    user = relationship("User")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(12, 2), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    order = relationship("Order", back_populates="items")
    product = relationship("Product")


class Sale(Base):
    __tablename__ = "sales"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, default=1)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    invoice_number = Column(String(40))
    sale_date = Column(Date, nullable=False)
    total_amount = Column(Numeric(14, 2), default=0)
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    client = relationship("Client")
    user = relationship("User")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"
    id = Column(Integer, primary_key=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(12, 2), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    total_price = Column(Numeric(14, 2), nullable=False)
    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")
