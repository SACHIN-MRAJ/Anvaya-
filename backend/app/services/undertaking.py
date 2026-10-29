"""Reads a signed undertaking and lists each promise with its due date and handbook clause.

This is a transparent, rule-based reader: numbered promises, explicit dates ("before 15 July 2027") and keywords
for the clause. Nothing is tracked until the institution confirms each promise. In production a document parser
(Docling) and a schema-bound language model can replace `read`; the confirmation step stays the same.
"""
import re
from datetime import date

MONTHS = {m: i for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"], start=1)}
DATE = re.compile(r"\b(\d{1,2})\s+(" + "|".join(MONTHS) + r")\s+(\d{4})\b", re.IGNORECASE)
CLAUSES = [
    (("faculty", "teacher", "professor"), "APH Annexure-1, 1.3.5"),
    (("lease", "land", "deed"), "APH 2.1(e)"),
    (("library", "volumes", "books"), "APH Ch. VI"),
    (("fire", "safety", "occupancy"), "APH Annexure-1"),
    (("building", "laboratory", "lab", "classroom"), "APH Appendix 8"),
]


def _clause(text: str) -> str:
    low = text.lower()
    return next((clause for words, clause in CLAUSES if any(w in low for w in words)), "APH 1.4.6")


def read(text: str) -> list[dict]:
    promises = []
    for line in text.splitlines():
        m = re.match(r"^\s*(\d+)[.)]\s+(.+)$", line)
        if not m:
            continue
        body = m.group(2).strip()
        found = DATE.search(body)
        due = date(int(found.group(3)), MONTHS[found.group(2).lower()], int(found.group(1))).isoformat() if found else None
        promise = re.sub(r"\s+(?:shall|will)\s+be\s+", " ", body)
        promise = re.sub(r"\s*(?:before|by|on or before)\s+" + DATE.pattern + r"\.?$", "", promise, flags=re.IGNORECASE).rstrip(" .")
        promises.append({
            "promise": promise[:1].upper() + promise[1:],
            "due": due,
            "clause": _clause(body),
            # an explicit date and a known clause are what make a promise trackable without a second look
            "confidence": round(0.6 + (0.25 if due else 0) + (0.12 if _clause(body) != "APH 1.4.6" else 0), 2),
        })
    return promises
