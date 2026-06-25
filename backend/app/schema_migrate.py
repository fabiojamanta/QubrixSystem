"""Patches incrementais de schema para bancos já existentes."""
from sqlalchemy import inspect, text

from .database import SessionLocal, engine

PATCHES = [
    ("clients", "registration_number", "registration_number VARCHAR(40)"),
    ("clients", "responsible_user_id", "responsible_user_id INTEGER"),
    ("campaigns", "show_early_notice", "show_early_notice BOOLEAN DEFAULT FALSE"),
    ("campaigns", "early_notice_days", "early_notice_days INTEGER"),
    ("info_board_items", "start_date", "start_date DATE"),
    ("info_board_items", "end_date", "end_date DATE"),
    ("users", "updated_at", "updated_at TIMESTAMP"),
    ("quotes", "lost_reason_detail", "lost_reason_detail TEXT"),
]

SQLITE_PATCHES = [
    ("clients", "registration_number", "registration_number VARCHAR(40)"),
    ("clients", "responsible_user_id", "responsible_user_id INTEGER"),
    ("campaigns", "show_early_notice", "show_early_notice BOOLEAN DEFAULT 0"),
    ("campaigns", "early_notice_days", "early_notice_days INTEGER"),
    ("info_board_items", "start_date", "start_date DATE"),
    ("info_board_items", "end_date", "end_date DATE"),
    ("users", "updated_at", "updated_at DATETIME"),
    ("quotes", "lost_reason_detail", "lost_reason_detail TEXT"),
]


def _add_column_sqlite(conn, table: str, column: str, ddl: str) -> None:
    insp = inspect(engine)
    if table not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns(table)}
    if column not in cols:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))


def _apply_postgres_patches(conn) -> None:
    for table, _column, ddl in PATCHES:
        exists = conn.execute(
            text("SELECT to_regclass(:name) IS NOT NULL"),
            {"name": table},
        ).scalar()
        if not exists:
            continue
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {ddl}"))


def _apply_sqlite_patches(conn) -> None:
    for table, column, ddl in SQLITE_PATCHES:
        _add_column_sqlite(conn, table, column, ddl)


def _backfill_data() -> None:
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


def apply_schema_patches() -> None:
    with engine.begin() as conn:
        if engine.dialect.name == "sqlite":
            _apply_sqlite_patches(conn)
        else:
            _apply_postgres_patches(conn)

    _backfill_data()
