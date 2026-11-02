/**
 * The one institutional record and the officers' oversight tools.
 *
 * These screens work on the live record, so they need the server: on built-in data every call answers null and the
 * screen says so (see NeedsServer). Client errors (4xx) are raised as ApiError with the server's sentence.
 */
import type { Application, Institution } from '../types';
import { DEMO_INSTITUTION } from '../data/institutions';
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

function mockProfile(): ProfileData {
  return {
    institution: DEMO_INSTITUTION,
    profile: {
      headName: 'Dr. Anand Sharma',
      headEmail: 'principal@narmadavalley.ac.in',
      headPhone: '+91 98765 43210',
      officialEmail: 'info@narmadavalley.ac.in',
      website: 'https://narmadavalley.ac.in',
      address: 'Sector 4, Knowledge Park, Bypass Road',
      pincode: '452001',
    },
    fields: {
      headName: 'Head of Institution (Principal / Director)',
      headEmail: 'Principal Email',
      headPhone: 'Principal Phone',
      officialEmail: 'Official Institution Email',
      website: 'Website Address',
      address: 'Campus Address',
      pincode: 'PIN Code',
    },
    completeness: 100,
    leaders: [
      { id: 1, name: 'Dr. Anand Sharma', position: 'Principal / Director', department: 'Administration', email: 'principal@narmadavalley.ac.in', isSignatory: true, since: '2021-06-01', until: null },
      { id: 2, name: 'Shri Vikramaditya Rao', position: 'Chairman of the Trust', department: 'Governing Body', email: 'chairman@narmadaeducation.org', isSignatory: true, since: '2018-04-15', until: null },
      { id: 3, name: 'Prof. Sunita Deshmukh', position: 'Head of Department', department: 'Computer Science', email: 'hod.cse@narmadavalley.ac.in', isSignatory: false, since: '2022-08-01', until: null }
    ],
    signatoryOk: true,
    history: [
      { at: '2026-03-15T10:30:00Z', actor: 'Dr. Anand Sharma', role: 'Principal / Director', action: 'Annual Institutional Master update', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }
    ],
    actions: [],
  };
}

export const getProfile = () => viaApi<ProfileData | null>('/institution/profile', async () => mockProfile());
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

function mockSeatMatrix(): SeatMatrix {
  const programmes: Programme[] = [
    { id: 'PRG-001', department: 'Computer Science and Engineering', name: 'B.Tech Computer Science and Engineering', level: 'UG', durationYears: 4, approvedIntake: 120, status: 'Approved', since: 2002, xCategory: false, accreditation: { body: 'NBA', number: 'NBA/2023/118', validUntil: '2028-06-30' }, accreditationState: 'Valid', sanctionedStudents: 480 },
    { id: 'PRG-002', department: 'Computer Science and Engineering', name: 'B.Tech Artificial Intelligence and Data Science', level: 'UG', durationYears: 4, approvedIntake: 60, status: 'Approved', since: 2021, xCategory: false, accreditation: null, accreditationState: null, sanctionedStudents: 240 },
    { id: 'PRG-003', department: 'Electronics & Communication', name: 'B.Tech Electronics and Communication Engineering', level: 'UG', durationYears: 4, approvedIntake: 60, status: 'Approved', since: 1998, xCategory: false, accreditation: { body: 'NBA', number: 'NBA/2022/045', validUntil: '2027-06-30' }, accreditationState: 'Valid', sanctionedStudents: 240 },
    { id: 'PRG-004', department: 'Mechanical Engineering', name: 'B.Tech Mechanical Engineering', level: 'UG', durationYears: 4, approvedIntake: 60, status: 'Approved', since: 1995, xCategory: false, accreditation: null, accreditationState: null, sanctionedStudents: 240 },
  ];
  return {
    programmes,
    departments: [
      { department: 'Computer Science and Engineering', programmes: 2, intake: 180, students: 720, facultyNeed: 36, facultyHave: 38 },
      { department: 'Electronics & Communication', programmes: 1, intake: 60, students: 240, facultyNeed: 12, facultyHave: 14 },
      { department: 'Mechanical Engineering', programmes: 1, intake: 60, students: 240, facultyNeed: 12, facultyHave: 13 },
    ],
    totals: { intake: 300, students: 1200, facultyNeed: 60, facultyHave: 65 },
  };
}

function mockFaculty(): { faculty: FacultyMember[]; norms: FacultyNorms } {
  const faculty: FacultyMember[] = [
    { id: 'FAC-001', name: 'Dr. Anand Sharma', designation: 'Professor', department: 'Computer Science and Engineering', qualification: 'Ph.D. IIT Bombay', employment: 'Regular', status: 'Active', verification: 'Verified', joined: '2012-07-01', panOnFile: true },
    { id: 'FAC-002', name: 'Dr. Rajeshwari Joshi', designation: 'Professor', department: 'Computer Science and Engineering', qualification: 'Ph.D. IISc', employment: 'Regular', status: 'Active', verification: 'Verified', joined: '2015-08-15', panOnFile: true },
    { id: 'FAC-003', name: 'Prof. Amit Verma', designation: 'Associate Professor', department: 'Computer Science and Engineering', qualification: 'M.Tech, Ph.D.', employment: 'Regular', status: 'Active', verification: 'Verified', joined: '2018-01-10', panOnFile: true },
    { id: 'FAC-004', name: 'Dr. Meena Iyer', designation: 'Associate Professor', department: 'Electronics & Communication', qualification: 'Ph.D. VNIT', employment: 'Regular', status: 'Active', verification: 'Verified', joined: '2016-06-20', panOnFile: true },
    { id: 'FAC-005', name: 'Prof. Suresh Kulkarni', designation: 'Assistant Professor', department: 'Mechanical Engineering', qualification: 'M.Tech VJTI', employment: 'Regular', status: 'Active', verification: 'Verified', joined: '2019-09-01', panOnFile: true },
  ];
  return {
    faculty,
    norms: {
      required: 60,
      inPost: 65,
      findings: [],
      ratio: '1:18.5',
      pendingVerification: 0,
      departments: [
        { department: 'Computer Science and Engineering', need: 36, have: 38, short: 0 },
        { department: 'Electronics & Communication', need: 12, have: 14, short: 0 },
        { department: 'Mechanical Engineering', need: 12, have: 13, short: 0 },
      ],
      cadre: [
        { designation: 'Professor', need: 6, have: 7, short: 0 },
        { designation: 'Associate Professor', need: 12, have: 14, short: 0 },
        { designation: 'Assistant Professor', need: 42, have: 44, short: 0 },
      ],
    },
  };
}

function mockInfrastructure(): Infrastructure {
  return {
    campuses: [
      { id: 'CMP-001', name: 'Main Campus', address: 'Plot 14, Sector 4, Knowledge Park', city: 'Indore', state: 'Madhya Pradesh', pincode: '452001', lat: 22.72, lng: 75.86, landAcres: 12.5, ownership: 'Leased', deedNo: 'IND/LEASE/2001/7731', leaseStart: '2001-07-01', leaseEnd: '2031-06-30', isMain: true }
    ],
    landChecks: [],
    spaces: [
      { id: 1, campusId: 'CMP-001', category: 'Instructional', kind: 'Classroom', name: 'Classroom A-101', building: 'Academic Block A', areaSqm: 68 },
      { id: 2, campusId: 'CMP-001', category: 'Instructional', kind: 'Classroom', name: 'Classroom A-102', building: 'Academic Block A', areaSqm: 68 },
      { id: 3, campusId: 'CMP-001', category: 'Instructional', kind: 'Laboratory', name: 'Advanced Computing Lab', building: 'IT Block', areaSqm: 110 },
      { id: 4, campusId: 'CMP-001', category: 'Administrative', kind: 'Principal Office', name: 'Principal Cabin', building: 'Admin Block', areaSqm: 40 },
      { id: 5, campusId: 'CMP-001', category: 'Amenities', kind: 'Library', name: 'Central Library', building: 'Library Block', areaSqm: 450 },
    ],
    norms: {
      rows: [
        { kind: 'Classroom', label: 'Classrooms (UG)', rooms: 16, minArea: 66, rule: 'APH Table 4.1', clause: 'APH 4.1.1', have: 18, onRecord: 18, short: 0, undersized: [], status: 'ok' },
        { kind: 'Laboratory', label: 'Laboratories', rooms: 24, minArea: 66, rule: 'APH Table 4.2', clause: 'APH 4.2.1', have: 26, onRecord: 26, short: 0, undersized: [], status: 'ok' },
      ],
      areas: [
        { category: 'Administrative', have: 1200, min: 1000, status: 'ok', clause: 'APH Table 4.4' },
        { category: 'Amenities', have: 850, min: 700, status: 'ok', clause: 'APH Table 4.5' },
      ],
      instructionalArea: 4800,
      builtUpEstimate: 7200,
      shortfalls: 0,
      computersNeeded: 350,
    },
    certificates: [
      { id: 'CERT-001', campusId: 'CMP-001', kind: 'Fire and life safety certificate', number: 'FS/IND/2025/0387', issuedBy: 'Fire and Emergency Services, Indore', issuedOn: '2025-11-08', validUntil: '2026-11-08', verification: 'Verified', verifiedBy: 'R. Verma', verifiedAt: '2025-12-02T11:00:00Z', note: null, documentId: null, clause: 'APH 4.1', expires: true, state: 'Valid', days: 300, tone: 'green' },
      { id: 'CERT-002', campusId: 'CMP-001', kind: 'Completion or occupancy certificate', number: 'IMC/OC/2004/118', issuedBy: 'Indore Municipal Corporation', issuedOn: '2004-03-15', validUntil: null, verification: 'Verified', verifiedBy: 'R. Verma', verifiedAt: '2025-12-02T11:05:00Z', note: null, documentId: null, clause: 'APH 4.2', expires: false, state: 'Valid', days: null, tone: 'green' },
      { id: 'CERT-003', campusId: 'CMP-001', kind: 'Structural stability certificate', number: 'SE/2024/IND/552', issuedBy: 'Chartered Structural Engineer', issuedOn: '2024-04-01', validUntil: '2027-03-31', verification: 'Verified', verifiedBy: 'R. Verma', verifiedAt: '2025-12-02T11:10:00Z', note: null, documentId: null, clause: 'APH 4.3', expires: true, state: 'Valid', days: 500, tone: 'green' },
    ],
    certificateKinds: ['Fire and life safety certificate', 'Completion or occupancy certificate', 'Structural stability certificate', 'Approved building plan'],
    spaceKinds: ['Classroom', 'Laboratory', 'Workshop', 'Seminar Hall', 'Computer Centre', 'Library', 'Principal Office', 'Faculty Room', 'Cafeteria'],
  };
}

function mockTeam(): TeamData {
  return {
    members: [
      { id: 1, name: 'Dr. Anand Sharma', email: 'principal@narmadavalley.ac.in', role: 'Institution Administrator', active: true, addedAt: '2021-06-01T00:00:00Z', addedBy: 'System', deactivatedAt: null, can: ['profile', 'compliance', 'programmes', 'infrastructure', 'faculty'] },
      { id: 2, name: 'K. Rao', email: 'office@narmadavalley.ac.in', role: 'Institution Staff', active: true, addedAt: '2022-01-15T00:00:00Z', addedBy: 'Principal', deactivatedAt: null, can: ['profile'] },
      { id: 3, name: 'Dr. Prakash Mehta', email: 'hod.cs@narmadavalley.ac.in', role: 'Head of Department', active: true, addedAt: '2023-08-01T00:00:00Z', addedBy: 'Principal', deactivatedAt: null, can: ['faculty', 'programmes'] },
    ],
    roles: ['Institution Administrator', 'Head of Department', 'Compliance Officer', 'Academic Administrator', 'Institution Staff'],
    permissions: [
      { id: 'profile', label: 'Institutional Profile', roles: ['Institution Administrator', 'Institution Staff'] },
      { id: 'compliance', label: 'Compliance & Approvals', roles: ['Institution Administrator'] },
    ],
    me: { role: 'Institution Administrator', can: ['profile', 'compliance', 'programmes', 'infrastructure', 'faculty'] },
  };
}

export const getInfrastructure = () => viaApi<Infrastructure | null>('/institution/infrastructure', async () => mockInfrastructure());
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
export const getSeatMatrix = () => viaApi<SeatMatrix | null>('/institution/programmes', async () => mockSeatMatrix());
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
export const getFaculty = () => viaApi<{ faculty: FacultyMember[]; norms: FacultyNorms } | null>('/institution/faculty', async () => mockFaculty());
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
export const getTeam = () => viaApi<TeamData | null>('/institution/team', async () => mockTeam());
export const addMember = (b: { name: string; email: string; role: string }) => viaApi<Member | null>('/institution/team', none, json(b));
export const updateMember = (id: number, b: { role?: string; active?: boolean }) => viaApi<Member | null>(`/institution/team/${id}`, none, put(b));
export const getDrafts = () => viaApi<DraftReview[] | null>('/institution/drafts', async () => []);
export const sendForReview = (id: string) => viaApi<DraftReview | null>(`/institution/drafts/${q(id)}/send-for-review`, none, post);
export const reviewDraft = (id: string, decision: 'approved' | 'changes', note: string) => viaApi<DraftReview | null>(`/institution/drafts/${q(id)}/review`, none, json({ decision, note }));

/* ---------------- badges ---------------- */
export type Badges = Record<string, number>;
export const getBadges = () => viaApi<Badges | null>('/me/badges', async () => ({ applications: 3, compliance: 1, notifications: 4 }));

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

function mockRouting(): Routing {
  return {
    files: [
      { id: 'APP-2026-081', institution: 'Narmada Valley Institute of Technology, Indore', typeId: 'extension-of-approval', stage: 'scrutiny', holder: 'A. Sharma', region: 'CRO', clock: 'running', daysAtStage: 4, targetDays: 7, dueOn: '2026-11-02', idleDays: 1, handoffs: 2, sendbacks: 0, lastHandoff: { at: '2026-10-15T09:30:00Z', action: 'Routed to Scrutiny', actor: 'System' }, flags: [] },
      { id: 'APP-2026-042', institution: 'Sahyadri College of Engineering, Pune', typeId: 'increase-in-intake', stage: 'evc', holder: 'Dr. R. Menon', region: 'WRO', clock: 'running', daysAtStage: 9, targetDays: 10, dueOn: '2026-11-05', idleDays: 2, handoffs: 3, sendbacks: 0, lastHandoff: { at: '2026-10-10T11:00:00Z', action: 'EVC Panel Assigned', actor: 'Bureau head' }, flags: ['Inspection pending'] },
      { id: 'APP-2026-019', institution: 'Brahmaputra Institute of Technology, Guwahati', typeId: 'new-institution', stage: 'shc', holder: 'L. Fernandes', region: 'ERO', clock: 'overdue', daysAtStage: 18, targetDays: 14, dueOn: '2026-10-28', idleDays: 0, handoffs: 4, sendbacks: 1, lastHandoff: { at: '2026-10-01T14:20:00Z', action: 'Referred to SHC', actor: 'Regional officer' }, flags: ['Deficiencies found'] },
    ],
    holders: [
      { holder: 'A. Sharma', files: 8, pastTarget: 1, idle: 2, oldestDays: 12 },
      { holder: 'Dr. R. Menon', files: 6, pastTarget: 0, idle: 1, oldestDays: 9 },
      { holder: 'L. Fernandes', files: 5, pastTarget: 2, idle: 0, oldestDays: 18 },
      { holder: 'T. Singh', files: 4, pastTarget: 0, idle: 1, oldestDays: 6 },
    ],
    routes: [
      { typeId: 'extension-of-approval', name: 'Extension of Approval', path: ['Submission', 'AI Verification', 'Bureau Scrutiny', 'Council Approval'] },
      { typeId: 'increase-in-intake', name: 'Increase in Intake', path: ['Submission', 'AI Verification', 'Bureau Scrutiny', 'EVC Inspection', 'Council Approval'] },
      { typeId: 'new-institution', name: 'New Technical Institution', path: ['Submission', 'AI Verification', 'Bureau Scrutiny', 'EVC Inspection', 'SHC Hearing', 'Executive Committee', 'Council Approval'] },
    ],
    rulesVersion: '2026.4-prod',
    summary: { open: 51, flagged: 8, pastTarget: 5, waitingOnInstitution: 9 },
  };
}

function mockInspections(): { inspections: InspectionSummary[]; unassigned: { id: string; institutionId: string; typeId: string; dueOn: string }[] } {
  return {
    inspections: [
      {
        id: 'EVC-2026-001',
        applicationId: 'APP-2026-042',
        inspectorId: 'u-aicte-evc-1',
        inspectorName: 'Dr. R. Menon',
        assignedBy: 'R. Verma',
        assignedAt: '2026-10-18T10:00:00Z',
        mode: 'Hybrid',
        status: 'In progress',
        videoUrl: '',
        startedAt: '2026-10-20T09:30:00Z',
        submittedAt: null,
        signature: null,
        reportSha256: null,
        progress: { done: 12, total: 16, concerns: 1, failed: 0 },
        application: { id: 'APP-2026-042', typeId: 'increase-in-intake', stage: 'evc', dueOn: '2026-11-05' },
        institution: { id: 'INS-002', name: 'Sahyadri College of Engineering', city: 'Pune', lat: 18.5204, lng: 73.8567 },
      },
      {
        id: 'EVC-2026-002',
        applicationId: 'APP-2026-019',
        inspectorId: 'u-aicte-evc-2',
        inspectorName: 'Prof. K. Sen',
        assignedBy: 'R. Verma',
        assignedAt: '2026-10-12T11:00:00Z',
        mode: 'Physical',
        status: 'Submitted',
        videoUrl: 'https://storage.anumati.gov.in/evc/APP-2026-019-stream.mp4',
        startedAt: '2026-10-15T10:00:00Z',
        submittedAt: '2026-10-16T17:00:00Z',
        signature: { name: 'Prof. K. Sen', role: 'EVC Panel Convenor', at: '2026-10-16T17:00:00Z', method: 'Aadhaar eSign' },
        reportSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        progress: { done: 16, total: 16, concerns: 2, failed: 1 },
        application: { id: 'APP-2026-019', typeId: 'new-institution', stage: 'shc', dueOn: '2026-10-28' },
        institution: { id: 'INS-004', name: 'Brahmaputra Institute of Technology', city: 'Guwahati', lat: 26.1445, lng: 91.7362 },
      },
    ],
    unassigned: [
      { id: 'APP-2026-088', institutionId: 'INS-007', typeId: 'new-institution', dueOn: '2026-11-12' },
      { id: 'APP-2026-092', institutionId: 'INS-009', typeId: 'addition-of-course', dueOn: '2026-11-15' },
    ],
  };
}

function mockVerificationList(): VerificationRow[] {
  return [
    { id: 'INS-001', name: 'Narmada Valley Institute of Technology', city: 'Indore', region: 'CRO', status: 'Compliant', pendingCertificates: 0, pendingFaculty: 1, discrepancies: 0, expiredCertificates: 0, lastChecked: '2026-10-15' },
    { id: 'INS-002', name: 'Sahyadri College of Engineering & Research', city: 'Pune', region: 'WRO', status: 'Needs Review', pendingCertificates: 1, pendingFaculty: 2, discrepancies: 1, expiredCertificates: 0, lastChecked: '2026-10-10' },
    { id: 'INS-003', name: 'Malabar Academy of Technology', city: 'Kochi', region: 'SWRO', status: 'Compliant', pendingCertificates: 0, pendingFaculty: 0, discrepancies: 0, expiredCertificates: 0, lastChecked: '2026-09-28' },
    { id: 'INS-004', name: 'Brahmaputra Institute of Science & Technology', city: 'Guwahati', region: 'ERO', status: 'Discrepancy', pendingCertificates: 2, pendingFaculty: 4, discrepancies: 3, expiredCertificates: 1, lastChecked: '2026-10-02' },
  ];
}

function mockAccounts(): { users: Account[]; officerRoles: string[]; institutionRoles: string[]; canEdit: boolean; sso: boolean; note: string } {
  return {
    users: [
      { id: 'u-aicte-1', name: 'R. Verma', email: 'r.verma@aicte-india.org', portal: 'aicte', role: 'Regulation Bureau Admin', region: null, institutionId: null, active: true },
      { id: 'u-aicte-2', name: 'A. Sharma', email: 'a.sharma@aicte-india.org', portal: 'aicte', role: 'Scrutiny Reviewer', region: 'CRO', institutionId: null, active: true },
      { id: 'u-aicte-3', name: 'Dr. R. Menon', email: 'r.menon@aicte-india.org', portal: 'aicte', role: 'EVC Inspector', region: 'WRO', institutionId: null, active: true },
      { id: 'u-inst-1', name: 'Dr. Anand Sharma', email: 'principal@narmadavalley.ac.in', portal: 'institution', role: 'Institution Administrator', region: 'CRO', institutionId: 'INS-001', active: true },
      { id: 'u-inst-2', name: 'K. Rao', email: 'office@narmadavalley.ac.in', portal: 'institution', role: 'Institution Staff', region: 'CRO', institutionId: 'INS-001', active: true },
    ],
    officerRoles: ['Regulation Bureau Admin', 'Scrutiny Reviewer', 'EVC Inspector', 'SHC Compliance Reviewer', 'Executive Committee Approver', 'Council Decision Authority'],
    institutionRoles: ['Institution Administrator', 'Institution Staff'],
    canEdit: true,
    sso: false,
    note: 'Role access synced with Central AICTE Security Service.',
  };
}

export const getRouting = () => viaApi<Routing | null>('/aicte/routing', async () => mockRouting());
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
export const getInspections = () => viaApi<{ inspections: InspectionSummary[]; unassigned: { id: string; institutionId: string; typeId: string; dueOn: string }[] } | null>('/aicte/field', async () => mockInspections());
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
export const getVerificationList = () => viaApi<VerificationRow[] | null>('/aicte/verification', async () => mockVerificationList());
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
export const getAccounts = () => viaApi<{ users: Account[]; officerRoles: string[]; institutionRoles: string[]; canEdit: boolean; sso: boolean; note: string } | null>('/aicte/admin/users', async () => mockAccounts());
export const updateAccount = (id: string, active: boolean) => viaApi<Pick<Account, 'id' | 'role' | 'region' | 'active'> | null>(`/aicte/admin/users/${q(id)}`, none, put({ active }));
