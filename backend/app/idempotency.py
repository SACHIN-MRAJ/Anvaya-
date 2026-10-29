"""Idempotency-Key support for the requests that must never happen twice (final submission, deficiency replies).

The client sends a random Idempotency-Key header per attempt and reuses it on retry. The first request records
the key before doing the work; a repeat gets the stored answer (with Idempotent-Replayed: true), a repeat while
the first is still running gets 409, and the same key with different content gets 422.
"""
import hashlib
import json
import re
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .models import IdempotencyKey
from .schemas import Principal

KEY_FORMAT = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
TTL = timedelta(hours=24)


async def run_once(session: AsyncSession, user: Principal, client_key: str | None, body: object, status_code: int, work: Callable[[], Awaitable[object]]):
    if not client_key:
        return await work()
    if not KEY_FORMAT.match(client_key):
        raise HTTPException(422, "Idempotency-Key must be 8 to 64 letters, digits, hyphens or underscores.")
    key = f"{user.id}:{client_key}"
    digest = hashlib.sha256(json.dumps(jsonable_encoder(body), sort_keys=True).encode()).hexdigest()

    await session.execute(delete(IdempotencyKey).where(IdempotencyKey.created_at < datetime.now() - TTL))
    session.add(IdempotencyKey(key=key, request_hash=digest))
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        seen = await session.get(IdempotencyKey, key)
        if seen is None:  # expired between the two statements; treat as new
            return await run_once(session, user, client_key, body, status_code, work)
        if seen.request_hash != digest:
            raise HTTPException(422, "This Idempotency-Key was already used for a different request.") from None
        if seen.status_code is None:
            raise HTTPException(409, "This request is already being processed. Check your applications in a moment.") from None
        return JSONResponse(seen.response, status_code=seen.status_code, headers={"Idempotent-Replayed": "true"})

    try:
        result = await work()
    except BaseException:
        await session.rollback()
        await session.execute(delete(IdempotencyKey).where(IdempotencyKey.key == key))
        await session.commit()
        raise
    row = await session.get(IdempotencyKey, key)
    row.status_code, row.response = status_code, jsonable_encoder(result)
    await session.commit()
    return result
