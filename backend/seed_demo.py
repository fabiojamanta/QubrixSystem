"""Script para popular ou repopular dados de demonstração."""
import sys

from app.bootstrap import bootstrap_database
from app.database import SessionLocal
from app.demo_seed import seed_demo_data, _has_demo_data
from app.models import Company
from app.schema_init import ensure_schema


def main():
    force = "--force" in sys.argv
    ensure_schema()
    db = SessionLocal()
    try:
        if not db.query(Company).filter(Company.id == 1).first():
            print("Empresa não encontrada — executando carga inicial do sistema...")
            bootstrap_database(db)
            db.flush()

        if _has_demo_data(db) and not force:
            print("Dados de exemplo já existem. Use --force para repopular.")
            return 0
        inserted = seed_demo_data(db, force=force)
        db.commit()
        if inserted:
            print("Dados de exemplo inseridos com sucesso.")
        else:
            print("Nenhum dado inserido.")
        return 0
    except Exception as e:
        db.rollback()
        print(f"Erro: {e}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
