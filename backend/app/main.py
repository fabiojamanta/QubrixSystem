from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .database import Base, engine, SessionLocal
from .models import Company, User
from .config import settings
from .security import get_password_hash, validate_password_strength
from .routers import auth, dashboard, products, clients, stock, quotes, orders, sales, campaigns, info_board, users
from .profile_seed import seed_profiles, sync_menu_catalog
from .demo_seed import seed_demo_data
from .middleware import SecurityHeadersMiddleware, CsrfMiddleware
from .rate_limit import limiter

Base.metadata.create_all(bind=engine)


def seed():
    db = SessionLocal()
    try:
        company = db.query(Company).filter(Company.id == 1).first()
        if not company:
            company = Company(id=1, name="Empresa Principal", active=True)
            db.add(company)
            db.flush()

        by_slug = seed_profiles(db)
        admin_profile = by_slug["administrador"]

        admin_email = settings.ADMIN_EMAIL.strip() or (
            "admin@qubrix.com" if not settings.is_production else ""
        )
        admin_password = settings.ADMIN_PASSWORD or (
            "Admin@1234" if not settings.is_production else ""
        )
        if admin_email and admin_password:
            validate_password_strength(admin_password)
            existing = db.query(User).filter(User.company_id == company.id, User.email == admin_email).first()
            if not existing:
                db.add(User(
                    company_id=company.id,
                    profile_id=admin_profile.id,
                    name="Administrador",
                    email=admin_email,
                    password_hash=get_password_hash(admin_password),
                    active=True,
                ))
        sync_menu_catalog(db)
        if settings.SEED_DEMO_DATA and not settings.is_production:
            seed_demo_data(db)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


seed()

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


@app.get("/")
@limiter.limit("60/minute")
def health(request: Request):
    return {"status": "online", "app": settings.APP_NAME}
