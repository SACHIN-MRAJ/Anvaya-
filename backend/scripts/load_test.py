r"""Load test: many simulated people using the portals at once, reporting throughput and latency percentiles.

Each virtual user signs in (development sign-in), then loops over a realistic mix of reads and a few writes for
the chosen duration. Point it at a server whose rate limit is raised for the test, never at production.

Run from backend/:  .venv\Scripts\python scripts\load_test.py --base http://127.0.0.1:8020 --users 50 --seconds 30
"""
import argparse
import asyncio
import random
import statistics
import time
from collections import Counter, defaultdict

import httpx

OFFICER = [
    ("GET", "/api/aicte/dashboard"), ("GET", "/api/aicte/queue"), ("GET", "/api/aicte/queue?region=CRO&sort=due"),
    ("GET", "/api/applications/ANU-2026-0412"), ("GET", "/api/applications/ANU-2026-0412/brief"), ("GET", "/api/applications/ANU-2026-0412/risk"),
    ("GET", "/api/audit/verify?ref=ANU-2026-0398"), ("GET", "/api/aicte/compliance"), ("GET", "/api/aicte/insights/process-map"),
    ("GET", "/api/notifications"), ("POST", "/api/aicte/simulator/run"),
]
INSTITUTION = [
    ("GET", "/api/institution/dashboard"), ("GET", "/api/institution/applications"), ("GET", "/api/institution/obligations"),
    ("GET", "/api/applications/ANU-2026-0398/eta"), ("GET", "/api/institution/documents"), ("POST", "/api/applications/precheck"),
]
PUBLIC = [("GET", "/api/public/institutions"), ("GET", "/api/public/verify/ANU-2026-0117"), ("GET", "/api/public/performance"), ("GET", "/api/public/rules/types"), ("GET", "/api/public/status")]
BODIES = {"/api/aicte/simulator/run": {"extraOfficersBottleneck": 2, "extraExperts": 3, "volumeChange": 0.1}, "/api/applications/precheck": {"typeId": "intake", "sampleKinds": ["uni", "fac"], "requestedIntake": 180}}


async def sign_in(c: httpx.AsyncClient, body: dict) -> None:
    for attempt in range(3):
        try:
            if (await c.post("/api/auth/dev-login", json=body)).status_code == 200:
                return
        except httpx.HTTPError:
            await asyncio.sleep(1 + attempt)
    raise SystemExit("could not sign in a virtual user")


async def user(base: str, kind: str, until: float, results: list, by_route: dict) -> None:
    async with httpx.AsyncClient(base_url=base, timeout=30) as c:
        if kind == "officer":
            await sign_in(c, {"portal": "aicte", "officerRole": random.choice(["Bureau head", "Dealing officer", "Committee member"])})  # noqa: S311
            mix = OFFICER + PUBLIC
        elif kind == "institution":
            await sign_in(c, {"portal": "institution"})
            mix = INSTITUTION + PUBLIC
        else:
            mix = PUBLIC
        while time.perf_counter() < until:
            method, path = random.choice(mix)  # noqa: S311
            start = time.perf_counter()
            try:
                r = await c.request(method, path, json=BODIES.get(path.split("?")[0]) if method == "POST" else None)
                status = r.status_code
            except httpx.HTTPError as e:
                status = type(e).__name__
            ms = (time.perf_counter() - start) * 1000
            results.append((status, ms))
            by_route[path.split("?")[0]].append(ms)


def pct(values: list[float], p: float) -> float:
    return statistics.quantiles(values, n=100, method="inclusive")[p - 1] if len(values) > 1 else values[0]


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8020")
    ap.add_argument("--users", type=int, default=50)
    ap.add_argument("--seconds", type=int, default=30)
    a = ap.parse_args()
    kinds = ["officer"] * (a.users * 4 // 10) + ["institution"] * (a.users * 4 // 10)
    kinds += ["public"] * (a.users - len(kinds))
    results: list = []
    by_route: dict = defaultdict(list)
    until = time.perf_counter() + a.seconds
    began = time.perf_counter()
    await asyncio.gather(*(user(a.base, k, until, results, by_route) for k in kinds))
    elapsed = time.perf_counter() - began
    times = [ms for _, ms in results]
    codes = Counter(s for s, _ in results)
    ok = sum(n for s, n in codes.items() if isinstance(s, int) and s < 400)
    print(f"{a.users} users ({Counter(kinds)}) for {a.seconds}s against {a.base}")
    print(f"requests {len(results)}  throughput {len(results) / elapsed:.0f}/s  success {ok / len(results):.2%}  status {dict(codes)}")
    print(f"latency ms  p50 {pct(times, 50):.0f}  p95 {pct(times, 95):.0f}  p99 {pct(times, 99):.0f}  max {max(times):.0f}")
    print("slowest routes by p95:")
    for route, vals in sorted(by_route.items(), key=lambda kv: -pct(kv[1], 95))[:5]:
        print(f"  {route:42} p95 {pct(vals, 95):6.0f} ms  n={len(vals)}")


if __name__ == "__main__":
    asyncio.run(main())
