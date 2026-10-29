/**
 * Shared types. These mirror the planned backend (FastAPI + Temporal + GoRules)
 * so the mock service layer in src/services/api.ts can be swapped for real HTTP calls.
 */

export type Need = 'required' | 'conditional' | 'none';
export type StepKey = 'selfDisclosure' | 'scrutiny' | 'evc' | 'shc';

export interface DocRequirement {
  id: string;
  name: string;
  clause: string;
  signedBy: string;
  validity?: string;
  sourceVerifiable?: boolean;
}

export interface ApplicationType {
  id: string;
  name: string;
  chapter: string;
  clause: string;
  summary: string;
  steps: Record<StepKey, Need>;
  documents: DocRequirement[];
  targetDays: number;
}

export type Stage = 'submitted' | 'scrutiny' | 'rescrutiny' | 'evc' | 'shc' | 'ec' | 'decision' | 'appeal';
export type ClockState = 'running' | 'paused' | 'breached' | 'met';
export type Outcome = 'LoA' | 'EoA' | 'LoD' | 'LoR' | null;
export type PublicStatus = 'Ongoing' | 'Action needed' | 'Decision issued';

export interface RegionInfo {
  id: string;
  name: string;
  office: string;
  states: string[];
}

export interface Institution {
  id: string;
  aicteId: string;
  name: string;
  city: string;
  state: string;
  region: string;
  category: string;
  established: number;
  land: 'Owned' | 'Leased';
  leaseEnd?: string;
  longestCourseYears: number;
  intake: number;
  programmes: string[];
  status: 'Approved' | 'Under review' | 'Closure in progress';
  trust: string;
  lat: number;
  lng: number;
}

export interface HistoryEvent {
  at: string;
  actor: string;
  role: string;
  action: string;
  note?: string;
  ruleRef?: string;
}

export interface RiskReason {
  factor: string;
  impact: number;
}

export interface Application {
  id: string;
  institutionId: string;
  typeId: string;
  cycle: string;
  submittedOn: string;
  stage: Stage;
  stageEnteredOn: string;
  dueOn: string;
  clock: ClockState;
  holder: string;
  region: string;
  deficiencies: number;
  risk: number;
  riskReasons: RiskReason[];
  outcome: Outcome;
  publicStatus: PublicStatus;
  history: HistoryEvent[];
}

export type ObligationKind = 'Undertaking' | 'Lease' | 'Document' | 'Faculty' | 'Condition';
export type ObligationStatus = 'Met' | 'On track' | 'Due soon' | 'Overdue' | 'Escalated';

export interface Obligation {
  id: string;
  institutionId: string;
  kind: ObligationKind;
  title: string;
  clause: string;
  dueOn: string;
  status: ObligationStatus;
  escalationLevel: 0 | 1 | 2 | 3;
  source: string;
  evidence?: string;
}

export interface Expert {
  id: string;
  name: string;
  city: string;
  region: string;
  specialisation: string;
  load: number;
  maxLoad: number;
  linkedInstitutions: string[];
  available: boolean;
}

export interface FacultyRecord {
  id: string;
  name: string;
  /** Salted hash of the PAN; the PAN itself is never stored with the record. */
  panHash: string;
  institutionId: string;
  designation: 'Professor' | 'Associate Professor' | 'Assistant Professor';
  joined: string;
}

export interface Notice {
  id: string;
  title: string;
  date: string;
  audience: 'Institutions' | 'Students' | 'Public' | 'Experts';
  category: 'Circular' | 'Public notice' | 'Calendar' | 'Advisory';
  summary: string;
}

export interface CalendarEvent {
  id: string;
  label: string;
  date: string;
  endDate?: string;
  kind: 'window' | 'deadline' | 'milestone';
  clause?: string;
  revisedFrom?: string;
  revisionReason?: string;
}

export interface AuditEntry {
  seq: number;
  at: string;
  actor: string;
  action: string;
  ref: string;
  payload: string;
  prevHash: string;
  hash: string;
}
