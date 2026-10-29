"""Logs and metrics.

Logs: one line per request, as text for people or as JSON for log collectors (ANUMATI_LOG_FORMAT=json).
Metrics: Prometheus format at /metrics. Request counts and latency per route, plus the numbers a duty officer
watches: open files by clock state, the highest escalation level and when the deadline check last ran.
"""
import json
import logging
import time

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

REQUESTS = Counter("anumati_http_requests_total", "HTTP requests", ["method", "route", "status"])
LATENCY = Histogram("anumati_http_request_seconds", "HTTP request duration", ["route"], buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5))
OPEN_FILES = Gauge("anumati_open_applications", "Applications not yet decided, by clock state", ["clock"])
ESCALATED = Gauge("anumati_escalated_applications", "Open applications at each escalation level", ["level"])
SCHEDULER_LAST_RUN = Gauge("anumati_scheduler_last_run_timestamp_seconds", "When the deadline check last finished")
ALERTS = Counter("anumati_alerts_total", "Alerts by channel and delivery result", ["channel", "result"])
CHAIN_FAILURES = Counter("anumati_evidence_chain_failures_total", "Evidence-log verifications that found a broken chain")


def metrics_payload() -> tuple[bytes, str]:
    return generate_latest(), CONTENT_TYPE_LATEST


def record_scheduler(by_clock: dict[str, int], by_level: dict[int, int]) -> None:
    for clock in ("running", "paused", "breached"):
        OPEN_FILES.labels(clock).set(by_clock.get(clock, 0))
    for level in range(4):
        ESCALATED.labels(str(level)).set(by_level.get(level, 0))
    SCHEDULER_LAST_RUN.set(time.time())


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {"time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"), "level": record.levelname, "logger": record.name, "message": record.getMessage()}
        for key in ("request_id", "method", "path", "status", "ms", "user"):
            if hasattr(record, key):
                entry[key] = getattr(record, key)
        if record.exc_info:
            entry["error"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False)


def configure_logging(fmt: str) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter() if fmt == "json" else logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(logging.INFO)
