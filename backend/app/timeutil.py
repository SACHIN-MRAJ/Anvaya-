"""One clock for the whole API.

Stored times are the server's local time (the API runs on Indian Standard Time, like the receipts it issues), set by
the application rather than the database, so SQLite and PostgreSQL behave the same. Every time that leaves the API
carries its UTC offset, so any browser shows it correctly.
"""
from datetime import datetime


def now() -> datetime:
    return datetime.now().replace(microsecond=0)


def local_iso(value: datetime | None) -> str | None:
    """2026-10-23T20:31:05+05:30: a stored time with its offset (a stored time without one is server-local)."""
    if value is None:
        return None
    return (value if value.tzinfo else value.astimezone()).isoformat(timespec="seconds")
