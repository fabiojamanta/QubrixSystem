"""Dados de demonstração para o Sistema Marcelo."""
from datetime import timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from .datetime_utils import now_br, today_br
from .models import (
    Campaign,
    Client,
    DescriptionChoice,
    InfoBoardItem,
    LostReason,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    ProductClientPrice,
    Profile,
    Quote,
    QuoteItem,
    QuoteStatus,
    Sale,
    SaleItem,
    SaleUnit,
    StockLot,
    User,
)
from .security import get_password_hash


def _has_demo_data(db: Session, company_id: int = 1) -> bool:
    return db.query(Product).filter(Product.company_id == company_id).count() > 0


def seed_demo_data(db: Session, company_id: int = 1, force: bool = False) -> bool:
    """Popula tabelas com dados de exemplo. Retorna True se inseriu dados."""
    if not force and _has_demo_data(db, company_id):
        return False

    if force:
        _clear_demo_data(db, company_id)

    today = today_br()
    profiles = {p.slug: p for p in db.query(Profile).filter(Profile.company_id == company_id).all()}
    gerencia = profiles.get("gerencia")
    vendedor_profile = profiles.get("vendedor")

    vendedor1 = _ensure_user(
        db, company_id, vendedor_profile.id,
        "Carlos Vendedor", "carlos@marcelo.com", "Vendedor@1234",
    )
    vendedor2 = _ensure_user(
        db, company_id, vendedor_profile.id,
        "Ana Souza", "ana@marcelo.com", "Vendedor@1234",
    )
    gerente = _ensure_user(
        db, company_id, gerencia.id,
        "Maria Gerente", "maria@marcelo.com", "Gerencia@1234",
    )

    clients = [
        Client(company_id=company_id, name="Clínica Vida Nova", document="12.345.678/0001-90",
               phone="(11) 3456-7890", email="compras@vidanova.com.br", city="São Paulo", state="SP",
               address="Av. Paulista, 1000", notes="Cliente prioritário — pagamento 30 dias"),
        Client(company_id=company_id, name="Hospital Santa Clara", document="98.765.432/0001-10",
               phone="(21) 2345-6789", email="suprimentos@santaclara.com.br", city="Rio de Janeiro", state="RJ",
               address="Rua das Flores, 500"),
        Client(company_id=company_id, name="Farmácia Popular Centro", document="11.222.333/0001-44",
               phone="(31) 9876-5432", email="pedidos@farmaciacentro.com.br", city="Belo Horizonte", state="MG",
               address="Rua da Bahia, 200"),
        Client(company_id=company_id, name="Lab Diagnóstico Plus", document="55.666.777/0001-88",
               phone="(41) 3333-4444", email="lab@diagnosticoplus.com.br", city="Curitiba", state="PR",
               address="Alameda Santos, 45"),
    ]
    db.add_all(clients)
    db.flush()

    products_data = [
        ("MED-001", "Soro Fisiológico 0,9% 500ml", "Soro fisiológico estéril para uso hospitalar, frasco 500ml.",
         "Eurofarma", 24, SaleUnit.cx, Decimal("48.00"), Decimal("10"), Decimal("32.00")),
        ("MED-002", "Luvas procedimento M", "Luvas de procedimento não estéril, caixa 100 unidades.",
         "Supermax", 100, SaleUnit.cx, Decimal("35.00"), Decimal("8"), Decimal("22.00")),
        ("MED-003", "Máscara cirúrgica tripla", "Máscara descartável tripla camada, pacote 50 un.",
         "MedSupply", 50, SaleUnit.pct, Decimal("28.00"), Decimal("5"), Decimal("18.00")),
        ("MED-004", "Kit curativo estéril", "Kit completo para curativos em ambiente hospitalar.",
         "Cremer", 1, SaleUnit.kit, Decimal("120.00"), Decimal("12"), Decimal("75.00")),
        ("MED-005", "Agulha descartável 25x7", "Agulha hipodérmica descartável, caixa 100 un.",
         "BD", 100, SaleUnit.cx, Decimal("65.00"), Decimal("10"), Decimal("42.00")),
        ("MED-006", "Algodão hidrófilo 500g", "Rolo de algodão hidrófilo para uso médico.",
         "Cremer", 1, SaleUnit.unit, Decimal("18.00"), Decimal("5"), Decimal("11.00")),
        ("MED-007", "Termômetro digital clínico", "Termômetro digital infravermelho sem contato.",
         "G-Tech", 1, SaleUnit.unit, Decimal("89.00"), Decimal("15"), Decimal("55.00")),
        ("MED-008", "Atadura crepe 10cm", "Rolo de atadura de crepe 10cm x 1,8m.",
         "MedSupply", 12, SaleUnit.cx, Decimal("42.00"), Decimal("8"), Decimal("26.00")),
    ]
    products: list[Product] = []
    for code, short, long, brand, qty, unit, price, disc, cost in products_data:
        p = Product(
            company_id=company_id, code=code, short_description=short, long_description=long,
            brand=brand, qty_per_package=qty, sale_unit=unit, general_price=price,
            max_discount_pct=disc, cost_price=cost, active=True,
        )
        db.add(p)
        products.append(p)
    db.flush()

    db.add_all([
        ProductClientPrice(product_id=products[0].id, client_id=clients[0].id, price=Decimal("44.00")),
        ProductClientPrice(product_id=products[1].id, client_id=clients[0].id, price=Decimal("32.00")),
        ProductClientPrice(product_id=products[4].id, client_id=clients[1].id, price=Decimal("58.00")),
        ProductClientPrice(product_id=products[6].id, client_id=clients[2].id, price=Decimal("79.00")),
    ])

    lots_data = [
        (products[0], "L2026A01", "Eurofarma", Decimal("480"), today + timedelta(days=15)),
        (products[0], "L2025B12", "Eurofarma", Decimal("0"), today + timedelta(days=60)),
        (products[1], "LUV-2401", "Supermax", Decimal("850"), today + timedelta(days=45)),
        (products[2], "MSK-1125", "MedSupply", Decimal("320"), today + timedelta(days=75)),
        (products[3], "KIT-001", "Cremer", Decimal("45"), today + timedelta(days=120)),
        (products[4], "AGU-7788", "BD", Decimal("200"), today + timedelta(days=25)),
        (products[5], "ALG-500", "Cremer", Decimal("150"), today + timedelta(days=150)),
        (products[6], "TERM-99", "G-Tech", Decimal("30"), today + timedelta(days=200)),
        (products[7], "ATD-10", "MedSupply", Decimal("60"), today + timedelta(days=10)),
    ]
    for prod, lot, mfr, qty, expiry in lots_data:
        db.add(StockLot(
            company_id=company_id, product_id=prod.id, lot_number=lot,
            manufacturer=mfr, quantity=qty, expiry_date=expiry, active=True,
        ))

    db.add_all([
        Campaign(
            company_id=company_id, title="Promoção Inverno 2026",
            description="Descontos especiais em materiais hospitalares para a temporada.",
            special_price_info="Luvas e máscaras com 15% de desconto na tabela geral.",
            start_date=today - timedelta(days=10), end_date=today + timedelta(days=50), active=True,
        ),
        Campaign(
            company_id=company_id, title="Semana do Cliente",
            description="Condições especiais de pagamento para pedidos acima de R$ 5.000.",
            special_price_info="Parcelamento em até 3x sem juros.",
            start_date=today - timedelta(days=5), end_date=today + timedelta(days=25), active=True,
        ),
    ])

    db.add_all([
        InfoBoardItem(
            company_id=company_id, title="Novo horário de expediente",
            content="A partir de julho, atendimento comercial das 8h às 18h.",
            active=True,
        ),
        InfoBoardItem(
            company_id=company_id, title="Prazo de entrega",
            content="Pedidos confirmados até 14h serão despachados no mesmo dia (região capital).",
            active=True,
        ),
        InfoBoardItem(
            company_id=company_id, title="Meta do mês",
            content="Meta coletiva: R$ 85.000 em vendas faturadas. Vamos juntos!",
            active=True,
        ),
    ])

    q1 = _make_quote(db, company_id, clients[0], vendedor1, QuoteStatus.aberta,
                     today + timedelta(days=7), "Entrega urgente solicitada", [
                         (products[0], Decimal("50"), Decimal("44.00"), DescriptionChoice.curta, None),
                         (products[1], Decimal("10"), Decimal("32.00"), DescriptionChoice.curta, "Cor branca"),
                     ], days_ago=5, requires_approval=False)

    q2 = _make_quote(db, company_id, clients[1], vendedor1, QuoteStatus.ganha,
                     today + timedelta(days=3), None, [
                         (products[4], Decimal("20"), Decimal("58.00"), DescriptionChoice.longa, None),
                         (products[3], Decimal("5"), Decimal("120.00"), DescriptionChoice.curta, None),
                     ], days_ago=12, requires_approval=False)

    q3 = _make_quote(db, company_id, clients[2], vendedor2, QuoteStatus.perdida,
                     today - timedelta(days=2), None, [
                         (products[6], Decimal("15"), Decimal("75.00"), DescriptionChoice.curta, None),
                     ], days_ago=20, lost_reason=LostReason.preco)

    q4 = _make_quote(db, company_id, clients[3], vendedor2, QuoteStatus.perdida,
                     today - timedelta(days=5), None, [
                         (products[2], Decimal("100"), Decimal("26.00"), DescriptionChoice.curta, None),
                     ], days_ago=18, lost_reason=LostReason.prazo_entrega)

    q5 = _make_quote(db, company_id, clients[0], vendedor1, QuoteStatus.perdida,
                     today - timedelta(days=10), None, [
                         (products[5], Decimal("30"), Decimal("16.00"), DescriptionChoice.curta, None),
                     ], days_ago=25, lost_reason=LostReason.outra_marca)

    q6 = _make_quote(db, company_id, clients[1], vendedor2, QuoteStatus.aberta,
                     today + timedelta(days=5), "Aguardando autorização gerencial", [
                         (products[0], Decimal("100"), Decimal("35.00"), DescriptionChoice.curta, "Preço promocional"),
                     ], days_ago=3, requires_approval=True, management_approved=False)

    q7 = _make_quote(db, company_id, clients[2], vendedor1, QuoteStatus.perdida,
                     None, None, [
                         (products[7], Decimal("40"), Decimal("38.00"), DescriptionChoice.curta, None),
                     ], days_ago=22, lost_reason=LostReason.prazo_pagamento)

    q8 = _make_quote(db, company_id, clients[3], vendedor2, QuoteStatus.aberta,
                     today + timedelta(days=10), "Renovação baseada em proposta anterior", [
                         (products[4], Decimal("15"), Decimal("58.00"), DescriptionChoice.longa, None),
                     ], days_ago=2, based_on_quote_id=q2.id)

    order1 = _make_order(db, company_id, clients[1], vendedor1, q2, OrderStatus.processando, [
        (products[4], Decimal("20"), Decimal("58.00")),
        (products[3], Decimal("5"), Decimal("120.00")),
    ], days_ago=8, notes="Pedido recebido no escritório")

    order2 = _make_order(db, company_id, clients[0], vendedor1, None, OrderStatus.recebido, [
        (products[0], Decimal("30"), Decimal("44.00")),
        (products[2], Decimal("50"), Decimal("28.00")),
    ], days_ago=2, notes="Pedido avulso sem cotação")

    _make_sale(db, company_id, clients[1], vendedor1, order1, "NF-2026-0042",
               today - timedelta(days=5), [
                   (products[4], Decimal("20"), Decimal("58.00")),
                   (products[3], Decimal("5"), Decimal("120.00")),
               ])

    _make_sale(db, company_id, clients[0], vendedor1, None, "NF-2026-0038",
               today - timedelta(days=12), [
                   (products[0], Decimal("80"), Decimal("44.00")),
               ])

    _make_sale(db, company_id, clients[2], vendedor2, None, "NF-2026-0035",
               today - timedelta(days=18), [
                   (products[1], Decimal("25"), Decimal("35.00")),
                   (products[2], Decimal("40"), Decimal("28.00")),
               ])

    _make_sale(db, company_id, clients[3], vendedor2, None, "NF-2026-0030",
               today - timedelta(days=25), [
                   (products[6], Decimal("10"), Decimal("89.00")),
               ])

    last_year = today.replace(year=today.year - 1)
    _make_sale(db, company_id, clients[0], vendedor1, None, "NF-2025-0198",
               last_year - timedelta(days=5), [
                   (products[0], Decimal("60"), Decimal("42.00")),
               ])

    prev_month = (today.replace(day=1) - timedelta(days=1))
    _make_sale(db, company_id, clients[1], vendedor1, None, "NF-2026-0028",
               prev_month.replace(day=15), [
                   (products[4], Decimal("15"), Decimal("60.00")),
               ])

    two_months = (prev_month.replace(day=1) - timedelta(days=1)).replace(day=10)
    _make_sale(db, company_id, clients[2], vendedor2, None, "NF-2026-0020",
               two_months, [
                   (products[3], Decimal("8"), Decimal("115.00")),
               ])

    db.flush()
    return True


def _ensure_user(db: Session, company_id: int, profile_id: int, name: str, email: str, password: str) -> User:
    user = db.query(User).filter(User.company_id == company_id, User.email == email).first()
    if user:
        return user
    user = User(
        company_id=company_id, profile_id=profile_id, name=name, email=email,
        password_hash=get_password_hash(password), active=True,
    )
    db.add(user)
    db.flush()
    return user


def _make_quote(
    db, company_id, client, user, status, deadline, notes, items_spec,
    days_ago=0, lost_reason=None, requires_approval=False, management_approved=False,
    based_on_quote_id=None,
) -> Quote:
    quote = Quote(
        company_id=company_id, client_id=client.id, user_id=user.id, status=status,
        response_deadline=deadline, notes=notes, lost_reason=lost_reason,
        requires_management_approval=requires_approval, management_approved=management_approved,
        based_on_quote_id=based_on_quote_id,
        created_at=now_br() - timedelta(days=days_ago),
    )
    db.add(quote)
    db.flush()
    for prod, qty, price, desc, extra in items_spec:
        db.add(QuoteItem(
            quote_id=quote.id, product_id=prod.id, quantity=qty, unit_price=price,
            description_choice=desc, extra_info=extra,
        ))
    return quote


def _make_order(db, company_id, client, user, quote, status, items_spec, days_ago=0, notes=None) -> Order:
    order = Order(
        company_id=company_id, client_id=client.id, user_id=user.id,
        quote_id=quote.id if quote else None, status=status, notes=notes,
        created_at=now_br() - timedelta(days=days_ago),
    )
    db.add(order)
    db.flush()
    for prod, qty, price in items_spec:
        db.add(OrderItem(order_id=order.id, product_id=prod.id, quantity=qty, unit_price=price))
    return order


def _make_sale(db, company_id, client, user, order, invoice, sale_date, items_spec) -> Sale:
    total = Decimal("0")
    sale = Sale(
        company_id=company_id, client_id=client.id, user_id=user.id,
        order_id=order.id if order else None, invoice_number=invoice,
        sale_date=sale_date, created_at=now_br(),
    )
    db.add(sale)
    db.flush()
    for prod, qty, price in items_spec:
        line = qty * price
        total += line
        db.add(SaleItem(
            sale_id=sale.id, product_id=prod.id, quantity=qty,
            unit_price=price, total_price=line,
        ))
    sale.total_amount = total
    if order:
        order.status = OrderStatus.faturado
    return sale


def _clear_demo_data(db: Session, company_id: int) -> None:
    """Remove dados operacionais mantendo admin e perfis."""
    from .models import AuditLog

    db.query(SaleItem).filter(SaleItem.sale_id.in_(
        db.query(Sale.id).filter(Sale.company_id == company_id)
    )).delete(synchronize_session=False)
    db.query(Sale).filter(Sale.company_id == company_id).delete()
    db.query(OrderItem).filter(OrderItem.order_id.in_(
        db.query(Order.id).filter(Order.company_id == company_id)
    )).delete(synchronize_session=False)
    db.query(Order).filter(Order.company_id == company_id).delete()
    db.query(QuoteItem).filter(QuoteItem.quote_id.in_(
        db.query(Quote.id).filter(Quote.company_id == company_id)
    )).delete(synchronize_session=False)
    db.query(Quote).filter(Quote.company_id == company_id).delete()
    db.query(StockLot).filter(StockLot.company_id == company_id).delete()
    db.query(ProductClientPrice).filter(ProductClientPrice.product_id.in_(
        db.query(Product.id).filter(Product.company_id == company_id)
    )).delete(synchronize_session=False)
    db.query(Product).filter(Product.company_id == company_id).delete()
    db.query(Client).filter(Client.company_id == company_id).delete()
    db.query(Campaign).filter(Campaign.company_id == company_id).delete()
    db.query(InfoBoardItem).filter(InfoBoardItem.company_id == company_id).delete()
    db.query(User).filter(
        User.company_id == company_id,
        User.email.notin_(["admin@marcelo.com"]),
    ).delete(synchronize_session=False)
    db.flush()
