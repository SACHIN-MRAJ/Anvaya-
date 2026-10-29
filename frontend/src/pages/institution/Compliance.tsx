import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  FileCheck,
  FileText,
  FileUp,
  Inbox,
  Landmark,
  ListChecks,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  XCircle,
} from 'lucide-react';
import { useAsync } from '../../lib/useAsync';
import {
  ApiError,
  attachEvidence,
  getNotifications,
  getObligations,
  uploadDocument,
} from '../../services/api';
import { preflight } from '../../lib/files';
import { DEMO_INSTITUTION } from '../../data/institutions';
import { ESCALATION_LADDER } from '../../data/rules';
import {
  Badge,
  Card,
  LoadingRows,
  Modal,
  ObligationBadge,
  PageHeader,
  WhyChip,
  toast,
} from '../../components/ui';
import { Tour } from '../../components/live';
import { COMPLIANCE_TOUR } from '../../data/tours';
import { daysBetween, formatDate, formatDateTime, TODAY } from '../../lib/utils';
import type { Obligation } from '../../types';

/* ── Tab definitions matching Document Section 2.6 ── */
const TABS = [
  { id: 'inbox',     label: 'Deficiency Inbox',               icon: <Inbox size={15} /> },
  { id: 'evidence',  label: 'Compliance Evidence Submission', icon: <FileUp size={15} /> },
  { id: 'status',    label: 'Compliance Verification Status', icon: <FileCheck size={15} /> },
  { id: 'notifs',    label: 'Notifications & Messages',       icon: <Bell size={15} /> },
  { id: 'renewals',  label: 'Undertakings & Renewals',        icon: <Calendar size={15} /> },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function InstCompliance() {
  const inst = DEMO_INSTITUTION;
  const [activeTab, setActiveTab] = useState<TabId>('inbox');
  const { data, loading, reload } = useAsync(() => getObligations(inst.id));
  const notifs = useAsync(getNotifications);
  const [upload, setUpload] = useState<Obligation | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sent, setSent] = useState<Record<string, string>>({});

  const rows = (data ?? []).map((o) => (sent[o.id] && !o.evidence ? { ...o, evidence: sent[o.id] } : o));

  const submitEvidence = async () => {
    if (!upload || !file) return;
    setBusy(true);
    try {
      const check = await preflight(file);
      if (check.errors.length) {
        toast(check.errors[0], 'red');
        return;
      }
      const doc = await uploadDocument(file, file.name, 'evidence');
      const updated = doc ? await attachEvidence(upload.id, doc.id) : null;
      setSent((m) => ({ ...m, [upload.id]: file.name }));
      if (updated) reload();
      toast('Compliance evidence submitted. AICTE will review and verify.', 'green');
      setUpload(null);
      setFile(null);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not submit evidence.', 'red');
    } finally {
      setBusy(false);
    }
  };

  const leaseYears = inst.leaseEnd
    ? (new Date(inst.leaseEnd).getTime() - new Date(TODAY).getTime()) / (365.25 * 86_400_000)
    : 99;
  const runway = leaseYears - inst.longestCourseYears;

  return (
    <>
      <PageHeader
        eyebrow="Compliance & Regulatory Oversight"
        title="Compliance & Notifications"
        description="Help institutions respond to official requirements, submit evidence, and meet continuing compliance obligations."
        tourId="compliance"
      />
      <Tour id="compliance" steps={COMPLIANCE_TOUR} />

      {/* ── Subpage Navigation Tabs (Section 2.6) ────────────────────── */}
      <div className="mb-6 flex overflow-x-auto rounded-2xl bg-slate-100/80 p-1.5 shadow-inner">
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold transition-all sm:text-sm ${
                active
                  ? 'bg-white text-brand-900 shadow-card'
                  : 'text-ink-mute hover:bg-white/40 hover:text-ink'
              }`}
            >
              <span className={active ? 'text-brand-600' : 'text-slate-400'}>{t.icon}</span>
              {t.label}
              {t.id === 'inbox' && rows.filter((r) => r.status === 'Due soon' || r.status === 'Overdue').length > 0 && (
                <span className="grid h-4 w-4 place-items-center rounded-full bg-red-500 text-[10px] text-white">
                  {rows.filter((r) => r.status === 'Due soon' || r.status === 'Overdue').length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── SUBPAGE 1: DEFICIENCY INBOX ─────────────────────────────── */}
      {activeTab === 'inbox' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
          <Card title="Official Deficiency Inbox" subtitle="Deficiencies raised during scrutiny, inspection or compliance monitoring.">
            {loading ? (
              <LoadingRows rows={3} />
            ) : rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-ink-mute">No deficiencies recorded for this institution.</p>
            ) : (
              <div className="space-y-3">
                {rows.map((o) => (
                  <div key={o.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between border-slate-200 bg-white">
                    <div className="flex items-start gap-3">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${o.status === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        <AlertTriangle size={18} />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-brand-900">{o.id}</span>
                          <ObligationBadge status={o.status} />
                          <span className="text-xs text-ink-mute">Clause: {o.clause}</span>
                        </div>
                        <h4 className="font-display text-sm font-bold text-ink mt-1">{o.title}</h4>
                        <p className="text-xs text-ink-mute mt-0.5">Source: {o.source} · Due on {formatDate(o.dueOn)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setUpload(o);
                          setActiveTab('evidence');
                        }}
                        className="btn-primary btn-sm"
                      >
                        Submit Evidence &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 2: COMPLIANCE EVIDENCE SUBMISSION ────────────────── */}
      {activeTab === 'evidence' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="max-w-2xl mx-auto space-y-6">
          <Card title="Submit Compliance Evidence" subtitle="Attach proofs, receipts, revised certificates and affidavits mapped directly to a deficiency requirement.">
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-ink mb-1">Target Deficiency / Condition</label>
                <select
                  value={upload?.id ?? rows[0]?.id ?? ''}
                  onChange={(e) => {
                    const sel = rows.find((r) => r.id === e.target.value);
                    if (sel) setUpload(sel);
                  }}
                  className="input w-full"
                >
                  {rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id}: {r.title} (Due: {formatDate(r.dueOn)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-brand-500 transition-colors bg-slate-50/50">
                <FileUp size={36} className="mx-auto text-slate-400 mb-2" />
                <p className="font-semibold text-ink text-sm">Select PDF Proof Document</p>
                <p className="text-ink-mute mt-1 text-[11px]">Clear scan or digitally signed PDF required.</p>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="mt-4 block mx-auto text-xs"
                />
              </div>

              {file && (
                <div className="rounded-xl bg-indgreen-50 p-3 text-xs text-indgreen-900 border border-indgreen-200">
                  <p className="font-bold">Attached: {file.name}</p>
                  <p className="text-[11px] text-indgreen-700 mt-0.5">Size: {(file.size / 1024).toFixed(1)} KB</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setUpload(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitEvidence}
                  disabled={busy || !file}
                  className="btn-primary"
                >
                  {busy ? 'Uploading & Fingerprinting...' : 'Submit Evidence'}
                </button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 3: COMPLIANCE VERIFICATION STATUS ─────────────────── */}
      {activeTab === 'status' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card title="Compliance Verification Status" subtitle="Audit trail showing officer reviews, acceptances and conditions marked as Met.">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-ink-mute">
                  <tr>
                    <th className="p-3">Ref ID</th>
                    <th className="p-3">Condition / Obligation</th>
                    <th className="p-3">Submitted Evidence</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">Verification Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono font-bold text-brand-900">{o.id}</td>
                      <td className="p-3">
                        <p className="font-semibold text-ink">{o.title}</p>
                        <p className="text-[11px] text-ink-mute">Clause: {o.clause}</p>
                      </td>
                      <td className="p-3 text-ink-mute">
                        {o.evidence ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-ink font-semibold">
                            <FileText size={12} className="text-brand-600" /> {o.evidence}
                          </span>
                        ) : (
                          <span className="text-slate-400">None uploaded</span>
                        )}
                      </td>
                      <td className="p-3 text-ink-soft">{formatDate(o.dueOn)}</td>
                      <td className="p-3">
                        <ObligationBadge status={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 4: NOTIFICATIONS & MESSAGES ───────────────────────── */}
      {activeTab === 'notifs' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card title="Unified Regulatory Notification Feed" subtitle="Official circulars, scrutiny communications and hearing reminders.">
            <div className="divide-y divide-slate-100">
              {(notifs.data ?? [
                { id: 1, title: 'Fire safety certificate expires in 17 days', createdAt: 'Today 09:00', tone: 'amber', read: false },
                { id: 2, title: 'Action needed on ANU-2026-0398: upload university NOC', createdAt: '2 days ago', tone: 'red', read: false },
                { id: 3, title: 'EVC inspection panel confirmed for ANU-2026-0412', createdAt: '5 days ago', tone: 'green', read: true },
              ]).map((n, i) => (
                <div key={i} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-slate-300' : 'bg-brand-600 animate-pulse'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${n.read ? 'text-ink-soft' : 'font-bold text-ink'}`}>{n.title}</p>
                    <p className="text-[11px] text-ink-mute mt-0.5">{n.createdAt}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 5: UNDERTAKINGS & RENEWALS ───────────────────────── */}
      {activeTab === 'renewals' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Tracked Undertakings & Commitments" subtitle="Conditions promised by the trust at the time of initial approval.">
              <div className="space-y-3 text-xs">
                {[
                  { promise: 'Appoint 6 additional faculty members in CSE (AI & ML) before 15 July 2027', due: '2027-07-15', clause: 'APH Annexure-1', status: 'On track' },
                  { promise: 'Complete registration of 30-year land lease deed before 30 June 2027', due: '2027-06-30', clause: 'APH 2.1(e)', status: 'Due soon' },
                  { promise: 'Procure 1,200 additional library volumes before semester commencement', due: '2027-08-01', clause: 'APH Ch. VI', status: 'On track' },
                ].map((u, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink">{u.promise}</span>
                      <span className="rounded bg-indgreen-100 px-2 py-0.5 text-[10px] font-bold text-indgreen-800">{u.status}</span>
                    </div>
                    <p className="text-[11px] text-ink-mute mt-1.5">Due Date: {formatDate(u.due)} · Clause: {u.clause}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Lease Runway Radar" subtitle="Land lease duration vs longest course duration (APH 2.1(e)).">
              <div className="p-4 text-center">
                <div className="inline-block rounded-2xl bg-amber-50 p-4 border border-amber-200">
                  <Landmark size={32} className="mx-auto text-amber-700 mb-2" />
                  <p className="text-2xl font-black text-ink">{leaseYears.toFixed(1)} Years</p>
                  <p className="text-xs text-ink-mute">Remaining Lease Runway</p>
                </div>
                <p className="mt-4 text-xs text-ink-mute leading-relaxed">
                  Approval Process Handbook mandates that registered lease deeds must remain valid for a minimum of the duration of the longest approved course.
                </p>
              </div>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Modal for evidence upload */}
      {upload && (
        <Modal open={!!upload} title={`Attach Proof for ${upload.id}`} onClose={() => setUpload(null)}>
          <div className="space-y-4 text-xs">
            <p className="text-ink font-semibold">{upload.title}</p>
            <p className="text-ink-mute">Clause: {upload.clause} · Due: {formatDate(upload.dueOn)}</p>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="input w-full text-xs"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setUpload(null)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={submitEvidence} disabled={busy || !file} className="btn-primary">
                {busy ? 'Submitting...' : 'Upload & Send to AICTE'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
