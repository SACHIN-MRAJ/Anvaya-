"""The Approval Process Handbook as code: Table 2.3 routing, stage targets and golden tests.

A rule set is a versioned decision table. The evaluator is identical to the browser's (frontend/src/data/rules.ts),
so the Rules studio preview and the server always agree. In a large deployment the same JSON tables can be
loaded into GoRules ZEN; the contract (facts in, path out) does not change.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Application, RuleVersion

KEYS = ["selfDisclosure", "scrutiny", "evc", "shc"]
STEP_LABEL = {"selfDisclosure": "Self-disclosure", "scrutiny": "Scrutiny", "evc": "Expert visit (EVC)", "shc": "Hearing (SHC)"}
STAGE_FOR_STEP = {"Self-disclosure": "scrutiny", "Scrutiny": "scrutiny", "Re-scrutiny": "rescrutiny", "EVC": "evc", "SHC": "shc", "Executive Committee": "ec", "SAC appeal": "appeal"}
DEFAULT_TARGETS = {"scrutiny": 15, "rescrutiny": 10, "evc": 30, "shc": 15, "ec": 10, "appeal": 7}


def evaluate_path(table: dict, type_id: str, deficiencies_found: bool = False, appeal: bool = False) -> list[str]:
    s = table.get(type_id)
    if not s:
        return []
    path: list[str] = []
    if s["selfDisclosure"] == "required":
        path.append("Self-disclosure")
    if s["scrutiny"] == "required":
        path.append("Scrutiny")
        if deficiencies_found:
            path.append("Re-scrutiny")
    if s["evc"] == "required" or (s["evc"] == "conditional" and deficiencies_found):
        path.append("EVC")
    if s["shc"] == "required" or (s["shc"] == "conditional" and deficiencies_found):
        path.append("SHC")
    path.append("Executive Committee")
    if appeal:
        path.append("SAC appeal")
    return path


def facts_of(app: Application) -> dict:
    return {"type_id": app.type_id, "deficiencies_found": app.deficiencies > 0 or app.stage == "rescrutiny", "appeal": app.stage == "appeal"}


def run_golden(table: dict, golden: list[dict]) -> list[dict]:
    out = []
    for g in golden:
        f = g["facts"]
        actual = evaluate_path(table, f["typeId"], f["deficienciesFound"], f["appeal"])
        out.append({"id": g["id"], "label": g["label"], "expected": g["expected"], "actual": actual, "pass": actual == g["expected"]})
    return out


async def published(session: AsyncSession) -> RuleVersion:
    return (await session.execute(select(RuleVersion).where(RuleVersion.status == "published").order_by(RuleVersion.id.desc()).limit(1))).scalar_one()


def impact(base: dict, proposed: dict, open_apps: list[Application]) -> list[dict]:
    """Which open files would follow a different path under the proposed table."""
    rows = []
    for a in open_apps:
        f = facts_of(a)
        before = evaluate_path(base, **f)
        after = evaluate_path(proposed, **f)
        if before != after:
            rows.append({"id": a.id, "institutionId": a.institution_id, "before": before, "after": after})
    return rows
