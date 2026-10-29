"""Database tables. Rule of thumb: nothing is overwritten. New document versions, new history rows,
new evidence-log entries and new rule versions are added; old ones stay."""
import datetime as dt
from datetime import date, datetime
from typing import ClassVar

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from . import timeutil as clock
from .db import Base


class Region(Base):
    __tablename__ = "regions"
    id: Mapped[str] = mapped_column(String(8), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    office: Mapped[str] = mapped_column(String(80))
    states: Mapped[list] = mapped_column(JSON, default=list)


class Institution(Base):
    __tablename__ = "institutions"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    aicte_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    city: Mapped[str] = mapped_column(String(80))
    state: Mapped[str] = mapped_column(String(80))
    region: Mapped[str] = mapped_column(ForeignKey("regions.id"), index=True)
    category: Mapped[str] = mapped_column(String(120))
    established: Mapped[int] = mapped_column(Integer)
    land: Mapped[str] = mapped_column(String(10))
    lease_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    longest_course_years: Mapped[int] = mapped_column(Integer)
    intake: Mapped[int] = mapped_column(Integer)
    programmes: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(30))
    trust: Mapped[str] = mapped_column(String(200))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    # Contact and trust details kept on the one institutional record (address, email, phone, website, registration)
    profile: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160), default="")
    phone: Mapped[str] = mapped_column(String(20), default="")
    portal: Mapped[str] = mapped_column(String(12))  # institution | aicte
    role: Mapped[str] = mapped_column(String(40))
    region: Mapped[str | None] = mapped_column(String(8), nullable=True)
    institution_id: Mapped[str | None] = mapped_column(ForeignKey("institutions.id"), nullable=True)
    language: Mapped[str] = mapped_column(String(5), default="en")
    channels: Mapped[list] = mapped_column(JSON, default=lambda: ["email", "sms"])
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")


class ApplicationType(Base):
    __tablename__ = "application_types"
    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    chapter: Mapped[str] = mapped_column(String(40))
    clause: Mapped[str] = mapped_column(String(80))
    summary: Mapped[str] = mapped_column(Text)
    steps: Mapped[dict] = mapped_column(JSON)
    documents: Mapped[list] = mapped_column(JSON)
    target_days: Mapped[int] = mapped_column(Integer)


class RuleVersion(Base):
    __tablename__ = "rule_versions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version: Mapped[str] = mapped_column(String(20), unique=True)
    table: Mapped[dict] = mapped_column(JSON)
    targets: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(12))  # proposed | published | rejected
    author: Mapped[str] = mapped_column(String(120))
    approver: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reason: Mapped[str] = mapped_column(Text, default="")
    effective_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    tests_passed: Mapped[int] = mapped_column(Integer, default=0)
    tests_total: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, server_default=func.now())
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Application(Base):
    __tablename__ = "applications"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"), index=True)
    type_id: Mapped[str] = mapped_column(ForeignKey("application_types.id"))
    cycle: Mapped[str] = mapped_column(String(10))
    submitted_on: Mapped[date] = mapped_column(Date)
    stage: Mapped[str] = mapped_column(String(12), index=True)
    stage_entered_on: Mapped[date] = mapped_column(Date)
    due_on: Mapped[date] = mapped_column(Date, index=True)
    clock: Mapped[str] = mapped_column(String(10), index=True)  # running | paused | breached | met
    paused_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    escalation_level: Mapped[int] = mapped_column(Integer, default=0)
    holder: Mapped[str] = mapped_column(String(80))
    region: Mapped[str] = mapped_column(ForeignKey("regions.id"), index=True)
    deficiencies: Mapped[int] = mapped_column(Integer, default=0)
    risk: Mapped[float] = mapped_column(Float, default=0.0)
    risk_reasons: Mapped[list] = mapped_column(JSON, default=list)
    outcome: Mapped[str | None] = mapped_column(String(4), nullable=True)
    public_status: Mapped[str] = mapped_column(String(20))
    rules_version: Mapped[str] = mapped_column(String(20), default="2026.3")
    submission_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    history: Mapped[list["HistoryEvent"]] = relationship(order_by="HistoryEvent.id", cascade="all, delete-orphan", lazy="selectin")


class HistoryEvent(Base):
    __tablename__ = "history_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id"), index=True)
    at: Mapped[str] = mapped_column(String(19))  # ISO local time, kept as text so evidence hashes stay stable
    actor: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(80))
    action: Mapped[str] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    rule_ref: Mapped[str | None] = mapped_column(String(60), nullable=True)


class Deficiency(Base):
    __tablename__ = "deficiencies"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id"), index=True)
    text: Mapped[str] = mapped_column(Text)
    clause: Mapped[str] = mapped_column(String(40), default="APH 1.8(f)")
    stage: Mapped[str] = mapped_column(String(12), default="scrutiny", server_default="scrutiny")
    status: Mapped[str] = mapped_column(String(10), default="open")  # open | resolved
    raised_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Draft(Base):
    __tablename__ = "drafts"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"), index=True)
    type_id: Mapped[str] = mapped_column(String(30))
    data: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, server_default=func.now(), onupdate=clock.now)


class Document(Base):
    """One uploaded file. A replacement is a new row with a higher version; nothing is overwritten."""

    __tablename__ = "documents"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"), index=True)
    application_id: Mapped[str | None] = mapped_column(ForeignKey("applications.id"), nullable=True, index=True)
    doc_kind: Mapped[str] = mapped_column(String(30))  # e.g. "uni" (university NOC), "land", "fire"
    filename: Mapped[str] = mapped_column(String(200))
    storage_key: Mapped[str] = mapped_column(String(300))
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    size_bytes: Mapped[int] = mapped_column(Integer)
    pages: Mapped[int | None] = mapped_column(Integer, nullable=True)
    signed: Mapped[bool] = mapped_column(Boolean, default=False)
    signature: Mapped[dict] = mapped_column(JSON, default=dict)
    preflight: Mapped[dict] = mapped_column(JSON, default=dict)
    version: Mapped[int] = mapped_column(Integer, default=1)
    uploaded_by: Mapped[str] = mapped_column(String(120))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, server_default=func.now())
    # Checklist status: uploaded -> awaiting verification (once submitted) -> verified or needs correction
    review_status: Mapped[str] = mapped_column(String(24), default="uploaded", server_default="uploaded")
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Obligation(Base):
    __tablename__ = "obligations"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(Text)
    clause: Mapped[str] = mapped_column(String(60))
    due_on: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(12))
    escalation_level: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String(200))
    evidence: Mapped[str | None] = mapped_column(String(200), nullable=True)


class Expert(Base):
    __tablename__ = "experts"
    id: Mapped[str] = mapped_column(String(10), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    city: Mapped[str] = mapped_column(String(80))
    region: Mapped[str] = mapped_column(String(8))
    specialisation: Mapped[str] = mapped_column(String(80))
    load: Mapped[int] = mapped_column(Integer)
    max_load: Mapped[int] = mapped_column(Integer)
    linked_institutions: Mapped[list] = mapped_column(JSON, default=list)
    available: Mapped[bool] = mapped_column(Boolean, default=True)


class EvcPanel(Base):
    __tablename__ = "evc_panels"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id"), index=True)
    mode: Mapped[str] = mapped_column(String(10), default="Physical")
    shortlist: Mapped[list] = mapped_column(JSON)
    excluded: Mapped[list] = mapped_column(JSON)
    commitment: Mapped[str] = mapped_column(String(64))
    committed_round: Mapped[int] = mapped_column(Integer)
    randomness: Mapped[str | None] = mapped_column(String(64), nullable=True)
    chosen: Mapped[list] = mapped_column(JSON, default=list)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, server_default=func.now())
    drawn_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class VisitPhoto(Base):
    __tablename__ = "visit_photos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id"), index=True)
    filename: Mapped[str] = mapped_column(String(200))
    sha256: Mapped[str] = mapped_column(String(64))
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    taken_at: Mapped[str | None] = mapped_column(String(19), nullable=True)
    distance_m: Mapped[int | None] = mapped_column(Integer, nullable=True)
    verdict: Mapped[str] = mapped_column(String(10))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, server_default=func.now())


class InspectionDraw(Base):
    __tablename__ = "inspection_draws"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    drand_round: Mapped[int] = mapped_column(Integer)
    randomness: Mapped[str] = mapped_column(String(64))
    source: Mapped[str] = mapped_column(String(40))
    k: Mapped[int] = mapped_column(Integer)
    weights: Mapped[list] = mapped_column(JSON)
    chosen: Mapped[list] = mapped_column(JSON)
    drawn_by: Mapped[str] = mapped_column(String(120))
    drawn_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, server_default=func.now())


class Faculty(Base):
    __tablename__ = "faculty"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    pan_hash: Mapped[str] = mapped_column(String(64), index=True)  # salted hash; the PAN itself is never stored
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"), index=True)
    designation: Mapped[str] = mapped_column(String(30))
    joined: Mapped[date] = mapped_column(Date)
    department: Mapped[str] = mapped_column(String(120), default="", server_default="")
    qualification: Mapped[str] = mapped_column(String(40), default="", server_default="")
    employment: Mapped[str] = mapped_column(String(12), default="Regular", server_default="Regular")  # Regular | Contract | Visiting
    status: Mapped[str] = mapped_column(String(10), default="Active", server_default="Active")  # Active | Left
    verification: Mapped[str] = mapped_column(String(12), default="Pending", server_default="Pending")  # Pending | Verified | Discrepancy


class Notice(Base):
    __tablename__ = "notices"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    date: Mapped[dt.date] = mapped_column(Date)
    audience: Mapped[str] = mapped_column(String(20))
    category: Mapped[str] = mapped_column(String(20))
    summary: Mapped[str] = mapped_column(Text)


class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    label: Mapped[str] = mapped_column(String(200))
    date: Mapped[dt.date] = mapped_column(Date)
    end_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    kind: Mapped[str] = mapped_column(String(12))
    clause: Mapped[str | None] = mapped_column(String(60), nullable=True)
    revised_from: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    revision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class GlossaryTerm(Base):
    __tablename__ = "glossary"
    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    full: Mapped[str] = mapped_column(String(120))
    meaning: Mapped[str] = mapped_column(Text)
    clause: Mapped[str | None] = mapped_column(String(40), nullable=True)
    aliases: Mapped[list] = mapped_column(JSON, default=list)


class Notification(Base):
    __tablename__ = "notifications"
    # No INSERT ... RETURNING: the sender may not be allowed to read the alert back under row-level security.
    __mapper_args__: ClassVar[dict] = {"eager_defaults": False}
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    audience: Mapped[str] = mapped_column(String(12))  # institution | aicte
    institution_id: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    region: Mapped[str | None] = mapped_column(String(8), nullable=True)
    title: Mapped[str] = mapped_column(Text)
    tone: Mapped[str] = mapped_column(String(8), default="brand")
    ref: Mapped[str | None] = mapped_column(String(20), nullable=True)
    channels: Mapped[list] = mapped_column(JSON, default=list)
    delivery: Mapped[dict] = mapped_column(JSON, default=dict)  # channel -> sent | logged | failed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, server_default=func.now(), index=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)


class AuditEntry(Base):
    """Tamper-evident evidence log: one hash chain per reference (an application or a register)."""

    __tablename__ = "audit_log"
    __table_args__ = (UniqueConstraint("ref", "seq"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ref: Mapped[str] = mapped_column(String(40), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    at: Mapped[str] = mapped_column(String(19))
    actor: Mapped[str] = mapped_column(String(120))
    action: Mapped[str] = mapped_column(Text)
    payload: Mapped[str] = mapped_column(Text)
    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64), index=True)


class SavedView(Base):
    __tablename__ = "saved_views"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(40), index=True)
    name: Mapped[str] = mapped_column(String(80))
    query: Mapped[str] = mapped_column(String(300))


class UnapprovedInstitution(Base):
    __tablename__ = "unapproved_institutions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(80))
    notice: Mapped[str] = mapped_column(String(120))


class SuspiciousReport(Base):
    __tablename__ = "suspicious_reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ref: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(80), default="")
    contact: Mapped[str] = mapped_column(String(120), default="")
    status: Mapped[str] = mapped_column(String(12), default="received")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, server_default=func.now())


class Feedback(Base):
    __tablename__ = "feedback"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    page: Mapped[str] = mapped_column(String(200))
    helpful: Mapped[bool] = mapped_column(Boolean)
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, server_default=func.now())


class StatusCheck(Base):
    __tablename__ = "status_checks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    service: Mapped[str] = mapped_column(String(60), index=True)
    at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, server_default=func.now(), index=True)
    ok: Mapped[bool] = mapped_column(Boolean)
    latency_ms: Mapped[int] = mapped_column(Integer)


class KeyValue(Base):
    """Small settings and reference blobs: alert settings, the historical process map, signing keys."""

    __tablename__ = "key_values"
    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)


class IdempotencyKey(Base):
    """Remembers the answer to a submission for 24 hours, so a retried or double-clicked request is answered
    once. The row is written before the work starts; a second identical request waits for the first."""

    __tablename__ = "idempotency_keys"
    key: Mapped[str] = mapped_column(String(160), primary_key=True)  # user id + client key
    request_hash: Mapped[str] = mapped_column(String(64))
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)  # empty while in progress
    response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, server_default=func.now(), index=True)


# ---------------------------------------------------------------- the one institutional record

class Campus(Base):
    """A campus or plot of the institution. APH allows at most three plots within 2 km (Annexure-3, 3.1(g))."""

    __tablename__ = "campuses"
    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    address: Mapped[str] = mapped_column(Text, default="")
    city: Mapped[str] = mapped_column(String(80))
    state: Mapped[str] = mapped_column(String(80))
    pincode: Mapped[str] = mapped_column(String(10), default="")
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    land_acres: Mapped[float] = mapped_column(Float, default=0)
    ownership: Mapped[str] = mapped_column(String(10))  # Owned | Leased
    deed_no: Mapped[str] = mapped_column(String(60), default="")
    lease_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    lease_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_main: Mapped[bool] = mapped_column(Boolean, default=False)


class Space(Base):
    """One room or area, carpet area in square metres, as APH Annexure-3 counts it."""

    __tablename__ = "spaces"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"), index=True)
    campus_id: Mapped[str] = mapped_column(ForeignKey("campuses.id"), index=True)
    category: Mapped[str] = mapped_column(String(16))  # Instructional | Administrative | Amenities
    kind: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(120))
    building: Mapped[str] = mapped_column(String(80), default="")
    area_sqm: Mapped[float] = mapped_column(Float)


class Certificate(Base):
    """A certificate with a validity date (fire safety, occupancy, structural stability and so on)."""

    __tablename__ = "certificates"
    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"), index=True)
    campus_id: Mapped[str | None] = mapped_column(ForeignKey("campuses.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String(60))
    number: Mapped[str] = mapped_column(String(60), default="")
    issued_by: Mapped[str] = mapped_column(String(160), default="")
    issued_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)  # empty: does not expire
    document_id: Mapped[str | None] = mapped_column(ForeignKey("documents.id"), nullable=True)
    verification: Mapped[str] = mapped_column(String(12), default="Pending")  # Pending | Verified | Discrepancy
    verified_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reminded: Mapped[list] = mapped_column(JSON, default=list)  # reminder windows already sent, in days


class Programme(Base):
    """An approved (or proposed, or closed) programme with its sanctioned intake."""

    __tablename__ = "programmes"
    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"), index=True)
    department: Mapped[str] = mapped_column(String(120))
    name: Mapped[str] = mapped_column(String(160))
    level: Mapped[str] = mapped_column(String(10))  # Diploma | UG | PG
    duration_years: Mapped[int] = mapped_column(Integer)
    approved_intake: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(10), default="Approved")  # Approved | Proposed | Closed
    since: Mapped[int] = mapped_column(Integer)
    x_category: Mapped[bool] = mapped_column(Boolean, default=False)  # needs an extra laboratory/workshop (Annexure-3)
    accreditation: Mapped[dict] = mapped_column(JSON, default=dict)  # {body, number, validUntil}


class Leader(Base):
    """Leadership and authorised signatories. Documents are signed by the Chairman or Secretary of the Trust (APH 1.4.6)."""

    __tablename__ = "leaders"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    position: Mapped[str] = mapped_column(String(60))
    department: Mapped[str] = mapped_column(String(120), default="")
    email: Mapped[str] = mapped_column(String(160), default="")
    is_signatory: Mapped[bool] = mapped_column(Boolean, default=False)
    since: Mapped[date] = mapped_column(Date)
    until: Mapped[date | None] = mapped_column(Date, nullable=True)


class Member(Base):
    """A person who works on the institution records in ANUMATI, with a role that sets what they may do."""

    __tablename__ = "members"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(40))
    user_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    added_by: Mapped[str] = mapped_column(String(120))
    added_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, server_default=func.now())
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


# ---------------------------------------------------------------- oversight

class FieldInspection(Base):
    """An on-site (or online) expert inspection: checklist answers, evidence, signature and report fingerprint."""

    __tablename__ = "field_inspections"
    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id"), index=True)
    inspector_id: Mapped[str] = mapped_column(String(40), index=True)
    inspector_name: Mapped[str] = mapped_column(String(120))
    assigned_by: Mapped[str] = mapped_column(String(120))
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, server_default=func.now())
    mode: Mapped[str] = mapped_column(String(10), default="Physical")
    status: Mapped[str] = mapped_column(String(12), default="Assigned")  # Assigned | In progress | Submitted
    items: Mapped[list] = mapped_column(JSON)
    video_url: Mapped[str] = mapped_column(String(300), default="")
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    signature: Mapped[dict] = mapped_column(JSON, default=dict)
    report_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)


class Verification(Base):
    """An officer check of one institutional record (campus, certificate, programme, faculty member and so on)."""

    __tablename__ = "verifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"), index=True)
    subject: Mapped[str] = mapped_column(String(20))  # Campus | Space | Certificate | Programme | Faculty | Leader
    subject_id: Mapped[str] = mapped_column(String(40))
    subject_label: Mapped[str] = mapped_column(String(200))
    outcome: Mapped[str] = mapped_column(String(12))  # Verified | Discrepancy | Follow-up
    note: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(20))  # Document | Site visit | Registry | Other
    checked_by: Mapped[str] = mapped_column(String(120))
    checked_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, server_default=func.now())


class AiDispute(Base):
    """An institution's challenge to a specific AI document check finding.
    An officer reviews it and either confirms the AI finding or overrides it so the
    document can proceed.  The AI never independently blocks an application — a person always decides."""

    __tablename__ = "ai_disputes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"), index=True)
    application_id: Mapped[str | None] = mapped_column(ForeignKey("applications.id"), nullable=True, index=True)
    finding_id: Mapped[str] = mapped_column(String(80))       # the AI finding id being disputed
    finding_title: Mapped[str] = mapped_column(Text)
    finding_detail: Mapped[str] = mapped_column(Text, default="")
    finding_clause: Mapped[str] = mapped_column(String(60), default="")
    reason: Mapped[str] = mapped_column(Text)                 # institution's explanation
    status: Mapped[str] = mapped_column(String(12), default="pending", index=True)  # pending | overridden | confirmed
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)  # officer's note
    reviewed_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, server_default=func.now(), index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class RegulatoryAction(Base):
    """A penal or restrictive action decided by the competent authority, with reasons (due process)."""

    __tablename__ = "regulatory_actions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"), index=True)
    application_id: Mapped[str | None] = mapped_column(ForeignKey("applications.id"), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(30))
    detail: Mapped[str] = mapped_column(Text)
    reason: Mapped[str] = mapped_column(Text)
    decided_by: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(40))
    decided_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, server_default=func.now())
    effective_from: Mapped[date] = mapped_column(Date)
