"""Field inspection (expert visit) checklist and report.

The checklist follows what APH 1.9(c)-(g) asks the visiting committee to check, and the expected figures come
from the institution's own records through the norms in norms.py, so the expert sees "16 classrooms of 66 m²"
rather than a blank line. The signed report is canonical JSON; its SHA-256 goes into the file's evidence log.
"""
import json

from .. import audit
from . import norms

RESULTS = ("Meets", "Partly meets", "Does not meet", "Not applicable")
PHOTO_SPOTS = ("Main entrance", "Academic building", "Administrative building", "Library")


def checklist(courses: list[norms.Course], fire_until: str | None, old_building: bool) -> list[dict]:
    need = {r["kind"]: r for r in norms.required_spaces(courses)}

    def rooms(kind: str) -> str:
        r = need.get(kind)
        return f"{r['rooms']} of at least {r['minArea']} m²" if r else "Not required"

    labs = sum(need[k]["rooms"] for k in ("First-year laboratory", "Laboratory", "PG laboratory", "Research laboratory", "X-category laboratory") if k in need)
    faculty = norms.faculty_required(courses)["total"]
    items = [
        ("A", "Instructional area", "classrooms", "Classrooms, furnished and in use", rooms("Classroom"), "APH 1.9(c), Annexure-3"),
        ("A", "Instructional area", "tutorials", "Tutorial rooms", rooms("Tutorial room"), "APH Annexure-3"),
        ("A", "Instructional area", "labs", "Laboratories with equipment as per the university curriculum", f"{labs} laboratories of at least 66 m²", "APH 1.9(c), Annexure-3"),
        ("A", "Instructional area", "workshop", "Workshop and drawing hall", f"Workshop {rooms('Workshop')}; drawing hall {rooms('Drawing hall')}", "APH Annexure-3"),
        ("A", "Instructional area", "library", "Library and reading room", f"At least {need['Library']['minArea']} m²", "APH Annexure-3, Annexure-4"),
        ("A", "Instructional area", "computers", "Computers, licensed software and internet", f"At least {norms.computers_needed(courses)} computers", "APH 1.9(e), Annexure-4"),
        ("B", "Administration and amenities", "admin", "Administrative area: Principal's room, office, faculty cabins, board room", f"At least {norms.area_minimums(sum(c.intake for c in courses))['Administrative']} m² in all", "APH 1.9(c), Annexure-3, 3.3"),
        ("B", "Administration and amenities", "amenities", "Amenities: toilets, common rooms, first aid, cafeteria", f"At least {norms.area_minimums(sum(c.intake for c in courses))['Amenities']} m² in all", "APH Annexure-3, 3.4"),
        ("B", "Administration and amenities", "barrier", "Barrier-free access (ramps, lifts or ground-floor rooms, accessible toilets)", "Available in every academic building", "APH Chapter VII"),
        ("C", "People", "principal", "Principal or Director appointed and present", "Appointment order seen", "APH 1.9(d)"),
        ("C", "People", "faculty", "Faculty appointment letters checked against the roster", f"{faculty} faculty needed; check a sample of 10 letters", "APH 1.9(d), Annexure-1"),
        ("D", "Records", "stock", "Stock registers for equipment, computers and books", "Up to date and signed", "APH 1.9(e)"),
        ("D", "Records", "books", "Books, journals and e-resources", "As per Annexure-4 for the approved intake", "APH 1.9(e), Annexure-4"),
        ("E", "Safety", "fire", "Fire and life safety certificate on display and valid", f"Valid until {fire_until}" if fire_until else "Valid certificate on display", "APH Annexure-3, 3.1(d)"),
        ("E", "Safety", "structure", "Structural stability certificate", "Needed: a building is over 30 years old" if old_building else "Needed only for buildings over 30 years old", "APH Annexure-1"),
        ("F", "Plan and evidence", "plan", "Building matches the approved plan signed by the scrutiny committee", "No unapproved additions", "APH 1.9(g)"),
        *(("F", "Plan and evidence", f"photo-{i}", f"GPS-tagged photo: {spot}", "Photo taken on the visit day within 500 m of the campus", "APH 1.9(f)") for i, spot in enumerate(PHOTO_SPOTS, start=1)),
        ("F", "Plan and evidence", "video", "Video recording of the visit", "Physical visit: recorded. Online visit: at least 30 minutes", "APH 1.9(f)"),
    ]
    return [
        {"id": key, "section": f"{sec}. {name}", "label": label, "expect": expect, "clause": clause, "result": None, "note": "", "evidence": [], "photo": key.startswith("photo-")}
        for sec, name, key, label, expect, clause in items
    ]


def progress(items: list[dict]) -> dict:
    done = sum(1 for i in items if i["result"])
    return {
        "done": done, "total": len(items),
        "concerns": sum(1 for i in items if i["result"] in ("Partly meets", "Does not meet")),
        "failed": sum(1 for i in items if i["result"] == "Does not meet"),
    }


def missing_for_submit(items: list[dict], mode: str, video_url: str) -> list[str]:
    gaps = [f"Answer: {i['label']}" for i in items if not i["result"]]
    for i in items:
        if i["photo"] and i["result"] != "Not applicable" and not any(e.get("verdict") == "ok" for e in i["evidence"]) and not i["note"].strip():
            gaps.append(f"Add a photo that passes the location check, or explain why: {i['label']}")
        if i["result"] in ("Partly meets", "Does not meet") and len(i["note"].strip()) < 10:
            gaps.append(f"Say what is wrong: {i['label']}")
    if mode in ("Online", "Hybrid") and not video_url.strip():
        gaps.append("Add the link to the visit recording (online visits need at least 30 minutes)")
    return gaps


def report(inspection: dict, institution: dict, application_id: str) -> tuple[str, str]:
    """The canonical report text and its SHA-256 fingerprint."""
    body = {"applicationId": application_id, "institution": institution, "inspection": inspection}
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return canonical, audit.sha256_hex(canonical)
