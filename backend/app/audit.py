"""Tamper-evident evidence log.

Each reference (an application, or a register such as RULES) has its own SHA-256 hash chain:
hash = sha256(prev_hash | seq | at | payload). The format is identical to the browser's check in
frontend/src/services/api.ts, so anyone can re-verify the server's log in their own browser.
"""
import hashlib
import json
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import AuditEntry

GENESIS = "0" * 64


def sha256_hex(data: str | bytes) -> str:
    return hashlib.sha256(data.encode() if isinstance(data, str) else data).hexdigest()


def payload_for(ref: str, action: str, actor: str, role: str, rule: str | None, note: str | None) -> str:
    # Same key order and spacing as JSON.stringify in the frontend.
    return json.dumps({"ref": ref, "action": action, "actor": actor, "role": role, "rule": rule, "note": note}, separators=(",", ":"), ensure_ascii=False)


def link(prev: str, seq: int, at: str, payload: str) -> str:
    return sha256_hex(f"{prev}|{seq}|{at}|{payload}")


def now_iso() -> str:
    return datetime.now().replace(microsecond=0).isoformat()


async def append(session: AsyncSession, ref: str, action: str, actor: str, role: str, rule: str | None = None, note: str | None = None, at: str | None = None) -> AuditEntry:
    last = (await session.execute(select(AuditEntry).where(AuditEntry.ref == ref).order_by(AuditEntry.seq.desc()).limit(1))).scalar_one_or_none()
    prev = last.hash if last else GENESIS
    seq = (last.seq if last else 0) + 1
    at = at or now_iso()
    payload = payload_for(ref, action, actor, role, rule, note)
    entry = AuditEntry(ref=ref, seq=seq, at=at, actor=actor, action=action, payload=payload, prev_hash=prev, hash=link(prev, seq, at, payload))
    session.add(entry)
    await session.flush()
    return entry


async def chain(session: AsyncSession, ref: str) -> list[AuditEntry]:
    return list((await session.execute(select(AuditEntry).where(AuditEntry.ref == ref).order_by(AuditEntry.seq))).scalars())


def verify_entries(entries: list[AuditEntry]) -> dict:
    prev = GENESIS
    for e in entries:
        if e.prev_hash != prev or e.hash != link(prev, e.seq, e.at, e.payload):
            return {"ok": False, "brokenAt": e.seq, "count": len(entries), "head": entries[-1].hash if entries else GENESIS}
        prev = e.hash
    return {"ok": True, "brokenAt": None, "count": len(entries), "head": prev}


async def daily_root(session: AsyncSession) -> str:
    """One hash over the head of every chain: publish it daily (and time-stamp it with RFC 3161)."""
    rows = (await session.execute(select(AuditEntry.ref, func.max(AuditEntry.seq)).group_by(AuditEntry.ref))).all()
    heads = []
    for ref, seq in sorted(rows):
        h = (await session.execute(select(AuditEntry.hash).where(AuditEntry.ref == ref, AuditEntry.seq == seq))).scalar_one()
        heads.append(f"{ref}:{h}")
    return sha256_hex("\n".join(heads))
