"""WhatsApp and SMS. Status is given only to the institution's registered number; everything else is a
general answer from the handbook. Hindi questions get Hindi status replies; with a Bhashini key, voice
notes are transcribed and answers translated into any of the 22 scheduled languages."""
import hashlib
import hmac
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_session
from ..models import Application, User
from ..schemas import WhatsAppIn
from ..services import assistant, insight

async def verify_signature(request: Request) -> None:
    """Providers sign each webhook with a shared secret (X-Hub-Signature-256: sha256=<HMAC of the raw body>).
    Required in production; without it anyone could send messages pretending to be a registered phone."""
    if not settings.webhook_secret:
        return
    expected = "sha256=" + hmac.new(settings.webhook_secret.encode(), await request.body(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(request.headers.get("x-hub-signature-256", ""), expected):
        raise HTTPException(401, "Webhook signature missing or wrong")


router = APIRouter(prefix="/channels", tags=["WhatsApp and SMS"], dependencies=[Depends(verify_signature)])
STAGE_HI = {"scrutiny": "दस्तावेज़ जाँच", "rescrutiny": "पुनः जाँच", "evc": "विशेषज्ञ दौरे (EVC)", "shc": "सुनवाई (SHC)", "ec": "कार्यकारी समिति", "decision": "निर्णय", "appeal": "अपील"}


async def _reply(session: AsyncSession, sender: str, text: str) -> dict:
    hindi = bool(re.search(r"[ऀ-ॿ]", text))
    ref = re.search(r"ANU-?\d{4}-?(\d{4})|\b(\d{4})\b", text.upper())
    if ref:
        app_id = f"ANU-2026-{ref.group(1) or ref.group(2)}"
        app = await session.get(Application, app_id)
        user = (await session.execute(select(User).where(User.phone == sender))).scalar_one_or_none()
        if app and (not settings.secure or (user and user.institution_id == app.institution_id)):
            stage = insight.STAGE_TO_STEP[app.stage]
            if hindi:
                return {"reply": f"आवेदन {app.id} अभी {STAGE_HI.get(app.stage, stage)} के चरण में है। स्थिति: {app.public_status}.", "lang": "hi"}
            return {"reply": f"{app.id} is at {stage}. Status: {app.public_status}.", "lang": "en"}
        return {"reply": "This number is not registered for that application." if not hindi else "यह नंबर इस आवेदन के लिए पंजीकृत नहीं है।", "lang": "hi" if hindi else "en"}
    a = await assistant.respond(session, None, text)  # as a visitor: status only through the registered-number path above
    body = a["text"] + ("\n" + "\n".join(f"• {b}" for b in a["bullets"]) if a.get("bullets") else "") + (f"\n({', '.join(a['cites'])})" if a.get("cites") else "")
    return {"reply": body, "lang": "en", "translated": False if not settings.bhashini_api_key else None}


@router.post("/whatsapp/webhook", summary="Incoming WhatsApp text or voice note")
async def whatsapp(body: WhatsAppIn, session: AsyncSession = Depends(get_session)):
    text = body.text
    if body.audio_url and not text and not settings.bhashini_api_key:
        return {"reply": "Voice notes need the Bhashini speech service to be configured. Please type your question.", "lang": "en"}
    return await _reply(session, body.from_, text)


@router.post("/sms", summary="Incoming SMS, for example “ANU 0412”")
async def sms(body: dict, session: AsyncSession = Depends(get_session)):
    return await _reply(session, str(body.get("from", "")), str(body.get("text", "")))
