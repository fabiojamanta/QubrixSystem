import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .database import Base, engine
from .config import settings
from .routers import auth, dashboard, products, clients, stock, quotes, orders, sales, campaigns, info_board, users
from .schema_migrate import apply_schema_patches
from .middleware import SecurityHeadersMiddleware, CsrfMiddleware
from .rate_limit import limiter

logger = logging.getLogger(__name__)

_startup_ready = asyncio.Event()
_startup_error: Exception | None = None


def init_database() -> None:
    Base.metadata.create_all(bind=engine)
    apply_schema_patches()


async def _run_startup() -> None:
    global _startup_error
    try:
        await asyncio.to_thread(init_database)
        logger.info("Banco inicializado com sucesso")
    except Exception as exc:
        _startup_error = exc
        logger.exception("Falha ao inicializar o banco: %s", exc)
    finally:
        _startup_ready.set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    startup_task = asyncio.create_task(_run_startup())
    yield
    startup_task.cancel()
    try:
        await startup_task
    except asyncio.CancelledError:
        pass


_docs_kwargs = (
    {"docs_url": None, "redoc_url": None, "openapi_url": None}
    if settings.is_production
    else {}
)
app = FastAPI(title=settings.APP_NAME, version="1.0.0", lifespan=lifespan, **_docs_kwargs)
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


@app.get("/")
@limiter.limit("60/minute")
def health(request: Request):
    if _startup_error is not None:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "app": settings.APP_NAME, "detail": str(_startup_error)},
        )
    if not _startup_ready.is_set():
        return {"status": "starting", "app": settings.APP_NAME}
    return {"status": "online", "app": settings.APP_NAME}
