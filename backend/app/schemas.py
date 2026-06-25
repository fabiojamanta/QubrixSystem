from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class Login(BaseModel):
    email: EmailStr = Field(max_length=160)
    password: str = Field(min_length=1, max_length=128)


class SessionResponse(BaseModel):
    user: dict


class ProductBase(BaseModel):
    code: str = Field(min_length=1, max_length=40)
    short_description: str = Field(min_length=1, max_length=180)
    long_description: Optional[str] = Field(default=None, max_length=5000)
    brand: Optional[str] = Field(default=None, max_length=120)
    qty_per_package: int = Field(default=1, ge=1, le=99999)
    sale_unit: Literal["CX", "PCT", "KIT", "UNIT"] = "UNIT"
    general_price: Decimal = Field(default=Decimal("0"), ge=0)
    max_discount_pct: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    cost_price: Decimal = Field(default=Decimal("0"), ge=0)
    active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(ProductBase):
    pass


class ProductClientPriceIn(BaseModel):
    client_id: int = Field(gt=0)
    price: Decimal = Field(ge=0)


class ClientContactIn(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=40)
    email: Optional[EmailStr] = Field(default=None, max_length=160)


class ClientBase(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    document: Optional[str] = Field(default=None, max_length=40)
    phone: Optional[str] = Field(default=None, max_length=40)
    email: Optional[EmailStr] = Field(default=None, max_length=160)
    address: Optional[str] = Field(default=None, max_length=255)
    city: Optional[str] = Field(default=None, max_length=120)
    state: Optional[str] = Field(default=None, max_length=2)
    notes: Optional[str] = Field(default=None, max_length=2000)
    responsible_user_id: Optional[int] = Field(default=None, gt=0)
    contacts: list[ClientContactIn] = Field(default_factory=list, max_length=3)
    active: bool = True

    @field_validator("contacts")
    @classmethod
    def limit_contacts(cls, value: list[ClientContactIn]) -> list[ClientContactIn]:
        if len(value) > 3:
            raise ValueError("Máximo de 3 contatos por cliente")
        return value


class ClientCreate(ClientBase):
    pass


class ClientUpdate(ClientBase):
    pass


class StockLotBase(BaseModel):
    product_id: int = Field(gt=0)
    lot_number: str = Field(min_length=1, max_length=60)
    quantity: Decimal = Field(ge=0)
    expiry_date: Optional[date] = None
    active: bool = True


class StockLotCreate(StockLotBase):
    pass


class StockLotUpdate(StockLotBase):
    pass


class CampaignBase(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    description: Optional[str] = Field(default=None, max_length=2000)
    special_price_info: Optional[str] = Field(default=None, max_length=500)
    start_date: date
    end_date: date
    show_early_notice: bool = False
    early_notice_days: Optional[int] = Field(default=None, ge=1, le=365)
    active: bool = True

    @model_validator(mode="after")
    def validate_early_notice(self):
        if self.show_early_notice and not self.early_notice_days:
            raise ValueError("Informe os dias antes para aviso de início da campanha")
        if not self.show_early_notice:
            self.early_notice_days = None
        if self.end_date < self.start_date:
            raise ValueError("Data final deve ser igual ou posterior à data inicial")
        return self


class CampaignCreate(CampaignBase):
    pass


class CampaignUpdate(CampaignBase):
    pass


class InfoBoardItemBase(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    content: str = Field(min_length=1, max_length=5000)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    active: bool = True

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("Data final deve ser igual ou posterior à data inicial")
        return self


class InfoBoardItemCreate(InfoBoardItemBase):
    pass


class InfoBoardItemUpdate(InfoBoardItemBase):
    pass


class QuoteItemIn(BaseModel):
    product_id: int = Field(gt=0)
    description_choice: Literal["curta", "longa"] = "curta"
    extra_info: Optional[str] = Field(default=None, max_length=500)
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)


class QuoteCreate(BaseModel):
    client_id: int = Field(gt=0)
    response_deadline: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=2000)
    based_on_quote_id: Optional[int] = Field(default=None, gt=0)
    items: list[QuoteItemIn] = Field(default_factory=list, max_length=200)


class QuoteStatusUpdate(BaseModel):
    status: Literal["aberta", "ganha", "perdida"]
    lost_reason: Optional[Literal["preco", "prazo_entrega", "prazo_pagamento", "outra_marca", "ma_fe", "outro"]] = None
    lost_reason_detail: Optional[str] = Field(default=None, max_length=500)


class QuoteApprove(BaseModel):
    approved: bool = True


class OrderItemIn(BaseModel):
    product_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)


class OrderCreate(BaseModel):
    client_id: int = Field(gt=0)
    quote_id: Optional[int] = Field(default=None, gt=0)
    notes: Optional[str] = Field(default=None, max_length=2000)
    items: list[OrderItemIn] = Field(default_factory=list, max_length=200)


class OrderStatusUpdate(BaseModel):
    status: Literal["recebido", "processando", "faturado", "cancelado"]


class SaleItemIn(BaseModel):
    product_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)


class SaleCreate(BaseModel):
    client_id: int = Field(gt=0)
    order_id: Optional[int] = Field(default=None, gt=0)
    invoice_number: Optional[str] = Field(default=None, max_length=40)
    sale_date: date
    notes: Optional[str] = Field(default=None, max_length=2000)
    items: list[SaleItemIn] = Field(default_factory=list, max_length=200)


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    email: EmailStr = Field(max_length=160)
    password: str = Field(min_length=8, max_length=128)
    profile_id: int = Field(gt=0)
    active: bool = True


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    email: Optional[EmailStr] = Field(default=None, max_length=160)
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    profile_id: Optional[int] = Field(default=None, gt=0)
    active: Optional[bool] = None

    @field_validator("password")
    @classmethod
    def empty_password(cls, v):
        if v == "":
            return None
        return v
