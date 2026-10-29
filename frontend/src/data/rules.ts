import type { ApplicationType, DocRequirement, StepKey, Need } from '../types';

/**
 * Rules as code: a machine-readable version of APH 2024-27 Table 2.3
 * ("Different steps involved in the processing of the applications").
 * "conditional" = the handbook's "AA" (as applicable, depending on earlier outcomes).
 * Document lists are illustrative; the binding list is APH Annexure-1/Annexure-2.
 */

const D = {
  affidavit2: { id: 'aff2', name: 'Affidavit 2 on non-judicial stamp paper', clause: 'APH 2.3.4(b)', signedBy: 'Chairman/Secretary (DSC)' },
  resolution: { id: 'res', name: 'Resolution of the Trust/Society/Company', clause: 'APH Format 3', signedBy: 'Chairman/Secretary (DSC)' },
  landDeed: { id: 'land', name: 'Registered land deed or lease (min. 30 years)', clause: 'APH 6.17(a,b)', signedBy: 'Chairman/Secretary (DSC)', validity: 'Live lease ≥ longest course', sourceVerifiable: true },
  buildingPlan: { id: 'plan', name: 'Approved building plan', clause: 'APH Annexure-1', signedBy: 'Competent authority', sourceVerifiable: true },
  occupancy: { id: 'occ', name: 'Occupancy / completion certificate', clause: 'APH Annexure-1', signedBy: 'Competent authority', sourceVerifiable: true },
  fireNoc: { id: 'fire', name: 'Fire safety certificate', clause: 'APH Annexure-1', signedBy: 'State fire service', validity: 'Renew before expiry', sourceVerifiable: true },
  uniNoc: { id: 'uni', name: 'NOC from affiliating university/board', clause: 'APH Annexure-2', signedBy: 'University registrar', sourceVerifiable: true },
  stateNoc: { id: 'state', name: 'NOC from state government/UT', clause: 'APH Annexure-2', signedBy: 'State department', sourceVerifiable: true },
  faculty: { id: 'fac', name: 'Faculty list as per norms', clause: 'APH Annexure-1, 1.3.4', signedBy: 'Principal/Director (DSC)' },
  infra: { id: 'infra', name: 'Self-disclosure of infrastructure and facilities', clause: 'APH 2.5', signedBy: 'Principal/Director (DSC)' },
  bank: { id: 'bank', name: 'Bank account details and cancelled cheque', clause: 'APH Annexure-2', signedBy: 'Chairman/Secretary (DSC)' },
  collab: { id: 'mou', name: 'Collaboration agreement / MoU', clause: 'APH Annexure-2', signedBy: 'Both parties' },
  nba: { id: 'nba', name: 'Accreditation certificates (if claimed)', clause: 'APH 2.1', signedBy: 'NBA/NAAC', validity: 'Valid on cut-off date', sourceVerifiable: true },
} satisfies Record<string, DocRequirement>;

const steps = (sd: Need, sc: Need, evc: Need, shc: Need): Record<StepKey, Need> => ({
  selfDisclosure: sd,
  scrutiny: sc,
  evc,
  shc,
});

export const APPLICATION_TYPES: ApplicationType[] = [
  { id: 'new', name: 'Establish a new technical institution', chapter: 'Chapter I', clause: 'APH 1.3–1.11', summary: 'For a promoter starting a new institution. Includes scrutiny, an expert visit and, if deficiencies remain, a hearing.', steps: steps('none', 'required', 'required', 'conditional'), documents: [D.affidavit2, D.resolution, D.landDeed, D.buildingPlan, D.occupancy, D.fireNoc, D.stateNoc, D.uniNoc], targetDays: 120 },
  { id: 'eoa', name: 'Extension of approval (self-disclosure)', chapter: 'Chapter II', clause: 'APH 2.5, Table 2.3', summary: 'Yearly renewal based on the institution\'s own disclosure of facilities. No scrutiny unless issues arise.', steps: steps('required', 'none', 'none', 'conditional'), documents: [D.infra, D.affidavit2, D.faculty, D.fireNoc], targetDays: 45 },
  { id: 'nri', name: 'Introduce or continue NRI seats', chapter: 'Chapter II', clause: 'APH 2.8', summary: 'Up to 5% of approved intake for Non-Resident Indians.', steps: steps('required', 'none', 'none', 'conditional'), documents: [D.infra, D.affidavit2], targetDays: 45 },
  { id: 'intake', name: 'Increase in intake or additional course', chapter: 'Chapter II', clause: 'APH 2.6', summary: 'More seats or a new course in an existing programme. Needs scrutiny and an expert visit.', steps: steps('none', 'required', 'required', 'conditional'), documents: [D.affidavit2, D.faculty, D.buildingPlan, D.uniNoc, D.nba], targetDays: 90 },
  { id: 'programme', name: 'Start a new programme or level', chapter: 'Chapter II', clause: 'APH 2.7', summary: 'A new programme (for example MCA) or level (for example PG) in an existing institution.', steps: steps('none', 'required', 'required', 'conditional'), documents: [D.affidavit2, D.faculty, D.buildingPlan, D.uniNoc], targetDays: 90 },
  { id: 'site', name: 'Change of site or location', chapter: 'Chapter II', clause: 'APH 2.17', summary: 'Moving the campus. Land, building and safety documents for the new site are checked, followed by an expert visit.', steps: steps('none', 'required', 'required', 'conditional'), documents: [D.resolution, D.landDeed, D.buildingPlan, D.occupancy, D.fireNoc, D.uniNoc, D.stateNoc], targetDays: 90 },
  { id: 'conversion', name: 'Convert diploma level to degree (or reverse)', chapter: 'Chapter II', clause: 'APH 2.14', summary: 'Change of level for the whole institution.', steps: steps('none', 'required', 'required', 'conditional'), documents: [D.resolution, D.faculty, D.uniNoc, D.stateNoc], targetDays: 90 },
  { id: 'merger', name: 'Merger of institutions', chapter: 'Chapter II', clause: 'APH 2.13', summary: 'Two institutions under the same or different trusts, on the same campus or city, merge.', steps: steps('none', 'required', 'required', 'conditional'), documents: [D.resolution, D.landDeed, D.faculty, D.uniNoc], targetDays: 90 },
  { id: 'break', name: 'Extension of approval after a break', chapter: 'Chapter II', clause: 'APH 2.16', summary: 'Restoring approval or intake after a gap year or punitive action.', steps: steps('none', 'required', 'required', 'conditional'), documents: [D.infra, D.affidavit2, D.faculty], targetDays: 90 },
  { id: 'supernumerary', name: 'Supernumerary seats (FN/OCI/CIWG)', chapter: 'Chapter II', clause: 'APH 2.9', summary: '15% seats over approved intake for foreign nationals, OCI and children of Indian workers in Gulf countries.', steps: steps('none', 'required', 'none', 'conditional'), documents: [D.affidavit2, D.infra], targetDays: 60 },
  { id: 'dual', name: 'Integrated or dual degree course', chapter: 'Chapter II', clause: 'APH 2.10', summary: 'Introduce an integrated or dual degree.', steps: steps('none', 'required', 'required', 'conditional'), documents: [D.affidavit2, D.faculty, D.uniNoc], targetDays: 90 },
  { id: 'fpm', name: 'Fellow Programme in Management', chapter: 'Chapter II', clause: 'APH 2.12', summary: 'Doctoral-level programme in management.', steps: steps('none', 'required', 'required', 'conditional'), documents: [D.affidavit2, D.faculty], targetDays: 90 },
  { id: 'collab', name: 'Collaboration and twinning programme', chapter: 'Chapter II', clause: 'APH Table 2.3', summary: 'Programmes with a foreign or Indian partner institution.', steps: steps('none', 'required', 'required', 'conditional'), documents: [D.collab, D.affidavit2, D.uniNoc], targetDays: 90 },
  { id: 'coursename', name: 'Change course name, merge courses or reduce intake', chapter: 'Chapter II', clause: 'APH 2.18', summary: 'Administrative change to courses. Scrutiny only.', steps: steps('none', 'required', 'none', 'conditional'), documents: [D.resolution, D.uniNoc], targetDays: 45 },
  { id: 'name', name: 'Change of institution name, university or type', chapter: 'Chapter II', clause: 'APH 2.19', summary: 'Rename the institution or change its affiliating body. Scrutiny only.', steps: steps('none', 'required', 'none', 'conditional'), documents: [D.resolution, D.uniNoc, D.stateNoc], targetDays: 45 },
  { id: 'coed', name: 'Women\'s institution to co-ed (or reverse)', chapter: 'Chapter II', clause: 'APH 2.15', summary: 'Change in admission policy by gender.', steps: steps('none', 'required', 'none', 'conditional'), documents: [D.resolution, D.uniNoc, D.stateNoc], targetDays: 45 },
  { id: 'closecourse', name: 'Closure of programmes or courses', chapter: 'Chapter II', clause: 'APH 2.18', summary: 'Close a course progressively. Scrutiny only.', steps: steps('none', 'required', 'none', 'conditional'), documents: [D.resolution, D.uniNoc], targetDays: 45 },
  { id: 'closure', name: 'Closure of the institution', chapter: 'Chapter II', clause: 'APH 2.21', summary: 'Close the whole institution. Student and staff liabilities are checked.', steps: steps('none', 'required', 'none', 'conditional'), documents: [D.resolution, D.uniNoc, D.stateNoc], targetDays: 60 },
  { id: 'bankchange', name: 'Change in bank details', chapter: 'Chapter II', clause: 'APH Table 2.3', summary: 'Update the institution\'s bank account on record.', steps: steps('none', 'required', 'none', 'none'), documents: [D.resolution, D.bank], targetDays: 30 },
  { id: 'trustname', name: 'Change in name of Trust/Society/Company', chapter: 'Chapter II', clause: 'APH 2.20', summary: 'Rename the promoting body.', steps: steps('none', 'required', 'none', 'conditional'), documents: [D.resolution, D.affidavit2], targetDays: 45 },
  { id: 'deemed', name: 'Conversion into a deemed-to-be university', chapter: 'Chapter II', clause: 'APH Table 2.3', summary: 'Institution converts to deemed-university status.', steps: steps('none', 'required', 'required', 'conditional'), documents: [D.resolution, D.faculty, D.landDeed], targetDays: 90 },
  { id: 'odl', name: 'Online learning or ODL courses', chapter: 'Chapter II', clause: 'APH Table 2.3', summary: 'Online or open and distance learning courses, processed twice a year.', steps: steps('none', 'required', 'required', 'conditional'), documents: [D.affidavit2, D.faculty], targetDays: 90 },
];

export const typeById = (id: string) => APPLICATION_TYPES.find((t) => t.id === id) ?? APPLICATION_TYPES[1];

export const STEP_LABEL: Record<StepKey, string> = {
  selfDisclosure: 'Self-disclosure',
  scrutiny: 'Scrutiny',
  evc: 'Expert visit (EVC)',
  shc: 'Hearing (SHC)',
};

/** Illustrative per-stage targets. In ANUMATI these live in an editable timeline table. */
export const STAGE_TARGET_DAYS = { scrutiny: 15, rescrutiny: 10, evc: 30, shc: 15, ec: 10, appeal: 7 } as const;

export const ESCALATION_LADDER = [
  { level: 0, when: '7 days before due', who: 'Dealing officer', channel: 'Dashboard + email' },
  { level: 1, when: 'On the due date', who: 'Regional officer', channel: 'Email + SMS' },
  { level: 2, when: '3 working days late', who: 'Bureau head (Regulation)', channel: 'Email + SMS' },
  { level: 3, when: '7 working days late', who: 'Member Secretary', channel: 'Weekly exception report' },
];

/* ---------------- Rules engine (what GoRules ZEN does on the server) ---------------- */

export interface CaseFacts {
  typeId: string;
  deficienciesFound: boolean;
  appeal: boolean;
}

export type StepTable = Record<string, Record<StepKey, Need>>;

export const baselineTable = (): StepTable =>
  Object.fromEntries(APPLICATION_TYPES.map((t) => [t.id, { ...t.steps }]));

/** Returns the ordered stage path a case must follow, citing the rule that produced it. */
export function evaluatePath(table: StepTable, f: CaseFacts): string[] {
  const s = table[f.typeId];
  if (!s) return [];
  const path: string[] = [];
  if (s.selfDisclosure === 'required') path.push('Self-disclosure');
  if (s.scrutiny === 'required') path.push('Scrutiny');
  if (s.scrutiny === 'required' && f.deficienciesFound) path.push('Re-scrutiny');
  if (s.evc === 'required' || (s.evc === 'conditional' && f.deficienciesFound)) path.push('EVC');
  if (s.shc === 'required' || (s.shc === 'conditional' && f.deficienciesFound)) path.push('SHC');
  path.push('Executive Committee');
  if (f.appeal) path.push('SAC appeal');
  return path;
}

export interface GoldenCase {
  id: string;
  label: string;
  facts: CaseFacts;
  expected: string[];
}

/** 50 hand-checkable cases: every type with and without deficiencies, plus four edge cases. */
export function buildGoldenCases(): GoldenCase[] {
  const table = baselineTable();
  const cases: GoldenCase[] = [];
  APPLICATION_TYPES.forEach((t) => {
    for (const def of [false, true]) {
      const facts = { typeId: t.id, deficienciesFound: def, appeal: false };
      cases.push({ id: `G${String(cases.length + 1).padStart(2, '0')}`, label: `${t.name}${def ? ' · deficiencies found' : ' · clean'}`, facts, expected: evaluatePath(table, facts) });
    }
  });
  const extra: [string, CaseFacts][] = [
    ['New institution · rejected, appeals within 7 days', { typeId: 'new', deficienciesFound: true, appeal: true }],
    ['Change of site · deficiencies, appeal', { typeId: 'site', deficienciesFound: true, appeal: true }],
    ['Renewal after a break · clean', { typeId: 'break', deficienciesFound: false, appeal: false }],
    ['Self-disclosure renewal · appeal after LoD', { typeId: 'eoa', deficienciesFound: true, appeal: true }],
    ['Increase in intake · appeal after LoD', { typeId: 'intake', deficienciesFound: true, appeal: true }],
    ['Closure of the institution · deficiencies, appeal', { typeId: 'closure', deficienciesFound: true, appeal: true }],
  ];
  extra.forEach(([label, facts]) => cases.push({ id: `G${String(cases.length + 1).padStart(2, '0')}`, label, facts, expected: evaluatePath(table, facts) }));
  return cases.slice(0, 50);
}
