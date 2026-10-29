"""API shapes. Field names are camelCase on the wire so they match src/types.ts in the frontend exactly."""
from datetime import date, datetime
from typing import Annotated, Any, Literal

from fastapi import Path
from pydantic import BaseModel, ConfigDict, Field, PlainSerializer
from pydantic.alias_generators import to_camel

from .timeutil import local_iso


# A database row id in a URL: positive and within PostgreSQL's integer range, so it can never overflow a query.
DbId = Annotated[int, Path(ge=1, le=2_147_483_647)]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class RiskReason(CamelModel):
    factor: str
    impact: float


class HistoryEventOut(CamelModel):
    at: str
    actor: str
    role: str
    action: str
    note: str | None = None
    rule_ref: str | None = None


class ApplicationOut(CamelModel):
    id: str
    institution_id: str
    type_id: str
    cycle: str
    submitted_on: date
    stage: str
    stage_entered_on: date
    due_on: date
    clock: str
    holder: str
    region: str
    deficiencies: int
    risk: float
    risk_reasons: list[RiskReason]
    outcome: str | None
    public_status: str
    rules_version: str
    history: list[HistoryEventOut]


class InstitutionOut(CamelModel):
    id: str
    aicte_id: str
    name: str
    city: str
    state: str
    region: str
    category: str
    established: int
    land: str
    lease_end: date | None = None
    longest_course_years: int
    intake: int
    programmes: list[str]
    status: str
    trust: str
    lat: float
    lng: float


class ObligationOut(CamelModel):
    id: str
    institution_id: str
    kind: str
    title: str
    clause: str
    due_on: date
    status: str
    escalation_level: int
    source: str
    evidence: str | None = None


class ExpertOut(CamelModel):
    id: str
    name: str
    city: str
    region: str
    specialisation: str
    load: int
    max_load: int
    linked_institutions: list[str]
    available: bool


class NoticeOut(CamelModel):
    id: str
    title: str
    date: date
    audience: str
    category: str
    summary: str


class CalendarEventOut(CamelModel):
    id: str
    label: str
    date: date
    end_date: date | None = None
    kind: str
    clause: str | None = None
    revised_from: date | None = None
    revision_reason: str | None = None


class GlossaryOut(CamelModel):
    key: str
    full: str
    meaning: str
    clause: str | None = None
    aliases: list[str] = []


class AuditEntryOut(CamelModel):
    seq: int
    at: str
    actor: str
    action: str
    ref: str
    payload: str
    prev_hash: str
    hash: str


class ChainVerdict(CamelModel):
    ok: bool
    broken_at: int | None = None
    count: int
    head: str


class DocRequirement(CamelModel):
    id: str
    name: str
    clause: str
    signed_by: str
    validity: str | None = None
    source_verifiable: bool | None = None


class ApplicationTypeOut(CamelModel):
    id: str
    name: str
    chapter: str
    clause: str
    summary: str
    steps: dict[str, str]
    documents: list[DocRequirement]
    target_days: int


class Preflight(CamelModel):
    kind: Literal["pdf", "other"]
    size_kb: int
    pages: int | None = None
    signed: bool
    signature_intact: bool | None = None
    signer: str | None = None
    encrypted: bool
    virus_scan: Literal["clean", "infected", "not configured", "unavailable"]
    errors: list[str]
    warnings: list[str]


class DocumentOut(CamelModel):
    id: str
    doc_kind: str
    filename: str
    sha256: str
    size_bytes: int
    pages: int | None
    signed: bool
    version: int
    preflight: dict[str, Any]
    application_id: str | None = None
    uploaded_at: Annotated[datetime | None, PlainSerializer(local_iso, return_type=str | None)] = None
    uploaded_by: str | None = None
    review_status: str = "uploaded"
    review_note: str | None = None
    reviewed_by: str | None = None
    reviewed_at: Annotated[datetime | None, PlainSerializer(local_iso, return_type=str | None)] = None


class CheckFinding(CamelModel):
    id: str
    severity: Literal["pass", "warning", "blocker"]
    title: str
    detail: str
    clause: str
    engine: str


class AiDisputeIn(CamelModel):
    finding_id: str
    finding_title: str
    finding_detail: str = ""
    finding_clause: str = ""
    reason: str


class AiDisputeOut(CamelModel):
    id: int
    document_id: str
    institution_id: str
    application_id: str | None = None
    finding_id: str
    finding_title: str
    finding_detail: str
    finding_clause: str
    reason: str
    status: str          # pending | overridden | confirmed
    resolution: str | None = None
    reviewed_by: str | None = None
    created_at: Annotated[datetime, PlainSerializer(local_iso, return_type=str)]
    resolved_at: Annotated[datetime | None, PlainSerializer(local_iso, return_type=str | None)] = None


class Receipt(CamelModel):
    ref: str
    received_at: str
    fingerprint: str
    path: list[str]
    documents: list[dict[str, str]]


class Eta(CamelModel):
    likely: date
    early: date
    late: date
    start: date


class VerifyResult(CamelModel):
    status: Literal["authentic", "not-found", "mismatch"]
    app: ApplicationOut | None = None
    fingerprint: str | None = None
    timestamp: str | None = None


class DashboardStats(CamelModel):
    pending: int
    at_risk: int
    breached: int
    paused: int
    decided: int
    on_time_rate: float
    by_region_stage: list[dict[str, Any]]
    ageing: list[dict[str, Any]]


class AuthConfig(CamelModel):
    mode: Literal["dev", "oidc"]
    login_url: str | None = None


class LogoutOut(CamelModel):
    logout_url: str | None = None


class DevLogin(CamelModel):
    portal: Literal["institution", "aicte"]
    officer_role: str | None = None
    institution_role: str | None = None


class Principal(CamelModel):
    id: str
    name: str
    portal: Literal["institution", "aicte"]
    role: str
    region: str | None = None
    institution_id: str | None = None


class DraftIn(CamelModel):
    type_id: str = Field(max_length=40)
    data: dict[str, Any]


class SubmitIn(CamelModel):
    type_id: str = Field(max_length=40)
    details: dict[str, Any] = Field(default_factory=dict)
    document_ids: list[str] = Field(default_factory=list, max_length=60)
    signer: str = Field(min_length=3, max_length=200)
    declarations: dict[str, bool] = Field(default_factory=dict)


class ConditionIn(CamelModel):
    title: str = Field(min_length=5, max_length=300)
    due_on: date
    clause: str = Field("APH 2.25", max_length=40)


class ActionIn(CamelModel):
    action: Literal["forward", "sendback", "recommend", "note", "decide"]
    reason: str = Field("", max_length=4000)
    outcome: Literal["LoA", "EoA", "LoD", "LoR"] | None = None
    # Approval with conditions: each one becomes an obligation with a due date that the deadline check follows.
    conditions: list[ConditionIn] = Field(default_factory=list, max_length=12)


class ResponseIn(CamelModel):
    document_ids: list[str] = Field(default_factory=list, max_length=60)
    note: str = Field("", max_length=4000)


class BulkIn(CamelModel):
    action: Literal["remind", "assign"]
    ids: list[str] = Field(min_length=1, max_length=500)


class ViewIn(CamelModel):
    name: str = Field(min_length=1, max_length=80)
    query: str = Field(max_length=1000)


class RuleProposalIn(CamelModel):
    table: dict[str, dict[str, str]]
    targets: dict[str, int] | None = None
    reason: str = Field(min_length=10, max_length=2000)
    effective_from: date


class CalendarReviseIn(CamelModel):
    date: date
    end_date: date | None = None
    reason: str = Field(min_length=10, max_length=2000)


class SimulationIn(CamelModel):
    """Bounds are wider than the screen's sliders but keep the model's arithmetic finite."""

    extra_officers_bottleneck: int = Field(0, ge=0, le=50)
    extra_experts: int = Field(0, ge=0, le=200)
    volume_change: float = Field(0, ge=-0.9, le=3)
    calendar_shift_days: int = Field(0, ge=-90, le=180)


class FeedbackIn(CamelModel):
    page: str = Field(max_length=200)
    helpful: bool
    comment: str = Field("", max_length=2000)


class ReportIn(CamelModel):
    name: str = Field(min_length=2, max_length=200)
    city: str = Field("", max_length=100)
    contact: str = Field("", max_length=200)


class UndertakingIn(CamelModel):
    text: str = Field(min_length=10, max_length=20_000)


class Promise(CamelModel):
    promise: str
    due: date | None
    clause: str
    confidence: float


class ObligationIn(CamelModel):
    title: str = Field(min_length=5, max_length=400)
    due_on: date
    clause: str = Field(min_length=3, max_length=60)
    kind: Literal["Undertaking", "Lease", "Document", "Faculty"] = "Undertaking"


class SubscribeIn(CamelModel):
    contact: str = Field(min_length=5, max_length=200)


class AskIn(CamelModel):
    question: str = Field(min_length=1, max_length=500)
    history: list[Annotated[str, Field(max_length=500)]] = Field(default_factory=list, max_length=6)  # earlier questions in this chat


class AssistantLink(CamelModel):
    to: str
    label: str


class AssistantOut(CamelModel):
    text: str
    bullets: list[str] = []
    cites: list[str] = []
    link: AssistantLink | None = None
    follow_ups: list[str] = []
    source: Literal["handbook", "records", "ai"] = "handbook"  # ai: generated by AI engine from the handbook sources
    confident: bool = True


class InspectionDrawIn(CamelModel):
    k: int = Field(5, ge=3, le=8)


class EvcProposeIn(CamelModel):
    specialisation: str = Field("Computer Science", max_length=80)
    mode: Literal["Physical", "Online", "Hybrid"] = "Physical"


class WhatsAppIn(CamelModel):
    from_: str = Field(alias="from", max_length=20)
    text: str = Field("", max_length=1000)
    audio_url: str | None = Field(None, max_length=500)


# ---------------------------------------------------------------- the one institutional record
Short = Annotated[str, Field(max_length=200)]
Designation = Literal["Professor", "Associate Professor", "Assistant Professor"]


class ProfileIn(CamelModel):
    """The contact and trust details an institution may edit itself. The legal name and type change only through an application."""

    address: Short | None = None
    pincode: str | None = Field(None, pattern=r"^\d{6}$")
    email: Short | None = None
    phone: str | None = Field(None, max_length=20)
    website: Short | None = None
    registered_under: Short | None = None
    registration_no: str | None = Field(None, max_length=60)
    university: Short | None = None


class CampusIn(CamelModel):
    name: str = Field(min_length=2, max_length=120)
    address: str = Field("", max_length=400)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=80)
    pincode: str = Field("", pattern=r"^(\d{6})?$")
    lat: float | None = Field(None, ge=6, le=38)
    lng: float | None = Field(None, ge=68, le=98)
    land_acres: float = Field(0, ge=0, le=5000)
    ownership: Literal["Owned", "Leased"]
    deed_no: str = Field("", max_length=60)
    lease_start: date | None = None
    lease_end: date | None = None
    is_main: bool = False


class SpaceIn(CamelModel):
    campus_id: str = Field(max_length=24)
    category: Literal["Instructional", "Administrative", "Amenities"]
    kind: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=120)
    building: str = Field("", max_length=80)
    area_sqm: float = Field(gt=0, le=20000)
    count: int = Field(1, ge=1, le=60)  # add several identical rooms at once


class CertificateIn(CamelModel):
    kind: str = Field(min_length=3, max_length=60)
    number: str = Field("", max_length=60)
    issued_by: str = Field("", max_length=160)
    issued_on: date | None = None
    valid_until: date | None = None
    campus_id: str | None = Field(None, max_length=24)
    document_id: str | None = Field(None, max_length=40)


class ProgrammeChangeIn(CamelModel):
    change: Literal["increase", "reduce", "new", "close", "rename"]
    programme_id: str | None = Field(None, max_length=24)
    new_intake: int | None = Field(None, ge=0, le=1200)
    new_name: str | None = Field(None, max_length=160)
    department: str | None = Field(None, max_length=120)
    level: Literal["Diploma", "UG", "PG"] | None = None
    duration_years: int | None = Field(None, ge=1, le=5)


class AccreditationIn(CamelModel):
    body: Literal["NBA", "NAAC", "Other"]
    number: str = Field(min_length=3, max_length=60)
    valid_until: date


class FacultyIn(CamelModel):
    name: str = Field(min_length=3, max_length=120)
    pan: str | None = Field(None, pattern=r"^[A-Za-z]{5}\d{4}[A-Za-z]$")  # only its hash is kept
    designation: Designation
    department: str = Field(min_length=2, max_length=120)
    qualification: Literal["PhD", "M.Tech", "M.E.", "MBA", "MCA", "M.Sc", "Other"]
    employment: Literal["Regular", "Contract", "Visiting"] = "Regular"
    joined: date


class FacultyUpdateIn(CamelModel):
    designation: Designation | None = None
    department: str | None = Field(None, max_length=120)
    qualification: Literal["PhD", "M.Tech", "M.E.", "MBA", "MCA", "M.Sc", "Other"] | None = None
    status: Literal["Active", "Left"] | None = None


class LeaderIn(CamelModel):
    name: str = Field(min_length=3, max_length=120)
    position: Literal["Chairman of the Trust", "Secretary of the Trust", "Principal / Director", "Head of Department", "Trustee", "Registrar"]
    department: str = Field("", max_length=120)
    email: str = Field("", max_length=160)
    is_signatory: bool = False
    since: date


class MemberIn(CamelModel):
    name: str = Field(min_length=3, max_length=120)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=160)
    role: str = Field(max_length=40)


class MemberUpdateIn(CamelModel):
    role: str | None = Field(None, max_length=40)
    active: bool | None = None


class DraftReviewIn(CamelModel):
    decision: Literal["approved", "changes"]
    note: str = Field("", max_length=1000)


# ---------------------------------------------------------------- oversight
class DocumentReviewIn(CamelModel):
    status: Literal["verified", "needs correction"]
    note: str = Field("", max_length=1000)


class FieldAssignIn(CamelModel):
    application_id: str = Field(max_length=40)
    inspector_id: str = Field(max_length=40)
    mode: Literal["Physical", "Online", "Hybrid"] = "Physical"


class FieldItemIn(CamelModel):
    result: Literal["Meets", "Partly meets", "Does not meet", "Not applicable"]
    note: str = Field("", max_length=2000)


class FieldSubmitIn(CamelModel):
    signer_name: str = Field(min_length=3, max_length=120)
    declaration: bool
    video_url: str = Field("", max_length=300)


class VerificationIn(CamelModel):
    subject: Literal["Campus", "Space", "Certificate", "Programme", "Faculty", "Leader", "Profile"]
    subject_id: str = Field(max_length=40)
    outcome: Literal["Verified", "Discrepancy", "Follow-up"]
    note: str = Field("", max_length=2000)
    source: Literal["Document", "Site visit", "Registry", "Other"] = "Document"


class RegulatoryActionIn(CamelModel):
    kind: Literal["Warning", "Show-cause notice", "Reduction in intake", "No admission for one year", "Withdrawal of approval"]
    detail: str = Field(min_length=10, max_length=2000)
    reason: str = Field(min_length=20, max_length=4000)
    application_id: str | None = Field(None, max_length=40)
    effective_from: date
    hearing_note: str = Field("", max_length=4000)  # Standing Hearing Committee outcome, needed before a penal action


class ReassignIn(CamelModel):
    holder: str = Field(min_length=3, max_length=120)
    reason: str = Field(min_length=5, max_length=1000)


class AdminUserIn(CamelModel):
    active: bool  # roles and regions come from the sign-in account (Keycloak); here access is switched on or off
