import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .config import settings
from .routers import auth, dashboard, products, clients, stock, quotes, orders, sales, campaigns, info_board, users
from .middleware import SecurityHeadersMiddleware, CsrfMiddleware
from .rate_limit import limiter

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

_docs_kwargs = (
    {"docs_url": None, "redoc_url": None, "openapi_url": None}
    if settings.is_production
    else {}
)
app = FastAPI(title=settings.APP_NAME, version="1.0.0", **_docs_kwargs)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(CsrfMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token", "Accept"],
    expose_headers=["X-CSRF-Token"],
)

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(products.router)
app.include_router(clients.router)
app.include_router(stock.router)
app.include_router(quotes.router)
app.include_router(orders.router)
app.include_router(sales.router)
app.include_router(campaigns.router)
app.include_router(info_board.router)
app.include_router(users.router)

logger.info("QuBrix API carregada (porta %s, schema sob demanda)", os.environ.get("PORT", "?"))


@app.get("/")
def health():
    return {"status": "online", "app": settings.APP_NAME}
