"""Patches incrementais de schema para bancos já existentes."""
from sqlalchemy import inspect, text

from .database import SessionLocal, engine


def apply_schema_patches() -> None:
    insp = inspect(engine)
    if "clients" not in insp.get_table_names():
        return

    cols = {c["name"] for c in insp.get_columns("clients")}
    with engine.begin() as conn:
        if "registration_number" not in cols:
            conn.execute(text("ALTER TABLE clients ADD COLUMN registration_number VARCHAR(40)"))
        if "responsible_user_id" not in cols:
            conn.execute(text("ALTER TABLE clients ADD COLUMN responsible_user_id INTEGER"))

    from .models import Client

    db = SessionLocal()
    try:
        rows = db.query(Client).filter(
            (Client.registration_number.is_(None)) | (Client.registration_number == "")
        ).all()
        for client in rows:
            client.registration_number = f"{client.id:06d}"
        if rows:
            db.commit()
    finally:
        db.close()
