import type { Application, ClockState, HistoryEvent, PublicStatus, RiskReason, Stage } from '../types';
import { INSTITUTIONS } from './institutions';
import { STAGE_TARGET_DAYS, typeById } from './rules';
import { mulberry32, between } from '../lib/rng';
import { addDays, daysBetween, TODAY } from '../lib/utils';

export const STAGE_ORDER: Stage[] = ['submitted', 'scrutiny', 'rescrutiny', 'evc', 'shc', 'ec', 'decision', 'appeal'];

export const STAGE_LABEL: Record<Stage, string> = {
  submitted: 'Submitted',
  scrutiny: 'Scrutiny',
  rescrutiny: 'Re-scrutiny',
  evc: 'Expert visit (EVC)',
  shc: 'Hearing (SHC)',
  ec: 'Executive Committee',
  decision: 'Decision issued',
  appeal: 'Appeal (SAC)',
};

const HOLDER: Record<Stage, string> = {
  submitted: 'Regulation Bureau intake',
  scrutiny: 'Scrutiny committee',
  rescrutiny: 'Dealing officer',
  evc: 'EVC panel',
  shc: 'Standing Hearing Committee',
  ec: 'Executive Committee',
  decision: 'Closed',
  appeal: 'Standing Appellate Committee',
};

/** Planted bottleneck for the demo: two regions carry heavier queues. */
const REGION_LOAD: Record<string, number> = { NRO: 0.95, SCRO: 0.65, WRO: 0.25, CRO: 0.2, ERO: 0.3, SRO: 0.1, SWRO: 0.1, NWRO: 0.2, NERO: 0.15, KRO: 0.05 };

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

function riskFor(stage: Stage, region: string, ageRatio: number, deficiencies: number, paused: boolean): { risk: number; reasons: RiskReason[] } {
  if (stage === 'decision') return { risk: 0, reasons: [] };
  const parts: RiskReason[] = [
    { factor: 'Regional queue length', impact: REGION_LOAD[region] ?? 0.2 },
    { factor: 'Days already spent in this stage', impact: Math.min(1.4, ageRatio * 0.9) },
    { factor: 'Open deficiencies', impact: deficiencies * 0.45 },
    { factor: 'Expert visit still to schedule', impact: stage === 'evc' ? 0.45 : 0 },
    { factor: 'Waiting on institution (clock paused)', impact: paused ? -0.55 : 0 },
  ].filter((p) => Math.abs(p.impact) > 0.01);
  const risk = sigmoid(-2.1 + parts.reduce((s, p) => s + p.impact, 0));
  return { risk, reasons: parts.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)) };
}

function historyFor(stage: Stage, typeId: string, submittedOn: string, stageEnteredOn: string): HistoryEvent[] {
  const t = typeById(typeId);
  const h: HistoryEvent[] = [
    { at: `${submittedOn}T10:12:00`, actor: 'Institution', role: 'Chairman (DSC)', action: 'Application submitted and digitally signed', ruleRef: 'APH 1.4.6' },
    { at: `${submittedOn}T10:12:05`, actor: 'ANUMATI', role: 'Rules engine', action: `Path set from Table 2.3 for "${t.name}"`, ruleRef: `${t.clause} · rules v2026.3` },
  ];
  const reached = STAGE_ORDER.indexOf(stage);
  if (reached >= STAGE_ORDER.indexOf('scrutiny')) h.push({ at: `${addDays(submittedOn, 2)}T11:00:00`, actor: 'Scrutiny committee', role: 'Committee', action: 'Scrutiny started' });
  if (reached >= STAGE_ORDER.indexOf('rescrutiny')) h.push({ at: `${addDays(submittedOn, 9)}T16:40:00`, actor: 'Scrutiny committee', role: 'Committee', action: 'Deficiency recorded and sent back to institution', note: 'Reason recorded; deadline clock paused while the institution responds.', ruleRef: 'APH 1.8(f)' });
  if (reached >= STAGE_ORDER.indexOf('evc')) h.push({ at: `${addDays(submittedOn, 14)}T09:30:00`, actor: 'ANUMATI', role: 'Workflow engine', action: 'Moved to EVC queue', ruleRef: 'APH 1.9' });
  if (reached >= STAGE_ORDER.indexOf('shc')) h.push({ at: `${addDays(submittedOn, 30)}T15:00:00`, actor: 'EVC panel', role: 'Committee', action: 'EVC report uploaded with shortfalls' });
  if (reached >= STAGE_ORDER.indexOf('ec')) h.push({ at: `${addDays(submittedOn, 38)}T12:00:00`, actor: 'Regulation Bureau', role: 'Bureau officer', action: 'Placed before Executive Committee' });
  if (reached >= STAGE_ORDER.indexOf('decision')) h.push({ at: `${stageEnteredOn}T17:30:00`, actor: 'Executive Committee', role: 'Competent authority', action: 'Decision recorded and letter issued', ruleRef: 'APH 2.23.3' });
  return h;
}

function make(i: number, rand: () => number): Application {
  const inst = INSTITUTIONS[1 + (i % (INSTITUTIONS.length - 1))];
  const typePool = ['eoa', 'eoa', 'eoa', 'eoa', 'intake', 'intake', 'programme', 'new', 'site', 'coursename', 'supernumerary', 'closure', 'name', 'dual', 'break'];
  const typeId = typePool[Math.floor(rand() * typePool.length)];
  const stagePool: Stage[] = ['scrutiny', 'scrutiny', 'scrutiny', 'rescrutiny', 'rescrutiny', 'evc', 'evc', 'evc', 'shc', 'ec', 'decision', 'decision', 'appeal'];
  let stage = stagePool[Math.floor(rand() * stagePool.length)];
  const t = typeById(typeId);
  if (stage === 'evc' && t.steps.evc === 'none') stage = 'scrutiny';
  if (typeId === 'eoa' && (stage === 'scrutiny' || stage === 'evc')) stage = rand() < 0.5 ? 'ec' : 'decision';
  const submittedOn = addDays('2026-08-25', between(rand, 0, 48));
  const stageEnteredOn = addDays(submittedOn, Math.min(daysBetween(submittedOn, TODAY) - 1, between(rand, 2, 30)));
  const target = stage in STAGE_TARGET_DAYS ? STAGE_TARGET_DAYS[stage as keyof typeof STAGE_TARGET_DAYS] : 15;
  const dueOn = addDays(stageEnteredOn, target);
  const paused = stage === 'rescrutiny' && rand() < 0.6;
  let clock: ClockState = 'running';
  if (stage === 'decision') clock = 'met';
  else if (paused) clock = 'paused';
  else if (daysBetween(dueOn, TODAY) > 0) clock = 'breached';
  const deficiencies = stage === 'rescrutiny' || stage === 'shc' ? between(rand, 1, 3) : stage === 'scrutiny' && rand() < 0.25 ? 1 : 0;
  const ageRatio = Math.max(0, daysBetween(stageEnteredOn, TODAY)) / target;
  const { risk, reasons } = riskFor(stage, inst.region, ageRatio, deficiencies, paused);
  const outcome = stage === 'decision' ? (rand() < 0.82 ? (typeId === 'new' ? 'LoA' : 'EoA') : 'LoD') : null;
  const publicStatus: PublicStatus = stage === 'decision' ? 'Decision issued' : paused ? 'Action needed' : 'Ongoing';
  return {
    id: `ANU-2026-${String(430 + i * 7).padStart(4, '0')}`,
    institutionId: inst.id,
    typeId,
    cycle: '2027-28',
    submittedOn,
    stage,
    stageEnteredOn,
    dueOn,
    clock,
    holder: paused ? 'Awaiting institution' : HOLDER[stage],
    region: inst.region,
    deficiencies,
    risk,
    riskReasons: reasons,
    outcome,
    publicStatus,
    history: historyFor(stage, typeId, submittedOn, stageEnteredOn),
  };
}

const DEMO_APPS: Application[] = [
  {
    id: 'ANU-2026-0412',
    institutionId: 'INS-001',
    typeId: 'intake',
    cycle: '2027-28',
    submittedOn: '2026-09-18',
    stage: 'evc',
    stageEnteredOn: '2026-10-06',
    dueOn: '2026-11-05',
    clock: 'running',
    holder: 'EVC panel',
    region: 'CRO',
    deficiencies: 0,
    ...(() => {
      const r = riskFor('evc', 'CRO', 16 / 30, 0, false);
      return { risk: r.risk, riskReasons: r.reasons };
    })(),
    outcome: null,
    publicStatus: 'Ongoing',
    history: [
      { at: '2026-09-18T10:12:00', actor: 'Institution', role: 'Chairman (DSC)', action: 'Application submitted and digitally signed', ruleRef: 'APH 1.4.6' },
      { at: '2026-09-18T10:12:05', actor: 'ANUMATI', role: 'Rules engine', action: 'Path set: Scrutiny → EVC → (SHC if needed) → Executive Committee', ruleRef: 'APH 2.6, Table 2.3 · rules v2026.3' },
      { at: '2026-09-20T11:00:00', actor: 'Scrutiny committee', role: 'Committee', action: 'Scrutiny started' },
      { at: '2026-10-06T15:20:00', actor: 'Scrutiny committee', role: 'Committee', action: 'Scrutiny cleared with no deficiencies' },
      { at: '2026-10-06T15:20:04', actor: 'ANUMATI', role: 'Workflow engine', action: 'Moved to EVC queue automatically', ruleRef: 'APH 1.9' },
      { at: '2026-10-09T12:00:00', actor: 'ANUMATI', role: 'EVC scheduler', action: 'Three experts assigned; drand round committed in advance', note: 'Conflict-of-interest rules applied; one expert excluded.' },
    ],
  },
  {
    id: 'ANU-2026-0398',
    institutionId: 'INS-001',
    typeId: 'coursename',
    cycle: '2027-28',
    submittedOn: '2026-09-10',
    stage: 'rescrutiny',
    stageEnteredOn: '2026-10-14',
    dueOn: '2026-10-29',
    clock: 'paused',
    holder: 'Awaiting institution',
    region: 'CRO',
    deficiencies: 1,
    ...(() => {
      const r = riskFor('rescrutiny', 'CRO', 8 / 10, 1, true);
      return { risk: r.risk, riskReasons: r.reasons };
    })(),
    outcome: null,
    publicStatus: 'Action needed',
    history: [
      { at: '2026-09-10T09:40:00', actor: 'Institution', role: 'Chairman (DSC)', action: 'Application submitted and digitally signed', ruleRef: 'APH 1.4.6' },
      { at: '2026-09-10T09:40:03', actor: 'ANUMATI', role: 'Rules engine', action: 'Path set: Scrutiny → Executive Committee', ruleRef: 'APH 2.18, Table 2.3 · rules v2026.3' },
      { at: '2026-09-15T10:00:00', actor: 'Scrutiny committee', role: 'Committee', action: 'Scrutiny started' },
      { at: '2026-10-14T16:05:00', actor: 'Scrutiny committee', role: 'Committee', action: 'Deficiency recorded: university NOC does not name the new course title', note: 'Clock paused until the institution uploads a corrected NOC.', ruleRef: 'APH 1.8(f)' },
    ],
  },
  {
    id: 'ANU-2026-0117',
    institutionId: 'INS-001',
    typeId: 'eoa',
    cycle: '2026-27',
    submittedOn: '2026-01-12',
    stage: 'decision',
    stageEnteredOn: '2026-04-28',
    dueOn: '2026-04-30',
    clock: 'met',
    holder: 'Closed',
    region: 'CRO',
    deficiencies: 0,
    risk: 0,
    riskReasons: [],
    outcome: 'EoA',
    publicStatus: 'Decision issued',
    history: [
      { at: '2026-01-12T12:00:00', actor: 'Institution', role: 'Chairman (DSC)', action: 'Application submitted and digitally signed', ruleRef: 'APH 1.4.6' },
      { at: '2026-01-12T12:00:02', actor: 'ANUMATI', role: 'Rules engine', action: 'Path set: Self-disclosure → Executive Committee', ruleRef: 'APH 2.5, Table 2.3 · rules v2026.1' },
      { at: '2026-04-28T17:30:00', actor: 'Executive Committee', role: 'Competent authority', action: 'Extension of Approval issued for 2026-27', ruleRef: 'APH 2.25' },
    ],
  },
];

function build(): Application[] {
  const rand = mulberry32(41);
  return [...DEMO_APPS, ...Array.from({ length: 64 }, (_, i) => make(i, rand))];
}

export const APPLICATIONS: Application[] = build();
