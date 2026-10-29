/** Plain-language meanings for the words and abbreviations used in AICTE approvals. */
export interface GlossaryTerm {
  key: string;
  full: string;
  meaning: string;
  clause?: string;
  /** Also match these spellings in running text. */
  aliases?: string[];
}

export const GLOSSARY: GlossaryTerm[] = [
  { key: 'AICTE', full: 'All India Council for Technical Education', meaning: 'The national body that approves technical institutions and courses such as engineering, management, pharmacy and architecture.' },
  { key: 'APH', full: 'Approval Process Handbook 2024-27', meaning: 'The rulebook that says what each kind of request needs, who checks it and by when.' },
  { key: 'EoA', full: 'Extension of Approval', meaning: 'The yearly renewal that lets an existing institution keep running its approved courses.', clause: 'APH 2.25' },
  { key: 'LoA', full: 'Letter of Approval', meaning: 'The letter that grants approval for a new institution or a new course.', clause: 'APH 2.25' },
  { key: 'LoD', full: 'Letter of Deficiency', meaning: 'A letter listing the shortfalls found. The institution can fix them, appear before the hearing committee or appeal.', clause: 'APH 2.25' },
  { key: 'LoR', full: 'Letter of Rejection', meaning: 'A letter refusing the request, always with written reasons.', clause: 'APH 2.25' },
  { key: 'EVC', full: 'Expert Visit Committee', meaning: 'Experts who inspect an institution, in person, online or both, when the handbook requires a visit.', clause: 'APH 1.9' },
  { key: 'SHC', full: 'Standing Hearing Committee', meaning: 'The committee that hears an institution that still has shortfalls, before a decision is taken.', clause: 'APH 2.23' },
  { key: 'EC', full: 'Executive Committee', meaning: 'AICTE’s decision-making committee. It takes the final decision on every application.' },
  { key: 'SAC', full: 'Standing Appellate Committee', meaning: 'The committee that hears an appeal against a decision. One appeal is allowed, within 7 days.', clause: 'APH 2.24' },
  { key: 'NOC', full: 'No Objection Certificate', meaning: 'A letter from the State Government or the affiliating university saying it has no objection to the request.' },
  { key: 'DSC', full: 'Digital Signature Certificate', meaning: 'An electronic signature. Every uploaded document must be signed by the Chairman or Secretary of the Trust or Society.', clause: 'APH 1.4.6' },
  { key: 'Scrutiny', full: 'Document scrutiny', meaning: 'An online check of the submitted documents by the scrutiny committee.', clause: 'APH 1.8' },
  { key: 'Re-scrutiny', full: 'Re-scrutiny', meaning: 'A second check that looks only at the shortfalls already raised, nothing new.', clause: 'APH 1.8(g)', aliases: ['re-scrutiny'] },
  { key: 'Deficiency', full: 'Deficiency', meaning: 'A shortfall against the norms found during scrutiny or a visit, such as a missing document or too few faculty.', aliases: ['deficiency', 'deficiencies'] },
  { key: 'Intake', full: 'Approved intake', meaning: 'The number of student seats approved for a course.', aliases: ['intake'] },
  { key: 'Undertaking', full: 'Undertaking', meaning: 'A formal promise by the institution to meet a condition by a set date, such as submitting a renewed certificate.', aliases: ['undertaking', 'undertakings'] },
  { key: 'Lease runway', full: 'Lease runway', meaning: 'How many years of land lease are left after allowing for the longest course. Renewal is blocked once it reaches zero.', clause: 'APH 2.1(e)', aliases: ['lease runway'] },
  { key: 'Fair clock', full: 'Fair deadline clock', meaning: 'A deadline timer that pauses while a file waits on the institution and runs only for the official who holds it.', aliases: ['fair clock', 'clock-stop'] },
  { key: 'Evidence log', full: 'Tamper-evident evidence log', meaning: 'A record of every action in which each entry is locked to the one before it, so any later edit is detectable.', aliases: ['evidence log'] },
  { key: 'SHA-256', full: 'SHA-256 fingerprint', meaning: 'A 64-character code calculated from a file. Change even one letter of the file and the code changes completely.', aliases: ['fingerprint'] },
  { key: 'drand', full: 'drand public randomness', meaning: 'A random number published every 30 seconds by independent organisations worldwide. ANUMATI uses it to pick expert panels so nobody can rig the draw.' },
  { key: 'Golden tests', full: 'Golden tests', meaning: 'Fixed example cases that the rules must always get right. A rule change that breaks one cannot go live.', aliases: ['golden tests'] },
  { key: 'Speaking order', full: 'Speaking order', meaning: 'A decision that states its reasons in writing, so the institution knows exactly why.', aliases: ['speaking order', 'Speaking Order'] },
  { key: 'Regional office', full: 'AICTE regional office', meaning: 'One of the 10 AICTE offices that handle applications from the states in their region.', aliases: ['regional office'] },
  { key: 'Trust', full: 'Trust, Society or Section 8 Company', meaning: 'The legal body that sets up and runs a private institution. Its Chairman or Secretary signs the documents.' },
  { key: 'DigiLocker', full: 'DigiLocker and API Setu', meaning: 'Government services that issue and confirm documents at the source, so a certificate can be checked without a paper copy.' },
  { key: 'Self-disclosure', full: 'Self-disclosure', meaning: 'For some requests the institution declares the facts and AICTE verifies them later, instead of a full check first.', aliases: ['self-disclosure'] },
  { key: 'Closure', full: 'Closure or progressive closure', meaning: 'Ending an institution or course. Progressive closure stops new admissions while current students finish.', aliases: ['progressive closure'] },
  { key: 'Target days', full: 'Stage target', meaning: 'The time limit for one stage of processing. Missing it raises an alert and then an escalation.', aliases: ['target days'] },
];

export const GLOSSARY_BY_KEY: Record<string, GlossaryTerm> = Object.fromEntries(GLOSSARY.map((g) => [g.key.toLowerCase(), g]));

/** Every spelling we recognise in running text, longest first so "Re-scrutiny" wins over "Scrutiny". */
const SPELLINGS = GLOSSARY.flatMap((g) => [g.key, ...(g.aliases ?? [])].map((s) => ({ s, key: g.key }))).sort((a, b) => b.s.length - a.s.length);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const TERM_PATTERN = new RegExp(`\\b(${SPELLINGS.map((x) => escape(x.s)).join('|')})\\b`, 'g');
export const termFor = (spelling: string) => SPELLINGS.find((x) => x.s === spelling)?.key ?? spelling;
