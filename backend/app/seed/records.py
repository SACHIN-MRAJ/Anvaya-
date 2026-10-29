"""Sample institutional records for the sample cycle: campuses, rooms, certificates, courses, faculty, leaders, team,
documents with real (small) PDF files, varied deficiency reasons, a field inspection and a regulatory action.

Narmada Valley Institute of Technology (INS-001) gets a full record with a few honest gaps, so every check has
something to find: one tutorial room and some library area short, a fire safety certificate expiring in 17 days,
six faculty short (the open condition OB-102), and a lease close to its limit. The other institutions get a main
campus, two certificates and their courses.
"""
import hashlib
import random
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import audit
from ..config import today
from ..models import (
    Application, ApplicationType, Campus, Certificate, Deficiency, Document, Faculty, FieldInspection, Institution, Leader,
    Member, Programme, RegulatoryAction, Space, Verification,
)
from ..security import DEV_USERS
from ..services import inspection, norms
from ..services.documents import storage

d = date.fromisoformat

# Reasons files were sent back, with the clause, the stage that usually raises them and the document they concern.
REASONS = [
    ("University NOC does not name the course title as applied.", "APH 2.3.4", "scrutiny", "uni", 6),
    ("Document not signed with the DSC of the Chairman or Secretary of the Trust.", "APH 1.4.6", "scrutiny", "aff2", 5),
    ("Fire and life safety certificate expired before the date of application.", "APH Annexure-3, 3.1(d)", "scrutiny", "fire", 5),
    ("Affidavit 2 not on non-judicial stamp paper of the required value.", "APH 2.3.4(b)", "scrutiny", "aff2", 4),
    ("Faculty list short of the 1:20 norm for the requested intake.", "APH Annexure-1", "evc", "fac", 4),
    ("Land lease shorter than 30 years, or not registered.", "APH 6.17(a)", "scrutiny", "land", 3),
    ("Occupancy certificate missing for the new academic block.", "APH Annexure-3, 3.1(c)", "scrutiny", "occ", 3),
    ("Building plan not approved by the competent authority.", "APH Annexure-3, 3.1(c)", "scrutiny", "plan", 2),
    ("Laboratory equipment does not match what the expert committee found.", "APH 1.9(c)", "evc", "infra", 2),
    ("Trust resolution not dated or not signed by the board.", "APH 2.3.4", "scrutiny", "res", 2),
    ("Bank account details do not match the cancelled cheque.", "APH Table 2.3", "scrutiny", "bank", 1),
    ("NBA accreditation certificate has lapsed for the course.", "APH 2.6", "scrutiny", "nba", 1),
]
FIRST = ["Aarti", "Rahul", "Sneha", "Vikram", "Priya", "Arjun", "Kavya", "Rohit", "Meera", "Sanjay", "Neha", "Amit", "Pooja", "Kiran", "Deepa", "Manish", "Anjali", "Suresh", "Lakshmi", "Ravi", "Divya", "Naveen", "Swati", "Harish", "Ritu", "Gopal", "Shalini", "Ajay", "Bhavna", "Tarun"]
LAST = ["Sharma", "Iyer", "Patil", "Khan", "Reddy", "Joshi", "Menon", "Gupta", "Nair", "Kulkarni", "Das", "Verma", "Bhat", "Singh", "Rao", "Pillai", "Mishra", "Chauhan", "Shetty", "Banerjee"]
INS1_PROGRAMMES = [
    ("P-001-1", "Computer Science and Engineering", "B.Tech CSE", "UG", 4, 240, 1995, False, {"body": "NBA", "number": "NBA/2024/1187", "validUntil": "2027-06-30"}),
    ("P-001-2", "Electronics and Communication Engineering", "B.Tech ECE", "UG", 4, 120, 1995, False, {"body": "NBA", "number": "NBA/2023/0942", "validUntil": "2026-06-30"}),
    ("P-001-3", "Mechanical Engineering", "B.Tech Mechanical", "UG", 4, 120, 1998, True, {}),
    ("P-001-4", "Computer Science and Engineering", "M.Tech CSE", "PG", 2, 30, 2011, False, {}),
]
DOC_TEXT = {
    "infra": ["Self-disclosure of infrastructure and facilities", "Built-up area, classrooms, laboratories and library as on 30 September."],
    "aff2": ["Affidavit 2 on non-judicial stamp paper", "I, the Secretary of the Trust, state that the information given in this application is true."],
    "fac": ["Faculty list as per norms", "Names, designations, qualifications and dates of joining of all faculty in post."],
    "fire": ["Fire and life safety certificate", "Issued by the Fire and Emergency Services after inspection of all buildings."],
    "uni": ["No objection certificate from the affiliating university", "The university has no objection to the course named below."],
    "plan": ["Approved building plan", "Sanctioned by the competent authority; plan number and date below."],
    "nba": ["Accreditation status", "National Board of Accreditation status of the courses named below."],
    "res": ["Resolution of the Trust", "Resolved by the board of the Trust at its meeting held on the date below."],
    "land": ["Land documents", "Registered lease or sale deed for the campus land, with survey numbers."],
    "occ": ["Completion and occupancy certificate", "Issued by the local authority for the buildings named below."],
    "state": ["No objection certificate from the State Government", "The State Government has no objection to the request below."],
    "mou": ["Memorandum of understanding", "Agreement with the collaborating institution."],
    "bank": ["Bank account details", "Cancelled cheque and bank letter for the account below."],
}


def _pdf_text(s: str) -> str:
    return s.encode("latin-1", "replace").decode("latin-1").replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def minimal_pdf(title: str, lines: list[str]) -> bytes:
    """A small, valid one-page PDF (Helvetica, A4) so the document viewer has a real file to show."""
    ops = ["BT", "/F1 16 Tf", "56 780 Td", f"({_pdf_text(title)}) Tj", "/F1 10 Tf", "0 -22 Td"]
    for line in lines:
        ops += [f"({_pdf_text(line)}) Tj", "0 -15 Td"]
    ops += ["0 -20 Td", "/F1 8 Tf", "(Sample document generated for the ANUMATI sample cycle. Not an official record.) Tj", "ET"]
    stream = "\n".join(ops).encode("latin-1")
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out, offsets = bytearray(b"%PDF-1.4\n"), []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode() + b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


def _level(name: str) -> tuple[str, int]:
    n = name.lower()
    if n.startswith(("m.tech", "mba", "mca", "m.e", "pgdm", "m.arch", "m.des")):
        return "PG", 2
    if "diploma" in n or "polytechnic" in n:
        return "Diploma", 3
    if n.startswith(("bba", "bca")):
        return "UG", 3
    return "UG", 4


def _department(name: str) -> str:
    n = name.lower()
    for key, dept in (("cse", "Computer Science and Engineering"), ("computer", "Computer Science and Engineering"), ("ece", "Electronics and Communication Engineering"),
                      ("electronics", "Electronics and Communication Engineering"), ("mech", "Mechanical Engineering"), ("civil", "Civil Engineering"),
                      ("electrical", "Electrical Engineering"), ("mba", "Management Studies"), ("pgdm", "Management Studies"), ("bba", "Management Studies"),
                      ("mca", "Computer Applications"), ("bca", "Computer Applications"), ("hotel", "Hotel Management"), ("bhm", "Hotel Management")):
        if key in n:
            return dept
    return name.split(" ", 1)[-1] if " " in name else name


def course_of(p: Programme) -> norms.Course:
    return norms.Course(p.id, p.name, p.department, p.level, p.duration_years, p.approved_intake, p.x_category)


async def _document(session: AsyncSession, app: Application, inst: Institution, kind: str, name: str, version: int, status: str, note: str | None, when: datetime, extra: list[str]) -> Document:
    title, lead = DOC_TEXT.get(kind, [name, ""])
    lines = [lead, "", f"Institution: {inst.name}", f"AICTE permanent ID: {inst.aicte_id}", f"Trust or society: {inst.trust}", f"Reference: {app.id} ({app.cycle})", *extra, "", f"Version {version}, dated {when:%d %B %Y}"]
    data = minimal_pdf(title, lines)
    sha = audit.sha256_hex(data)
    doc = Document(
        id=f"DOC-{sha[:10]}-{version}", institution_id=inst.id, application_id=app.id, doc_kind=kind, filename=f"{kind}-{app.id.lower()}-v{version}.pdf",
        storage_key=await storage.save(data, ".pdf"), sha256=sha, size_bytes=len(data), pages=1, signed=True,
        signature={"intact": True, "signer": f"Secretary, {inst.trust}", "engine": "Recorded at intake (sample)"},
        preflight={"kind": "pdf", "pages": 1, "errors": [], "warnings": [], "virusScan": "clean", "signed": True}, version=version,
        uploaded_by="Institution", uploaded_at=when, review_status=status, review_note=note,
        reviewed_by="R. Verma" if status in ("verified", "needs correction") else None, reviewed_at=when + timedelta(days=3) if status in ("verified", "needs correction") else None,
    )
    session.add(doc)
    return doc


def _extra_lines(kind: str, app: Application, inst: Institution, programmes: list[Programme], version: int) -> list[str]:
    if kind == "uni":
        course = "B.Tech CSE (Data Science), intake 60" if version > 1 or app.id != "ANU-2026-0398" else "B.Tech Computer Science and Engineering"
        return [f"Course: {course}", "Issued by: Registrar, affiliating university"]
    if kind == "fire":
        return ["Certificate no.: FS/IND/2025/0387", "Valid until: 08 November 2026" if inst.id == "INS-001" else "Valid until: 31 March 2027"]
    if kind == "fac":
        return [f"Faculty in post: {94 if inst.id == 'INS-001' else 7}", "Ratio claimed: 1:20 (UG), 1:15 (PG)"]
    if kind == "land":
        return [f"Land: {inst.land}", f"Lease ends: {inst.lease_end:%d %B %Y}" if inst.lease_end else "Owned land, registered sale deed"]
    if kind in ("infra", "nba"):
        return [f"Courses: {', '.join(p.name for p in programmes) or ', '.join(inst.programmes)}", f"Approved intake: {inst.intake}"]
    return []


GENERIC_DEFICIENCY = "Document mismatch recorded by the scrutiny committee."  # what databases seeded before v1.3 hold


async def seed_records(session: AsyncSession, applications: list[dict], backfill: bool = False) -> None:
    """Fills the institutional record. With backfill=True (a database seeded by an earlier version), files that
    already have documents keep them, and deficiencies an officer wrote are left as they are."""
    t = today()
    rnd = random.Random(26)  # noqa: S311  # nosec B311  (repeatable sample data, not security)
    institutions = list((await session.execute(select(Institution).order_by(Institution.id))).scalars())
    by_id = {i.id: i for i in institutions}
    programmes: dict[str, list[Programme]] = {}

    # ---- courses
    for inst in institutions:
        rows = []
        if inst.id == "INS-001":
            for pid, dept, name, level, years, intake, since, x, acc in INS1_PROGRAMMES:
                rows.append(Programme(id=pid, institution_id=inst.id, department=dept, name=name, level=level, duration_years=years, approved_intake=intake, status="Approved", since=since, x_category=x, accreditation=acc))
        else:
            share = max(30, (inst.intake // max(1, len(inst.programmes))) // 30 * 30)
            for k, name in enumerate(inst.programmes, start=1):
                level, years = _level(name)
                intake = share if k < len(inst.programmes) else max(30, inst.intake - share * (len(inst.programmes) - 1))
                rows.append(Programme(id=f"P-{inst.id[-3:]}-{k}", institution_id=inst.id, department=_department(name), name=name, level=level, duration_years=years, approved_intake=intake, status="Approved", since=inst.established + (k - 1) * 3, x_category=any(w in name.lower() for w in ("mech", "civil", "electrical")), accreditation={}))
        session.add_all(rows)
        programmes[inst.id] = rows

    # ---- the sample institution's full record
    ins1 = by_id["INS-001"]
    ins1.profile = {
        "address": "Plot 14, AB Road, Rau", "pincode": "453331", "email": "principal@nvit.example.in", "phone": "0731-2856400", "website": "https://nvit.example.in",
        "registeredUnder": "Madhya Pradesh Society Registrikaran Adhiniyam, 1973", "registrationNo": "IND/SOC/1993/1146", "university": "Rajiv Gandhi Proudyogiki Vishwavidyalaya, Bhopal",
        "type": "Private (self-financing)", "minority": False, "womenOnly": False,
    }
    session.add_all([
        Campus(id="CMP-001-1", institution_id="INS-001", name="Main campus", address="Plot 14, AB Road, Rau, Indore", city="Indore", state="Madhya Pradesh", pincode="453331", lat=22.72, lng=75.86, land_acres=12.5, ownership="Leased", deed_no="IND/LEASE/2001/7731", lease_start=d("2001-07-01"), lease_end=d("2031-06-30"), is_main=True),
        Campus(id="CMP-001-2", institution_id="INS-001", name="Hostel and sports plot", address="Survey 212/3, Rau, Indore", city="Indore", state="Madhya Pradesh", pincode="453331", lat=22.7285, lng=75.8691, land_acres=3.2, ownership="Owned", deed_no="IND/SALE/2009/2240", is_main=False),
    ])
    spaces = []

    def add(category: str, kind: str, n: int, area: float, building: str, label: str | None = None, campus: str = "CMP-001-1"):
        for k in range(1, n + 1):
            spaces.append(Space(institution_id="INS-001", campus_id=campus, category=category, kind=kind, name=f"{label or kind} {k}" if n > 1 else (label or kind), building=building, area_sqm=area))

    add("Instructional", "Classroom", 15, 68, "Academic block A")
    add("Instructional", "Classroom", 1, 60, "Academic block A", "Classroom 16 (old wing)")
    add("Instructional", "Classroom (PG)", 1, 36, "Academic block B", "PG classroom")
    add("Instructional", "Tutorial room", 4, 34, "Academic block A")
    add("Instructional", "First-year laboratory", 4, 70, "Academic block B", "First-year laboratory")
    add("Instructional", "Laboratory", 21, 68, "Academic block B", "Course laboratory")
    add("Instructional", "PG laboratory", 1, 70, "Academic block B", "PG laboratory")
    add("Instructional", "Research laboratory", 1, 72, "Academic block B", "Research laboratory")
    add("Instructional", "Workshop", 1, 240, "Workshop block")
    add("Instructional", "X-category laboratory", 1, 210, "Workshop block", "Mechanical heavy machines laboratory")
    add("Instructional", "Drawing hall", 1, 140, "Academic block A", "CAD centre and drawing hall")
    add("Instructional", "Computer centre", 1, 160, "Academic block B", "Central computer centre")
    add("Instructional", "Seminar hall", 1, 150, "Academic block A", "Seminar hall")
    add("Instructional", "Library", 1, 450, "Library block", "Central library and reading room")
    add("Instructional", "Language laboratory", 1, 36, "Academic block A", "Language laboratory")
    add("Administrative", "Office", 1, 1310, "Administrative block", "Administrative block (all offices)")
    add("Amenities", "Amenities", 1, 640, "Academic block A", "Toilets, common rooms, first aid")
    add("Amenities", "Cafeteria", 1, 260, "Hostel and sports plot", "Cafeteria", campus="CMP-001-2")
    session.add_all(spaces)

    fire_until = t + timedelta(days=17)
    session.add_all([
        Certificate(id="CERT-001-1", institution_id="INS-001", campus_id="CMP-001-1", kind="Fire and life safety certificate", number="FS/IND/2025/0387", issued_by="Fire and Emergency Services, Indore Municipal Corporation", issued_on=fire_until - timedelta(days=365), valid_until=fire_until, verification="Verified", verified_by="R. Verma", verified_at=datetime(2025, 12, 2, 11, 0), reminded=[30, 60]),
        Certificate(id="CERT-001-2", institution_id="INS-001", campus_id="CMP-001-1", kind="Completion or occupancy certificate", number="IMC/OC/2004/118", issued_by="Indore Municipal Corporation", issued_on=d("2004-03-15"), valid_until=None, verification="Verified", verified_by="R. Verma", verified_at=datetime(2025, 12, 2, 11, 5)),
        Certificate(id="CERT-001-3", institution_id="INS-001", campus_id="CMP-001-1", kind="Provisional occupancy certificate", number="IMC/POC/2025/031", issued_by="Indore Municipal Corporation (Academic block B extension)", issued_on=d("2025-07-01"), valid_until=d("2027-06-30"), verification="Pending", note="Provisional: counts for two consecutive years only."),
        Certificate(id="CERT-001-4", institution_id="INS-001", campus_id="CMP-001-1", kind="Structural stability certificate", number="SE/2024/IND/552", issued_by="Chartered structural engineer, Reg. no. MP/SE/0912", issued_on=d("2024-04-01"), valid_until=d("2027-03-31"), verification="Verified", verified_by="R. Verma", verified_at=datetime(2025, 12, 2, 11, 10), note="Main building is over 30 years old."),
        Certificate(id="CERT-001-5", institution_id="INS-001", campus_id="CMP-001-1", kind="Approved building plan", number="IMC/BP/1996/0447", issued_by="Indore Municipal Corporation", issued_on=d("1996-02-12"), valid_until=None, verification="Verified", verified_by="R. Verma", verified_at=datetime(2025, 12, 2, 11, 12)),
        Certificate(id="CERT-001-6", institution_id="INS-001", campus_id="CMP-001-2", kind="Fire and life safety certificate", number="FS/IND/2026/0112", issued_by="Fire and Emergency Services, Indore Municipal Corporation", issued_on=d("2026-02-01"), valid_until=d("2027-01-31"), verification="Pending"),
    ])
    session.add_all([
        Leader(institution_id="INS-001", name="Shri Mahesh Agrawal", position="Chairman of the Trust", email="chairman@nvit.example.in", is_signatory=True, since=d("2012-04-01")),
        Leader(institution_id="INS-001", name="Smt. Kalpana Dubey", position="Secretary of the Trust", email="secretary@nvit.example.in", is_signatory=True, since=d("2016-08-01")),
        Leader(institution_id="INS-001", name="Dr. Prakash Tiwari", position="Principal / Director", email="principal@nvit.example.in", is_signatory=False, since=d("2019-07-01")),
        Leader(institution_id="INS-001", name="Dr. A. Mehta", position="Head of Department", department="Computer Science and Engineering", email="hod.cse@nvit.example.in", since=d("2021-06-15")),
        Leader(institution_id="INS-001", name="Dr. S. Bhatia", position="Head of Department", department="Electronics and Communication Engineering", email="hod.ece@nvit.example.in", since=d("2018-01-10")),
        Leader(institution_id="INS-001", name="Dr. R. Chauhan", position="Head of Department", department="Mechanical Engineering", email="hod.mech@nvit.example.in", since=d("2020-07-01")),
        Leader(institution_id="INS-001", name="Dr. V. Saxena", position="Principal / Director", email="", since=d("2009-07-01"), until=d("2019-06-30")),
    ])
    for key, p in DEV_USERS.items():
        if key.startswith("institution:"):
            session.add(Member(institution_id="INS-001", name=p.name, email=f"{p.id}@nvit.example.in", role=p.role, user_id=p.id, added_by="Principal, Narmada Valley Institute of Technology", added_at=datetime(2026, 6, 1, 10, 0)))

    # faculty: the 8 on the shared list plus the rest of the roster, six short of the norm (the open condition OB-102)
    existing = list((await session.execute(select(Faculty).where(Faculty.institution_id == "INS-001"))).scalars())
    if not any(f.id.startswith("F-001-") for f in existing):  # the roster is built once
        plan = [("Computer Science and Engineering", 47), ("Electronics and Communication Engineering", 24), ("Mechanical Engineering", 23)]
        # 9 Professors and 20 Associate Professors in all (both a little short of 1:2:6); the existing 8 keep their posts
        target = {"Professor": 9, "Associate Professor": 20}
        for f in existing:
            if f.designation in target:
                target[f.designation] -= 1
        cadre = ["Professor"] * max(0, target["Professor"]) + ["Associate Professor"] * max(0, target["Associate Professor"])
        slots = [dept for dept, n in plan for _ in range(n)]
        for k, dept in enumerate(slots):
            j = k - len(existing)
            designation = cadre[j] if 0 <= j < len(cadre) else "Assistant Professor"
            if k < len(existing):
                f = existing[k]
                f.department = dept
            else:
                name = f"{'Dr. ' if designation != 'Assistant Professor' else ''}{rnd.choice(FIRST)} {rnd.choice(LAST)}"
                f = Faculty(id=f"F-001-{k:03d}", name=name, pan_hash=hashlib.sha256(f"INS-001:{k}".encode()).hexdigest()[:16], institution_id="INS-001", designation=designation, joined=d("2008-07-01") + timedelta(days=rnd.randint(0, 6400)), department=dept)
                session.add(f)
            f.qualification = "PhD" if f.designation in norms.PHD_NEEDED else rnd.choice(["M.Tech", "M.Tech", "M.Tech", "PhD"])
            f.employment = "Regular" if k % 17 else "Contract"
            f.status = "Active"
            f.verification = "Pending" if f.joined >= d("2026-01-01") else "Verified"
        session.add(Faculty(id="F-001-left", name="Dr. Nitin Pandey", pan_hash=hashlib.sha256(b"INS-001:left").hexdigest()[:16], institution_id="INS-001", designation="Associate Professor", joined=d("2014-07-01"), department="Mechanical Engineering", qualification="PhD", status="Left", verification="Verified"))
        await session.flush()
        oldest = (await session.execute(select(Faculty).where(Faculty.institution_id == "INS-001", Faculty.designation == "Associate Professor").order_by(Faculty.id))).scalars().first()
        if oldest:
            oldest.qualification = "M.Tech"  # one Associate Professor without a PhD, for the qualification check

    # ---- every other institution: a main campus and two certificates
    for k, inst in enumerate(institutions):
        if inst.id == "INS-001":
            continue
        session.add(Campus(id=f"CMP-{inst.id[-3:]}-1", institution_id=inst.id, name="Main campus", address=f"{inst.city}", city=inst.city, state=inst.state, lat=inst.lat, lng=inst.lng, land_acres=round(5 + rnd.random() * 15, 1), ownership="Leased" if inst.land == "Leased" else "Owned", deed_no=f"DEED/{inst.id}", lease_start=(inst.lease_end - timedelta(days=round(30 * 365.25))) if inst.lease_end else None, lease_end=inst.lease_end, is_main=True))
        expiry = t + timedelta(days=rnd.choice([-12, 9, 26, 48, 120, 210, 300, 330]))
        session.add(Certificate(id=f"CERT-{inst.id[-3:]}-1", institution_id=inst.id, campus_id=f"CMP-{inst.id[-3:]}-1", kind="Fire and life safety certificate", number=f"FS/{inst.id}/{expiry.year - 1}", issued_by=f"Fire and Emergency Services, {inst.city}", issued_on=expiry - timedelta(days=365), valid_until=expiry, verification="Verified" if k % 3 else "Pending", reminded=[w for w in (1, 7, 15, 30, 60) if (expiry - t).days <= w]))
        session.add(Certificate(id=f"CERT-{inst.id[-3:]}-2", institution_id=inst.id, campus_id=f"CMP-{inst.id[-3:]}-1", kind="Completion or occupancy certificate", number=f"OC/{inst.id}", issued_by=f"Municipal authority, {inst.city}", issued_on=d(f"{inst.established + 1}-03-31"), verification="Verified" if k % 4 else "Pending"))

    # ---- documents, deficiencies and their statuses for every open file and the sample institution's files
    types = {x.id: x for x in (await session.execute(select(ApplicationType))).scalars()}
    weighted = [r for r in REASONS for _ in range(r[4])]
    for a in applications:
        app = await session.get(Application, a["id"])
        if app is None:
            continue
        inst, typ = by_id[app.institution_id], types[app.type_id]
        kinds = [x["id"] for x in typ.documents]
        existing_def = list((await session.execute(select(Deficiency).where(Deficiency.application_id == app.id))).scalars())
        rewrite = app.deficiencies and (not backfill or all(df.text == GENERIC_DEFICIENCY for df in existing_def))
        if rewrite:
            for df in existing_def:
                await session.delete(df)
            fits = [r for r in weighted if r[3] in kinds] or weighted
            for n in range(app.deficiencies if rewrite else 0):
                if app.id == "ANU-2026-0398":
                    text, clause, stage = "University NOC does not name the new course title “B.Tech CSE (Data Science)”.", "APH 2.3.4", "scrutiny"
                else:
                    text, clause, stage, _, _ = fits[(hash_index(app.id) + n * 7) % len(fits)]
                raised = datetime.combine(app.submitted_on + timedelta(days=6 + n * 9), datetime.min.time()) + timedelta(hours=11)
                still_open = app.clock == "paused" and n == app.deficiencies - 1
                resolved = None if still_open else raised + timedelta(days=4 + (hash_index(app.id + str(n)) % 15))
                session.add(Deficiency(application_id=app.id, text=text, clause=clause, stage=stage, status="open" if still_open else "resolved", raised_at=raised, resolved_at=resolved))
        if app.stage == "decision" and app.institution_id != "INS-001":
            continue
        if backfill and (await session.execute(select(Document.id).where(Document.application_id == app.id).limit(1))).first():
            continue  # this file's documents came in through the portal; keep them
        open_kind = None
        if app.deficiencies:
            last = (await session.execute(select(Deficiency).where(Deficiency.application_id == app.id).order_by(Deficiency.raised_at.desc()))).scalars().first()
            open_kind = next((r[3] for r in REASONS if last and r[0] == last.text), "uni" if app.id == "ANU-2026-0398" else None)
        base = datetime.combine(app.submitted_on, datetime.min.time()) + timedelta(hours=10)
        later = app.stage not in ("submitted", "scrutiny")
        for x in typ.documents:
            kind = x["id"]
            if kind == open_kind:
                await _document(session, app, inst, kind, x["name"], 1, "needs correction", last.text if last else None, base, _extra_lines(kind, app, inst, programmes[inst.id], 1))
                if app.clock != "paused":
                    await _document(session, app, inst, kind, x["name"], 2, "awaiting verification", None, base + timedelta(days=14), _extra_lines(kind, app, inst, programmes[inst.id], 2))
            else:
                await _document(session, app, inst, kind, x["name"], 1, "verified" if later or app.stage == "decision" else "awaiting verification", None, base, _extra_lines(kind, app, inst, programmes[inst.id], 1))

    # ---- a field inspection in progress for the intake increase at the expert-visit stage
    courses = [course_of(p) for p in programmes["INS-001"]]
    items = inspection.checklist(courses, f"{fire_until:%d %b %Y}", old_building=True)
    answers = {"classrooms": ("Meets", "15 rooms of 68 m² and one older room of 60 m² in use."), "tutorials": ("Partly meets", "Four tutorial rooms seen; a fifth is needed for the norm."), "labs": ("Meets", ""), "workshop": ("Meets", "")}
    for i in items:
        if i["id"] in answers:
            i["result"], i["note"] = answers[i["id"]]
    inspector = DEV_USERS["Inspector"]
    session.add(FieldInspection(id="FI-2026-0412", application_id="ANU-2026-0412", inspector_id=inspector.id, inspector_name=inspector.name, assigned_by="A. Sharma", assigned_at=datetime(2026, 10, 18, 15, 0), mode="Physical", status="In progress", items=items, started_at=datetime(2026, 10, 21, 10, 30)))

    # ---- officer checks and one regulatory action under due process
    session.add_all([
        Verification(institution_id="INS-001", subject="Certificate", subject_id="CERT-001-1", subject_label="Fire and life safety certificate (Main campus)", outcome="Verified", note="Matches the Fire and Emergency Services register.", source="Registry", checked_by="R. Verma", checked_at=datetime(2025, 12, 2, 11, 0)),
        Verification(institution_id="INS-001", subject="Campus", subject_id="CMP-001-1", subject_label="Main campus lease", outcome="Follow-up", note="Lease leaves 4.7 years; ask for an extension before the next cycle.", source="Document", checked_by="R. Verma", checked_at=datetime(2026, 9, 14, 16, 20)),
        Verification(institution_id="INS-008", subject="Certificate", subject_id="CERT-008-1", subject_label="Fire and life safety certificate (Main campus)", outcome="Discrepancy", note="Certificate number not found in the municipal register.", source="Registry", checked_by="R. Verma", checked_at=datetime(2026, 10, 9, 12, 0)),
    ])
    session.add(RegulatoryAction(institution_id="INS-008", kind="Show-cause notice", detail="Explain within 15 days why the security deposit proof is still not filed.", reason="Condition OB-110 has been overdue past escalation level 3; two reminders went unanswered.", decided_by="R. Verma", role="Bureau head", decided_at=datetime(2026, 10, 15, 17, 0), effective_from=d("2026-10-15")))
    await audit.append(session, "RECORD-INS-008", "Show-cause notice issued: security deposit proof overdue", "R. Verma", "Bureau head", "APH Chapter VII", "Reply within 15 days")
    await audit.append(session, "RECORD-INS-001", "Institutional record created from the approved file", "ANUMATI", "Records", None, "Profile, campuses, courses, faculty and signatories")


def hash_index(s: str) -> int:
    return int(hashlib.sha256(s.encode()).hexdigest()[:8], 16)
