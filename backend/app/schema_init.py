import logging
import threading

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_ready = False
_init_error: Exception | None = None

SCHEMA_INIT_TIMEOUT_SECONDS = 180


class SchemaNotReadyError(RuntimeError):
    pass


def _apply_schema() -> None:
    from .database import Base, engine
    from .schema_migrate import apply_schema_patches

    Base.metadata.create_all(bind=engine)
    apply_schema_patches()


def ensure_schema() -> None:
    global _ready, _init_error
    if _ready:
        return
    if _init_error is not None:
        logger.info("Nova tentativa de inicialização do schema após falha anterior")

    acquired = _lock.acquire(timeout=SCHEMA_INIT_TIMEOUT_SECONDS)
    if not acquired:
        raise SchemaNotReadyError(
            "Banco indisponível: timeout aguardando inicialização do schema "
            f"({SCHEMA_INIT_TIMEOUT_SECONDS}s)"
        )

    try:
        if _ready:
            return

        logger.info("Inicializando schema do banco...")
        _apply_schema()
        _ready = True
        _init_error = None
        logger.info("Schema do banco pronto")
    except Exception as exc:
        _init_error = exc
        logger.exception("Falha ao inicializar schema: %s", exc)
        raise SchemaNotReadyError(f"Banco indisponível: {exc}") from exc
    finally:
        _lock.release()


def schema_status() -> dict:
    if _ready:
        return {"schema": "ready"}
    if _init_error is not None:
        return {"schema": "error", "detail": str(_init_error)}
    return {"schema": "pending"}
