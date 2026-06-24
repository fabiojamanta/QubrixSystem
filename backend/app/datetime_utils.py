from datetime import datetime
from zoneinfo import ZoneInfo

from .config import settings


def now_br() -> datetime:
    return datetime.now(ZoneInfo(settings.TIMEZONE)).replace(tzinfo=None)


def today_br():
    return now_br().date()
