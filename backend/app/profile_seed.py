from sqlalchemy.orm import Session

from .models import AccessLevel, MenuItemRecord, Profile, ProfilePermission
from .menu_catalog import MENU_CATALOG, route_paths_json

SYSTEM_PROFILES = [
    {"slug": "administrador", "name": "Administrador", "is_admin": True, "is_management": True},
    {"slug": "gerencia", "name": "Gerência / Supervisão", "is_admin": False, "is_management": True},
    {"slug": "vendedor", "name": "Vendedor", "is_admin": False, "is_management": False},
]

DEFAULT_PERMISSIONS = {
    "gerencia": {
        "dashboard": "write",
        "produtos": "write",
        "clientes": "write",
        "estoque": "write",
        "cotacoes": "write",
        "pedidos": "write",
        "vendas": "write",
        "campanhas": "write",
        "informacoes": "write",
        "usuarios": "write",
    },
    "vendedor": {
        "dashboard": "write",
        "clientes": "read",
        "estoque": "read",
        "cotacoes": "write",
        "pedidos": "write",
        "vendas": "read",
    },
}


def sync_menu_catalog(db: Session) -> None:
    existing = {m.menu_key: m for m in db.query(MenuItemRecord).all()}
    for entry in MENU_CATALOG:
        row = existing.get(entry["menu_key"])
        if not row:
            row = MenuItemRecord(
                menu_key=entry["menu_key"],
                label=entry["label"],
                route_paths=route_paths_json(entry["route_paths"]),
                nav_group=entry.get("nav_group"),
                sort_order=entry["sort_order"],
                active=True,
            )
            db.add(row)
        else:
            row.label = entry["label"]
            row.route_paths = route_paths_json(entry["route_paths"])
            row.nav_group = entry.get("nav_group")
            row.sort_order = entry["sort_order"]
            row.active = True
    db.flush()

    profiles = db.query(Profile).filter(Profile.is_admin == False).all()
    menu_keys = [e["menu_key"] for e in MENU_CATALOG]
    for profile in profiles:
        for mk in menu_keys:
            if db.query(ProfilePermission).filter_by(profile_id=profile.id, menu_key=mk).first():
                continue
            db.add(ProfilePermission(profile_id=profile.id, menu_key=mk, access_level=AccessLevel.hidden))
    db.flush()


def seed_profiles(db: Session, company_id: int = 1) -> dict[str, Profile]:
    by_slug: dict[str, Profile] = {}
    for spec in SYSTEM_PROFILES:
        p = db.query(Profile).filter_by(company_id=company_id, slug=spec["slug"]).first()
        if not p:
            p = Profile(
                company_id=company_id,
                name=spec["name"],
                slug=spec["slug"],
                is_system=True,
                is_admin=spec["is_admin"],
                is_management=spec["is_management"],
                active=True,
            )
            db.add(p)
            db.flush()
        else:
            p.name = spec["name"]
            p.is_system = True
            p.is_admin = spec["is_admin"]
            p.is_management = spec["is_management"]
            p.active = True
        by_slug[spec["slug"]] = p

    sync_menu_catalog(db)

    for slug, perms in DEFAULT_PERMISSIONS.items():
        profile = by_slug.get(slug)
        if not profile or profile.is_admin:
            continue
        for menu_key, level_str in perms.items():
            level = AccessLevel(level_str)
            row = db.query(ProfilePermission).filter_by(profile_id=profile.id, menu_key=menu_key).first()
            if row:
                row.access_level = level
            else:
                db.add(ProfilePermission(profile_id=profile.id, menu_key=menu_key, access_level=level))
    db.flush()
    return by_slug
