from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import settings

if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
elif settings.DATABASE_URL.startswith("postgresql"):
    connect_args = {
        "connect_timeout": 10,
        "options": "-c statement_timeout=60000",
    }
else:
    connect_args = {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_timeout=10,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    from .schema_init import SchemaNotReadyError, ensure_schema

    try:
        ensure_schema()
    except SchemaNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
