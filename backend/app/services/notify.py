"""Alerts: one outbox, several channels.

Every alert is delivered on each enabled channel and recorded with its delivery results in the same transaction as
the action that caused it (the in-portal bell and notifications page read it). It reaches the people it concerns: the institution's users, or the officers of that region (all officers when the
alert has no region), each only on the channels they chose. Channel adapters are swappable: "log" for
development, SMTP for email, an HTTP gateway for SMS (DLT-registered templates) and WhatsApp Business.
A failed delivery is recorded on the alert, never lost.
"""
import asyncio
import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from urllib.parse import urlparse

import httpx
from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models import KeyValue, Notification, User
from ..observability import ALERTS

log = logging.getLogger("anumati.notify")


async def _recipients(session: AsyncSession, audience: str, institution_id: str | None, region: str | None) -> list[User]:
    stmt = select(User).where(User.portal == audience, User.active.is_(True))  # switched-off accounts get nothing
    if audience == "institution":
        stmt = stmt.where(User.institution_id == institution_id)
    elif region:
        stmt = stmt.where(or_(User.region == region, User.region.is_(None)))
    return list((await session.execute(stmt)).scalars())


def _body(title: str, ref: str | None, audience: str) -> str:
    portal = f"{settings.web_url.rstrip('/')}/{'institution' if audience == 'institution' else 'aicte'}"
    lines = [title, ""]
    if ref and ref.startswith("ANU-"):
        lines.append(f"Open {ref}: {portal}/applications/{ref}")
    lines += [f"Sign in: {portal}", "", "This alert is recorded in the ANUMATI evidence log. Do not reply to this email."]
    return "\n".join(lines)


async def _email(title: str, to: list[str], body: str) -> str:
    if not to:
        return "no recipient"
    if settings.email_mode != "smtp" or not settings.smtp_url:
        log.debug("email (logged) to %d: %s", len(to), title)
        return "logged"
    u = urlparse(settings.smtp_url)
    sender = u.username if u.username and "@" in u.username else "alerts@anumati.example"

    def send() -> None:
        msg = EmailMessage()
        msg["Subject"] = f"ANUMATI: {title[:90]}"
        msg["From"] = formataddr(("ANUMATI alerts", sender))
        msg["To"] = formataddr(("ANUMATI alerts", sender))
        msg["Bcc"] = ", ".join(to)  # recipients never see each other's addresses
        msg["Message-ID"] = make_msgid(domain="anumati.example")
        msg.set_content(body)
        with smtplib.SMTP(u.hostname or "localhost", u.port or 587, timeout=10) as s:
            if u.password:
                s.starttls()
                s.login(u.username or "", u.password)
            s.send_message(msg)

    try:
        await asyncio.to_thread(send)
        return "sent"
    except Exception as e:  # delivery failure is recorded on the notification
        log.warning("email failed: %s", e)
        return "failed"


async def _http(mode: str, url: str, channel: str, title: str, to: list[str]) -> str:
    if not to:
        return "no recipient"
    if mode != "http" or not url:
        log.debug("%s (logged) to %d: %s", channel, len(to), title)
        return "logged"
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.post(url, json={"channel": channel, "to": to, "text": title})
            return "sent" if r.is_success else "failed"
    except httpx.HTTPError as e:
        log.warning("%s failed: %s", channel, e)
        return "failed"


async def notify(session: AsyncSession, audience: str, title: str, tone: str = "brand", ref: str | None = None, institution_id: str | None = None, region: str | None = None) -> Notification:
    prefs = await session.get(KeyValue, "alerts")
    enabled = (prefs.value if prefs else {}).get("channels", {"email": True})
    channels = [c for c in ("email", "sms", "whatsapp") if enabled.get(c)]
    people = await _recipients(session, audience, institution_id, region) if channels else []
    wants = {c: [p for p in people if c in (p.channels or [])] for c in channels}
    delivery = {}
    for c in channels:
        if c == "email":
            delivery[c] = await _email(title, [p.email for p in wants[c] if p.email], _body(title, ref, audience))
        elif c == "sms":
            delivery[c] = await _http(settings.sms_mode, settings.sms_api_url, "sms", title, [p.phone for p in wants[c] if p.phone])
        else:
            delivery[c] = await _http(settings.whatsapp_mode, settings.whatsapp_api_url, "whatsapp", title, [p.phone for p in wants[c] if p.phone])
    # Written once, complete: with row-level security the sender may not be allowed to read (or update) an alert
    # meant for someone else, so there is no insert-then-update and no RETURNING.
    n = Notification(audience=audience, title=title, tone=tone, ref=ref, institution_id=institution_id, region=region, channels=channels, delivery=delivery)
    if session.bind.dialect.name == "postgresql":
        n.id = (await session.execute(text("SELECT nextval(pg_get_serial_sequence('notifications', 'id'))"))).scalar_one()
    session.add(n)
    for channel, result in delivery.items():
        ALERTS.labels(channel, result).inc()
    log.info("alert to %s via %s: %s", audience, ",".join(f"{c}={v}" for c, v in delivery.items()) or "portal only", title)
    await session.flush()
    return n
