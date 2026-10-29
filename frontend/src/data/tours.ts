/**
 * Guided tour step definitions for every page in ANUMATI.
 *
 * Each tour is an array of TourStep objects.  The `target` field must match
 * a `data-tour="..."` attribute on a DOM element in the page.
 * Import the `startTour` function from `components/live` to trigger a tour
 * programmatically (e.g. from a "Take a tour" button).
 */

export interface TourStep {
  target: string;
  title: string;
  text: string;
}

/* ------------------------------------------------------------------ */
/* PUBLIC PAGES                                                         */
/* ------------------------------------------------------------------ */

export const HOME_TOUR: TourStep[] = [
  {
    target: 'hero',
    title: 'Welcome to ANUMATI',
    text: 'ANUMATI is AICTE\'s digital approval portal. Institutions apply here; AICTE officers review here; anyone can verify a decision here. The whole journey — from upload to approval letter — happens in one place.',
  },
  {
    target: 'stages',
    title: 'How every application flows',
    text: 'Every file follows the same steps set by the AICTE Approval Process Handbook: documents are verified by AI the moment you upload them, then reviewed by an officer, inspected if needed, and decided by the Executive Committee.',
  },
  {
    target: 'tracker-demo',
    title: 'Track your application live',
    text: 'Once you submit, you can see exactly which stage your file is at, who holds it, and when a decision is expected — updated in real time. The clock pauses automatically while AICTE waits on you.',
  },
  {
    target: 'novelties',
    title: '19 innovations in this platform',
    text: 'Click "Our solution" to see all 19 features explained: the problem each one solves, how it works, and which handbook clause it implements.',
  },
];

export const RULES_TOUR: TourStep[] = [
  {
    target: 'type-selector',
    title: 'Pick your request type',
    text: 'Select from all 22 AICTE request types (new institution, intake increase, course closure, etc.). The page instantly shows the exact steps and documents required for that type.',
  },
  {
    target: 'path-display',
    title: 'Your exact approval path',
    text: 'The handbook\'s Table 2.3 is loaded as rules-as-code. This shows your file\'s path — Scrutiny, Expert Visit, SHC — with target days for each stage. No surprises.',
  },
  {
    target: 'documents-list',
    title: 'Document checklist',
    text: 'Every required document is listed with its handbook clause and who must sign it. Download the checklist as a PDF to prepare offline.',
  },
];

/* ------------------------------------------------------------------ */
/* INSTITUTION PORTAL                                                   */
/* ------------------------------------------------------------------ */

export const INST_DASHBOARD_TOUR: TourStep[] = [
  {
    target: 'action-needed',
    title: 'What needs your attention first',
    text: 'This section shows only the things that are blocking your progress right now — a deficiency to reply to, a certificate about to expire, a deadline coming up. Start here every time you visit.',
  },
  {
    target: 'stats',
    title: 'Your application summary',
    text: 'At a glance: how many applications are in progress, how many are waiting on you, and how many decisions have been issued. Click any tile to jump to that list.',
  },
  {
    target: 'renewal',
    title: 'Proactive renewal',
    text: 'ANUMATI pre-fills your annual Extension of Approval from last year\'s records. You only confirm what changed — nothing has to be typed twice.',
  },
  {
    target: 'health',
    title: 'Institution health score',
    text: 'A single number showing how ready your institution is for a smooth approval cycle. Green means you qualify for the fast-track (green channel) with a 15-day decision.',
  },
];

export const APPLY_TOUR: TourStep[] = [
  {
    target: 'step-type',
    title: 'Step 1 — Choose your request',
    text: 'Select what you want to do: increase seats, add a course, change the institution name, or one of 22 other types. The rest of the form adapts to your choice.',
  },
  {
    target: 'step-details',
    title: 'Step 2 — Fill in the details',
    text: 'Enter the programme name, current seats, and requested seats. The faculty norm calculator updates live — you see whether you have enough faculty before submitting.',
  },
  {
    target: 'step-documents',
    title: 'Step 3 — Upload documents',
    text: 'Drop each PDF onto its slot. As soon as you upload, AI reads the document using OCR and checks it against AICTE rules for that document type — you get a result in seconds, not weeks.',
  },
  {
    target: 'step-check',
    title: 'Step 4 — AI self-check',
    text: 'Before you submit, a full check runs across all documents together: missing files, signature issues, mismatched course names across documents. Fix blockers here so scrutiny passes smoothly.',
  },
  {
    target: 'step-submit',
    title: 'Step 5 — Sign and submit',
    text: 'Tick both declarations, choose the authorised signatory (Chairman or Secretary of the Trust), and sign. You get a time-stamped receipt with a fingerprint that proves your submission time.',
  },
];

export const TRACKER_TOUR: TourStep[] = [
  {
    target: 'timeline',
    title: 'Your application timeline',
    text: 'This shows every stage your application must pass through, with dates. Green stages are done; the pulsing stage is where your file is right now; grey stages are ahead.',
  },
  {
    target: 'action-panel',
    title: 'What you need to do',
    text: 'When AICTE sends your file back with a deficiency, it appears here with the exact issue, what to fix, and a step-by-step plan. Upload the corrected document to restart the clock.',
  },
  {
    target: 'doc-checklist',
    title: 'Document checklist',
    text: 'Every document you submitted is here with its review status — uploaded, awaiting verification, verified, or needs correction. You can see exactly which documents AICTE has checked.',
  },
  {
    target: 'history',
    title: 'Full audit trail',
    text: 'Every action on your file is recorded with a timestamp — who did what, why, and which handbook clause it was under. Each entry is hash-chained so nothing can be changed quietly.',
  },
];

export const COMPLIANCE_TOUR: TourStep[] = [
  {
    target: 'overdue',
    title: 'Overdue and urgent items',
    text: 'Conditions that are past their due date are shown at the top in red. Each one is escalated automatically — upload your proof here to stop the escalation.',
  },
  {
    target: 'upcoming',
    title: 'Coming up in the next 30 days',
    text: 'These items are due soon. Upload your evidence now so you have time to correct it if AICTE asks for more.',
  },
  {
    target: 'lease',
    title: 'Lease runway',
    text: 'ANUMATI calculates how many years your land lease has left beyond your longest course. When this reaches zero, Extension of Approval is blocked. Start the lease extension well before that.',
  },
];

export const FACULTY_TOUR: TourStep[] = [
  {
    target: 'norms',
    title: 'Faculty norm summary',
    text: 'AICTE requires one faculty member for every 20 students (1:20 for UG, 1:15 for PG). This panel shows whether your current roster meets the norm for each programme.',
  },
  {
    target: 'roster',
    title: 'Faculty roster',
    text: 'Every faculty member on record, with their designation, department, qualification, and verification status. PAN numbers are stored as a one-way hash — the actual PAN is never stored.',
  },
  {
    target: 'integrity',
    title: 'Duplicate detection',
    text: 'Faculty listed full-time at two institutions are flagged by matching PAN hashes across ANUMATI — without exposing the actual PAN to anyone.',
  },
];

export const DOCUMENTS_TOUR: TourStep[] = [
  {
    target: 'upload-btn',
    title: 'Upload a new document',
    text: 'Click here to upload any PDF. It is checked for viruses, digital signature, and — for documents you uploaded during an application — AI-verified against AICTE rules for its type.',
  },
  {
    target: 'doc-table',
    title: 'Your document vault',
    text: 'Every version of every document is kept here permanently. The fingerprint column lets you prove a document has not changed. The AI check column shows the result of the automated content check.',
  },
  {
    target: 'undertaking',
    title: 'Undertaking reader',
    text: 'Paste or upload a signed undertaking. ANUMATI extracts each promise with its due date and clause. Confirm the ones that are correct and they are tracked automatically in Compliance.',
  },
];

export const NOTIFICATIONS_TOUR: TourStep[] = [
  {
    target: 'unread',
    title: 'Unread alerts',
    text: 'Every important event — a decision issued, a deficiency raised, a deadline coming up — is here as a notification. Click any one to go straight to the relevant file.',
  },
  {
    target: 'channels',
    title: 'How you receive alerts',
    text: 'Choose email, SMS, or WhatsApp. You can also send "ANU 0412" (your file\'s last four digits) to ANUMATI\'s WhatsApp number to get its current status any time.',
  },
];

/* ------------------------------------------------------------------ */
/* AICTE OFFICIALS PORTAL                                               */
/* ------------------------------------------------------------------ */

export const COMMAND_TOUR: TourStep[] = [
  {
    target: 'stats',
    title: 'Live pendency at a glance',
    text: 'Pending files, files likely to miss their deadline, files already past their due date, and files paused while institutions reply — all updated in real time. Click any tile to filter the work queue.',
  },
  {
    target: 'heatmap',
    title: 'Pendency heatmap by region',
    text: 'Darker cells mean more files waiting in that region and stage. Click any cell to open those specific files in the work queue.',
  },
  {
    target: 'risk-files',
    title: 'Files likely to miss their deadline',
    text: 'The risk score considers how many deficiencies the file already has, how long it has been at the current stage, and how complex the request type is. Files above 50% risk are highlighted.',
  },
  {
    target: 'forecast',
    title: 'What-if forecast',
    text: 'Adding 3 officers in the bottleneck region could improve the on-time rate significantly. Change the inputs in the simulator to model staffing decisions before making them.',
  },
];

export const QUEUE_TOUR: TourStep[] = [
  {
    target: 'filters',
    title: 'Filter to what matters to you',
    text: 'Filter by region, stage (scrutiny, EVC, etc.), clock state (running, paused, breached), and risk level. Save your filter as a view and return to it with one click next time.',
  },
  {
    target: 'file-list',
    title: 'Your work queue',
    text: 'Each row shows the application reference, institution, type, current stage, deadline, and risk level. Click any row to open the full dossier for that file.',
  },
  {
    target: 'focus-mode',
    title: 'Focus mode',
    text: 'Click "Focus" on any file to enter focus mode — the dossier opens, and when you take an action the next file in your queue loads automatically. The fastest way to work through a batch.',
  },
  {
    target: 'bulk',
    title: 'Bulk actions',
    text: 'Select multiple files and send a reminder, assign, or forward them all at once. You have 10 seconds to undo the action after it runs.',
  },
];

export const DOSSIER_TOUR: TourStep[] = [
  {
    target: 'dossier-header',
    title: 'Application overview',
    text: 'The institution name, request type, current stage, and deadline are at the top. The clock badge shows whether the file is running on time, paused waiting on the institution, or past its deadline.',
  },
  {
    target: 'dossier-tabs',
    title: 'Four views of the same file',
    text: 'Overview (case brief + risk), Documents (checklist with AI verification results), Rules (which path this file follows and why), and History (every action with its audit hash).',
  },
  {
    target: 'decision-panel',
    title: 'Take an action',
    text: 'Forward to the next stage, send back to the institution with a reason, recommend to the committee, or record the final decision. Every action is logged with your name, role, and the time.',
  },
  {
    target: 'readiness',
    title: 'Decision readiness',
    text: 'At the Executive Committee stage, this panel shows what conditions to attach to an approval, or why a file should be rejected. The suggestion is advisory — you make the decision.',
  },
];

export const EVC_TOUR: TourStep[] = [
  {
    target: 'evc-panel',
    title: 'Expert panel draw',
    text: 'Experts with a conflict of interest (linked institutions, same employer) are excluded automatically. The remaining shortlist is drawn using a public random number so nobody can predict or influence who is chosen.',
  },
  {
    target: 'evc-schedule',
    title: 'Schedule the visit',
    text: 'Set the visit date and mode (physical, online, or hybrid). The assigned experts receive a notification with the checklist from APH 1.9.',
  },
];

export const FIELD_TOUR: TourStep[] = [
  {
    target: 'checklist',
    title: 'APH 1.9 inspection checklist',
    text: 'Each item comes directly from the APH 1.9 inspection requirements. Answer yes/no and add a note for each item. Partially-completed inspections are saved automatically.',
  },
  {
    target: 'gps-photos',
    title: 'GPS-verified evidence photos',
    text: 'Photos uploaded here are checked against the campus GPS coordinates and the visit date. A photo taken at a different location or on a different day is flagged automatically.',
  },
  {
    target: 'sign-report',
    title: 'Sign and submit the report',
    text: 'Once all items are complete, sign the report with your DSC. The signed PDF is fingerprinted and stored permanently in the evidence log.',
  },
];

export const VERIFICATION_TOUR: TourStep[] = [
  {
    target: 'verify-list',
    title: 'Institutions awaiting check',
    text: 'Every institution whose self-reported record has changed since the last verification appears here. Once you check a record, it is marked verified — if the institution changes it again, it goes back to "awaiting check".',
  },
  {
    target: 'verify-detail',
    title: 'Check each record type',
    text: 'Campus, certificates, rooms against APH norms, programmes, faculty, and signatories are all checked separately. Record your finding (verified, discrepancy, or follow-up needed) for each one.',
  },
];

export const AI_DISPUTES_TOUR: TourStep[] = [
  {
    target: 'disputes-stats',
    title: 'Dispute dashboard',
    text: 'When an institution thinks an AI document check finding is wrong, they raise a dispute. You see all pending disputes here — with the AI\'s finding and the institution\'s explanation side by side.',
  },
  {
    target: 'dispute-card',
    title: 'Review and decide',
    text: 'Expand any dispute to see the full AI finding, the institution\'s reason, and the document filename. Override the AI finding (if the AI was wrong) or confirm it (if the AI was right). The institution is notified immediately.',
  },
  {
    target: 'resolve-form',
    title: 'Write a resolution note',
    text: 'Your note is sent to the institution and recorded in the audit log. "AI assists verification; authorised officials make all regulatory decisions" — this is where that principle is put into practice.',
  },
];

export const COMPLIANCE_OFFICER_TOUR: TourStep[] = [
  {
    target: 'compliance-stats',
    title: 'Compliance overview',
    text: 'Overdue obligations (conditions institutions have not met) are shown in red. On track obligations are green. Click any row to see the full condition and the institution\'s uploaded evidence.',
  },
  {
    target: 'compliance-list',
    title: 'Conditions by institution',
    text: 'Every condition attached to an approval is tracked here with its due date and current status. Overdue conditions are escalated automatically through three levels.',
  },
];

export const ROUTING_TOUR: TourStep[] = [
  {
    target: 'routing-queue',
    title: 'Files ready to route',
    text: 'Files that have been submitted but not yet assigned to a dealing officer appear here. Route them to the right region and officer based on the institution\'s state and the type of request.',
  },
  {
    target: 'handoff',
    title: 'Handoffs between officers',
    text: 'When a file moves between stages it may need to be handed off to a different officer or committee. Record the handoff here so the audit trail is complete.',
  },
];

export const RULES_STUDIO_TOUR: TourStep[] = [
  {
    target: 'rule-table',
    title: 'The handbook as a rule table',
    text: 'Each cell of APH Table 2.3 is stored here as data — which steps each of the 22 request types requires. Change a cell and click "Test" to see the impact on all open files before publishing.',
  },
  {
    target: 'golden-tests',
    title: 'Golden tests before publishing',
    text: 'A rule change must pass 50 test cases that cover every request type and common edge cases. If any test fails, the change cannot be published.',
  },
  {
    target: 'impact-preview',
    title: 'Impact on open files',
    text: 'Before you publish, see which currently open files would follow a different path under the proposed rules. Any file that would be affected is listed with its old and new path.',
  },
];

export const INSIGHTS_TOUR: TourStep[] = [
  {
    target: 'bottleneck',
    title: 'Where files slow down',
    text: 'This chart shows the average days files spend at each stage across all regions. The slowest stages are highlighted — these are where adding capacity would have the most impact.',
  },
  {
    target: 'return-reasons',
    title: 'Why files are sent back',
    text: 'The most common deficiency reasons are listed here. If the same problem keeps appearing (e.g. wrong signatory on NOC), it may need a change to the guidance given to institutions.',
  },
  {
    target: 'simulator-link',
    title: 'What-if simulator',
    text: 'Click here to model what would happen if you add officers in a bottleneck region, increase applications by 10%, or shift the submission window. See the impact on on-time rates before deciding.',
  },
];
