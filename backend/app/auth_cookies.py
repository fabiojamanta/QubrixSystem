from fastapi import Response

from .config import settings

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"


def cookie_flags() -> dict:
    """Cross-origin (frontend ≠ API no Render) exige SameSite=None + Secure."""
    if settings.is_production:
        return {"secure": True, "samesite": "none"}
    return {"secure": False, "samesite": "lax"}


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    flags = cookie_flags()
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        **flags,
    )
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/auth",
        **flags,
    )


def clear_auth_cookies(response: Response) -> None:
    flags = cookie_flags()
    response.delete_cookie(ACCESS_COOKIE, path="/", **flags)
    response.delete_cookie(REFRESH_COOKIE, path="/auth", **flags)
