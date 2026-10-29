"""AICTE norms worked out from an institution's own records (Approval Process Handbook 2024-27).

Engineering and Technology only, which is what the sample cycle holds. Each figure names the clause it comes from,
so an officer can check the arithmetic and an institution can see why a number is what it is.

- Instructional area: Annexure-3, 3.2.1 (A). Administrative and amenities area: 3.3 and 3.4.
- Faculty: Annexure-1 faculty tables (UG 1:20 and PG 1:15 on the sum of approved intake over all years,
  cadre 1:2:6) and the AICTE 2019 qualification regulations (PhD for Associate Professor and Professor).
- Land and plots: Annexure-3, 3.1(g) (at most three plots within 2 km) and 6.17(a) (lease of 30 years or more).
"""
import math
from dataclasses import dataclass
from datetime import date

from . import geo

DIVISION = 60  # students in a division (Annexure-3: classrooms of 66 m² for a division of 60)
UG_RATIO, PG_RATIO = 20, 15
CADRE = (1, 2, 6)  # Professor : Associate Professor : Assistant Professor (Annexure-1)
PHD_NEEDED = {"Professor", "Associate Professor"}


@dataclass
class Course:
    id: str
    name: str
    department: str
    level: str  # Diploma | UG | PG
    duration: int
    intake: int
    x_category: bool = False


def _ceil(x: float) -> int:
    return math.ceil(round(x, 6))


def required_spaces(courses: list[Course]) -> list[dict]:
    """Rooms the instructional area must have, with the minimum carpet area of each (Annexure-3, 3.2.1 A)."""
    total = sum(c.intake for c in courses)
    scale = max(1.0, total / 1200)  # pro rata above an approved intake of 1200
    ug = [c for c in courses if c.level != "PG"]
    pg = [c for c in courses if c.level == "PG"]
    big = 1 if total <= 600 else 2

    classrooms = sum(_ceil(c.intake / DIVISION) * c.duration * 0.5 for c in ug)
    pg_rooms = sum(_ceil(c.intake / 30) * c.duration * 0.5 for c in pg)
    rooms_66, rooms_33 = _ceil(classrooms), _ceil(pg_rooms)
    later_labs = 0
    for c in ug:
        per_year = 2 * max(1.0, c.intake / 180) if _ceil(c.intake / DIVISION) > 3 else 2
        later_labs += _ceil(per_year) * max(0, c.duration - 1)
    extra_library = max(0, _ceil((total - 420) / 60)) * 50 if total > 420 else 0

    rows = [
        ("Classroom", "Classrooms", rooms_66, 66, "divisions per year x course years x 0.5, 66 m² each for a division of 60"),
        ("Classroom (PG)", "Classrooms for PG courses", rooms_33, 33, "a division of 30 needs 33 m²"),
        ("Tutorial room", "Tutorial rooms", _ceil((rooms_66 + rooms_33) * 0.25), 33, "25% of the classrooms"),
        ("First-year laboratory", "First-year laboratories", 4 if ug else 0, 66, "4 up to an intake of 600, including 2 for basic sciences"),
        ("Laboratory", "Course laboratories after the first year", later_labs, 66, "2 per course per year up to an intake of 180 per course, more pro rata above 3 divisions"),
        ("PG laboratory", "PG laboratories", len(pg), 66, "1 per PG course"),
        ("Research laboratory", "Research laboratory", 1 if pg else 0, 66, "1 for institutions with PG courses"),
        ("Workshop", "Workshop", _ceil(big * scale) if ug else 0, 200, "1 up to an intake of 600, 1 more for 601-1200"),
        ("X-category laboratory", "Extra laboratory or workshop for X-category courses", sum(1 for c in ug if c.x_category), 200, "1 per course such as Mechanical, Civil or Electrical"),
        ("Drawing hall", "CAD centre or drawing hall", _ceil(big * scale), 132, "1 up to an intake of 600, 1 more for 601-1200"),
        ("Computer centre", "Computer centre", _ceil(big * scale), 150, "1 up to an intake of 600, 1 more for 601-1200"),
        ("Seminar hall", "Seminar hall", 1, 132, "1 for every institution"),
        ("Library", "Library", 1, 400 + extra_library, "400 m², plus 50 m² per 60 students of intake above 420"),
        ("Language laboratory", "Language laboratory", 1, 33, "1, with at least 20 computers"),
    ]
    return [
        {"kind": k, "label": label, "rooms": n, "minArea": area, "rule": rule, "clause": "APH Annexure-3, 3.2.1"}
        for k, label, n, area, rule in rows if n
    ]


def area_minimums(total_intake: int) -> dict:
    """Administrative (750 m²) and amenities (500 m²) minimums for an intake up to 300, in proportion above that."""
    f = max(1.0, total_intake / 300)
    return {"Administrative": round(750 * f), "Amenities": round(500 * f)}


def check_spaces(courses: list[Course], spaces: list[dict]) -> dict:
    """Compares the rooms on record with what the norms ask for. A room smaller than the minimum area is listed but not counted."""
    need = required_spaces(courses)
    rows = []
    for r in need:
        mine = [s for s in spaces if s["kind"] == r["kind"]]
        big_enough = [s for s in mine if s["areaSqm"] >= r["minArea"]]
        short = max(0, r["rooms"] - len(big_enough))
        rows.append({
            **r, "have": len(big_enough), "onRecord": len(mine), "short": short,
            "undersized": [{"name": s["name"], "areaSqm": s["areaSqm"]} for s in mine if s["areaSqm"] < r["minArea"]],
            "status": "ok" if short == 0 else "short",
        })
    total = sum(c.intake for c in courses)
    minimums = area_minimums(total)
    areas = []
    for cat, minimum in minimums.items():
        have = round(sum(s["areaSqm"] for s in spaces if s["category"] == cat))
        areas.append({"category": cat, "have": have, "min": minimum, "status": "ok" if have >= minimum else "short", "clause": "APH Annexure-3, 3.3" if cat == "Administrative" else "APH Annexure-3, 3.4"})
    instructional = round(sum(s["areaSqm"] for s in spaces if s["category"] == "Instructional"))
    carpet = sum(a["have"] for a in areas) + instructional
    return {
        "rows": rows, "areas": areas, "instructionalArea": instructional,
        "builtUpEstimate": round(carpet * 1.25),  # access and circulation is about 25% (3.2 b)
        "shortfalls": sum(1 for r in rows if r["status"] == "short") + sum(1 for a in areas if a["status"] == "short"),
        "computersNeeded": computers_needed(courses),
    }


def computers_needed(courses: list[Course]) -> int:
    """Annexure-4, 4.1: one computer for 10 UG or Diploma students and one for 4 PG students, at least 20."""
    ug = sum(c.intake * c.duration for c in courses if c.level != "PG")
    pg = sum(c.intake * c.duration for c in courses if c.level == "PG")
    return max(20, _ceil(ug / 10) + _ceil(pg / 4))


def faculty_required(courses: list[Course]) -> dict:
    """Faculty needed by department: UG/Diploma at 1:20 and PG at 1:15 on the approved intake of all years."""
    by_dept: dict[str, float] = {}
    for c in courses:
        students = c.intake * c.duration
        by_dept[c.department] = by_dept.get(c.department, 0) + students / (PG_RATIO if c.level == "PG" else UG_RATIO)
    need = {d: _ceil(v) for d, v in by_dept.items()}
    total = sum(need.values())
    unit = total / sum(CADRE)
    return {"byDepartment": need, "total": total, "cadre": {"Professor": _ceil(unit * CADRE[0]), "Associate Professor": _ceil(unit * CADRE[1]), "Assistant Professor": max(0, total - _ceil(unit * CADRE[0]) - _ceil(unit * CADRE[1]))}}


def check_faculty(courses: list[Course], faculty: list[dict]) -> dict:
    active = [f for f in faculty if f["status"] == "Active"]
    req = faculty_required(courses)
    departments = []
    for dept, need in req["byDepartment"].items():
        have = sum(1 for f in active if f["department"] == dept)
        departments.append({"department": dept, "need": need, "have": have, "short": max(0, need - have)})
    cadre = []
    for designation, need in req["cadre"].items():
        have = sum(1 for f in active if f["designation"] == designation)
        cadre.append({"designation": designation, "need": need, "have": have, "short": max(0, need - have)})
    no_phd = [f for f in active if f["designation"] in PHD_NEEDED and f.get("qualification") != "PhD"]
    findings = []
    short = sum(d["short"] for d in departments)
    if short:
        findings.append({"severity": "blocker", "title": f"Short by {short} faculty", "detail": ", ".join(f"{d['department']}: {d['short']}" for d in departments if d["short"]), "clause": "APH Annexure-1"})
    for c in cadre:
        if c["short"]:
            stand_in = " An Associate Professor may stand in for a Professor who cannot be found." if c["designation"] == "Professor" else ""
            findings.append({"severity": "warning", "title": f"{c['short']} {c['designation']} post{'s' if c['short'] != 1 else ''} short of the 1:2:6 cadre", "detail": f"{c['have']} in post, {c['need']} expected.{stand_in}", "clause": "APH Annexure-1"})
    for f in no_phd:
        findings.append({"severity": "warning", "title": f"{f['name']}: {f['designation']} without a PhD", "detail": "The 2019 qualification regulations ask for a PhD for this post.", "clause": "AICTE Regulations 2019"})
    pending = sum(1 for f in active if f.get("verification") == "Pending")
    return {
        "required": req["total"], "inPost": len(active), "departments": departments, "cadre": cadre, "findings": findings,
        "ratio": f"1:{round(sum(c.intake * c.duration for c in courses) / max(1, len(active)), 1)}", "pendingVerification": pending,
    }


def check_campuses(campuses: list[dict], longest_course: int, today: date) -> list[dict]:
    """Land checks: plots within 2 km of the main campus, at most three, and a lease that is long enough."""
    out = []
    main = next((c for c in campuses if c["isMain"]), campuses[0] if campuses else None)
    if len(campuses) > 3:
        out.append({"severity": "blocker", "title": f"{len(campuses)} plots on record; at most 3 are allowed", "clause": "APH Annexure-3, 3.1(g)"})
    for c in campuses:
        if main and c is not main and c.get("lat") is not None and main.get("lat") is not None:
            km = geo.distance_km(main["lat"], main["lng"], c["lat"], c["lng"])
            c["distanceKm"] = round(km, 2)
            if km > 2:
                out.append({"severity": "blocker", "title": f"{c['name']} is {km:.1f} km from the main campus; plots must be within 2 km", "clause": "APH Annexure-3, 3.1(g)"})
        if c["ownership"] == "Leased":
            if not (c.get("leaseStart") and c.get("leaseEnd")):
                out.append({"severity": "blocker", "title": f"{c['name']}: lease dates missing", "clause": "APH 6.17(a)"})
                continue
            years = (c["leaseEnd"] - c["leaseStart"]).days / 365.25
            runway = (c["leaseEnd"] - today).days / 365.25
            if years < 29.9:
                out.append({"severity": "blocker", "title": f"{c['name']}: lease of {years:.0f} years; at least 30 are needed", "clause": "APH 6.17(a)"})
            if runway < longest_course:
                out.append({"severity": "blocker", "title": f"{c['name']}: {runway:.1f} years of lease left, less than the {longest_course}-year course", "clause": "APH 6.17(a)"})
            elif runway < longest_course + 2:
                out.append({"severity": "warning", "title": f"{c['name']}: only {runway:.1f} years of lease left; renew before the next cycle", "clause": "APH 6.17(a)"})
    return out


CERTIFICATE_KINDS = {
    "Fire and life safety certificate": ("APH Annexure-3, 3.1(d)", True),
    "Completion or occupancy certificate": ("APH Annexure-3, 3.1(c)", False),
    "Provisional occupancy certificate": ("APH Annexure-3, 3.1(c)", True),
    "Structural stability certificate": ("APH Annexure-3, 3.1(e)", True),
    "Approved building plan": ("APH Annexure-3, 3.1(c)", False),
    "Barrier-free access audit": ("APH Chapter VII", False),
    "Electrical safety certificate": ("State electrical inspectorate", True),
}


def certificate_state(valid_until: date | None, today: date) -> dict:
    if valid_until is None:
        return {"state": "No expiry", "days": None, "tone": "green"}
    days = (valid_until - today).days
    if days < 0:
        return {"state": "Expired", "days": days, "tone": "red"}
    if days <= 30:
        return {"state": "Expiring soon", "days": days, "tone": "red" if days <= 15 else "amber"}
    if days <= 90:
        return {"state": "Renew within 90 days", "days": days, "tone": "amber"}
    return {"state": "Valid", "days": days, "tone": "green"}
