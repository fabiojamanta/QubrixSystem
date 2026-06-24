import json
from pathlib import Path

_CATALOG_PATH = Path(__file__).resolve().parents[2] / "shared" / "menu-catalog.json"


def load_menu_catalog() -> list[dict]:
    with open(_CATALOG_PATH, encoding="utf-8") as f:
        return json.load(f)


MENU_CATALOG = load_menu_catalog()


def route_paths_json(paths: list[str]) -> str:
    return json.dumps(paths, ensure_ascii=False)
