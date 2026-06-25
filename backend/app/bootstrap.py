"""Carga inicial do sistema (empresa, perfis, admin, menu). Executar manualmente via seed_system.py."""
from sqlalchemy.orm import Session

from .config import settings
from .database import SessionLocal
from .demo_seed import seed_demo_data
from .models import Company, User
from .profile_seed import seed_profiles, sync_menu_catalog
from .security import get_password_hash, validate_password_strength


from .schema_init import ensure_schema


def bootstrap_database(db: Session) -> None:
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
        try:
            validate_password_strength(admin_password)
        except Exception as exc:
            detail = getattr(exc, "detail", str(exc))
            raise ValueError(f"ADMIN_PASSWORD inválida: {detail}") from exc
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


def run_initial_load(*, demo: bool = False, force_demo: bool = False) -> None:
    ensure_schema()
    db = SessionLocal()
    try:
        bootstrap_database(db)
        if demo:
            seed_demo_data(db, force=force_demo)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
