from decimal import Decimal

from .models import Product, DescriptionChoice, ProfitabilityLevel


def product_display_description(product: Product, choice: str, extra_info: str | None = None) -> str:
    base = product.short_description if choice == DescriptionChoice.curta.value else (product.long_description or product.short_description)
    parts = [base]
    if product.brand:
        parts.append(product.brand)
    parts.append(f"{product.qty_per_package} {product.sale_unit.value}")
    if extra_info:
        parts.append(extra_info)
    return " — ".join(parts)


def profitability_for_price(product: Product, unit_price: Decimal) -> str:
    general = Decimal(str(product.general_price or 0))
    cost = Decimal(str(product.cost_price or 0))
    if general <= 0:
        return ProfitabilityLevel.verde.value
    margin = (unit_price - cost) / general if general else Decimal("0")
    if unit_price >= general * Decimal("0.95"):
        return ProfitabilityLevel.verde.value
    if unit_price >= general * Decimal("0.80"):
        return ProfitabilityLevel.amarelo.value
    return ProfitabilityLevel.vermelho.value


def resolve_unit_price(product: Product, client_id: int | None, client_prices: dict[tuple[int, int], Decimal]) -> Decimal:
    if client_id and (product.id, client_id) in client_prices:
        return client_prices[(product.id, client_id)]
    return Decimal(str(product.general_price or 0))
