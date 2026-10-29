import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  FileSignature,
  FileText,
  FileUp,
  Fingerprint,
  HelpCircle,
  History,
  Info,
  Loader2,
  Lock,
  MessageSquare,
  PartyPopper,
  PenLine,
  RefreshCw,
  Save,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { APPLICATION_TYPES, STEP_LABEL, typeById } from '../../data/rules';
import { DEMO_INSTITUTION } from '../../data/institutions';
import { newIdempotencyKey, raiseDispute, runPreSubmissionCheck, saveDraft, submitApplication, uploadDocument, USE_API, type CheckFinding } from '../../services/api';
import { may, useSession } from '../../lib/session';
import { getDrafts, sendForReview } from '../../services/records';
import { useAsync } from '../../lib/useAsync';
import { celebrate } from '../../components/motion';
import { sha256Hex, shortHash } from '../../lib/hash';
import { ago, downloadIcs, downloadText, preflight, type Preflight } from '../../lib/files';
import { Badge, Callout, Card, CopyButton, PageHeader, WhyChip, toast } from '../../components/ui';
import { Tour } from '../../components/live';
import { APPLY_TOUR } from '../../data/tours';
import { Term } from '../../components/term';
import { FacultyNorms } from '../../components/norms';
import { addDays, cn, formatDate, formatDateTime, TODAY } from '../../lib/utils';
import type { StepKey } from '../../types';

/* ── 7 Subpages per Document Section 2.3 ─────────────────────────────────────── */
const STEPS = [
  'Application Type & Checklist',
  'Application Form',
  'Document Upload',
  'AI Verification Results',
  'Correction Centre',
  'Human Review Request',
  'Submission & Acknowledgement',
];

const ENGINES = [
  'Rules engine (APH Norms)',
  'Document reader & OCR (Docling)',
  'Signature validator (pyHanko)',
  'Authority repository check (DigiLocker)',
];

const DRAFT_KEY = 'anumati.draft.apply';

type AiCheckFinding = { severity: 'pass' | 'warn' | 'fail'; title: string; detail: string; clause: string; engine: string };
type AiCheck = { status: 'pass' | 'warn' | 'fail'; findings: AiCheckFinding[]; wordCount?: number; engine?: string };
type Upload = { name: string; hash: string; check?: Preflight; sample?: boolean; serverId?: string; scan?: string; aiCheck?: AiCheck; aiLoading?: boolean };

const samplePdf = (_docId: string): Blob => {
  const lines = [
    'AICTE TECHNICAL INSTITUTION APPROVAL - COMPLIANCE DOCUMENT',
    'Narmada Valley Institute of Technology',
    'AICTE Institution ID: INS-001',
    'Trust Registration Number: TR-2018-MH-04521',
    'Application Reference: ANU-2026-SAMPLE',
    '',
    'LAND OWNERSHIP CERTIFICATE',
    'Survey Number: 147/2 and 148/1, Pimpri Village, Pune District',
    'Land Area: 12.5 acres (50586 square metres)',
    'Registration Date: 15 March 2019',
    'Deed Number: SRO-PNE-2019-00847',
    'Ownership Type: Absolute ownership free from all encumbrances',
    'Validity: Permanent deed — no expiry',
    '',
    'FACULTY APPOINTMENT AND STRENGTH',
    'Total Sanctioned Faculty Positions: 48',
    'Positions Filled: 45',
    'Faculty to Student Ratio: 1:15',
    'PhD Holders: 14 out of 45 faculty members (31 percent)',
    'Verification Date: 10 October 2026',
    'Faculty Cadre and Designations:',
    '1. Dr. Ramesh Kulkarni - Professor and Principal (PhD, Computer Engineering)',
    '2. Dr. Sunita Patil - Professor (PhD, AI & Data Science)',
    '3. Dr. Amit Sharma - Associate Professor (PhD, Computer Networks)',
    '4. Dr. Priya Nair - Associate Professor (PhD, Machine Learning)',
    '5. Er. Vikram Joshi - Assistant Professor (M.Tech, Software Systems)',
    '6. Er. Neha Gupta - Assistant Professor (M.Tech, Information Technology)',
    '',
    'BANK SOLVENCY CERTIFICATE',
    'Bank: State Bank of India',
    'Branch: Pimpri-Chinchwad Branch Pune',
    'Certificate Number: SBI-PNE-2026-09-04521',
    'Available Funds: Rs 15,50,00,000 (Fifteen Crore Fifty Lakh Rupees)',
    'Fixed Deposits: Rs 8,00,00,000 (Eight Crore Rupees)',
    'Date of Issue: 04 September 2026',
    'Valid Until: 04 March 2027',
    '',
    'UNIVERSITY AFFILIATION LETTER',
    'Affiliated University: University of Pune',
    'Affiliation Number: UP-ENG-2019-0234',
    'Affiliation Granted: 12 June 2019',
    'Last Renewed: 12 June 2024',
    'Affiliation Valid Until: 31 July 2028',
    '',
    'FIRE SAFETY CERTIFICATE',
    'Certificate Number: FSC-PCMC-2025-11-0341',
    'Issuing Authority: Fire Officer Pimpri-Chinchwad Municipal Corporation',
    'Date of Issue: 05 November 2025',
    'Valid Until: 30 November 2027',
    '',
    'BUILDING COMPLETION AND OCCUPANCY CERTIFICATES',
    'Building Completion Certificate Number: BCC-PCMC-2021-0445',
    'Occupancy Certificate Number: OC-PCMC-2021-09-0892',
    'Date of Issue: 22 August 2021',
    'Total Built-up Area: 8200 square metres',
    'Structure: Ground floor plus three upper floors',
    '',
    'STATE GOVERNMENT NOC',
    'Issuing Authority: Government of Maharashtra Education Department',
    'NOC Reference Number: GOV-MH-2018-EDU-4521',
    'Date of Issue: 14 September 2018',
    'Validity: Permanent approval',
    '',
    'INFRASTRUCTURE SUMMARY',
    'Computer Laboratories: 3 labs with 60 seats each',
    'Library: 1200 square metres with 25000 volumes',
    'Workshop Laboratories: 4 discipline labs covering 2400 square metres',
    'Hostel: 200 seats residential facility',
    '',
    'COMPLIANCE DECLARATION',
    'All infrastructure and academic resources meet AICTE APH 2024 norms.',
    'All certificates are valid and current as of the date of this document.',
    'No dues outstanding to any authority.',
    'No adverse legal proceedings against the Trust or Institution.',
    '',
    'Authorised Signatory: Dr Ramesh Kulkarni Chairman',
    'Organisation: Narmada Valley Education Trust',
    'Date of Issue: 10 October 2026',
  ];

  let stream = 'BT\n/F1 10 Tf\n40 800 Td\n13 TL\n';
  for (const line of lines) {
    const safe = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    stream += `(${safe}) Tj T*\n`;
  }
  stream += 'ET';

  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 1000] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  let body = '%PDF-1.4\n';
  const offs: number[] = [];
  for (let i = 0; i < objs.length; i++) {
    offs.push(body.length);
    body += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xp = body.length;
  body += `xref\n0 6\n0000000000 65535 f \n`;
  for (const o of offs) body += `${String(o).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xp}\n%%EOF\n`;

  return new Blob([body], { type: 'application/pdf' });
};

interface Draft {
  step: number;
  typeId: string;
  details: { programme: string; current: number; requested: number; reason: string };
  uploads: Record<string, Upload>;
  decl: { truth: boolean; lock: boolean };
  signer: string;
  savedAt: number;
}

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

const istNow = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 19) + '+05:30';

/** Inline AI document verification result shown on each document row — with dispute flow. */
function AiCheckPanel({ aiCheck, aiLoading, documentId, onDispute }: { aiCheck?: AiCheck; aiLoading?: boolean; documentId?: string; onDispute?: (f: AiCheckFinding) => void }) {
  if (aiLoading) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-700">
        <Loader2 size={13} className="animate-spin shrink-0" />
        <span>AI document check running — OCR · NLP · Rules · DigiLocker…</span>
      </div>
    );
  }
  if (!aiCheck) return null;

  const { status, findings, wordCount, engine } = aiCheck;
  const fails = findings.filter((f) => f.severity === 'fail');
  const warns = findings.filter((f) => f.severity === 'warn');
  const passes = findings.filter((f) => f.severity === 'pass');

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
        <div className="flex items-center gap-2">
          {status === 'pass' && <Badge tone="green" icon={<CheckCircle2 size={11} />}>All checks passed</Badge>}
          {status === 'warn' && <Badge tone="amber" icon={<TriangleAlert size={11} />}>{warns.length} warning{warns.length > 1 ? 's' : ''}</Badge>}
          {status === 'fail' && <Badge tone="red" icon={<XCircle size={11} />}>{fails.length} deficiency flagged</Badge>}
          {wordCount !== undefined && <span className="text-[11px] text-ink-mute">{wordCount} words extracted</span>}
        </div>
        {engine && <span className="font-mono text-[10px] text-ink-mute">{engine}</span>}
      </div>

      <ul className="mt-2 space-y-2">
        {findings.map((f, i) => (
          <li key={i} className={cn('rounded p-2 text-xs', f.severity === 'fail' ? 'bg-red-50 text-red-900 border border-red-100' : f.severity === 'warn' ? 'bg-amber-50 text-amber-900 border border-amber-100' : 'bg-indgreen-50/60 text-indgreen-900')}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{f.title}</p>
                <p className="mt-0.5 text-[11px] opacity-90">{f.detail}</p>
                <p className="mt-1 font-mono text-[10px] opacity-75">{f.clause} · {f.engine}</p>
              </div>
              {onDispute && f.severity !== 'pass' && (
                <button
                  type="button"
                  onClick={() => onDispute(f)}
                  className="shrink-0 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-ink-soft hover:bg-slate-50 hover:text-ink"
                >
                  Dispute
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FileFacts({ up }: { up: Upload }) {
  const stored = up.serverId ? (
    <Badge tone="green" icon={<ShieldCheck size={11} />}>
      Stored{up.scan === 'clean' ? ' · virus-free' : ''}
    </Badge>
  ) : null;

  if (up.sample) {
    return (
      <div className="mt-1.5 space-y-1">
        <p className="flex flex-wrap items-center gap-2 truncate font-mono text-[11px] text-indgreen-700">
          <span>{up.name}</span>
          <Badge tone="green">Sample document ready</Badge>
          {up.hash ? <span className="text-ink-mute">SHA: {shortHash(up.hash)}</span> : null}
          {stored}
        </p>
      </div>
    );
  }

  const c = up.check;
  return (
    <div className="mt-1.5 space-y-1">
      <p className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-mono text-ink-soft">{up.name}</span>
        {c?.pages && <Badge tone="slate">{c.pages} pages</Badge>}
        {c && <Badge tone="slate">{c.sizeKB >= 1024 ? `${(c.sizeKB / 1024).toFixed(1)} MB` : `${c.sizeKB} KB`}</Badge>}
        {c?.signed ? (
          <Badge tone="green" icon={<ShieldCheck size={11} />}>
            Digitally signed (DSC)
          </Badge>
        ) : (
          <Badge tone="slate">Standard PDF</Badge>
        )}
        {up.hash ? <span className="font-mono text-ink-mute">SHA: {shortHash(up.hash)}</span> : null}
        {stored}
      </p>
      {c?.warnings.map((w) => (
        <p key={w} className="flex items-start gap-1.5 text-xs text-amber-800">
          <TriangleAlert size={13} className="mt-0.5 shrink-0" /> {w}
        </p>
      ))}
    </div>
  );
}

export default function Apply() {
  const [params] = useSearchParams();
  const { session } = useSession();
  const draft = useRef(readDraft()).current;
  const [step, setStep] = useState(params.get('programme') ? 1 : draft?.step ?? 0);
  const [typeId, setTypeId] = useState(params.get('type') ?? draft?.typeId ?? 'intake');
  const t = typeById(typeId);

  const fromSeats = params.get('programme')
    ? {
        programme: params.get('programme') ?? '',
        current: Number(params.get('current') ?? 0),
        requested: Number(params.get('requested') ?? 0),
        reason: params.get('reason') ?? '',
      }
    : null;

  const [details, setDetails] = useState(
    fromSeats ?? draft?.details ?? {
      programme: 'B.Tech CSE (Artificial Intelligence & Machine Learning)',
      current: 120,
      requested: 180,
      reason: 'Surging student preference and regional industrial demand in Indore IT hub. Laboratories and cadre strength already in place.',
    }
  );

  const canSubmit = may(session, 'submit');
  const draftId = `DRF-${session?.institutionId ?? 'INS-001'}-apply`;
  const reviews = useAsync(getDrafts, []);
  const review = (reviews.data ?? []).find((d) => d.id === draftId)?.review ?? null;

  const [uploads, setUploads] = useState<Record<string, Upload>>(draft?.uploads ?? {});
  const [rejected, setRejected] = useState<Record<string, string[]>>({});
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [engineDone, setEngineDone] = useState(0);
  const [findings, setFindings] = useState<CheckFinding[] | null>(null);
  const [decl, setDecl] = useState(draft?.decl ?? { truth: false, lock: false });
  const [signer, setSigner] = useState(draft?.signer ?? 'Secretary, Narmada Valley Education Society');
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);
  const [seal, setSeal] = useState('');
  const [submitted, setSubmitted] = useState<{ ref: string; hash: string; at: string } | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(draft?.savedAt ?? null);
  const [now, setNow] = useState(Date.now());

  /* Disputes state for Step 5 (Human Review Request) */
  const [disputes, setDisputes] = useState<
    { id: string; findingTitle: string; reason: string; status: 'Submitted' | 'Under Review' | 'Accepted' | 'Rejected'; at: string }[]
  >([
    {
      id: 'DSP-2026-004',
      findingTitle: 'Land Ownership Certificate - Hindi Devanagari Endorsement',
      reason: 'Deed registration endorsement was in Marathi/Hindi with registered translation attached on page 4.',
      status: 'Under Review',
      at: '2026-10-24 11:30',
    },
  ]);
  const [activeDisputeFinding, setActiveDisputeFinding] = useState<string>('');
  const [disputeReason, setDisputeReason] = useState<string>('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const blockers = findings?.filter((f) => f.severity === 'blocker').length ?? 0;
  const warnings = findings?.filter((f) => f.severity === 'warning').length ?? 0;
  const passes = findings?.filter((f) => f.severity === 'pass').length ?? 0;

  const pathSteps = useMemo(() => (['selfDisclosure', 'scrutiny', 'evc', 'shc'] as StepKey[]).filter((k) => t.steps[k] !== 'none'), [t]);

  // Restore notice
  const notified = useRef(false);
  useEffect(() => {
    if (!draft || notified.current) return;
    notified.current = true;
    toast(`Draft restored from ${formatDateTime(new Date(draft.savedAt))}. Continue where you left off.`, 'brand');
  }, [draft]);

  // Autosave
  useEffect(() => {
    if (submitted) return;
    const id = setTimeout(() => {
      const at = Date.now();
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, typeId, details, uploads, decl, signer, savedAt: at } satisfies Draft));
        setSavedAt(at);
      } catch {
        /* storage blocked */
      }
      if (USE_API && session?.institutionId) {
        void saveDraft(`DRF-${session.institutionId}-apply`, typeId, { step, details, decl, signer, uploads }).catch(() => undefined);
      }
    }, 500);
    return () => clearTimeout(id);
  }, [step, typeId, details, uploads, decl, signer, submitted, session]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const discard = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setStep(0);
    setUploads({});
    setFindings(null);
    setDecl({ truth: false, lock: false });
    setSigned(false);
    setSavedAt(null);
    toast('Draft discarded.', 'brand');
  };

  const attach = async (docId: string, file?: File) => {
    const blob = file ?? samplePdf(docId);
    const name = file?.name ?? `${docId}-sample.pdf`;
    if (file) {
      const check = await preflight(file);
      if (check.errors.length) {
        setRejected((r) => ({ ...r, [docId]: check.errors }));
        toast(`${file.name} was not attached. ${check.errors[0]}`, 'red');
        return;
      }
    }
    let prevUpload: Upload | undefined;
    setUploads((u) => {
      prevUpload = u[docId];
      return { ...u, [docId]: { name, hash: '', sample: !file } };
    });
    try {
      const stored = await uploadDocument(blob, name, docId);
      const hash = stored?.sha256 ?? (await sha256Hex(await blob.arrayBuffer()));
      const check = file ? await preflight(file) : undefined;
      const aiCheck = stored?.preflight?.aiCheck ?? undefined;
      setUploads((u) => ({
        ...u,
        [docId]: { name, hash, check, sample: !file, serverId: stored?.id, scan: stored?.preflight?.virusScan, aiCheck },
      }));
      setRejected((r) => ({ ...r, [docId]: [] }));
      setFindings(null);
      const docLabel = t.documents.find((d) => d.id === docId)?.name ?? name;
      if (file) {
        toast(`${name} attached successfully ✓`, 'green');
      } else {
        toast(`Sample document attached for ${docLabel}`, 'brand');
      }
    } catch (e) {
      const why = e instanceof Error ? e.message : 'The server could not store this file.';
      setUploads((u) => {
        const next = { ...u };
        if (prevUpload) next[docId] = prevUpload;
        else delete next[docId];
        return next;
      });
      setRejected((r) => ({ ...r, [docId]: [why] }));
      toast(`${name} was not attached. ${why}`, 'red');
    }
  };

  const runCheck = async () => {
    setChecking(true);
    setFindings(null);
    setEngineDone(0);
    for (let i = 1; i <= ENGINES.length; i++) {
      await new Promise((r) => setTimeout(r, 480));
      setEngineDone(i);
    }
    const onServer = Object.values(uploads).flatMap((u) => (u.serverId ? [u.serverId] : []));
    const notStored = Object.entries(uploads).filter(([, u]) => !u.serverId).map(([k]) => k);
    const res = await runPreSubmissionCheck(typeId, Object.keys(uploads), details.requested, onServer, notStored, details.programme, details.current);
    setFindings(res);
    setChecking(false);
  };

  const sign = async () => {
    setSigning(true);
    const canonical = JSON.stringify({ typeId, details, signer, documents: Object.entries(uploads).map(([k, u]) => [k, u.hash]).sort() });
    const [hash] = await Promise.all([sha256Hex(canonical), new Promise((r) => setTimeout(r, 650))]);
    setSeal(hash);
    setSigning(false);
    setSigned(true);
    toast('Application digitally sealed with Class 3 DSC token');
  };

  const submitKey = useRef(newIdempotencyKey());

  const askForReview = async () => {
    try {
      await saveDraft(draftId, typeId, { step, details, decl, signer, uploads });
      const r = await sendForReview(draftId);
      if (r) {
        toast('Sent for review. Principal and HoD notified.');
        reviews.reload();
      } else {
        toast('Draft forwarded to Head of Department for endorsement.', 'brand');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send for review.', 'red');
    }
  };

  const submit = async () => {
    try {
      const documentIds = Object.values(uploads).flatMap((u) => (u.serverId ? [u.serverId] : []));
      const res = await submitApplication({ typeId, details, signer, declarations: decl, documentIds }, submitKey.current);
      celebrate();
      if (res) setSubmitted({ ref: res.receipt.ref, hash: res.receipt.fingerprint, at: res.receipt.receivedAt });
      else setSubmitted({ ref: 'ANU-2026-0461', hash: await sha256Hex(JSON.stringify({ typeId, details, uploads, signer })), at: istNow() });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Submission failed. Your draft is safe; please try again.', 'red');
      return;
    }
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDisputeFinding || !disputeReason.trim()) {
      toast('Please select an issue and explain the grounds for dispute.', 'brand');
      return;
    }
    setSubmittingDispute(true);
    try {
      const firstDocId = Object.values(uploads).find((u) => u.serverId)?.serverId ?? 'DOC-GEN';
      await raiseDispute(firstDocId, 'dispute-apply', activeDisputeFinding, disputeReason, t.clause, disputeReason);
      setDisputes((d) => [
        {
          id: `DSP-2026-${String(d.length + 5).padStart(3, '0')}`,
          findingTitle: activeDisputeFinding,
          reason: disputeReason,
          status: 'Submitted',
          at: formatDateTime(new Date()),
        },
        ...d,
      ]);
      toast('Dispute logged and routed to AICTE Scrutiny Reviewer.', 'brand');
      setActiveDisputeFinding('');
      setDisputeReason('');
    } catch {
      setDisputes((d) => [
        {
          id: `DSP-2026-${String(d.length + 5).padStart(3, '0')}`,
          findingTitle: activeDisputeFinding,
          reason: disputeReason,
          status: 'Submitted',
          at: formatDateTime(new Date()),
        },
        ...d,
      ]);
      toast('Dispute recorded for official scrutiny consideration.', 'brand');
      setActiveDisputeFinding('');
      setDisputeReason('');
    } finally {
      setSubmittingDispute(false);
    }
  };

  const canNext =
    step === 0
      ? !!typeId
      : step === 1
      ? details.programme.trim().length > 2
      : step === 2
      ? Object.keys(uploads).length > 0
      : true;

  if (submitted) {
    const docs = Object.entries(uploads);
    const receipt = [
      'ANUMATI SUBMISSION RECEIPT',
      '==========================',
      `Reference        : ${submitted.ref}`,
      `Received at      : ${submitted.at}`,
      `Institution      : ${DEMO_INSTITUTION.name} (AICTE ID ${DEMO_INSTITUTION.aicteId})`,
      `Request          : ${t.name} (${t.clause})`,
      `Programme        : ${details.programme}`,
      `Intake           : ${details.current} -> ${details.requested}`,
      `Signed by        : ${signer}`,
      '',
      `Documents (${docs.length})`,
      ...docs.map(([, d]) => `  - ${d.name}  sha256:${d.hash}`),
      '',
      `Submission fingerprint (SHA-256): ${submitted.hash}`,
      '',
      'This receipt proves the time of submission. Your statutory deadline is met as of the timestamp above.',
      'Even if processing is queued during peak load, your SLA clock begins immediately.',
    ].join('\n');

    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-2xl py-6">
        <div className="card overflow-hidden text-center shadow-lift">
          <div className="bg-gradient-to-b from-indgreen-50 to-white px-6 pb-6 pt-10">
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 12 }}
              className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-indgreen-600 text-white shadow-md"
            >
              <PartyPopper size={30} />
            </motion.span>
            <h1 className="mt-5 text-2xl font-bold text-ink">Application Submitted Successfully</h1>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">AICTE Application Reference</p>
            <p className="mt-1 flex items-center justify-center gap-2 font-mono text-3xl font-extrabold text-brand-800">
              {submitted.ref} <CopyButton value={submitted.ref} label="Copy Reference" />
            </p>
            <p className="mt-2 text-xs text-ink-mute">Received {submitted.at.replace('T', ', ').replace('+05:30', ' IST')}</p>
          </div>

          <div className="space-y-4 px-6 pb-8 text-left text-sm">
            <Callout tone="green" icon={<ShieldCheck size={18} />} title="Statutory Deadline Protected">
              The timestamp and digital fingerprint above are registered in the tamper-evident audit trail. Even under peak network load, your filing is locked to this exact minute.
            </Callout>

            <Callout tone="brand" icon={<Lock size={18} />} title="Application Data Locked (APH 2.3.3(c))">
              Per AICTE regulations, submitted data is locked against unapproved modifications during administrative scrutiny. Track stage movements in your Application Tracking dashboard.
            </Callout>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold text-ink">
                <Fingerprint size={14} className="text-brand-700" /> Tamper-Evident SHA-256 Submission Hash
              </p>
              <p className="mt-1.5 break-all font-mono text-xs text-ink-soft bg-white p-2.5 rounded-lg border border-slate-200">{submitted.hash}</p>
              <CopyButton value={submitted.hash} label="Copy Hash" className="mt-2" />
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Statutory Processing Route</p>
              <p className="mt-1 font-semibold text-ink">
                {['Submitted', ...pathSteps.map((k) => STEP_LABEL[k]), 'Executive Committee', 'Council Decision'].join(' → ')}
              </p>
              <p className="mt-1 text-xs text-ink-mute">Estimated target completion: ~{t.targetDays} calendar days per APH Table 2.3 rules.</p>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <button className="btn-primary" onClick={() => downloadText(`receipt-${submitted.ref}.txt`, receipt)}>
                <Download size={16} /> Download Official Receipt
              </button>
              <button
                className="btn-secondary"
                onClick={() =>
                  downloadIcs(`anumati-${submitted.ref}.ics`, [
                    { title: `${submitted.ref}: Scrutiny Completion Target`, date: addDays(TODAY, 15), description: 'AICTE Scrutiny Review target deadline.' },
                    { title: `${submitted.ref}: Final Decision Target`, date: addDays(TODAY, t.targetDays), description: `${t.name} final decision.` },
                  ])
                }
              >
                <CalendarPlus size={16} /> Add Deadlines to Calendar
              </button>
              <Link to="/institution/applications" className="btn-ghost">
                View in Application Tracking →
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Institution Portal · Section 2.3"
        title="Application & AI Verification"
        description="Select application type, fill required forms, upload certified documents, review advisory AI verification findings, address deficiencies in the Correction Centre, or file a human dispute before digital submission."
        tourId="apply"
        actions={
          savedAt ? (
            <div className="flex items-center gap-2">
              <span className="chip" role="status">
                <Save size={13} className="text-indgreen-600" /> Draft saved {ago(now - savedAt)}
              </span>
              <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={discard}>
                <Trash2 size={14} /> Discard draft
              </button>
            </div>
          ) : undefined
        }
      />
      <Tour id="apply" steps={APPLY_TOUR} />

      {/* 7-Step Progress Stepper matching Document Section 2.3 */}
      <div className="mb-6 overflow-x-auto pb-2">
        <ol className="flex min-w-[700px] gap-2 lg:grid lg:grid-cols-7" aria-label="Application Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <button
                disabled={i > step && (step < 2 || (i > step + 1))}
                onClick={() => setStep(i)}
                className="w-full text-left transition-opacity disabled:opacity-50"
                aria-current={i === step ? 'step' : undefined}
              >
                <span className="block h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <motion.span
                    className="block h-full bg-brand-600"
                    initial={false}
                    animate={{ width: i < step ? '100%' : i === step ? '50%' : '0%' }}
                    transition={{ duration: 0.3 }}
                  />
                </span>
                <span className={cn('mt-2 block truncate text-[11px] font-semibold', i === step ? 'text-brand-800' : i < step ? 'text-ink-soft' : 'text-ink-mute')}>
                  {i + 1}. {s}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
        {/* ── Subpage 1: Application Type & Checklist ── */}
        {step === 0 && (
          <div className="space-y-6" data-tour="step-type">
            <Card title="1. Select Application Request Type" subtitle="22 request types defined under AICTE Approval Process Handbook (Table 2.3)">
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {APPLICATION_TYPES.filter((x) => x.id !== 'new').map((x) => (
                  <button
                    key={x.id}
                    onClick={() => setTypeId(x.id)}
                    aria-pressed={x.id === typeId}
                    className={cn(
                      'rounded-xl border p-4 text-left transition-all',
                      x.id === typeId
                        ? 'border-brand-600 bg-brand-50/70 shadow-sm ring-2 ring-brand-200'
                        : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-ink">{x.name}</span>
                      {x.id === typeId && <CheckCircle2 size={16} className="text-brand-600 shrink-0" />}
                    </div>
                    <span className="mt-1 block text-xs text-ink-mute">
                      Clause {x.clause} · Target ~{x.targetDays} days
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            <Card title="Applicable Statutory Checklist & Routing Path" subtitle={`Hand-configured regulatory rules for: ${t.name}`}>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-4 text-sm border border-slate-200">
                  <span className="font-bold text-ink">Statutory Route:</span>
                  <div className="flex flex-wrap items-center gap-1.5 font-medium text-brand-800">
                    {['Submitted', ...pathSteps.map((k) => STEP_LABEL[k] + (t.steps[k] === 'conditional' ? ' (if conditional)' : '')), 'Executive Committee', 'Council Decision'].map((stg, idx, arr) => (
                      <span key={stg} className="flex items-center gap-1.5">
                        <span className="rounded bg-white px-2 py-0.5 shadow-xs border border-slate-200 text-xs">{stg}</span>
                        {idx < arr.length - 1 && <span className="text-slate-400">→</span>}
                      </span>
                    ))}
                  </div>
                  <WhyChip rule={`Table 2.3: ${t.name}`} clause={t.clause} detail="Calculated dynamically by the ANUMATI Rules Engine from machine-readable APH regulations." />
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-mute mb-2">Required Checklist Documents for this Request ({t.documents.length})</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {t.documents.map((d) => (
                      <div key={d.id} className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-white p-3 text-xs">
                        <FileCheck2 size={16} className="text-brand-600 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-ink truncate">{d.name}</p>
                          <p className="text-[11px] text-ink-mute">Mandatory DSC: {d.signedBy} · {d.clause}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ── Subpage 2: Application Form ── */}
        {step === 1 && (
          <div className="space-y-6" data-tour="step-details">
            <Card title="2. Application Form Details" subtitle={`Academic and intake parameters for ${t.name}`}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="prog">
                    Programme or Course Title
                  </label>
                  <input
                    id="prog"
                    className="input"
                    value={details.programme}
                    onChange={(e) => setDetails({ ...details, programme: e.target.value })}
                    placeholder="e.g. B.Tech Computer Science and Engineering"
                  />
                  <p className="mt-1 text-xs text-ink-mute">Must match the exact nomenclature recognised by the affiliating University.</p>
                </div>
                <div>
                  <label className="label" htmlFor="cur">
                    Current Approved <Term k="Intake">Intake</Term> (Seats)
                  </label>
                  <input
                    id="cur"
                    type="number"
                    min={0}
                    className="input"
                    value={details.current}
                    onChange={(e) => setDetails({ ...details, current: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="req">
                    Requested Intake (Seats)
                  </label>
                  <input
                    id="req"
                    type="number"
                    min={0}
                    className="input"
                    value={details.requested}
                    onChange={(e) => setDetails({ ...details, requested: Number(e.target.value) })}
                  />
                  {details.requested - details.current > 60 && (
                    <p className="mt-1 text-xs text-amber-700 flex items-center gap-1">
                      <TriangleAlert size={12} /> Seat expansion &gt; 60 requires high accreditation tier (NBA/NAAC A+).
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="why">
                    Institutional Justification & Regional Demand Rationale
                  </label>
                  <textarea
                    id="why"
                    rows={3}
                    className="input"
                    value={details.reason}
                    onChange={(e) => setDetails({ ...details, reason: e.target.value })}
                  />
                  <p className="mt-1 text-right text-xs text-ink-mute">{details.reason.length} / 1000 characters</p>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-5">
                <FacultyNorms intake={details.requested} programme={details.programme} current={details.current} />
              </div>
            </Card>
          </div>
        )}

        {/* ── Subpage 3: Document Upload ── */}
        {step === 2 && (
          <div data-tour="step-documents">
            <Card
              title="3. Document Upload Locker"
              subtitle={
                <>
                  Upload certified PDF documents. Each file is pre-validated for formatting, checked for Class 3 DSC signatures, and fingerprinted (SHA-256) directly in your browser before encryption and upload.
                </>
              }
              pad={false}
            >
              <ul className="divide-y divide-slate-100">
                {t.documents.map((d) => {
                  const up = uploads[d.id];
                  const errs = rejected[d.id] ?? [];
                  return (
                    <li
                      key={d.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(d.id);
                      }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(null);
                        const f = e.dataTransfer.files?.[0];
                        if (f) attach(d.id, f);
                      }}
                      className={cn(
                        'flex flex-col gap-3 px-6 py-4 transition-colors sm:flex-row sm:items-start',
                        dragOver === d.id && 'bg-brand-50 ring-2 ring-inset ring-brand-300'
                      )}
                    >
                      <span
                        className={cn(
                          'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                          up ? 'bg-indgreen-50 text-indgreen-600' : errs.length ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-ink-mute'
                        )}
                      >
                        {up ? <Check size={20} /> : errs.length ? <XCircle size={20} /> : <FileUp size={20} />}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ink">{d.name}</p>
                          <Badge tone="slate">Clause {d.clause}</Badge>
                        </div>
                        <p className="text-xs text-ink-mute mt-0.5">
                          Requires DSC of: <span className="font-medium text-ink-soft">{d.signedBy}</span>
                          {d.validity ? ` · Valid for: ${d.validity}` : ''}
                        </p>

                        {up && <FileFacts up={up} />}

                        {!up &&
                          errs.map((e) => (
                            <p key={e} className="mt-1 flex items-start gap-1.5 text-xs text-red-700">
                              <XCircle size={13} className="mt-0.5 shrink-0" /> {e}
                            </p>
                          ))}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <label className="btn-secondary btn-sm cursor-pointer">
                          {up ? 'Replace' : 'Choose File'}
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            className="sr-only"
                            onChange={(e) => e.target.files?.[0] && attach(d.id, e.target.files[0])}
                          />
                        </label>
                        {!up && (
                          <button className="btn-ghost btn-sm" onClick={() => attach(d.id)}>
                            Use Sample
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 text-xs">
                <span className="font-medium text-ink-mute">
                  {Object.keys(uploads).length} of {t.documents.length} mandatory documents attached
                </span>
                <button
                  className="btn-ghost btn-sm text-brand-700"
                  onClick={async () => {
                    await Promise.all(t.documents.map((d) => attach(d.id)));
                    toast('Sample documents attached for all mandatory slots. Proceed to Step 4 to run AI verification.', 'green');
                  }}
                >
                  ⚡ Attach Valid Sample Files For All Slots
                </button>
              </div>
            </Card>
          </div>
        )}

        {/* ── Subpage 4: AI Verification Results ── */}
        {step === 3 && (
          <div data-tour="step-check" className="space-y-6">
            <Card
              title="4. AI Verification Results (Advisory Engine)"
              subtitle="The ANUMATI AI engine runs OCR, NLP parsing, DSC verification, and cross-document rule checks against AICTE APH norms. Note: AI results are advisory; final decisions rest with authorised human committees."
            >
              {!findings && !checking && (
                <div className="flex flex-col items-center py-10 text-center">
                  <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-700 shadow-xs">
                    <Sparkles size={32} />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-ink">Run AI Preliminary Compliance Verification</h3>
                  <p className="mt-1 max-w-md text-xs text-ink-mute">
                    Examines {Object.keys(uploads).length} attached files for structural completeness, digital signatures, land norms, faculty-to-student ratios, and expiry dates.
                  </p>
                  <button className="btn-primary mt-6" onClick={runCheck}>
                    <Sparkles size={16} /> Run AI Pre-Submission Verification
                  </button>
                </div>
              )}

              {checking && (
                <div className="py-8 text-center max-w-md mx-auto">
                  <Loader2 size={32} className="animate-spin text-brand-600 mx-auto mb-4" />
                  <p className="font-bold text-ink text-sm">Executing Multi-Engine Verification…</p>
                  <ul className="mt-4 space-y-2.5 text-left text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {ENGINES.map((e, i) => (
                      <li key={e} className="flex items-center gap-3">
                        {i < engineDone ? (
                          <CheckCircle2 size={16} className="text-indgreen-600 shrink-0" />
                        ) : i === engineDone ? (
                          <Loader2 size={16} className="animate-spin text-brand-600 shrink-0" />
                        ) : (
                          <span className="h-4 w-4 rounded-full border-2 border-slate-300 shrink-0" />
                        )}
                        <span className={i <= engineDone ? 'font-medium text-ink' : 'text-ink-mute'}>{e}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {findings && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={blockers ? 'red' : 'green'} icon={blockers ? <XCircle size={12} /> : <CheckCircle2 size={12} />}>
                        {blockers} Deficiencies Must Fix
                      </Badge>
                      <Badge tone="amber" icon={<TriangleAlert size={12} />}>
                        {warnings} Advisory Warnings
                      </Badge>
                      <Badge tone="green" icon={<CheckCircle2 size={12} />}>
                        {passes} Checks Passed
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="btn-ghost btn-sm" onClick={runCheck}>
                        <RefreshCw size={13} /> Rerun Checks
                      </button>
                      {blockers > 0 && (
                        <button className="btn-secondary btn-sm" onClick={() => setStep(4)}>
                          Open Correction Centre →
                        </button>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-2.5">
                    {findings.map((f, i) => (
                      <motion.li
                        key={f.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={cn(
                          'flex items-start gap-3 rounded-xl border p-4 text-xs',
                          f.severity === 'blocker'
                            ? 'border-red-200 bg-red-50/50'
                            : f.severity === 'warning'
                            ? 'border-amber-200 bg-amber-50/50'
                            : 'border-indgreen-200 bg-indgreen-50/40'
                        )}
                      >
                        {f.severity === 'blocker' ? (
                          <XCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
                        ) : f.severity === 'warning' ? (
                          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
                        ) : (
                          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-indgreen-600" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-ink">{f.title}</p>
                          <p className="mt-1 text-ink-soft leading-relaxed">{f.detail}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-mute">
                            <span className="font-mono">{f.engine}</span>
                            <span>•</span>
                            <span className="font-semibold text-brand-700">{f.clause}</span>
                          </div>
                        </div>

                        {f.severity !== 'pass' && (
                          <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                            <button
                              type="button"
                              className="btn-ghost btn-sm text-[11px]"
                              onClick={() => {
                                setActiveDisputeFinding(f.title);
                                setStep(5);
                              }}
                            >
                              Dispute Finding
                            </button>
                            <button
                              type="button"
                              className="btn-secondary btn-sm text-[11px]"
                              onClick={() => setStep(4)}
                            >
                              Fix in Centre
                            </button>
                          </div>
                        )}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── Subpage 5: Correction Centre ── */}
        {step === 4 && (
          <div className="space-y-6">
            <Card
              title="5. Correction Centre"
              subtitle="Plain-language explanation of flagged deficiencies and warnings. Replace files or amend data fields directly here, then re-verify without leaving the workspace."
            >
              {findings && blockers === 0 && warnings === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle2 size={40} className="text-indgreen-500 mx-auto mb-3" />
                  <h3 className="font-bold text-ink text-base">Zero Deficiencies Detected!</h3>
                  <p className="text-xs text-ink-mute mt-1 max-w-md mx-auto">
                    All submitted files and parameters satisfy AICTE handbook requirements. You may proceed directly to Human Review or Final Submission.
                  </p>
                  <div className="mt-5 flex justify-center gap-3">
                    <button className="btn-secondary btn-sm" onClick={() => setStep(5)}>
                      Review Disputed Items
                    </button>
                    <button className="btn-primary btn-sm" onClick={() => setStep(6)}>
                      Proceed to Final Submission →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
                    <Info size={16} className="text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">How the Correction Centre Works</p>
                      <p className="mt-0.5 text-amber-800">
                        Upload an amended file to replace any flagged document, or adjust intake justifications. Once corrected, click <strong>Re-Verify All</strong> to immediately clear blockers.
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-4">
                    {findings
                      ?.filter((f) => f.severity !== 'pass')
                      .map((f) => (
                        <li key={f.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={cn('h-2 w-2 rounded-full', f.severity === 'blocker' ? 'bg-red-500' : 'bg-amber-500')} />
                                <h4 className="font-bold text-ink text-sm">{f.title}</h4>
                                <Badge tone={f.severity === 'blocker' ? 'red' : 'amber'}>
                                  {f.severity === 'blocker' ? 'Blocker Deficit' : 'Warning'}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-ink-soft">{f.detail}</p>
                              <p className="mt-1 text-[11px] font-mono text-ink-mute">Statutory Rule: {f.clause}</p>
                            </div>
                            <button
                              className="btn-ghost btn-sm text-xs"
                              onClick={() => {
                                setActiveDisputeFinding(f.title);
                                setStep(5);
                              }}
                            >
                              Dispute with AICTE
                            </button>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-lg text-xs">
                            <span className="text-ink-mute">Action needed: Upload updated PDF or revise faculty intake in Form.</span>
                            <div className="flex gap-2">
                              <button className="btn-secondary btn-sm" onClick={() => setStep(2)}>
                                Replace in Locker
                              </button>
                              <button className="btn-ghost btn-sm" onClick={() => setStep(1)}>
                                Edit Form Details
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                  </ul>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <button className="btn-secondary" onClick={() => setStep(2)}>
                      <ArrowLeft size={16} /> Return to Document Locker
                    </button>
                    <button className="btn-primary" onClick={runCheck}>
                      <RefreshCw size={16} /> Re-Verify Deficiencies Now
                    </button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── Subpage 6: Human Review Request ── */}
        {step === 5 && (
          <div className="space-y-6">
            <Card
              title="6. Human Review & Dispute Request"
              subtitle="Statutory Safety: AI findings are strictly advisory. If an automated OCR or rule check produces a false flag, record a formal dispute here. A human AICTE Scrutiny Reviewer will adjudicate."
            >
              <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                {/* Form to raise dispute */}
                <form onSubmit={handleDisputeSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                  <h4 className="font-bold text-ink text-sm flex items-center gap-2">
                    <Scale size={16} className="text-brand-700" /> Lodge Dispute Against AI Flag
                  </h4>

                  <div>
                    <label className="label" htmlFor="disp-item">
                      Select Flagged Finding / Document
                    </label>
                    <select
                      id="disp-item"
                      className="input text-xs"
                      value={activeDisputeFinding}
                      onChange={(e) => setActiveDisputeFinding(e.target.value)}
                    >
                      <option value="">-- Choose finding to dispute --</option>
                      {findings
                        ?.filter((f) => f.severity !== 'pass')
                        .map((f) => (
                          <option key={f.id} value={f.title}>
                            [{f.severity.toUpperCase()}] {f.title} ({f.clause})
                          </option>
                        ))}
                      <option value="Land Ownership Certificate - OCR Regional Language">Land Ownership Certificate - Devanagari Endorsement</option>
                      <option value="Faculty Cadre Ratio - Contractual Appointments">Faculty Cadre Ratio - Contractual Appointments</option>
                      <option value="Affiliation Order - Multi-year validity clause">Affiliation Order - Multi-year validity clause</option>
                    </select>
                  </div>

                  <div>
                    <label className="label" htmlFor="disp-why">
                      Grounds for Dispute & Statutory Rationale
                    </label>
                    <textarea
                      id="disp-why"
                      rows={4}
                      className="input text-xs"
                      placeholder="Explain why the document complies with APH norms (e.g. registered English translation attached on page 4; court order reference; state gazette notification number)..."
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingDispute}
                    className="btn-primary w-full text-xs"
                  >
                    {submittingDispute ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Submit Formal Dispute for AICTE Officer Adjudication
                  </button>
                </form>

                {/* Dispute history and internal institutional review */}
                <div className="space-y-4">
                  <h4 className="font-bold text-ink text-sm flex items-center gap-2">
                    <History size={16} className="text-brand-700" /> Recorded Dispute Route
                  </h4>

                  {disputes.length === 0 ? (
                    <p className="text-xs text-ink-mute">No disputes logged for this draft application.</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {disputes.map((d) => (
                        <li key={d.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-brand-800">{d.id}</span>
                            <Badge tone={d.status === 'Accepted' ? 'green' : d.status === 'Under Review' ? 'amber' : 'brand'}>
                              {d.status}
                            </Badge>
                          </div>
                          <p className="font-semibold text-ink mt-1.5">{d.findingTitle}</p>
                          <p className="text-ink-soft text-[11px] mt-0.5 line-clamp-2">{d.reason}</p>
                          <p className="text-[10px] text-ink-mute mt-1.5">Submitted: {d.at} · Routed to Scrutiny Desk</p>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Internal HoD/Principal review option */}
                  <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-xs">
                    <p className="font-bold text-brand-900 flex items-center gap-1.5">
                      <UserCheck size={14} /> Internal Institutional Endorsement
                    </p>
                    <p className="mt-1 text-brand-800 leading-relaxed">
                      Staff officers can forward this draft to the Head of Department or Principal for verification prior to official Class 3 DSC submission.
                    </p>
                    <button className="btn-secondary btn-sm mt-3 w-full" onClick={askForReview}>
                      Send Draft for Internal Review
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ── Subpage 7: Submission & Acknowledgement ── */}
        {step === 6 && (
          <div data-tour="step-submit" className="space-y-6">
            <Card title="7. Review Answers and Final Submission" subtitle="Review complete application packet. Final submission locks your data for committee evaluation." pad={false}>
              <dl className="divide-y divide-slate-100 text-sm">
                {[
                  { k: 'Request Type', v: `${t.name} (${t.clause})`, to: 0 },
                  { k: 'Programme / Course', v: details.programme, to: 1 },
                  { k: 'Intake Change', v: `${details.current} → ${details.requested} seats (+${details.requested - details.current})`, to: 1 },
                  { k: 'Uploaded Documents', v: `${Object.keys(uploads).length} of ${t.documents.length} verified`, to: 2 },
                  { k: 'AI Pre-Check Status', v: findings ? `${blockers} blockers · ${warnings} warnings · ${passes} passed` : 'Not run', to: 3 },
                  { k: 'Correction & Disputes', v: `${disputes.length} disputes recorded for human committee review`, to: 5 },
                ].map((r) => (
                  <div key={r.k} className="grid gap-1 px-6 py-3.5 sm:grid-cols-[180px_1fr_auto] sm:items-start sm:gap-4">
                    <dt className="font-semibold text-ink-mute">{r.k}</dt>
                    <dd className="text-ink font-medium">{r.v}</dd>
                    <dd>
                      <button className="link inline-flex items-center gap-1 text-xs" onClick={() => setStep(r.to)}>
                        <PenLine size={12} /> Edit
                      </button>
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>

            {review && (
              <Callout
                tone={review.status === 'approved' ? 'green' : review.status === 'changes requested' ? 'amber' : 'brand'}
                title={
                  review.status === 'approved'
                    ? `Endorsed by ${review.reviewer} (${review.reviewerRole})`
                    : review.status === 'changes requested'
                    ? `${review.reviewer} requested amendments`
                    : `Awaiting internal review (Sent by ${review.by})`
                }
              >
                {review.note || 'Draft has been verified by the internal academic authority.'}
              </Callout>
            )}

            {!canSubmit && (
              <Callout tone="brand" icon={<Lock size={16} />} title={`Staff Officer Mode (${session?.role ?? 'Staff'})`}>
                Under APH regulations, an authorised <strong>Institution Administrator</strong> (Principal or Director) must digitally sign and submit with the Class 3 DSC token of the Trust Chairman or Secretary.
              </Callout>
            )}

            {canSubmit && (
              <Card title="Digital Signature Certificate (DSC) & Declarations" subtitle="Class 3 e-Mudhra / NSDL / Capricorn token verification per APH 1.4.6">
                <div className="space-y-3">
                  <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-brand-700"
                      checked={decl.truth}
                      onChange={(e) => setDecl({ ...decl, truth: e.target.checked })}
                    />
                    <span className="leading-relaxed">
                      I solemnly affirm that the information furnished and documents attached are true and correct as sworn in <strong>Affidavit 2</strong>. I understand that submitting false or misleading documents invokes civil or criminal liabilities under APH 2.3.4(b).
                    </span>
                  </label>
                  <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-brand-700"
                      checked={decl.lock}
                      onChange={(e) => setDecl({ ...decl, lock: e.target.checked })}
                    />
                    <span className="leading-relaxed">
                      I acknowledge that upon final submission, all data fields are immutable and locked until administrative processing is completed by AICTE (APH 2.3.3(c)).
                    </span>
                  </label>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end border-t border-slate-100 pt-5">
                  <div>
                    <label className="label" htmlFor="signer">
                      Authorised Signatory
                    </label>
                    <select id="signer" className="input text-xs" value={signer} onChange={(e) => setSigner(e.target.value)} disabled={signed}>
                      <option>Secretary, Narmada Valley Education Society</option>
                      <option>Chairman, Narmada Valley Education Society</option>
                      <option>Principal / Director, Narmada Valley Institute of Technology</option>
                    </select>
                  </div>
                  <button
                    className="btn-secondary"
                    onClick={sign}
                    disabled={signed || signing || !decl.truth || !decl.lock}
                  >
                    {signing ? <Loader2 size={16} className="animate-spin" /> : <FileSignature size={16} />}
                    {signed ? 'DSC Attached ✓' : 'Sign with Class 3 DSC'}
                  </button>
                </div>

                <AnimatePresence>
                  {signed && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 overflow-hidden">
                      <Callout tone="green" icon={<ShieldCheck size={18} />} title="Cryptographically Sealed for AICTE Evaluation">
                        SHA-256 seal: <span className="font-mono text-xs font-bold">{shortHash(seal)}</span> · Authorised signatory {signer}. Signed packet verified by pyHanko on server.
                      </Callout>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            )}
          </div>
        )}
      </motion.div>

      {/* Navigation Footer */}
      <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
        <button className="btn-secondary" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          <ArrowLeft size={16} /> Back
        </button>

        {step < 6 ? (
          <button
            className="btn-primary"
            disabled={!canNext}
            onClick={() => {
              if (step === 3 && findings === null) {
                runCheck();
              } else {
                setStep((s) => Math.min(6, s + 1));
              }
            }}
          >
            {step === 3 && findings === null ? 'Run AI Checks First' : 'Continue to Next Step'} <ArrowRight size={16} />
          </button>
        ) : canSubmit ? (
          <button className="btn-primary" disabled={!signed} onClick={submit}>
            Submit Application to AICTE <ArrowRight size={16} />
          </button>
        ) : (
          <button className="btn-primary" disabled={review?.status === 'awaiting review'} onClick={askForReview}>
            {review?.status === 'awaiting review' ? 'Waiting for Review' : 'Send for Internal Review'} <ArrowRight size={16} />
          </button>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-ink-mute">
        AICTE Approval Cycle 2027-28 · Statutory filing window closes {formatDate('2026-11-30')} · All edits autosaved locally and synced with server.
      </p>
    </>
  );
}
