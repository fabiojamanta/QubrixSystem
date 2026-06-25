import threading

_lock = threading.Lock()
_ready = False


def ensure_schema() -> None:
    global _ready
    if _ready:
        return
    with _lock:
        if _ready:
            return
        from .database import Base, engine
        from .schema_migrate import apply_schema_patches

        Base.metadata.create_all(bind=engine)
        apply_schema_patches()
        _ready = True
