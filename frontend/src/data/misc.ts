import type { CalendarEvent, Expert, Notice, Obligation } from '../types';

/* ---------------- Experts for EVC (synthetic) ---------------- */
export const EXPERTS: Expert[] = [
  { id: 'EX-01', name: 'Dr. A. Kulkarni', city: 'Bhopal', region: 'CRO', specialisation: 'Computer Science', load: 2, maxLoad: 4, linkedInstitutions: [], available: true },
  { id: 'EX-02', name: 'Prof. S. Iyer', city: 'Jabalpur', region: 'CRO', specialisation: 'Civil Engineering', load: 3, maxLoad: 4, linkedInstitutions: [], available: true },
  { id: 'EX-03', name: 'Dr. R. Menon', city: 'Indore', region: 'CRO', specialisation: 'Computer Science', load: 1, maxLoad: 4, linkedInstitutions: ['INS-001'], available: true },
  { id: 'EX-04', name: 'Prof. N. Bose', city: 'Gwalior', region: 'CRO', specialisation: 'Electronics', load: 0, maxLoad: 3, linkedInstitutions: [], available: true },
  { id: 'EX-05', name: 'Dr. P. Rao', city: 'Raipur', region: 'CRO', specialisation: 'Mechanical Engineering', load: 4, maxLoad: 4, linkedInstitutions: [], available: true },
  { id: 'EX-06', name: 'Dr. K. Fernandes', city: 'Ujjain', region: 'CRO', specialisation: 'Architecture & Planning', load: 1, maxLoad: 3, linkedInstitutions: [], available: false },
  { id: 'EX-07', name: 'Prof. M. Siddiqui', city: 'Sagar', region: 'CRO', specialisation: 'Computer Science', load: 1, maxLoad: 4, linkedInstitutions: [], available: true },
  { id: 'EX-08', name: 'Dr. V. Nair', city: 'Bhilai', region: 'CRO', specialisation: 'Management', load: 2, maxLoad: 4, linkedInstitutions: ['INS-012'], available: true },
  { id: 'EX-09', name: 'Prof. H. Gill', city: 'Rewa', region: 'CRO', specialisation: 'Electrical Engineering', load: 0, maxLoad: 4, linkedInstitutions: [], available: true },
  { id: 'EX-10', name: 'Dr. T. Das', city: 'Satna', region: 'CRO', specialisation: 'Computer Science', load: 3, maxLoad: 4, linkedInstitutions: [], available: true },
];

/* ---------------- Post-approval obligations (synthetic) ---------------- */
export const OBLIGATIONS: Obligation[] = [
  { id: 'OB-101', institutionId: 'INS-001', kind: 'Lease', title: 'Extend land lease: live lease (4.7 years) is close to the longest course (4 years)', clause: 'APH 2.1(e), 6.17', dueOn: '2027-06-30', status: 'Due soon', escalationLevel: 0, source: 'Registered lease deed, Indore SRO' },
  { id: 'OB-102', institutionId: 'INS-001', kind: 'Faculty', title: 'Appoint 6 faculty for the additional CSE (AI & ML) division before classes start', clause: 'APH Annexure-1, 1.3.5', dueOn: '2027-07-15', status: 'On track', escalationLevel: 0, source: 'Undertaking with application ANU-2026-0412' },
  { id: 'OB-103', institutionId: 'INS-001', kind: 'Document', title: 'Renew fire safety certificate', clause: 'APH Annexure-1', dueOn: '2026-11-08', status: 'Due soon', escalationLevel: 0, source: 'State fire service certificate' },
  { id: 'OB-104', institutionId: 'INS-001', kind: 'Undertaking', title: 'Upload monthly complaints and grievances status report', clause: 'APH 7.13', dueOn: '2026-10-31', status: 'On track', escalationLevel: 0, source: 'Standing undertaking' },
  { id: 'OB-105', institutionId: 'INS-001', kind: 'Document', title: 'Occupancy certificate for new academic block', clause: 'APH Annexure-1', dueOn: '2026-09-30', status: 'Met', escalationLevel: 0, source: 'Municipal corporation', evidence: 'OC-IND-2026-118.pdf' },
  { id: 'OB-201', institutionId: 'INS-006', kind: 'Undertaking', title: 'Complete library volumes as per norms', clause: 'APH Ch. VI', dueOn: '2026-10-05', status: 'Escalated', escalationLevel: 2, source: 'Undertaking with EoA 2026-27' },
  { id: 'OB-202', institutionId: 'INS-009', kind: 'Lease', title: 'Lease renewal: live lease below longest course duration', clause: 'APH 2.1(e)', dueOn: '2026-10-12', status: 'Overdue', escalationLevel: 1, source: 'Registered lease deed' },
  { id: 'OB-203', institutionId: 'INS-004', kind: 'Faculty', title: 'Principal appointment as per qualification norms', clause: 'APH 1.6', dueOn: '2026-11-20', status: 'On track', escalationLevel: 0, source: 'LoA condition' },
  { id: 'OB-204', institutionId: 'INS-015', kind: 'Document', title: 'Renew fire safety certificate', clause: 'APH Annexure-1', dueOn: '2026-10-18', status: 'Overdue', escalationLevel: 1, source: 'State fire service certificate' },
  { id: 'OB-205', institutionId: 'INS-011', kind: 'Undertaking', title: 'Install anti-ragging CCTV coverage in hostels', clause: 'APH Ch. VI', dueOn: '2026-12-01', status: 'On track', escalationLevel: 0, source: 'Undertaking with EoA 2026-27' },
  { id: 'OB-206', institutionId: 'INS-017', kind: 'Lease', title: 'Lease extension for 30 years submitted, verification pending', clause: 'APH 2.1(e)', dueOn: '2026-11-02', status: 'Due soon', escalationLevel: 0, source: 'Registered lease deed' },
  { id: 'OB-207', institutionId: 'INS-008', kind: 'Undertaking', title: 'Security deposit payment proof with Affidavit 3', clause: 'APH 2.25(f)', dueOn: '2026-09-28', status: 'Escalated', escalationLevel: 3, source: 'LoA intimation' },
  { id: 'OB-208', institutionId: 'INS-019', kind: 'Faculty', title: 'Faculty data upload in prescribed format', clause: 'APH 1.3.6', dueOn: '2026-10-25', status: 'Due soon', escalationLevel: 0, source: 'EoA condition' },
];

/* ---------------- Public notices (synthetic, descriptive titles) ---------------- */
export const NOTICES: Notice[] = [
  { id: 'N-31', title: 'Approval process 2027-28: application window and fee schedule', date: '2026-10-20', audience: 'Institutions', category: 'Public notice', summary: 'Opening and closing dates for all application types, with the rules version in force.' },
  { id: 'N-30', title: 'EVCs can now be held physically, online or in hybrid mode', date: '2026-10-14', audience: 'Institutions', category: 'Circular', summary: 'Following the December 2025 corrigendum, the Council constitutes EVCs and SACs.' },
  { id: 'N-29', title: 'Revised academic calendar 2026-27 after court-directed extension', date: '2026-08-13', audience: 'Students', category: 'Calendar', summary: 'Last dates for admission and commencement of classes, with the previous dates shown for comparison.' },
  { id: 'N-28', title: 'Expert empanelment for EVC panels: declare conflicts of interest', date: '2026-08-02', audience: 'Experts', category: 'Advisory', summary: 'Experts must declare institutions they are linked to; the scheduler excludes them automatically.' },
  { id: 'N-27', title: 'List of institutions under progressive closure', date: '2026-07-21', audience: 'Students', category: 'Public notice', summary: 'Check before applying for admission. Searchable list with the reason and effective year.' },
  { id: 'N-26', title: 'How to verify an approval letter in seconds', date: '2026-07-10', audience: 'Public', category: 'Advisory', summary: 'Any letter issued through ANUMATI carries a reference number and fingerprint you can verify.' },
  { id: 'N-25', title: 'Monthly complaints status report: new upload format', date: '2026-06-30', audience: 'Institutions', category: 'Circular', summary: 'Institutions upload the number of complaints received and action taken each month (APH 7.13).' },
];

/* ---------------- Approval calendar, cycle 2027-28 (illustrative dates) ---------------- */
export const CALENDAR: CalendarEvent[] = [
  { id: 'C1', label: 'Approval process 2027-28 notified', date: '2026-08-25', kind: 'milestone', clause: 'APH 1.2' },
  { id: 'C2', label: 'Application window (all types)', date: '2026-08-25', endDate: '2026-11-30', kind: 'window', clause: 'APH 1.2' },
  { id: 'C3', label: 'Scrutiny and re-scrutiny', date: '2026-09-15', endDate: '2027-01-31', kind: 'window', clause: 'APH 1.8' },
  { id: 'C4', label: 'Expert visits (EVC)', date: '2026-10-01', endDate: '2027-02-28', kind: 'window', clause: 'APH 1.9' },
  { id: 'C5', label: 'Hearings (SHC)', date: '2027-01-15', endDate: '2027-03-15', kind: 'window', clause: 'APH 2.23.3' },
  { id: 'C6', label: 'Last date for approval decisions', date: '2027-04-30', kind: 'deadline', clause: 'APH 1.10(c), 7.12' },
  { id: 'C7', label: 'Appeals to SAC (7 days from decision)', date: '2027-05-01', endDate: '2027-05-15', kind: 'window', clause: 'APH 1.11, 2.24' },
  { id: 'C8', label: 'Affiliation by universities', date: '2027-05-31', kind: 'deadline', clause: 'State notifications', revisedFrom: '2027-05-15', revisionReason: 'Illustrative revision to show how court-directed changes are recorded.' },
];

/* ---------------- Process mining output (synthetic, OCEL 2.0-style) ---------------- */
export const MINING = {
  nodes: [
    { id: 'submitted', label: 'Submitted', cases: 1248, wait: 0.4 },
    { id: 'scrutiny', label: 'Scrutiny', cases: 812, wait: 6.2 },
    { id: 'rescrutiny', label: 'Re-scrutiny', cases: 296, wait: 18.4 },
    { id: 'evc', label: 'EVC', cases: 371, wait: 21.7 },
    { id: 'shc', label: 'Hearing (SHC)', cases: 118, wait: 9.1 },
    { id: 'ec', label: 'Executive Committee', cases: 1180, wait: 4.3 },
    { id: 'decision', label: 'Decision', cases: 1180, wait: 0 },
    { id: 'appeal', label: 'Appeal (SAC)', cases: 64, wait: 5.2 },
  ],
  edges: [
    { from: 'submitted', to: 'scrutiny', cases: 812, days: 1.1 },
    { from: 'submitted', to: 'ec', cases: 436, days: 2.0 },
    { from: 'scrutiny', to: 'rescrutiny', cases: 296, days: 6.2 },
    { from: 'scrutiny', to: 'evc', cases: 241, days: 4.8 },
    { from: 'scrutiny', to: 'ec', cases: 275, days: 3.1 },
    { from: 'rescrutiny', to: 'evc', cases: 130, days: 18.4 },
    { from: 'rescrutiny', to: 'ec', cases: 141, days: 12.7 },
    { from: 'rescrutiny', to: 'scrutiny', cases: 25, days: 9.0 },
    { from: 'evc', to: 'shc', cases: 118, days: 21.7 },
    { from: 'evc', to: 'ec', cases: 253, days: 14.2 },
    { from: 'shc', to: 'ec', cases: 118, days: 9.1 },
    { from: 'ec', to: 'decision', cases: 1180, days: 4.3 },
    { from: 'decision', to: 'appeal', cases: 64, days: 3.0 },
  ],
  regionStageDays: [
    { region: 'NRO', scrutiny: 9.8, rescrutiny: 27.6, evc: 31.2, shc: 11.0 },
    { region: 'SCRO', scrutiny: 8.1, rescrutiny: 22.4, evc: 26.5, shc: 10.2 },
    { region: 'ERO', scrutiny: 6.9, rescrutiny: 17.1, evc: 22.0, shc: 9.4 },
    { region: 'WRO', scrutiny: 6.0, rescrutiny: 16.0, evc: 20.4, shc: 8.8 },
    { region: 'CRO', scrutiny: 5.6, rescrutiny: 15.2, evc: 19.8, shc: 8.9 },
    { region: 'NWRO', scrutiny: 5.9, rescrutiny: 15.8, evc: 19.1, shc: 8.5 },
    { region: 'SRO', scrutiny: 4.8, rescrutiny: 13.9, evc: 18.0, shc: 8.1 },
    { region: 'SWRO', scrutiny: 5.1, rescrutiny: 14.2, evc: 18.6, shc: 8.3 },
    { region: 'NERO', scrutiny: 6.4, rescrutiny: 16.9, evc: 24.8, shc: 9.9 },
    { region: 'KRO', scrutiny: 4.5, rescrutiny: 13.1, evc: 17.2, shc: 7.9 },
  ],
  variants: [
    { path: 'Submitted → Executive Committee → Decision', share: 0.35, days: 6.3 },
    { path: 'Submitted → Scrutiny → Executive Committee → Decision', share: 0.22, days: 13.5 },
    { path: 'Submitted → Scrutiny → EVC → Executive Committee → Decision', share: 0.19, days: 34.4 },
    { path: 'Submitted → Scrutiny → Re-scrutiny → EVC → Executive Committee → Decision', share: 0.1, days: 57.9 },
    { path: 'Submitted → Scrutiny → EVC → SHC → Executive Committee → Decision', share: 0.09, days: 52.1 },
  ],
  deviations: [
    { rule: 'Re-scrutiny repeated more than once (APH 1.8(g) allows one)', cases: 25, severity: 'High' as const },
    { rule: 'EVC skipped where Table 2.3 requires it', cases: 3, severity: 'High' as const },
    { rule: 'Decision recorded before the SHC compliance window closed', cases: 2, severity: 'Medium' as const },
    { rule: 'Appeal heard after the 7-day window without a recorded reason', cases: 4, severity: 'Medium' as const },
  ],
};
