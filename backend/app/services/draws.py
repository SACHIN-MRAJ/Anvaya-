"""Public randomness from drand, and the two draws that use it: the expert panel (commit, then reveal)
and risk-weighted surprise inspections. The arithmetic matches the browser so anyone can re-check a draw.
"""
import hashlib
import logging
import time

import httpx

from ..config import settings

log = logging.getLogger("anumati.drand")
GENESIS_TIME, PERIOD = 1595431050, 30  # League of Entropy default chain


def sha(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def current_round() -> int:
    return int((time.time() - GENESIS_TIME) // PERIOD) + 1


async def fetch(round_: int | None = None) -> dict:
    """Latest (or a given) round. Falls back to a clearly labelled simulated value when offline."""
    url = f"{settings.drand_url}/{round_ if round_ else 'latest'}"
    try:
        async with httpx.AsyncClient(timeout=settings.drand_timeout_seconds) as c:
            r = await c.get(url)
            if r.status_code == 200:
                j = r.json()
                return {"round": j["round"], "randomness": j["randomness"], "source": "live drand network"}
            if r.status_code in (404, 425) and round_:
                return {"round": round_, "randomness": None, "source": "not yet published"}
    except (httpx.HTTPError, KeyError, ValueError) as e:
        log.info("drand unavailable: %s", e)
    r_ = round_ or current_round()
    if round_ and round_ > current_round():
        return {"round": r_, "randomness": None, "source": "not yet published"}
    return {"round": r_, "randomness": sha(f"simulated-{r_}"), "source": "simulated (offline)"}


def commitment(app_id: str, expert_ids: list[str], round_: int) -> str:
    return sha(f"{app_id}|{','.join(expert_ids)}|round:{round_}")


def draw_panel(expert_ids: list[str], randomness: str, k: int = 3) -> list[str]:
    return [e for _, e in sorted((sha(f"{randomness}|{e}"), e) for e in expert_ids)][:k]


def unit(hex_: str) -> float:
    return int(hex_[:13], 16) / 16**13


def weighted_draw(items: list[dict], randomness: str, k: int, pure_random: int) -> list[dict]:
    """Efraimidis–Spirakis weighted sampling without replacement, plus a share of purely random picks."""
    keyed = [(it, unit(sha(f"{randomness}|{it['id']}"))) for it in items]
    by_risk = sorted(keyed, key=lambda x: -(x[1] ** (1 / x[0]["weight"])))[: k - pure_random]
    taken = {it["id"] for it, _ in by_risk}
    rand = sorted(((it, u) for it, u in keyed if it["id"] not in taken), key=lambda x: x[1])[:pure_random]
    return [{"id": it["id"], "why": "risk-weighted"} for it, _ in by_risk] + [{"id": it["id"], "why": "pure random"} for it, _ in rand]
