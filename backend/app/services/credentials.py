"""Decision letters: the canonical letter text, its fingerprint, a W3C Verifiable Credential signed with
Ed25519 (Data Integrity, eddsa-jcs-2022 style), the did:web document that publishes the public key, and
calendar (.ics) files.
"""
import hashlib
import json
from datetime import date, datetime, timedelta, timezone

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

from ..config import settings
from ..models import Application, ApplicationType, Institution

OUTCOME = {"EoA": "Extension of Approval granted", "LoA": "Letter of Approval granted", "LoD": "Letter of Deficiency issued", "LoR": "Letter of Rejection issued"}
DID = "did:web:aicte.gov.in"
KEY_ID = f"{DID}#letters-2026"
_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def letter_text(app: Application, inst: Institution, t: ApplicationType) -> str:
    """Byte-for-byte the same text the browser fingerprints (letterText in frontend/src/services/api.ts)."""
    return "\n".join([
        "ANUMATI DECISION LETTER",
        f"Reference: {app.id}",
        f"Institution: {inst.name} ({inst.aicte_id})",
        f"Application: {t.name}",
        f"Academic year: {app.cycle}",
        f"Decision: {app.outcome or 'Pending'}",
        f"Decided on: {app.stage_entered_on.isoformat()}",
        "Issued by: Executive Committee (competent authority)",
    ])


def fingerprint(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def _b58(data: bytes) -> str:
    n = int.from_bytes(data, "big")
    out = ""
    while n:
        n, r = divmod(n, 58)
        out = _B58[r] + out
    return "1" * (len(data) - len(data.lstrip(b"\0"))) + out


def _unb58(s: str) -> bytes:
    n = 0
    for ch in s:
        n = n * 58 + _B58.index(ch)
    raw = n.to_bytes((n.bit_length() + 7) // 8, "big")
    return b"\0" * (len(s) - len(s.lstrip("1"))) + raw


def _key() -> Ed25519PrivateKey:
    path = settings.storage_dir / "keys" / "letters-ed25519.pem"
    if path.exists():
        return serialization.load_pem_private_key(path.read_bytes(), password=None)  # type: ignore[return-value]
    key = Ed25519PrivateKey.generate()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    return key


def public_multibase(pub: Ed25519PublicKey | None = None) -> str:
    raw = (pub or _key().public_key()).public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return "z" + _b58(b"\xed\x01" + raw)  # multicodec ed25519-pub


def did_document() -> dict:
    return {
        "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/multikey/v1"],
        "id": DID,
        "verificationMethod": [{"id": KEY_ID, "type": "Multikey", "controller": DID, "publicKeyMultibase": public_multibase()}],
        "assertionMethod": [KEY_ID],
    }


def _jcs(obj: dict) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def _hash_data(doc: dict, proof_config: dict) -> bytes:
    return hashlib.sha256(_jcs(proof_config)).digest() + hashlib.sha256(_jcs(doc)).digest()


def credential(app: Application, inst: Institution, t: ApplicationType, verify_url: str) -> dict:
    doc = {
        "@context": ["https://www.w3.org/ns/credentials/v2"],
        "id": f"urn:anumati:letter:{app.id}",
        "type": ["VerifiableCredential", "AicteApprovalCredential"],
        "issuer": {"id": DID, "name": "All India Council for Technical Education"},
        "validFrom": f"{app.stage_entered_on.isoformat()}T17:30:12+05:30",
        "credentialSubject": {"id": f"urn:aicte:institution:{inst.aicte_id}", "name": inst.name, "decision": OUTCOME.get(app.outcome or "", app.outcome), "request": t.name, "academicYear": app.cycle, "handbookClause": t.clause},
        "evidence": [{"type": "DocumentFingerprint", "algorithm": "SHA-256", "digest": fingerprint(letter_text(app, inst, t))}],
        "credentialStatus": {"type": "AnumatiStatusCheck", "statusUrl": verify_url},
    }
    proof = {"type": "DataIntegrityProof", "cryptosuite": "eddsa-jcs-2022", "verificationMethod": KEY_ID, "proofPurpose": "assertionMethod", "created": datetime.now(timezone.utc).replace(microsecond=0).isoformat()}
    signature = _key().sign(_hash_data(doc, {**proof, "@context": doc["@context"]}))
    return {**doc, "proof": {**proof, "proofValue": "z" + _b58(signature)}}


def verify_credential(vc: dict) -> bool:
    try:
        proof = dict(vc["proof"])
        value = proof.pop("proofValue")
        doc = {k: v for k, v in vc.items() if k != "proof"}
        raw = _unb58(public_multibase()[1:])[2:]
        Ed25519PublicKey.from_public_bytes(raw).verify(_unb58(value[1:]), _hash_data(doc, {**proof, "@context": doc["@context"]}))
        return True
    except Exception:
        return False


def ics(items: list[dict], name: str = "ANUMATI deadlines") -> str:
    """iCalendar with a reminder 3 days before each date."""
    esc = lambda s: s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")  # noqa: E731
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ANUMATI//Approvals//EN", "CALSCALE:GREGORIAN", f"X-WR-CALNAME:{esc(name)}"]
    for i, it in enumerate(items):
        d: date = it["date"]
        lines += [
            "BEGIN:VEVENT", f"UID:anumati-{d:%Y%m%d}-{i}@aicte", f"DTSTAMP:{stamp}", f"DTSTART;VALUE=DATE:{d:%Y%m%d}", f"DTEND;VALUE=DATE:{d + timedelta(days=1):%Y%m%d}",
            f"SUMMARY:{esc(it['title'])}", f"DESCRIPTION:{esc(it.get('description', 'From ANUMATI'))}", "BEGIN:VALARM", "TRIGGER:-P3D", "ACTION:DISPLAY", f"DESCRIPTION:{esc(it['title'])}", "END:VALARM", "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)
