/**
 * The one institutional record and the officers' oversight tools.
 *
 * These screens work on the live record, so they need the server: on built-in data every call answers null and the
 * screen says so (see NeedsServer). Client errors (4xx) are raised as ApiError with the server's sentence.
 */
import type { Application, Institution } from '../types';
import { del, json, post, put, viaApi, type StoredDocument } from './api';

const none = async () => null;
const q = (s: string) => encodeURIComponent(s);

/* ---------------- shared ---------------- */
export interface Finding {
  severity: 'blocker' | 'warning';
  title: string;
  detail?: string;
  clause: string;
}
export interface RecordEntry {
  at: string;
  actor: string;
  role?: string | null;
  action: string;
  note?: string | null;
  rule?: string | null;
  hash: string;
}
export interface RegulatoryActionRow {
  id: number;
  kind: string;
  detail: string;
  reason: string;
  decidedBy: string;
  role: string;
  decidedAt: string;
  effectiveFrom: string;
  applicationId?: string | null;
}

/* ---------------- profile and signatories ---------------- */
export interface Leader {
  id: number;
  name: string;
  position: string;
  department: string;
  email: string;
  isSignatory: boolean;
  since: string;
  until: string | null;
}
export interface ProfileData {
  institution: Institution;
  profile: Record<string, string | boolean | undefined>;
  fields: Record<string, string>;
  completeness: number;
  leaders: Leader[];
  signatoryOk: boolean;
  history: RecordEntry[];
  actions: RegulatoryActionRow[];
}
export const getProfile = () => viaApi<ProfileData | null>('/institution/profile', none);
export const saveProfile = (body: Record<string, string>) => viaApi<{ changed: number } | null>('/institution/profile', none, put(body));
export const addLeader = (body: Omit<Leader, 'id' | 'until'>) => viaApi<Leader | null>('/institution/leaders', none, json(body));
export const endLeader = (id: number) => viaApi<Leader | null>(`/institution/leaders/${id}/end`, none, post);

/* ---------------- infrastructure locker ---------------- */
export interface Campus {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
  landAcres: number;
  ownership: 'Owned' | 'Leased';
  deedNo: string;
  leaseStart: string | null;
  leaseEnd: string | null;
  isMain: boolean;
  distanceKm?: number;
}
export interface Space {
  id: number;
  campusId: string;
  category: 'Instructional' | 'Administrative' | 'Amenities';
  kind: string;
  name: string;
  building: string;
  areaSqm: number;
}
export interface Certificate {
  id: string;
  kind: string;
  number: string;
  issuedBy: string;
  issuedOn: string | null;
  validUntil: string | null;
  campusId: string | null;
  documentId: string | null;
  verification: 'Pending' | 'Verified' | 'Discrepancy';
  verifiedBy: string | null;
  verifiedAt: string | null;
  note: string | null;
  clause: string;
  expires: boolean;
  state: 'No expiry' | 'Expired' | 'Expiring soon' | 'Renew within 90 days' | 'Valid';
  days: number | null;
  tone: 'green' | 'amber' | 'red';
}
export interface NormRow {
  kind: string;
  label: string;
  rooms: number;
  minArea: number;
  rule: string;
  clause: string;
  have: number;
  onRecord: number;
  short: number;
  undersized: { name: string; areaSqm: number }[];
  status: 'ok' | 'short';
}
export interface AreaRow {
  category: 'Administrative' | 'Amenities';
  have: number;
  min: number;
  status: 'ok' | 'short';
  clause: string;
}
export interface Infrastructure {
  campuses: Campus[];
  landChecks: Finding[];
  spaces: Space[];
  norms: { rows: NormRow[]; areas: AreaRow[]; instructionalArea: number; builtUpEstimate: number; shortfalls: number; computersNeeded: number };
  certificates: Certificate[];
  certificateKinds: string[];
  spaceKinds: string[];
}
export type CampusIn = Omit<Campus, 'id' | 'distanceKm'>;
export interface SpaceIn {
  campusId: string;
  category: Space['category'];
  kind: string;
  name: string;
  building: string;
  areaSqm: number;
  count?: number;
}
export interface CertificateIn {
  kind: string;
  number: string;
  issuedBy: string;
  issuedOn: string | null;
  validUntil: string | null;
  campusId: string | null;
}
export const getInfrastructure = () => viaApi<Infrastructure | null>('/institution/infrastructure', none);
export const addCampus = (b: CampusIn) => viaApi<Campus | null>('/institution/campuses', none, json(b));
export const updateCampus = (id: string, b: CampusIn) => viaApi<Campus | null>(`/institution/campuses/${q(id)}`, none, put(b));
export const addSpaces = (b: SpaceIn) => viaApi<Space[] | null>('/institution/spaces', none, json(b));
export const deleteSpace = (id: number) => viaApi<null>(`/institution/spaces/${id}`, none, del);
export const addCertificate = (b: CertificateIn) => viaApi<Certificate | null>('/institution/certificates', none, json(b));
export const renewCertificate = (id: string, b: CertificateIn) => viaApi<Certificate | null>(`/institution/certificates/${q(id)}`, none, put(b));

/* ---------------- courses and seats ---------------- */
export interface Programme {
  id: string;
  department: string;
  name: string;
  level: 'Diploma' | 'UG' | 'PG';
  durationYears: number;
  approvedIntake: number;
  status: 'Approved' | 'Proposed' | 'Closed';
  since: number;
  xCategory: boolean;
  accreditation: { body: string; number: string; validUntil: string } | null;
  accreditationState: 'Valid' | 'Renew soon' | 'Lapsed' | null;
  sanctionedStudents: number;
}
export interface SeatMatrix {
  programmes: Programme[];
  departments: { department: string; programmes: number; intake: number; students: number; facultyNeed: number; facultyHave: number }[];
  totals: { intake: number; students: number; facultyNeed: number; facultyHave: number };
}
export type SeatChange = 'increase' | 'reduce' | 'new' | 'close' | 'rename';
export interface SeatChangeIn {
  change: SeatChange;
  programmeId?: string;
  newIntake?: number;
  newName?: string;
  department?: string;
  level?: Programme['level'];
  durationYears?: number;
}
export interface SeatImpact {
  typeId: string;
  typeName: string;
  clause: string;
  documents: string[];
  programme: string;
  currentIntake: number;
  requestedIntake: number;
  faculty: { before: number; after: number; inPost: number; short: number };
  rooms: { kind: string; label: string; before: number; after: number; have: number; short: number }[];
  computers: { before: number; after: number };
  ready: boolean;
}
export const getSeatMatrix = () => viaApi<SeatMatrix | null>('/institution/programmes', none);
export const seatCheck = (b: SeatChangeIn) => viaApi<SeatImpact | null>('/institution/programmes/seat-check', none, json(b));
export const seatDraft = (b: SeatChangeIn) => viaApi<{ draftId: string; typeId: string; details: Record<string, string | number> } | null>('/institution/programmes/draft', none, json(b));
export const saveAccreditation = (id: string, b: { body: string; number: string; validUntil: string }) => viaApi<Programme | null>(`/institution/programmes/${q(id)}/accreditation`, none, put(b));

/* ---------------- faculty roster ---------------- */
export interface FacultyMember {
  id: string;
  name: string;
  designation: 'Professor' | 'Associate Professor' | 'Assistant Professor';
  department: string;
  qualification: string;
  employment: 'Regular' | 'Contract' | 'Visiting';
  status: 'Active' | 'Left';
  verification: 'Pending' | 'Verified' | 'Discrepancy';
  joined: string;
  panOnFile: boolean;
}
export interface FacultyNorms {
  required: number;
  inPost: number;
  departments: { department: string; need: number; have: number; short: number }[];
  cadre: { designation: string; need: number; have: number; short: number }[];
  findings: Finding[];
  ratio: string;
  pendingVerification: number;
}
export const getFaculty = () => viaApi<{ faculty: FacultyMember[]; norms: FacultyNorms } | null>('/institution/faculty', none);
export const addFaculty = (b: { name: string; pan?: string; designation: string; department: string; qualification: string; employment: string; joined: string }) =>
  viaApi<(FacultyMember & { warning?: string | null }) | null>('/institution/faculty', none, json(b));
export const updateFaculty = (id: string, b: Partial<Pick<FacultyMember, 'designation' | 'department' | 'qualification' | 'status'>>) => viaApi<FacultyMember | null>(`/institution/faculty/${q(id)}`, none, put(b));

/* ---------------- team and access ---------------- */
export interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  addedBy: string;
  addedAt: string;
  deactivatedAt: string | null;
  can: string[];
}
export interface TeamData {
  members: Member[];
  roles: string[];
  permissions: { id: string; label: string; roles: string[] }[];
  me: { role: string; can: string[] };
}
export interface DraftReview {
  id: string;
  typeId: string;
  updatedAt: string;
  preparedBy?: string | null;
  review: { status: 'awaiting review' | 'approved' | 'changes requested'; by?: string; role?: string; at?: string; reviewer?: string; reviewerRole?: string; note?: string; reviewedAt?: string } | null;
}
export const getTeam = () => viaApi<TeamData | null>('/institution/team', none);
export const addMember = (b: { name: string; email: string; role: string }) => viaApi<Member | null>('/institution/team', none, json(b));
export const updateMember = (id: number, b: { role?: string; active?: boolean }) => viaApi<Member | null>(`/institution/team/${id}`, none, put(b));
export const getDrafts = () => viaApi<DraftReview[] | null>('/institution/drafts', none);
export const sendForReview = (id: string) => viaApi<DraftReview | null>(`/institution/drafts/${q(id)}/send-for-review`, none, post);
export const reviewDraft = (id: string, decision: 'approved' | 'changes', note: string) => viaApi<DraftReview | null>(`/institution/drafts/${q(id)}/review`, none, json({ decision, note }));

/* ---------------- badges ---------------- */
export type Badges = Record<string, number>;
export const getBadges = () => viaApi<Badges | null>('/me/badges', none);

/* ---------------- documents: checklist and viewer ---------------- */
export interface RequiredDocument {
  kind: string;
  name: string;
  clause: string;
  signedBy: string | null;
  versions: StoredDocument[];
  status: 'missing' | 'uploaded' | 'awaiting verification' | 'verified' | 'needs correction';
}
export const getApplicationDocuments = (appId: string) => viaApi<{ documents: RequiredDocument[]; counts: Record<string, number>; allVerified: boolean } | null>(`/applications/${q(appId)}/documents`, none);
export const reviewDocument = (id: string, status: 'verified' | 'needs correction', note: string) => viaApi<StoredDocument | null>(`/aicte/documents/${q(id)}/review`, none, json({ status, note }));
/** The stored file as a blob URL for the viewer (the API forbids framing its own responses). Revoke it when done. */
export async function documentBlobUrl(id: string): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE ?? ''}/api/documents/${q(id)}/file`, { credentials: 'include' });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    return null;
  }
}

/* ---------------- decision readiness ---------------- */
export interface ReadinessCheck {
  label: string;
  state: 'ok' | 'warn' | 'block';
  detail: string;
  clause: string | null;
}
export interface Condition {
  title: string;
  dueOn: string;
  clause: string;
}
export interface Readiness {
  checks: ReadinessCheck[];
  suggestion: { outcome: 'EoA' | 'LoA' | 'LoD' | 'LoR' | null; text: string };
  conditions: Condition[];
  canDecide: boolean;
  note: string;
}
export const getReadiness = (appId: string) => viaApi<Readiness | null>(`/applications/${q(appId)}/readiness`, none);
export const decideWithConditions = (appId: string, outcome: string, reason: string, conditions: Condition[]) =>
  viaApi<Application | null>(`/applications/${q(appId)}/actions`, none, json({ action: 'decide', outcome, reason, conditions }));

/* ---------------- routing and handoffs ---------------- */
export interface RouteFile {
  id: string;
  institution: string;
  typeId: string;
  stage: string;
  holder: string;
  region: string;
  clock: string;
  daysAtStage: number;
  targetDays: number | null;
  dueOn: string;
  idleDays: number;
  handoffs: number;
  sendbacks: number;
  lastHandoff: { at: string; action: string; actor: string } | null;
  flags: string[];
}
export interface Routing {
  files: RouteFile[];
  holders: { holder: string; files: number; pastTarget: number; idle: number; oldestDays: number }[];
  routes: { typeId: string; name: string; path: string[] }[];
  rulesVersion: string;
  summary: { open: number; flagged: number; pastTarget: number; waitingOnInstitution: number };
}
export const getRouting = () => viaApi<Routing | null>('/aicte/routing', none);
export const reassignFile = (id: string, holder: string, reason: string) => viaApi<{ id: string; holder: string } | null>(`/aicte/routing/${q(id)}/reassign`, none, json({ holder, reason }));

/* ---------------- field inspections ---------------- */
export interface Evidence {
  name: string;
  sha256: string;
  lat: number | null;
  lng: number | null;
  takenAt: string | null;
  verdict: 'ok' | 'far' | 'time' | 'nogps';
  distanceM: number | null;
}
export interface InspectionItem {
  id: string;
  section: string;
  label: string;
  expect: string;
  clause: string;
  result: 'Meets' | 'Partly meets' | 'Does not meet' | 'Not applicable' | null;
  note: string;
  evidence: Evidence[];
  photo: boolean;
}
export interface InspectionSummary {
  id: string;
  applicationId: string;
  inspectorId: string;
  inspectorName: string;
  assignedBy: string;
  assignedAt: string;
  mode: 'Physical' | 'Online' | 'Hybrid';
  status: 'Assigned' | 'In progress' | 'Submitted';
  videoUrl: string;
  startedAt: string | null;
  submittedAt: string | null;
  signature: { name: string; role: string; at: string; method: string } | null;
  reportSha256: string | null;
  progress: { done: number; total: number; concerns: number; failed: number };
  application?: { id: string; typeId: string; stage: string; dueOn: string };
  institution?: { id: string; name: string; city: string; lat: number; lng: number };
}
export interface InspectionDetail extends InspectionSummary {
  items: InspectionItem[];
  campuses: { name: string; lat: number | null; lng: number | null }[];
  canEdit: boolean;
}
export const getInspections = () => viaApi<{ inspections: InspectionSummary[]; unassigned: { id: string; institutionId: string; typeId: string; dueOn: string }[] } | null>('/aicte/field', none);
export const getInspectors = (appId: string) => viaApi<{ id: string; name: string; open: number; conflict: boolean }[] | null>(`/aicte/field/inspectors?application_id=${q(appId)}`, none);
export const assignInspection = (applicationId: string, inspectorId: string, mode: string) => viaApi<InspectionSummary | null>('/aicte/field', none, json({ applicationId, inspectorId, mode }));
export const getInspection = (id: string) => viaApi<InspectionDetail | null>(`/aicte/field/${q(id)}`, none);
export const answerItem = (id: string, itemId: string, result: string, note: string) =>
  viaApi<{ item: InspectionItem; progress: InspectionSummary['progress']; status: string } | null>(`/aicte/field/${q(id)}/items/${q(itemId)}`, none, put({ result, note }));
export function uploadInspectionPhoto(id: string, itemId: string, file: Blob, name: string, where?: { lat: number; lng: number; takenAt: string }) {
  const form = new FormData();
  form.append('file', file, name);
  if (where) {
    form.append('lat', String(where.lat));
    form.append('lng', String(where.lng));
    form.append('taken_at', where.takenAt);
  }
  return viaApi<{ item: InspectionItem; photo: Evidence } | null>(`/aicte/field/${q(id)}/items/${q(itemId)}/photo`, none, { method: 'POST', body: form });
}
export const saveVideo = (id: string, videoUrl: string) => viaApi<{ videoUrl: string } | null>(`/aicte/field/${q(id)}/video`, none, put({ videoUrl }));
export const submitInspection = (id: string, signerName: string, declaration: boolean, videoUrl: string) =>
  viaApi<InspectionSummary | null>(`/aicte/field/${q(id)}/submit`, none, json({ signerName, declaration, videoUrl }));
export const getInspectionReport = (id: string) => viaApi<string | null>(`/aicte/field/${q(id)}/report`, none);

/* ---------------- institutional verification ---------------- */
export interface VerificationRow {
  id: string;
  name: string;
  city: string;
  region: string;
  status: string;
  pendingCertificates: number;
  pendingFaculty: number;
  discrepancies: number;
  expiredCertificates: number;
  lastChecked: string | null;
}
export interface OfficerCheck {
  id: number;
  subject: string;
  subjectId: string;
  subjectLabel: string;
  outcome: 'Verified' | 'Discrepancy' | 'Follow-up';
  note: string;
  source: string;
  checkedBy: string;
  checkedAt: string;
}
export interface VerificationDetail extends Infrastructure {
  institution: Institution;
  profile: Record<string, string | boolean | undefined>;
  programmes: Programme[];
  faculty: { norms: FacultyNorms; pending: FacultyMember[] };
  leaders: Leader[];
  checks: OfficerCheck[];
  actions: RegulatoryActionRow[];
}
export const getVerificationList = () => viaApi<VerificationRow[] | null>('/aicte/verification', none);
export const getVerification = (id: string) => viaApi<VerificationDetail | null>(`/aicte/verification/${q(id)}`, none);
export const recordCheck = (instId: string, b: { subject: string; subjectId: string; outcome: string; note: string; source: string }) =>
  viaApi<{ id: number; subjectLabel: string; outcome: string } | null>(`/aicte/verification/${q(instId)}`, none, json(b));
export const recordAction = (instId: string, b: { kind: string; detail: string; reason: string; applicationId?: string; effectiveFrom: string; hearingNote?: string }) =>
  viaApi<{ id: number; kind: string } | null>(`/aicte/institutions/${q(instId)}/actions`, none, json(b));

/* ---------------- why files are sent back ---------------- */
export interface ReturnReasons {
  total: number;
  files: number;
  categories: { category: string; count: number; share: number; open: number; medianDaysToFix: number | null; stages: Record<string, number>; clauses: string[]; example: string; advice: string }[];
  recent: { applicationId: string; text: string; stage: string; raisedAt: string; status: string }[];
  note: string;
}
export const getReturnReasons = () => viaApi<ReturnReasons | null>('/aicte/insights/return-reasons', none);

/* ---------------- user access ---------------- */
export interface Account {
  id: string;
  name: string;
  email: string;
  portal: 'institution' | 'aicte';
  role: string;
  region: string | null;
  institutionId: string | null;
  active: boolean;
}
export const getAccounts = () => viaApi<{ users: Account[]; officerRoles: string[]; institutionRoles: string[]; canEdit: boolean; sso: boolean; note: string } | null>('/aicte/admin/users', none);
export const updateAccount = (id: string, active: boolean) => viaApi<Pick<Account, 'id' | 'role' | 'region' | 'active'> | null>(`/aicte/admin/users/${q(id)}`, none, put({ active }));
