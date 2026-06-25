"""Patches incrementais de schema para bancos já existentes."""
from sqlalchemy import inspect, text

from .database import SessionLocal, engine


def _add_column_if_missing(conn, table: str, column: str, ddl: str) -> None:
    insp = inspect(engine)
    if table not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns(table)}
    if column not in cols:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))


def apply_schema_patches() -> None:
    is_sqlite = engine.dialect.name == "sqlite"
    bool_default = "0" if is_sqlite else "FALSE"
    datetime_type = "DATETIME" if is_sqlite else "TIMESTAMP"

    with engine.begin() as conn:
        _add_column_if_missing(conn, "clients", "registration_number", "registration_number VARCHAR(40)")
        _add_column_if_missing(conn, "clients", "responsible_user_id", "responsible_user_id INTEGER")
        _add_column_if_missing(conn, "campaigns", "show_early_notice", f"show_early_notice BOOLEAN DEFAULT {bool_default}")
        _add_column_if_missing(conn, "campaigns", "early_notice_days", "early_notice_days INTEGER")
        _add_column_if_missing(conn, "info_board_items", "start_date", "start_date DATE")
        _add_column_if_missing(conn, "info_board_items", "end_date", "end_date DATE")
        _add_column_if_missing(conn, "users", "updated_at", f"updated_at {datetime_type}")
        _add_column_if_missing(conn, "quotes", "lost_reason_detail", "lost_reason_detail TEXT")

    from .models import Client, User

    db = SessionLocal()
    try:
        rows = db.query(Client).filter(
            (Client.registration_number.is_(None)) | (Client.registration_number == "")
        ).all()
        for client in rows:
            client.registration_number = f"{client.id:06d}"

        users = db.query(User).filter(User.updated_at.is_(None)).all()
        for user in users:
            user.updated_at = user.created_at

        if rows or users:
            db.commit()
    finally:
        db.close()
