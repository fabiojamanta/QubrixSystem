def sanitize_search_term(q: str | None, max_len: int = 80) -> str | None:
    if not q:
        return None
    s = q.strip()[:max_len]
    return s.replace("%", "").replace("_", "")
