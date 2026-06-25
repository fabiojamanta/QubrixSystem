import logging
import os
import threading

import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("start")


def _warm_schema() -> None:
    try:
        from app.schema_init import ensure_schema

        ensure_schema()
    except Exception as exc:
        logger.warning("Schema nao pronto no startup (tentativa nas requisicoes): %s", exc)


if __name__ == "__main__":
    threading.Thread(target=_warm_schema, daemon=True, name="schema-warm").start()
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8000")),
        log_level="info",
    )
