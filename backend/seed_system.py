"""Carga inicial manual: empresa, perfis, admin, menu e (opcional) dados de exemplo."""
import sys

from app.bootstrap import run_initial_load


def main() -> int:
    demo = "--demo" in sys.argv
    force = "--force" in sys.argv
    try:
        run_initial_load(demo=demo, force_demo=force)
    except Exception as exc:
        print(f"Erro: {exc}")
        return 1

    if demo:
        print("Carga inicial concluída (sistema + dados de exemplo).")
    else:
        print("Carga inicial concluída (empresa, perfis, admin e menu).")
        print("Para incluir dados de exemplo: python seed_system.py --demo")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
