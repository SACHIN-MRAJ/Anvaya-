"""AI Document Verification Service.

For each AICTE document type this module:
  1. Extracts text  – pdfminer for digital PDFs; Tesseract OCR (via pdf2image) for scanned pages;
                      falls back to vision AI document reader when the API key is set.
  2. Runs NLP       – regex + dateparser to pull institution name, course title, dates, signatory,
                      validity periods and registration numbers from the extracted text.
  3. Applies rules  – one set of AICTE-specific checks per doc_kind (APH clauses cited per rule).
  4. Scores with ML – a lightweight IsolationForest trained on synthetic feature vectors flags
                      unusually thin documents (very few words, no dates, no institution name).

Returns a list of AiCheckResult dicts:
    {"severity": "pass"|"warn"|"fail",
     "title":    str,
     "detail":   str,
     "clause":   str,
     "engine":   "OCR"|"NLP"|"Rules"|"ML"}

The whole pipeline is async-safe: heavy CPU work runs in a thread pool so it never blocks the event
loop.  All imports are soft: if a library is missing the affected step degrades gracefully.
"""

from __future__ import annotations

import asyncio
import io
import logging
import os
import re
import unicodedata
from datetime import date
from typing import Any

log = logging.getLogger("anumati.doc_ai")

# ── type alias ──────────────────────────────────────────────────────────────
AiCheckResult = dict  # {"severity", "title", "detail", "clause", "engine"}


# ═══════════════════════════════════════════════════════════════════════════
# 1.  TEXT EXTRACTION
# ═══════════════════════════════════════════════════════════════════════════

def _extract_text_pdfminer(data: bytes) -> str:
    """Extract text from a digital PDF using pdfminer.six."""
    try:
        from pdfminer.high_level import extract_text as _ext
        return _ext(io.BytesIO(data)) or ""
    except Exception as exc:
        log.debug("pdfminer failed: %s", exc)
        return ""


def _extract_text_tesseract(data: bytes) -> str:
    """Convert each PDF page to an image and OCR it with Tesseract."""
    try:
        import pytesseract
        from pdf2image import convert_from_bytes

        # Tesseract binary paths (Windows default install, Linux package manager)
        for path in (
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            "/usr/bin/tesseract",
            "/usr/local/bin/tesseract",
        ):
            if os.path.isfile(path):
                pytesseract.pytesseract.tesseract_cmd = path
                break

        pages = convert_from_bytes(data, dpi=200, fmt="jpeg", thread_count=2)
        parts: list[str] = []
        for img in pages[:10]:  # cap at 10 pages to keep latency sane
            parts.append(pytesseract.image_to_string(img, lang="eng"))
        return "\n".join(parts)
    except Exception as exc:
        log.debug("Tesseract OCR failed: %s", exc)
        return ""


async def _extract_text_vision_ai(data: bytes, doc_kind: str) -> str:
    """Use vision AI document reader as OCR fallback for scanned documents."""
    api_key = os.environ.get("ANUMATI_ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return ""
    try:
        import anthropic
        import base64
        client = anthropic.AsyncAnthropic(api_key=api_key, timeout=30, max_retries=1)
        prompt = (
            f"This is a scanned '{doc_kind}' document uploaded to the AICTE approval portal. "
            "Extract ALL text visible in the document exactly as written. "
            "Return only the extracted text, no commentary."
        )
        resp = await client.messages.create(
            model="vision-ai-fast",
            max_tokens=2000,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": base64.standard_b64encode(data).decode(),
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }],
        )
        return "".join(b.text for b in resp.content if b.type == "text")
    except Exception as exc:
        log.debug("Vision AI OCR fallback failed: %s", exc)
        return ""


def _has_real_text(text: str) -> bool:
    """True when pdfminer found at least 80 meaningful characters (not just whitespace/noise)."""
    clean = re.sub(r"\s+", " ", text or "").strip()
    return len(clean) >= 80


async def extract_text(data: bytes, doc_kind: str) -> str:
    """Extract text from a PDF using the best available method."""
    # Try digital text extraction first (fast, no API cost)
    text = await asyncio.to_thread(_extract_text_pdfminer, data)
    if _has_real_text(text):
        return text
    # Scanned PDF: try Tesseract
    text = await asyncio.to_thread(_extract_text_tesseract, data)
    if _has_real_text(text):
        return text
    # Last resort: Vision AI document API
    return await _extract_text_vision_ai(data, doc_kind)


# ═══════════════════════════════════════════════════════════════════════════
# 2.  NLP — FIELD EXTRACTION
# ═══════════════════════════════════════════════════════════════════════════

def _normalise(s: str) -> str:
    return unicodedata.normalize("NFKC", s).lower()


def extract_dates(text: str) -> list[date]:
    """Pull all date-like strings from text and parse them."""
    dates: list[date] = []
    try:
        import dateparser
        # Match patterns like  12/03/2024, 12-03-2024, 12 March 2024, March 12, 2024
        pattern = re.compile(
            r"\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}"
            r"|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{2,4}"
            r"|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s+\d{4})\b",
            re.IGNORECASE,
        )
        for m in pattern.finditer(text):
            try:
                d = dateparser.parse(m.group(), settings={"DATE_ORDER": "DMY", "PREFER_DAY_OF_MONTH": "first"})
                if d:
                    dates.append(d.date())
            except Exception:
                pass
    except ImportError:
        pass
    return dates


def extract_institution_name(text: str) -> str | None:
    """Try to find the institution's name using common header patterns."""
    patterns = [
        r"(?:name of (?:the )?(?:institution|college|institute)\s*[:–-]\s*)([A-Z][^\n]{4,80})",
        r"^([A-Z][A-Z\s&,.'()-]{10,80})\n",
        r"(?:this is to certify that\s+)([A-Z][^\n]{4,80})",
        r"(?:granted to\s+)([A-Z][^\n]{4,80})",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.MULTILINE | re.IGNORECASE)
        if m:
            name = m.group(1).strip().rstrip(".,")
            if 5 <= len(name) <= 120:
                return name
    return None


def extract_course_name(text: str) -> str | None:
    """Extract course/programme name from document text."""
    patterns = [
        # Explicit label: "course: X" or "programme: X"
        r"(?:course|programme|program|branch)\s*[:–-]\s*([A-Za-z][^\n]{4,80})",
        # "for the programme X" or "for programme X"
        r"(?:for\s+(?:the\s+)?(?:programme|program|course)\s+)([A-Za-z][^\n]{4,80})",
        # "for X" where X is a known degree
        r"(?:for\s+)(B\.?\s*Tech[^\n]{2,60}|M\.?\s*Tech[^\n]{2,60}|MBA[^\n]{0,60}|BCA[^\n]{0,60}|MCA[^\n]{0,60}|B\.?\s*E[^\n]{2,60})",
        # "in X" where X is a degree
        r"(?:in\s+)(B\.?\s*Tech[^\n]{2,60}|M\.?\s*Tech[^\n]{2,60}|MBA[^\n]{0,60}|BCA[^\n]{0,60}|MCA[^\n]{0,60})",
        # Standalone degree at start of line or after bullet
        r"(?:^|\*\s*)(B\.?\s*Tech\s+\w[^\n]{4,60}|M\.?\s*Tech\s+\w[^\n]{4,60})",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE | re.MULTILINE)
        if m:
            return m.group(1).strip().rstrip(".,")
    return None


def extract_signatory(text: str) -> str | None:
    """Find who signed the document."""
    patterns = [
        r"(?:signed by|signature of|authorised by|authorized by|issued by)\s*[:–-]?\s*([A-Z][^\n]{4,80})",
        r"(?:Chairman|Secretary|Director|Registrar|Commissioner|Officer)[^\n]{0,40}",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(0).strip()
    return None


def extract_validity(text: str) -> date | None:
    """Find an explicit validity / expiry date."""
    patterns = [
        r"(?:valid (?:up to|till|until|upto)|expiry date|expir(?:es|ed) on|validity)\s*[:–-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+\w+\s+\d{4})",
        r"(?:valid (?:up to|till|until|upto)|expiry date)\s*[:–-]?\s*(\w+\s+\d{4})",
    ]
    try:
        import dateparser
        for pat in patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                d = dateparser.parse(m.group(1), settings={"DATE_ORDER": "DMY"})
                if d:
                    return d.date()
    except ImportError:
        pass
    return None


def has_government_seal_or_letterhead(text: str) -> bool:
    """Heuristic: government documents mention their department or ministry."""
    keywords = [
        "government of india", "government of", "ministry of", "department of",
        "municipal corporation", "fire department", "fire brigade", "collector",
        "registrar", "vice chancellor", "aicte", "ugc", "naac", "nba",
        "state government", "central government", "district",
    ]
    norm = _normalise(text)
    return any(kw in norm for kw in keywords)


def extract_area(text: str) -> float | None:
    """Extract land area in acres from text."""
    pattern = re.compile(r"([\d,]+(?:\.\d+)?)\s*(?:acres?|acre)", re.IGNORECASE)
    m = pattern.search(text)
    if m:
        try:
            return float(m.group(1).replace(",", ""))
        except ValueError:
            pass
    # Also check sq. metres / sq. feet
    pattern2 = re.compile(r"([\d,]+(?:\.\d+)?)\s*(?:sq\.?\s*m(?:etres?|t)?|sqm)", re.IGNORECASE)
    m2 = pattern2.search(text)
    if m2:
        try:
            return float(m2.group(1).replace(",", "")) / 4046.86  # convert to acres
        except ValueError:
            pass
    return None


def count_words(text: str) -> int:
    return len(re.findall(r"\b\w{2,}\b", text))


# ═══════════════════════════════════════════════════════════════════════════
# 3.  RULE-BASED CHECKS  (one function per doc_kind)
# ═══════════════════════════════════════════════════════════════════════════

def _today() -> date:
    """Always returns the current date — never a stale module-import-time constant."""
    return date.today()


def _result(severity: str, title: str, detail: str, clause: str, engine: str = "Rules") -> AiCheckResult:
    return {"severity": severity, "title": title, "detail": detail, "clause": clause, "engine": engine}


def _pass(title: str, detail: str = "", clause: str = "") -> AiCheckResult:
    return _result("pass", title, detail, clause)


def _warn(title: str, detail: str, clause: str) -> AiCheckResult:
    return _result("warn", title, detail, clause)


def _fail(title: str, detail: str, clause: str) -> AiCheckResult:
    return _result("fail", title, detail, clause)


# ── common check applied to every document ──────────────────────────────────
def _common_checks(text: str, doc_kind: str) -> list[AiCheckResult]:
    out: list[AiCheckResult] = []
    words = count_words(text)
    # Thresholds are deliberately conservative: a genuine one-page Fire NOC might have 60-80 words.
    # Real full-page PDFs (1-5 pages) normally have 200-2000 words after OCR.
    if words < 20:
        out.append(_fail("Document appears to be a blank scan or unreadable image",
                         f"Only {words} readable word(s) extracted. Ensure the PDF is not a blank page, "
                         "password-protected, or a very low-resolution scan. Scan at ≥200 dpi in greyscale.",
                         "APH 1.4.6"))
    elif words < 50:
        out.append(_warn(f"Very little text extracted ({words} words)",
                         "Short text may indicate a low-quality scan or an incomplete document. "
                         "If this is a full-page certificate, re-scan at ≥200 dpi.",
                         "APH 1.4.6"))
    return out


# ── Fire NOC ────────────────────────────────────────────────────────────────
def _check_fire(text: str, context: dict) -> list[AiCheckResult]:
    out: list[AiCheckResult] = []
    norm = _normalise(text)
    # 1. Issuing authority
    if not any(kw in norm for kw in ["fire department", "fire brigade", "fire officer", "fire station", "chief fire"]):
        out.append(_fail("Fire department authority not found",
                         "The document must be issued by the Fire Department or Fire Brigade. "
                         "Ensure the issuing authority's name and stamp are on the first page.",
                         "APH Annexure-1, Clause 2.1(f)"))
    else:
        out.append(_pass("Fire department authority identified", "", "APH Annexure-1"))
    # 2. Validity / expiry
    validity = extract_validity(text)
    if validity is None:
        out.append(_warn("Validity date not found in Fire NOC",
                         "Could not extract an expiry or validity date. Ensure the date is clearly printed.",
                         "APH Annexure-1"))
    elif validity < _today():
        out.append(_fail(f"Fire NOC expired on {validity:%d %b %Y}",
                         "An expired NOC is not accepted. Upload the renewed certificate before submission.",
                         "APH Annexure-1, Clause 2.1(f)"))
    else:
        days_left = (validity - _today()).days
        if days_left <= 30:
            out.append(_warn(f"Fire NOC expires in {days_left} day{'s' if days_left != 1 else ''} ({validity:%d %b %Y})",
                             "It may expire before scrutiny ends. Start the renewal now.",
                             "APH Annexure-1"))
        else:
            out.append(_pass(f"Fire NOC valid until {validity:%d %b %Y}", "", "APH Annexure-1"))
    # 3. Institution name
    if context.get("institution_name"):
        inst_norm = _normalise(context["institution_name"])
        words = inst_norm.split()[:3]  # first 3 significant words
        if not any(w in norm for w in words if len(w) > 3):
            out.append(_warn("Institution name not clearly found in Fire NOC",
                             "Verify the NOC explicitly names your institution.",
                             "APH Annexure-1"))
        else:
            out.append(_pass("Institution name found in Fire NOC", "", "APH Annexure-1"))
    return out


# ── University / Affiliation NOC ─────────────────────────────────────────────
def _check_uni_noc(text: str, context: dict) -> list[AiCheckResult]:
    out: list[AiCheckResult] = []
    norm = _normalise(text)
    # 1. Issued by Registrar / competent authority
    if not any(kw in norm for kw in ["registrar", "vice chancellor", "chancellor", "dean", "university"]):
        out.append(_warn("University authority not found",
                         "The NOC should be signed by the Registrar or Vice Chancellor. "
                         "Ensure the document clearly states the issuing authority.",
                         "APH Annexure-2, Clause 1.3"))
    else:
        out.append(_pass("University/Registrar authority identified", "", "APH Annexure-2"))
    # 2. Course name match
    requested_course = context.get("programme", "")
    doc_course = extract_course_name(text)
    if requested_course and doc_course:
        if _normalise(requested_course[:15]) not in norm:
            out.append(_warn(f"Course name mismatch",
                             f"Application says '{requested_course}' but document mentions '{doc_course}'. "
                             "AICTE scrutiny will flag this as a deficiency.",
                             "APH 1.8"))
        else:
            out.append(_pass("Course name matches the application", "", "APH 1.8"))
    elif not doc_course:
        out.append(_warn("Course/programme name not found in University NOC",
                         "The NOC must explicitly name the programme for which affiliation is granted.",
                         "APH Annexure-2"))
    # 3. Validity
    validity = extract_validity(text)
    if validity and validity < _today():
        out.append(_fail(f"University NOC expired on {validity:%d %b %Y}",
                         "Upload a renewed NOC. An expired document will cause a deficiency at scrutiny.",
                         "APH Annexure-2"))
    elif validity:
        out.append(_pass(f"University NOC valid until {validity:%d %b %Y}", "", "APH Annexure-2"))
    return out


# ── Land deed / lease deed ───────────────────────────────────────────────────
def _check_land(text: str, context: dict) -> list[AiCheckResult]:
    out: list[AiCheckResult] = []
    norm = _normalise(text)
    # 1. Area
    area = extract_area(text)
    if area is None:
        out.append(_warn("Land area not found in deed",
                         "Could not extract land area. Ensure the area (in acres or sq. metres) is stated clearly.",
                         "APH 2.1(a)"))
    elif area < 0.5:
        out.append(_fail(f"Land area ({area:.2f} acres) is below the minimum",
                         "APH 2.1(a) requires a minimum campus area. Check that the deed covers the full site.",
                         "APH 2.1(a)"))
    else:
        out.append(_pass(f"Land area: {area:.2f} acres", "Area extracted successfully.", "APH 2.1(a)"))
    # 2. Ownership / registration number
    if re.search(r"registration\s*(?:no|number|#)\s*[:\.]?\s*[\w/-]+", text, re.IGNORECASE):
        out.append(_pass("Registration number found in deed", "", "APH 2.1(a)"))
    else:
        out.append(_warn("Registration number not clearly found",
                         "Ensure the sub-registrar's registration number is visible on the first page.",
                         "APH 2.1(a)"))
    # 3. Lease validity (if leased)
    if any(kw in norm for kw in ["lease", "leased", "lessee", "lessor"]):
        validity = extract_validity(text)
        if validity:
            years_left = (validity - _today()).days / 365.25
            if years_left < 30:
                out.append(_fail(f"Lease expires in {years_left:.1f} years ({validity:%d %b %Y})",
                                 "APH 2.1(e) requires a lease of at least 30 years. "
                                 "Extension of Approval will be blocked once this falls below the longest course duration.",
                                 "APH 2.1(e)"))
            else:
                out.append(_pass(f"Lease valid for {years_left:.0f} more years", "", "APH 2.1(e)"))
    else:
        out.append(_pass("Ownership deed (not a lease)", "No lease clauses found.", "APH 2.1(a)"))
    return out


# ── Affidavit 1 & 2 ─────────────────────────────────────────────────────────
def _check_affidavit(text: str, context: dict) -> list[AiCheckResult]:
    out: list[AiCheckResult] = []
    norm = _normalise(text)
    # 1. Signed by correct authority
    if any(kw in norm for kw in ["chairman", "secretary", "secretary of the trust", "secretary of the society"]):
        out.append(_pass("Signatory is Chairman or Secretary", "", "APH 1.4.6"))
    elif any(kw in norm for kw in ["principal", "director", "dean"]):
        out.append(_fail("Affidavit signed by Principal/Director — not accepted",
                         "APH 1.4.6 requires the Chairman or Secretary of the Trust/Society to sign. "
                         "Re-sign and re-upload.",
                         "APH 1.4.6"))
    else:
        out.append(_warn("Signatory designation not clearly found",
                         "Ensure the affidavit is signed by the Chairman or Secretary of the Trust (APH 1.4.6).",
                         "APH 1.4.6"))
    # 2. Notarised / sworn before a magistrate
    if any(kw in norm for kw in ["notary", "notarized", "notarised", "sworn before", "judicial magistrate", "oath commissioner"]):
        out.append(_pass("Notarisation / oath found", "", "APH 1.4.6"))
    else:
        out.append(_warn("Notarisation not confirmed",
                         "The affidavit must be sworn before a notary, judicial magistrate or oath commissioner.",
                         "APH 1.4.6"))
    # 3. Date present
    dates = extract_dates(text)
    if dates:
        out.append(_pass(f"Date found: {min(dates, key=lambda d: abs((d - _today()).days)):%d %b %Y}", "", "APH 1.4.6"))
    else:
        out.append(_warn("Date not found in affidavit",
                         "The affidavit must show the date on which it was executed.",
                         "APH 1.4.6"))
    return out


# ── State government NOC ─────────────────────────────────────────────────────
def _check_state_noc(text: str, context: dict) -> list[AiCheckResult]:
    out: list[AiCheckResult] = []
    norm = _normalise(text)
    if any(kw in norm for kw in ["government of", "state government", "secretary to government",
                                   "director of technical education", "directorate"]):
        out.append(_pass("State government authority found", "", "APH Annexure-2"))
    else:
        out.append(_fail("State government authority not found",
                         "The NOC must be issued by the state Directorate of Technical Education or equivalent. "
                         "Ensure the issuing department name and official seal are on the document.",
                         "APH Annexure-2"))
    # Intake/course mention
    if context.get("programme") and _normalise(context["programme"][:10]) in norm:
        out.append(_pass("Course name found in State NOC", "", "APH Annexure-2"))
    else:
        out.append(_warn("Course name not confirmed in State NOC",
                         "The NOC should explicitly name the programme and approved intake.",
                         "APH Annexure-2"))
    return out


# ── Building plan / Occupancy certificate ────────────────────────────────────
def _check_building(text: str, context: dict) -> list[AiCheckResult]:
    out: list[AiCheckResult] = []
    norm = _normalise(text)
    if any(kw in norm for kw in ["panchayat", "municipality", "corporation", "town planning",
                                   "executive engineer", "pwd", "local authority", "occupancy"]):
        out.append(_pass("Competent authority identified", "", "APH Annexure-3"))
    else:
        out.append(_warn("Issuing authority not clearly identified",
                         "Building plans / occupancy certificates must be approved by the local body "
                         "(municipality, panchayat, or PWD).",
                         "APH Annexure-3"))
    # Area check
    area = extract_area(text)
    if area:
        out.append(_pass(f"Built-up area found: {area:.2f} acres equivalent", "", "APH Annexure-3"))
    else:
        out.append(_warn("Built-up area not extracted",
                         "Ensure the built-up or plinth area is stated in the document.",
                         "APH Annexure-3"))
    return out


# ── Faculty list ──────────────────────────────────────────────────────────────
def _check_faculty(text: str, context: dict) -> list[AiCheckResult]:
    out: list[AiCheckResult] = []
    # Count rows that look like faculty entries (name + designation)
    designation_pattern = re.compile(
        r"\b(?:professor|associate professor|assistant professor|lecturer|reader)\b", re.IGNORECASE
    )
    faculty_count = len(designation_pattern.findall(text))
    if faculty_count == 0:
        out.append(_fail("No faculty designations found in the list",
                         "The document must contain a table with faculty names and designations "
                         "(Professor / Associate Professor / Assistant Professor).",
                         "APH Appendix 7"))
    else:
        out.append(_pass(f"{faculty_count} faculty designation(s) found", "", "APH Appendix 7"))
        # Warn if count looks low for the intake
        intake = context.get("requested_intake", 0) or context.get("intake", 0)
        if intake and faculty_count < max(1, int(intake / 20)):
            out.append(_warn(
                f"Faculty count ({faculty_count}) may be below the 1:20 norm for {intake} seats",
                "APH Appendix 7 requires one faculty member for every 20 students. "
                "Verify the full roster includes all regular faculty members.",
                "APH Appendix 7",
            ))
    # Check for PAN / employee ID column
    if re.search(r"\b[A-Z]{5}\d{4}[A-Z]\b", text):  # PAN format
        out.append(_pass("PAN numbers detected in faculty list", "", "APH Appendix 7"))
    return out


# ── Bank details / resolution letter ─────────────────────────────────────────
def _check_bank(text: str, context: dict) -> list[AiCheckResult]:
    out: list[AiCheckResult] = []
    norm = _normalise(text)
    # IFSC code
    if re.search(r"\b[A-Z]{4}0[A-Z0-9]{6}\b", text):
        out.append(_pass("IFSC code found", "", "APH Table 2.3"))
    else:
        out.append(_warn("IFSC code not found",
                         "A bank details letter must include the IFSC code of the institution's account.",
                         "APH Table 2.3"))
    # Account number
    if re.search(r"\b\d{9,18}\b", text):
        out.append(_pass("Account number found", "", "APH Table 2.3"))
    else:
        out.append(_warn("Account number not found",
                         "Ensure the bank passbook copy or letter shows the account number clearly.",
                         "APH Table 2.3"))
    # Bank name
    if any(kw in norm for kw in ["bank", "savings", "current account", "nationalised"]):
        out.append(_pass("Bank name/type mentioned", "", "APH Table 2.3"))
    return out


# ── Trust / Society resolution ───────────────────────────────────────────────
def _check_resolution(text: str, context: dict) -> list[AiCheckResult]:
    out: list[AiCheckResult] = []
    norm = _normalise(text)
    if any(kw in norm for kw in ["resolution", "resolved that", "it is resolved"]):
        out.append(_pass("Resolution clause found", "", "APH 1.4.5"))
    else:
        out.append(_warn("Resolution clause not found",
                         "The document must contain a formal resolution clause (e.g., 'Resolved that…').",
                         "APH 1.4.5"))
    if any(kw in norm for kw in ["chairman", "secretary", "managing committee", "board of directors"]):
        out.append(_pass("Governing body members identified", "", "APH 1.4.5"))
    else:
        out.append(_warn("Governing body not identified",
                         "The resolution should name the Chairman/Secretary who passed it.",
                         "APH 1.4.5"))
    dates = extract_dates(text)
    if dates:
        out.append(_pass(f"Resolution date found: {min(dates, key=lambda d: abs((d - _today()).days)):%d %b %Y}", "", "APH 1.4.5"))
    else:
        out.append(_warn("Resolution date not found",
                         "Include the date on which the governing body passed the resolution.",
                         "APH 1.4.5"))
    return out


# ── Generic fallback for unknown doc kinds ────────────────────────────────────
def _check_generic(text: str, context: dict) -> list[AiCheckResult]:
    out: list[AiCheckResult] = []
    if has_government_seal_or_letterhead(text):
        out.append(_pass("Official letterhead / authority name found", "", "APH 1.4"))
    else:
        out.append(_warn("No official letterhead or authority name detected",
                         "Ensure the document is printed on official letterhead with the issuing authority's name.",
                         "APH 1.4"))
    dates = extract_dates(text)
    if dates:
        out.append(_pass(f"Date found: {min(dates, key=lambda d: abs((d - _today()).days)):%d %b %Y}", "", "APH 1.4"))
    else:
        out.append(_warn("No date found in document",
                         "All official documents must carry a date.",
                         "APH 1.4"))
    return out


# Map doc_kind values → checker function
_CHECKERS: dict[str, Any] = {
    "fire":         _check_fire,
    "firenoc":      _check_fire,
    "uninoc":       _check_uni_noc,
    "uni":          _check_uni_noc,
    "affiliation":  _check_uni_noc,
    "land":         _check_land,
    "landdeed":     _check_land,
    "affidavit":    _check_affidavit,
    "affidavit1":   _check_affidavit,
    "affidavit2":   _check_affidavit,
    "statenoc":     _check_state_noc,
    "state":        _check_state_noc,
    "building":     _check_building,
    "buildingplan": _check_building,
    "occupancy":    _check_building,
    "fac":          _check_faculty,
    "faculty":      _check_faculty,
    "bank":         _check_bank,
    "bankchange":   _check_bank,
    "resolution":   _check_resolution,
}


# ═══════════════════════════════════════════════════════════════════════════
# 4.  ML QUALITY SCORER
# ═══════════════════════════════════════════════════════════════════════════

def _feature_vector(text: str) -> list[float]:
    """Compute a numeric feature vector for the ML scorer."""
    words = count_words(text)
    dates  = len(extract_dates(text))
    has_auth = 1.0 if has_government_seal_or_letterhead(text) else 0.0
    has_name = 1.0 if extract_institution_name(text) else 0.0
    has_sig  = 1.0 if re.search(r"\b(?:signed|signature|signatory)\b", text, re.I) else 0.0
    unique_words = len(set(re.findall(r"\b\w{4,}\b", text.lower())))
    return [
        min(words / 500.0, 1.0),         # word density (normalised)
        min(dates / 3.0, 1.0),           # date richness
        has_auth,                         # authority present
        has_name,                         # institution name present
        has_sig,                          # signature mention
        min(unique_words / 200.0, 1.0),  # vocabulary richness
    ]


def _build_clf():
    """Load the trained RandomForestClassifier from disk.
    Falls back to a synthetic IsolationForest if the saved model is not found.
    Called once at import time so every request reuses the fitted model."""
    from pathlib import Path
    model_path = Path(__file__).parent.parent / "models" / "doc_ai_clf.joblib"
    # --- Prefer the trained RandomForest saved by scripts/train_doc_ai_model.py ---
    if model_path.exists():
        try:
            import joblib
            clf = joblib.load(model_path)
            log.info("doc_ai: loaded trained RandomForestClassifier from %s", model_path)
            return clf, "rf"
        except Exception as exc:
            log.warning("doc_ai: could not load saved model (%s); falling back to IsolationForest", exc)
    # --- Fallback: IsolationForest on synthetic data ---
    try:
        import numpy as np
        from sklearn.ensemble import IsolationForest
        rng = np.random.default_rng(42)
        good = rng.uniform(
            [0.3, 0.1, 0.5, 0.5, 0.3, 0.3],
            [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
            size=(200, 6),
        )
        clf = IsolationForest(n_estimators=50, contamination=0.05, random_state=42)
        clf.fit(good)
        log.info("doc_ai: IsolationForest fallback trained on synthetic data")
        return clf, "if"
    except Exception as exc:
        log.warning("doc_ai: could not build any ML classifier (%s); ML checks will be skipped", exc)
        return None, None


_clf, _clf_type = _build_clf()


def _ml_score(text: str) -> AiCheckResult | None:
    """Score a document with the trained RandomForestClassifier (or IsolationForest fallback).
    Returns None if no classifier is available or scoring fails."""
    if _clf is None:
        return None
    try:
        import numpy as np
        fv = np.array([_feature_vector(text)])

        if _clf_type == "rf":
            # RandomForestClassifier: predict_proba gives [P(bad), P(good)]
            proba = _clf.predict_proba(fv)[0]
            pred  = int(_clf.predict(fv)[0])
            good_prob = float(proba[1])
            log.debug("doc_ai: RF score=%.3f (good) pred=%d fv=%s", good_prob, pred, fv.tolist())
            if pred == 0:
                # Use a generous threshold to avoid penalising legitimate short documents.
                # A real full-page PDF (300+ words) will have good_prob > 0.85 when correct.
                severity = "fail" if good_prob < 0.15 else "warn"
                return _result(
                    severity,
                    "ML quality check: document may be incomplete or incorrect",
                    f"The classifier is {(1 - good_prob) * 100:.0f}% confident this document is "
                    f"structurally incomplete (word density, dates or authority signals are low). "
                    f"Verify you have uploaded the correct, complete file.",
                    "APH 1.4",
                    "ML",
                )
            return _result(
                "pass",
                "ML quality check passed",
                f"Document structure and content look correct ({good_prob * 100:.0f}% confidence).",
                "APH 1.4",
                "ML",
            )
        else:
            # IsolationForest fallback
            score = float(_clf.score_samples(fv)[0])
            pred  = int(_clf.predict(fv)[0])
            log.debug("doc_ai: IF score=%.3f pred=%d", score, pred)
            if pred == -1 and score < -0.15:
                return _result(
                    "warn",
                    "ML quality check: document pattern is unusual",
                    f"Structural signals look atypical (anomaly score {score:.3f}). "
                    f"Verify you have uploaded the correct, complete document.",
                    "APH 1.4",
                    "ML",
                )
            return _result("pass", "ML quality check passed",
                           f"Document structure looks normal (score {score:.3f}).", "APH 1.4", "ML")
    except Exception as exc:
        log.warning("doc_ai: ML scoring failed: %s", exc)
        return None


# ═══════════════════════════════════════════════════════════════════════════
# 5.  PUBLIC ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════

async def check(data: bytes, doc_kind: str, context: dict | None = None) -> dict:
    """
    Run the full AI document check pipeline.

    Args:
        data:     Raw PDF bytes.
        doc_kind: AICTE document type key (e.g. "fire", "uniNoc", "affidavit2").
        context:  Optional dict with application context:
                  {institution_name, programme, requested_intake, current_intake}

    Returns:
        {"status": "pass"|"warn"|"fail",
         "findings": [AiCheckResult, ...],
         "wordCount": int,
         "engine":    "pdfminer"|"tesseract"|"vision_ai"|"empty"}
    """
    ctx = context or {}
    kind_key = re.sub(r"[^a-z]", "", doc_kind.lower())

    # Step 1: extract text
    text = await extract_text(data, doc_kind)
    word_count = count_words(text)
    engine_used = "pdfminer" if word_count > 30 else ("tesseract" if word_count > 5 else "empty")

    findings: list[AiCheckResult] = []

    # Step 2: common checks (blank / unreadable)
    findings.extend(_common_checks(text, doc_kind))

    # Step 3: doc-kind specific rules
    checker = _CHECKERS.get(kind_key, _check_generic)
    if text:
        findings.extend(await asyncio.to_thread(checker, text, ctx))

    # Step 4: ML anomaly score
    if text:
        ml_result = await asyncio.to_thread(_ml_score, text)
        if ml_result:
            findings.append(ml_result)

    # Compute overall status
    if any(f["severity"] == "fail" for f in findings):
        status = "fail"
    elif any(f["severity"] == "warn" for f in findings):
        status = "warn"
    else:
        status = "pass"

    return {"status": status, "findings": findings, "wordCount": word_count, "engine": engine_used}
