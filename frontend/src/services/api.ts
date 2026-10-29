/**
 * ANUMATI service layer.
 *
 * Every screen talks to the backend only through the functions in this file (screens usually reach them through
 * the hooks in src/lib/live-data.ts). With VITE_USE_API=true each call goes to the FastAPI backend through /api.
 * If the backend cannot be reached, the same call answers from the built-in sample data, so the interface always
 * works; client errors (4xx) are real answers and are raised as ApiError with the server's sentence.
 */
import type { Application, ApplicationType, AuditEntry, CalendarEvent, Expert, FacultyRecord, Institution, Notice, Obligation, Stage } from '../types';
import { APPLICATIONS, STAGE_LABEL } from '../data/applications';
import { INSTITUTIONS, REGIONS } from '../data/institutions';
import { CALENDAR, EXPERTS, MINING, NOTICES, OBLIGATIONS } from '../data/misc';
import { APPLICATION_TYPES, typeById } from '../data/rules';
import { GLOSSARY, type GlossaryTerm } from '../data/glossary';
import { simulate, type Scenario, type TwinResult } from '../lib/twin';
import { sha256Hex } from '../lib/hash';
import { sleep, TODAY, daysBetween } from '../lib/utils';
import { summarise } from '../lib/metrics';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';
export const USE_API = import.meta.env.VITE_USE_API === 'true';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// After a failed call the site uses sample data for a short while, then tries the server again, so a restart or a
// slow first response does not leave the whole visit on sample data.
const RETRY_AFTER_MS = 15_000;
let downUntil = 0;
let apiDown = false;
const markDown = () => {
  apiDown = true;
  downUntil = Date.now() + RETRY_AFTER_MS;
};
const checkDown = () => {
  if (apiDown && Date.now() >= downUntil) apiDown = false;
  return apiDown;
};
/** "on": answers come from the backend · "fallback": backend unreachable, sample data · "off": sample data by choice. */
export const apiMode = (): 'on' | 'fallback' | 'off' => (!USE_API ? 'off' : checkDown() ? 'fallback' : 'on');

/** Signs the backend session in again with the portal and role kept in this tab (development sign-in only;
 *  with single sign-on an expired session sends the person back through Keycloak instead). */
async function reLogin(): Promise<boolean> {
  if ((await getAuthMode()) === 'oidc') return false;
  try {
    const s = JSON.parse(sessionStorage.getItem('anumati.session') ?? 'null') as { portal: string; officerRole?: string; role?: string } | null;
    if (!s) return false;
    const r = await fetch(`${API_BASE}/api/auth/dev-login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(signInBody(s.portal, s.portal === 'aicte' ? s.officerRole : s.role)) });
    return r.ok;
  } catch {
    return false;
  }
}

const signInBody = (portal: string, role?: string) => ({ portal, ...(role ? { [portal === 'aicte' ? 'officerRole' : 'institutionRole']: role } : {}) });

/** Calls the API. Sends cookies, retries once after re-signing-in on 401, and raises ApiError with the server's message. */
export async function http<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const form = init?.body instanceof FormData;
  const res = await fetch(`${API_BASE}/api${path}`, { credentials: 'include', ...init, headers: form ? init?.headers : { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  if (res.status === 401 && retry && (await reLogin())) return http<T>(path, init, false);
  if (!res.ok) {
    const detail = await res.json().then((j) => j.detail, () => res.statusText);
    throw new ApiError(res.status, typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  // 204 No Content (and any empty body) is a successful answer with nothing to parse.
  const body = await res.text();
  if (!body) return undefined as T;
  return (res.headers.get('content-type')?.includes('json') ? JSON.parse(body) : body) as T;
}

/** Real API when available; built-in data when the backend is off or unreachable. Client errors (4xx) are real answers and are raised. */
export async function viaApi<T>(path: string, fallback: () => T | Promise<T>, init?: RequestInit): Promise<T> {
  if (!USE_API || checkDown()) return fallback();
  try {
    return await http<T>(path, init);
  } catch (e) {
    if (e instanceof ApiError && e.status < 500) throw e;
    markDown();
    console.warn(`ANUMATI API unreachable; using built-in data and retrying in ${RETRY_AFTER_MS / 1000} s.`, e);
    return fallback();
  }
}

export const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });
const latency = () => sleep(250 + Math.random() * 250);
const mock = <T,>(v: T) => async () => (await latency(), v);

/* ------------------------------------------------------------------ */
/* Sign-in: development sign-in, or Keycloak single sign-on            */
/* ------------------------------------------------------------------ */

export type AuthMode = 'dev' | 'oidc';
let authMode: Promise<AuthMode> | null = null;

/** How the server signs people in. "oidc" = Keycloak single sign-on handled by the API (no tokens in the browser). */
export function getAuthMode(): Promise<AuthMode> {
  if (!USE_API) return Promise.resolve('dev');
  authMode ??= fetch(`${API_BASE}/api/auth/config`, { credentials: 'include' })
    .then((r) => (r.ok ? r.json() : { mode: 'dev' }))
    .then((c: { mode: AuthMode }) => c.mode)
    .catch(() => 'dev' as AuthMode);
  return authMode;
}

/** Where to send the browser to start single sign-on; the API returns it to `next` afterwards. */
export const ssoLoginUrl = (next: string) => `${API_BASE}/api/auth/login?next=${encodeURIComponent(next)}`;

/** The person the server's session cookie belongs to, if any (used after the single sign-on redirect). */
export interface Principal {
  id: string;
  name: string;
  portal: 'institution' | 'aicte';
  role: string;
  institutionId?: string | null;
  region?: string | null;
}
export async function apiMe(): Promise<Principal | null> {
  if (!USE_API || checkDown()) return null;
  try {
    return await http<Principal>('/me', undefined, false);
  } catch {
    return null;
  }
}

/** Development sign-in as a sample person: an officer role for the AICTE portal, an institution role otherwise. */
export async function apiSignIn(portal: string, role?: string): Promise<void> {
  if (!USE_API || checkDown()) return;
  await http('/auth/dev-login', json(signInBody(portal, role)), false).catch(() => undefined);
}
/** Ends the server session. With single sign-on, returns Keycloak's sign-out address so the SSO session ends too. */
export async function apiSignOut(): Promise<string | null> {
  if (!USE_API || checkDown()) return null;
  const r = await http<{ logoutUrl?: string | null }>('/auth/logout', { method: 'POST' }, false).catch(() => null);
  return r?.logoutUrl ?? null;
}

/** A fresh key per submission attempt; the server answers a retried request with the first answer. */
export const newIdempotencyKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '');
export async function apiRefresh(): Promise<void> {
  if (USE_API && !checkDown()) await http('/auth/refresh', { method: 'POST' }).catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* Read APIs                                                           */
/* ------------------------------------------------------------------ */

export const getApplications = () => viaApi<Application[]>('/applications', mock(APPLICATIONS));

export async function getApplication(id: string): Promise<Application | undefined> {
  try {
    return await viaApi<Application | undefined>(`/applications/${id}`, mock(APPLICATIONS.find((a) => a.id === id)));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return undefined;
    throw e;
  }
}

export const getInstitutionApplications = (institutionId: string) => viaApi<Application[]>('/institution/applications', mock(APPLICATIONS.filter((a) => a.institutionId === institutionId)));
export const getInstitutions = () => viaApi<Institution[]>('/public/institutions', mock(INSTITUTIONS));
export const getObligations = (institutionId?: string) =>
  institutionId ? viaApi<Obligation[]>('/institution/obligations', mock(OBLIGATIONS.filter((o) => o.institutionId === institutionId))) : viaApi<Obligation[]>('/aicte/compliance', mock(OBLIGATIONS));

/* ------------------------------------------------------------------ */
/* Dashboard aggregates                                                */
/* ------------------------------------------------------------------ */

export interface DashboardStats {
  pending: number;
  atRisk: number;
  breached: number;
  paused: number;
  decided: number;
  onTimeRate: number;
  byRegionStage: { region: string; scrutiny: number; rescrutiny: number; evc: number; shc: number; ec: number }[];
  ageing: { bucket: string; count: number }[];
}

function mockDashboard(): DashboardStats {
  const open = APPLICATIONS.filter((a) => a.stage !== 'decision');
  const byRegionStage = REGIONS.map((r) => {
    const inR = open.filter((a) => a.region === r.id);
    const c = (s: string) => inR.filter((a) => a.stage === s).length;
    return { region: r.id, scrutiny: c('scrutiny'), rescrutiny: c('rescrutiny'), evc: c('evc'), shc: c('shc'), ec: c('ec') };
  });
  const buckets = [
    { bucket: '0–7 days', min: 0, max: 7 },
    { bucket: '8–15 days', min: 8, max: 15 },
    { bucket: '16–30 days', min: 16, max: 30 },
    { bucket: '31–45 days', min: 31, max: 45 },
    { bucket: 'Over 45 days', min: 46, max: 9999 },
  ];
  const ageing = buckets.map((b) => ({
    bucket: b.bucket,
    count: open.filter((a) => {
      const d = daysBetween(a.submittedOn, TODAY);
      return d >= b.min && d <= b.max;
    }).length,
  }));
  return {
    pending: open.length,
    atRisk: open.filter((a) => a.risk >= 0.5).length,
    breached: open.filter((a) => a.clock === 'breached').length,
    paused: open.filter((a) => a.clock === 'paused').length,
    decided: APPLICATIONS.length - open.length,
    onTimeRate: summarise(APPLICATIONS).onTimePct / 100,
    byRegionStage,
    ageing,
  };
}

export const getDashboardStats = () => viaApi<DashboardStats>('/aicte/dashboard', async () => (await latency(), mockDashboard()));

/* ------------------------------------------------------------------ */
/* Institution: AI pre-submission self-check (advisory)                */
/* ------------------------------------------------------------------ */

export interface CheckFinding {
  id: string;
  severity: 'pass' | 'warning' | 'blocker';
  title: string;
  detail: string;
  clause: string;
  engine: 'Rules engine' | 'Signature check (pyHanko)' | 'Document reader (Docling)' | 'Source check (DigiLocker)';
}

function mockPrecheck(typeId: string, uploaded: string[]): CheckFinding[] {
  const t = typeById(typeId);
  const findings: CheckFinding[] = [];
  t.documents.forEach((d) => {
    if (!uploaded.includes(d.id)) {
      findings.push({ id: `miss-${d.id}`, severity: 'blocker', title: `Missing: ${d.name}`, detail: 'Required for this application type. Upload it before final submission.', clause: d.clause, engine: 'Rules engine' });
    }
  });
  if (uploaded.includes('land')) {
    findings.push({ id: 'lease', severity: 'warning', title: 'Lease runway is short', detail: 'Live lease is 4.7 years against a 4-year longest course. Renewal will be blocked from the year these are equal unless the lease is extended by 30 years.', clause: 'APH 2.1(e)', engine: 'Rules engine' });
  }
  if (uploaded.includes('uni')) {
    findings.push({ id: 'uni-name', severity: 'warning', title: 'Course title differs between documents', detail: 'The university NOC says "CSE (Artificial Intelligence)"; the application says "CSE (AI & ML)". Make them match to avoid a deficiency.', clause: 'APH 1.8', engine: 'Document reader (Docling)' });
  }
  if (uploaded.includes('aff2')) {
    findings.push({ id: 'sig', severity: 'pass', title: 'Affidavit digital signature is valid', detail: 'Signed by the Trust Secretary; certificate chain valid and not revoked.', clause: 'APH 1.4.6', engine: 'Signature check (pyHanko)' });
  }
  if (uploaded.includes('fire')) {
    findings.push({ id: 'fire', severity: 'warning', title: 'Fire safety certificate expires in 17 days', detail: 'It will expire before scrutiny ends. Upload the renewed certificate to avoid a deficiency.', clause: 'APH Annexure-1', engine: 'Source check (DigiLocker)' });
  }
  if (uploaded.includes('fac')) {
    findings.push({ id: 'fac', severity: 'warning', title: 'Faculty norm: check against your roster', detail: 'Sample check only. With the server connected, ANUMATI counts your faculty roster against UG 1:20 and PG 1:15 over all years.', clause: 'APH Annexure-1', engine: 'Rules engine' });
  }
  return findings;
}

/** documentIds are files already stored on the server; sampleKinds stand in for files that were not uploaded. */
export function runPreSubmissionCheck(typeId: string, uploaded: string[], requestedIntake?: number, documentIds: string[] = [], sampleKinds: string[] = uploaded, programme?: string, currentIntake?: number): Promise<CheckFinding[]> {
  return viaApi<CheckFinding[]>('/applications/precheck', async () => (await sleep(600), mockPrecheck(typeId, uploaded)), json({ typeId, documentIds, sampleKinds, requestedIntake, programme, currentIntake }));
}

/* ------------------------------------------------------------------ */
/* Institution: submit, reply, appeal                                  */
/* ------------------------------------------------------------------ */

export interface SubmitResult {
  application: Application;
  receipt: { ref: string; receivedAt: string; fingerprint: string; path: string[]; documents: { name: string; sha256: string }[] };
}

/** Final submission. Returns null when running on built-in data (the screen then makes its own receipt). */
export async function submitApplication(
  body: { typeId: string; details: Record<string, unknown>; signer: string; declarations: { truth: boolean; lock: boolean }; documentIds?: string[] },
  idempotencyKey: string = newIdempotencyKey(),
): Promise<SubmitResult | null> {
  return viaApi<SubmitResult | null>('/applications', () => null, { ...json({ documentIds: [], ...body }), headers: { 'Idempotency-Key': idempotencyKey } });
}

export const respondToDeficiency = (id: string, note: string, idempotencyKey: string = newIdempotencyKey(), documentIds: string[] = []) =>
  viaApi<Application | null>(`/applications/${id}/responses`, () => null, { ...json({ documentIds, note }), headers: { 'Idempotency-Key': idempotencyKey } });

/* ------------------------------------------------------------------ */
/* Officers: actions on a file                                         */
/* ------------------------------------------------------------------ */

export type Outcome = 'EoA' | 'LoA' | 'LoD' | 'LoR';
/** Officer actions; 'decide' records the competent authority's decision (Committee member or Bureau head, at the Executive Committee). */
export const actOnApplication = (id: string, action: 'forward' | 'sendback' | 'recommend' | 'note' | 'decide', reason: string, outcome?: Outcome) =>
  viaApi<Application | null>(`/applications/${id}/actions`, () => null, json({ action, reason, outcome }));

/* ------------------------------------------------------------------ */
/* EVC: conflict-free assignment + verifiable draw                     */
/* ------------------------------------------------------------------ */

export interface DrandRound {
  round: number;
  randomness: string;
  source: 'live drand network' | 'simulated (offline)';
}

/** Read straight from the public drand network in the browser, so nobody has to trust the server for it. */
export async function fetchDrand(): Promise<DrandRound> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch('https://api.drand.sh/public/latest', { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('drand unavailable');
    const j = (await res.json()) as { round: number; randomness: string };
    return { round: j.round, randomness: j.randomness, source: 'live drand network' };
  } catch {
    const round = 5_200_000 + Math.floor(Date.now() / 30_000) % 100_000;
    return { round, randomness: await sha256Hex(`simulated-${round}`), source: 'simulated (offline)' };
  }
}

export interface EvcProposal {
  shortlist: (Expert & { score: number })[];
  excluded: { expert: Expert; reason: string }[];
  commitment: string;
  committedRound: number;
}

async function mockProposal(app: Application, specialisation: string): Promise<EvcProposal> {
  await sleep(900);
  const excluded: { expert: Expert; reason: string }[] = [];
  const ok: (Expert & { score: number })[] = [];
  for (const e of EXPERTS) {
    if (e.linkedInstitutions.includes(app.institutionId)) excluded.push({ expert: e, reason: 'Conflict of interest: linked to this institution' });
    else if (!e.available) excluded.push({ expert: e, reason: 'Not available in the visit window' });
    else if (e.load >= e.maxLoad) excluded.push({ expert: e, reason: `Load limit reached (${e.load}/${e.maxLoad} visits)` });
    else ok.push({ ...e, score: (e.specialisation === specialisation ? 3 : 1) + (e.maxLoad - e.load) * 0.5 });
  }
  const shortlist = ok.sort((a, b) => b.score - a.score).slice(0, 6);
  const latest = await fetchDrand();
  const committedRound = latest.round + 2;
  const commitment = await sha256Hex(`${app.id}|${shortlist.map((s) => s.id).join(',')}|round:${committedRound}`);
  return { shortlist, excluded, commitment, committedRound };
}

export const proposeEvcPanel = (app: Application, specialisation = 'Computer Science') => viaApi<EvcProposal>(`/evc/${app.id}/propose`, () => mockProposal(app, specialisation), json({ specialisation }));

/** Deterministically picks k experts from the shortlist using the drand randomness. Anyone can recompute this. */
export async function drawFromShortlist(shortlist: Expert[], randomness: string, k = 3): Promise<Expert[]> {
  const scored = await Promise.all(shortlist.map(async (e) => ({ e, h: await sha256Hex(`${randomness}|${e.id}`) })));
  return scored.sort((a, b) => (a.h < b.h ? -1 : 1)).slice(0, k).map((x) => x.e);
}

/* ------------------------------------------------------------------ */
/* Evidence log: real SHA-256 hash chain                               */
/* ------------------------------------------------------------------ */

export const GENESIS = '0'.repeat(64);

async function localChain(app: Application): Promise<AuditEntry[]> {
  const out: AuditEntry[] = [];
  let prev = GENESIS;
  for (let i = 0; i < app.history.length; i++) {
    const h = app.history[i];
    const payload = JSON.stringify({ ref: app.id, action: h.action, actor: h.actor, role: h.role, rule: h.ruleRef ?? null, note: h.note ?? null });
    const hash = await sha256Hex(`${prev}|${i + 1}|${h.at}|${payload}`);
    out.push({ seq: i + 1, at: h.at, actor: h.actor, action: h.action, ref: app.id, payload, prevHash: prev, hash });
    prev = hash;
  }
  return out;
}

/** The server's chain when connected (same format), otherwise rebuilt from the file's history. */
export const buildAuditChain = (app: Application) => viaApi<AuditEntry[]>(`/audit?ref=${encodeURIComponent(app.id)}`, () => localChain(app));

/** Always runs in the browser: the point is that anyone can check the server's log without trusting it. */
export async function verifyChain(entries: AuditEntry[]): Promise<{ ok: boolean; brokenAt?: number }> {
  let prev = GENESIS;
  for (const e of entries) {
    const expect = await sha256Hex(`${prev}|${e.seq}|${e.at}|${e.payload}`);
    if (e.prevHash !== prev || e.hash !== expect) return { ok: false, brokenAt: e.seq };
    prev = e.hash;
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Public verification of letters                                      */
/* ------------------------------------------------------------------ */

/** Byte-for-byte the same text the server fingerprints. */
export function letterText(app: Application): string {
  const inst = INSTITUTIONS.find((i) => i.id === app.institutionId);
  return [
    'ANUMATI DECISION LETTER',
    `Reference: ${app.id}`,
    `Institution: ${inst?.name ?? app.institutionId} (${inst?.aicteId ?? ''})`,
    `Application: ${typeById(app.typeId).name}`,
    `Academic year: ${app.cycle}`,
    `Decision: ${app.outcome ?? 'Pending'}`,
    `Decided on: ${app.stageEnteredOn}`,
    'Issued by: Executive Committee (competent authority)',
  ].join('\n');
}

export interface VerifyResult {
  status: 'authentic' | 'not-found' | 'mismatch';
  app?: Application;
  fingerprint?: string;
  timestamp?: string;
}

async function mockVerify(ref: string): Promise<VerifyResult> {
  await latency();
  const app = APPLICATIONS.find((a) => a.id.toUpperCase() === ref.trim().toUpperCase() && a.stage === 'decision');
  if (!app) return { status: 'not-found' };
  return { status: 'authentic', app, fingerprint: await sha256Hex(letterText(app)), timestamp: `${app.stageEnteredOn}T17:30:12+05:30` };
}

export const verifyReference = (ref: string) => viaApi<VerifyResult>(`/public/verify/${encodeURIComponent(ref.trim())}`, () => mockVerify(ref));

export async function verifyFile(buf: ArrayBuffer): Promise<VerifyResult> {
  const local = async (): Promise<VerifyResult> => {
    await latency();
    const fp = await sha256Hex(buf);
    for (const app of APPLICATIONS.filter((a) => a.stage === 'decision')) {
      if ((await sha256Hex(letterText(app))) === fp) return { status: 'authentic', app, fingerprint: fp, timestamp: `${app.stageEnteredOn}T17:30:12+05:30` };
    }
    return { status: 'mismatch', fingerprint: fp };
  };
  const form = new FormData();
  form.append('file', new Blob([buf]), 'letter');
  return viaApi<VerifyResult>('/public/verify/file', local, { method: 'POST', body: form });
}

/* ------------------------------------------------------------------ */
/* Helpers for live data                                               */
/* ------------------------------------------------------------------ */

/** The API sends null for empty optional fields; the screens expect them to be absent. */
const noNulls = <T,>(rows: T[]): T[] => rows.map((r) => Object.fromEntries(Object.entries(r as object).filter(([, v]) => v !== null)) as T);
export const put = (body: unknown): RequestInit => ({ method: 'PUT', body: JSON.stringify(body) });
export const post: RequestInit = { method: 'POST' };
export const del: RequestInit = { method: 'DELETE' };

/* ------------------------------------------------------------------ */
/* Public reference data                                               */
/* ------------------------------------------------------------------ */

export const getCalendarEvents = async () => noNulls(await viaApi<CalendarEvent[]>('/public/calendar', mock(CALENDAR)));
export const getNoticeList = () => viaApi<Notice[]>('/public/notices', mock(NOTICES));
export const getGlossary = async () => noNulls(await viaApi<GlossaryTerm[]>('/public/glossary', mock(GLOSSARY)));
export const getTypes = () => viaApi<ApplicationType[]>('/public/rules/types', mock(APPLICATION_TYPES));

export interface Summary {
  total: number;
  decided: number;
  open: number;
  missed: number;
  medianDays: number;
  onTimePct: number;
}
export interface PerformanceData {
  generatedAt: string;
  cycle: string;
  licence: string;
  national: Summary;
  regions: (Summary & { id: string; name: string; office: string })[];
  stages: { stage: string; onTime: number; late: number }[];
  outcomes: { o: 'EoA' | 'LoA' | 'LoD' | 'LoR'; n: number }[];
}

/** The same figures the server publishes, computed from the built-in records. */
export function localPerformance(apps: Application[] = APPLICATIONS): PerformanceData {
  const stages = (['scrutiny', 'rescrutiny', 'evc', 'shc', 'ec', 'appeal'] as Stage[]).map((s) => {
    const files = apps.filter((a) => a.stage === s);
    const late = files.filter((a) => a.clock === 'breached').length;
    return { stage: STAGE_LABEL[s], onTime: files.length - late, late };
  });
  return {
    generatedAt: `${TODAY}T02:00:00+05:30`,
    cycle: '2027-28',
    licence: 'Government Open Data License - India',
    national: summarise(apps),
    regions: REGIONS.map((r) => ({ id: r.id, name: r.name, office: r.office, ...summarise(apps.filter((a) => a.region === r.id)) })),
    stages,
    outcomes: (['EoA', 'LoA', 'LoD', 'LoR'] as const).map((o) => ({ o, n: apps.filter((a) => a.outcome === o).length })),
  };
}
export const getPerformance = () => viaApi<PerformanceData>('/public/performance', async () => localPerformance());

export type DayHealth = 'ok' | 'slow' | 'down';
export interface StatusData {
  overall: string;
  ok: boolean;
  checks: Record<string, { ok: boolean; ms?: number | null; lastRun?: string | null }>;
  services: { service: string; days: DayHealth[]; uptime: number }[];
  checkedAt: string;
}
export interface ForecastData {
  windowStart: string;
  windowEnd: string;
  days: { date: string; expected: number; submitted: number }[];
  lastWeekShare: number;
  rushFrom: string;
}
/** null when running on built-in data: the status page then shows its own simulated history. */
export const getStatus = () => viaApi<StatusData | null>('/public/status', async () => null);
export const getForecast = () => viaApi<ForecastData | null>('/public/status/forecast', async () => null);

/** Round trip to the API's liveness check in milliseconds (the website itself when on built-in data); null if unreachable. */
export async function pingApi(): Promise<number | null> {
  const t0 = performance.now();
  try {
    const r = await fetch(USE_API && !checkDown() ? `${API_BASE}/api/health` : `/favicon.svg?probe=${Date.now()}`, { cache: 'no-store' });
    return r.ok ? Math.round(performance.now() - t0) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Institution: documents, drafts, notifications                       */
/* ------------------------------------------------------------------ */

export interface StoredDocument {
  id: string;
  docKind: string;
  filename: string;
  sha256: string;
  sizeBytes: number;
  pages: number | null;
  signed: boolean;
  version: number;
  preflight: {
    virusScan?: string;
    signatureIntact?: boolean | null;
    signer?: string | null;
    errors?: string[];
    warnings?: string[];
    /** AI document verification result added at upload time (doc_ai.py). */
    aiCheck?: {
      status: 'pass' | 'warn' | 'fail';
      wordCount?: number;
      engine?: string;
      findings: {
        severity: 'pass' | 'warn' | 'fail';
        title: string;
        detail: string;
        clause: string;
        engine: string;
      }[];
    };
  };
  applicationId?: string | null;
  uploadedAt?: string | null;
  uploadedBy?: string | null;
  /** Checklist status: uploaded → awaiting verification (once submitted) → verified or needs correction. */
  reviewStatus?: 'uploaded' | 'awaiting verification' | 'verified' | 'needs correction';
  reviewNote?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}
/* ------------------------------------------------------------------ */
/* AI Dispute types and API                                            */
/* ------------------------------------------------------------------ */

export interface AiDispute {
  id: number;
  documentId: string;
  institutionId: string;
  institutionName?: string;
  applicationId?: string | null;
  filename?: string;
  findingId: string;
  findingTitle: string;
  findingDetail: string;
  findingClause: string;
  reason: string;
  status: 'pending' | 'overridden' | 'confirmed';
  resolution?: string | null;
  reviewedBy?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

/** Raise a dispute on a specific AI finding. null on built-in data. */
export function raiseDispute(documentId: string, findingId: string, findingTitle: string, findingDetail: string, findingClause: string, reason: string): Promise<AiDispute | null> {
  return viaApi<AiDispute | null>(`/documents/${encodeURIComponent(documentId)}/disputes`, async () => null, json({ findingId, findingTitle, findingDetail, findingClause, reason }));
}

/** All disputes raised by this institution. */
export const getMyDisputes = () => viaApi<AiDispute[] | null>('/institution/disputes', async () => null);

/** AICTE: list disputes (default: pending only). */
export const getDisputes = (status = 'pending') => viaApi<AiDispute[] | null>(`/aicte/disputes?status=${status}`, async () => null);

/** AICTE: resolve a dispute. */
export const resolveDispute = (id: number, decision: 'override' | 'confirm', resolution: string) =>
  viaApi<AiDispute | null>(`/aicte/disputes/${id}/resolve`, async () => null, json({ decision, resolution }));

/** null when running on built-in data. */
export const getDocuments = () => viaApi<StoredDocument[] | null>('/institution/documents', async () => null);

/** Sends one file to the server: fingerprinted, checked, virus-scanned and stored. null on built-in data. */
export function uploadDocument(file: Blob, name: string, docKind: string, applicationId?: string): Promise<StoredDocument | null> {
  const form = new FormData();
  form.append('file', file, name);
  form.append('doc_kind', docKind);
  if (applicationId) form.append('application_id', applicationId);
  return viaApi<StoredDocument | null>('/uploads', async () => null, { method: 'POST', body: form });
}

export interface ReadPromise {
  promise: string;
  due: string | null;
  clause: string;
  confidence: number;
}
/** Reads a signed undertaking on the server; null on built-in data. */
export const readUndertaking = (text: string) => viaApi<ReadPromise[] | null>('/institution/undertakings/read', async () => null, json({ text }));
/** Tracks a confirmed promise as an obligation; null on built-in data. */
export const trackObligation = (title: string, dueOn: string, clause: string) => viaApi<Obligation | null>('/institution/obligations', async () => null, json({ title, dueOn, clause, kind: 'Undertaking' }));
/** Attaches an uploaded document as proof for an obligation; null on built-in data. */
export function attachEvidence(obligationId: string, documentId: string): Promise<Obligation | null> {
  const form = new FormData();
  form.append('document_id', documentId);
  return viaApi<Obligation | null>(`/obligations/${encodeURIComponent(obligationId)}/evidence`, async () => null, { method: 'POST', body: form });
}

/** Ask ANUMATI on the server (same engine as the browser's); null on built-in data. */
export interface AssistantReply {
  text: string;
  bullets?: string[];
  cites?: string[];
  link?: { to: string; label: string } | null;
  followUps?: string[];
  /** handbook: curated answers and rules · records: the asker's own files or queue · ai: generated by AI engine from those sources */
  source?: 'handbook' | 'records' | 'ai';
  confident?: boolean;
}
/** Asks the server, which knows who is signed in; `history` lets follow-ups such as “and how long?” keep their topic. */
export const askAssistant = (question: string, history: string[] = []) => viaApi<AssistantReply | null>('/public/assistant/ask', async () => null, json({ question, history: history.slice(-4) }));

export const saveDraft = (id: string, typeId: string, data: Record<string, unknown>) => viaApi<{ id: string; savedAt: string } | null>(`/institution/drafts/${id}`, async () => null, put({ typeId, data }));

export interface NotificationItem {
  id: number;
  title: string;
  tone: 'brand' | 'green' | 'amber' | 'red';
  ref?: string | null;
  createdAt: string;
  read: boolean;
  delivery?: Record<string, string>;
}
/** null when running on built-in data. */
export const getNotifications = () => viaApi<NotificationItem[] | null>('/notifications', async () => null);
export const markNotificationRead = (id: number) => viaApi<unknown>(`/notifications/${id}/read`, async () => null, post);
export const saveNotificationPrefs = (channels: string[], language: 'en' | 'hi') => viaApi<unknown>('/notifications/preferences', async () => null, put({ channels, language }));

/* ------------------------------------------------------------------ */
/* Officers: queue tools and live activity                             */
/* ------------------------------------------------------------------ */

export const bulkAction = (action: 'remind' | 'assign', ids: string[]) => viaApi<{ count: number; undoToken: string } | null>('/aicte/queue/bulk', async () => null, json({ action, ids }));
export const undoBulk = (token: string) => viaApi<{ withdrawn: number } | null>(`/aicte/queue/bulk/${encodeURIComponent(token)}/undo`, async () => null, post);

export interface SavedView {
  id: number;
  name: string;
  query: string;
}
export const getSavedViews = () => viaApi<SavedView[] | null>('/aicte/views', async () => null);
export const saveView = (name: string, query: string) => viaApi<SavedView | null>('/aicte/views', async () => null, json({ name, query }));
export const deleteView = (id: number) => viaApi<unknown>(`/aicte/views/${id}`, async () => null, { method: 'DELETE' });

export interface ActivityItem {
  id: number;
  ref: string;
  at: string;
  actor: string;
  action: string;
}
export const getActivity = (limit = 12) => viaApi<ActivityItem[] | null>(`/aicte/activity?limit=${limit}`, async () => null);
/** Server-Sent Events carrying each new evidence-log entry the officer may see; null on built-in data. */
export const openActivityStream = (): EventSource | null =>
  USE_API && !checkDown() && typeof EventSource !== 'undefined' ? new EventSource(`${API_BASE}/api/aicte/activity/stream`, { withCredentials: true }) : null;

/* ------------------------------------------------------------------ */
/* Officers: compliance, inspections, integrity                        */
/* ------------------------------------------------------------------ */

export const remindObligation = (id: string) => viaApi<{ sent: boolean; channels: string[] } | null>(`/aicte/compliance/${encodeURIComponent(id)}/remind`, async () => null, post);
export const verifyObligation = (id: string) => viaApi<Obligation | null>(`/aicte/compliance/${encodeURIComponent(id)}/verify`, async () => null, post);

export interface InspectionWeight {
  id: string;
  name: string;
  weight: number;
  reasons: string[];
}
export interface InspectionDrawResult {
  id: number;
  round: number;
  randomness: string;
  source: string;
  chosen: { id: string; why: 'risk-weighted' | 'pure random' }[];
  weights: InspectionWeight[];
}
export const getInspectionWeights = () => viaApi<InspectionWeight[] | null>('/aicte/inspections/weights', async () => null);
export const drawInspections = (k: number) => viaApi<InspectionDrawResult | null>('/aicte/inspections/draw', async () => null, json({ k }));

export interface DuplicateReport {
  checked: number;
  institutionsInvolved: number;
  clusters: { panHash: string; name: string; records: FacultyRecord[] }[];
}
export const getDuplicates = () => viaApi<DuplicateReport | null>('/aicte/integrity/duplicates', async () => null);
export const askToExplain = (panHash: string) => viaApi<{ asked: string[] } | null>(`/aicte/integrity/${encodeURIComponent(panHash)}/ask`, async () => null, post);

/* ------------------------------------------------------------------ */
/* Officers: expert visits                                             */
/* ------------------------------------------------------------------ */

export interface EvcPanel {
  id: number;
  mode: string;
  shortlist: (Expert & { score: number })[];
  commitment: string;
  committedRound: number;
  randomness: string | null;
  chosen: string[] | null;
  verified: boolean | null;
}
/** The server reveals the panel from the committed drand round; ApiError 425 means that round is not out yet. */
export const drawEvcPanel = (appId: string) => viaApi<EvcPanel | null>(`/evc/${encodeURIComponent(appId)}/draw`, async () => null, post);

export interface PhotoCheck {
  name: string;
  lat?: number | null;
  lng?: number | null;
  takenAt?: string | null;
  distanceM?: number | null;
  verdict: 'ok' | 'far' | 'time' | 'nogps';
}
/** Uploads real visit photos: the server reads their GPS and time itself and records the result in the evidence log. */
export function uploadVisitPhotos(appId: string, files: File[]): Promise<PhotoCheck[] | null> {
  const form = new FormData();
  files.forEach((f) => form.append('files', f, f.name));
  return viaApi<PhotoCheck[] | null>(`/evc/${encodeURIComponent(appId)}/photos`, async () => null, { method: 'POST', body: form });
}

/* ------------------------------------------------------------------ */
/* Officers: insights, simulator, reports                              */
/* ------------------------------------------------------------------ */

export type ProcessMap = typeof MINING & { live?: Record<string, { files: number; avgDaysInStage: number }> };
export const getProcessMap = () => viaApi<ProcessMap>('/aicte/insights/process-map', mock(MINING));
export const runSimulation = (s: Scenario) => viaApi<TwinResult>('/aicte/simulator/run', async () => simulate(s), json(s));

/** Downloads a consolidated report from the server (CSV or JSON); false on built-in data. */
export async function downloadReport(name: 'pendency' | 'regions' | 'obligations' | 'decisions', format: 'csv' | 'json' = 'csv'): Promise<boolean> {
  if (!USE_API || checkDown()) return false;
  try {
    const res = await fetch(`${API_BASE}/api/aicte/reports/${name}?format=${format}`, { credentials: 'include' });
    if (!res.ok) return false;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `anumati-${name}.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Officers: rules studio, calendar, settings                          */
/* ------------------------------------------------------------------ */

export interface RuleVersion {
  version: string;
  status: 'published' | 'proposed';
  author: string;
  approver?: string | null;
  reason: string;
  effectiveFrom: string;
  testsPassed: number;
  testsTotal: number;
  createdAt?: string | null;
  publishedAt?: string | null;
}
export const getRuleVersions = () => viaApi<RuleVersion[] | null>('/rules/versions', async () => null);
export const testRuleTable = (table: unknown) => viaApi<{ passed: number; total: number } | null>('/rules/test', async () => null, json({ table }));
export const proposeRules = (table: unknown, reason: string, effectiveFrom: string) => viaApi<RuleVersion | null>('/rules/versions', async () => null, json({ table, reason, effectiveFrom }));
export const publishRules = (version: string) => viaApi<RuleVersion | null>(`/rules/versions/${encodeURIComponent(version)}/publish`, async () => null, post);

export const reviseCalendar = (id: string, date: string, reason: string, endDate?: string) =>
  viaApi<CalendarEvent | null>(`/aicte/calendar/${encodeURIComponent(id)}`, async () => null, put({ date, endDate: endDate ?? null, reason }));

export interface AlertSettings {
  ladder: { level: number; when: string; who: string; channel: string }[];
  channels: { email: boolean; sms: boolean; whatsapp: boolean };
  remindDaysBefore: number[];
  quietHours: string;
}
export const getAlertSettings = () => viaApi<AlertSettings | null>('/aicte/settings/alerts', async () => null);
export const saveAlertSettings = (s: Partial<AlertSettings>) => viaApi<AlertSettings | null>('/aicte/settings/alerts', async () => null, put(s));
export const getIntegrations = () => viaApi<{ name: string; purpose: string; status: string }[] | null>('/aicte/settings/integrations', async () => null);
/** Public: report a suspected fake college; returns the reference number, or null on built-in data. */
export const reportSuspicious = (name: string, city = '') => viaApi<{ ref: string; message: string } | null>('/public/reports/suspicious-institution', async () => null, json({ name, city }));
export const subscribeStatus = (contact: string) => viaApi<{ subscribed: boolean; channel: string; message: string } | null>('/public/status/subscribe', async () => null, json({ contact }));
export const sendFeedback = (page: string, helpful: boolean) => viaApi<unknown>('/public/feedback', async () => null, json({ page, helpful }));
/** The decision letter as a W3C verifiable credential signed by the server (Ed25519); null on built-in data. */
export const getSignedCredential = (ref: string) => viaApi<Record<string, unknown> | null>(`/public/letters/${encodeURIComponent(ref)}/credential`, async () => null);

export const runDeadlineCheck = () => viaApi<{ lastRun: string; escalated: number; reminded: number } | null>('/aicte/scheduler/run', async () => null, post);
