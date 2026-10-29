"""A small time-based cache for public answers that are the same for everyone (status, open performance data).

Each API process keeps its own copy for a few seconds, and the response says how long browsers and proxies may
reuse it. Only public, non-personal data goes through here; anything tied to a signed-in person never does.
"""
import asyncio
import time
from collections.abc import Awaitable, Callable

from fastapi import Response

_store: dict[str, tuple[float, object]] = {}
_locks: dict[str, asyncio.Lock] = {}


async def public(key: str, seconds: int, response: Response, compute: Callable[[], Awaitable[object]]) -> object:
    response.headers["Cache-Control"] = f"public, max-age={seconds}"
    hit = _store.get(key)
    if hit and hit[0] > time.monotonic():
        return hit[1]
    async with _locks.setdefault(key, asyncio.Lock()):  # one computation at a time, the rest wait for it
        hit = _store.get(key)
        if hit and hit[0] > time.monotonic():
            return hit[1]
        value = await compute()
        _store[key] = (time.monotonic() + seconds, value)
        return value


def clear() -> None:
    _store.clear()
