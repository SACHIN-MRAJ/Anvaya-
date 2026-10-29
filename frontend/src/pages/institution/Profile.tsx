import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  CheckCircle2,
  Gavel,
  GraduationCap,
  History,
  IdCard,
  PenLine,
  Plus,
  ShieldCheck,
  UserCheck,
  UserRoundX,
  Users,
} from 'lucide-react';
import { useAsync } from '../../lib/useAsync';
import { may, useSession } from '../../lib/session';
import { ApiError } from '../../services/api';
import {
  addLeader,
  endLeader,
  getProfile,
  getSeatMatrix,
  saveProfile,
  type Leader,
} from '../../services/records';
import { Badge, Callout, Card, LoadingRows, Modal, PageHeader, toast } from '../../components/ui';
import { KeyValue, Pending, ReadOnlyNote } from '../../components/records-ui';
import { formatDate, formatDateTime, TODAY } from '../../lib/utils';
import { shortHash } from '../../lib/hash';
import { regionName } from '../../data/institutions';
import { Link } from 'react-router-dom';

/* ── Tab definitions matching Document Section 2.2 ── */
const TABS = [
  { id: 'details',  label: 'Institution Details',                 icon: <Building2 size={15} /> },
  { id: 'reps',     label: 'Authorised Representatives & Users',  icon: <Users size={15} /> },
  { id: 'courses',  label: 'Courses & Approved Intake',           icon: <GraduationCap size={15} /> },
  { id: 'history',  label: 'Institution & Approval History',      icon: <History size={15} /> },
] as const;
type TabId = (typeof TABS)[number]['id'];

const POSITIONS = [
  'Chairman of the Trust',
  'Secretary of the Trust',
  'Principal / Director',
  'Head of Department',
  'Trustee',
  'Registrar',
];
const SIGNERS = ['Chairman of the Trust', 'Secretary of the Trust', 'Principal / Director'];

export default function Profile() {
  const { session } = useSession();
  const canEdit = may(session, 'profile');
  const [activeTab, setActiveTab] = useState<TabId>('details');
  const { data, loading, reload } = useAsync(getProfile);
  const seats = useAsync(getSeatMatrix);
  const [edit, setEdit] = useState<Record<string, string> | null>(null);
  const [leader, setLeader] = useState<Omit<Leader, 'id' | 'until'> | null>(null);
  const [busy, setBusy] = useState(false);

  if (!data) return <Pending loading={loading} what="The institution profile" />;
  const { institution: inst, profile, fields } = data;
  const currentLeaders = data.leaders.filter((l) => !l.until);
  const pastLeaders = data.leaders.filter((l) => l.until);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      reload();
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not save. Please try again.', 'red');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={`AICTE Permanent ID: ${inst.aicteId} · Institutional Master Record`}
        title="Institutional Profile"
        description="Maintain institutional identity, contacts, approved courses, and authorised representatives with immutable change history."
        actions={
          canEdit && activeTab === 'details' ? (
            <button
              className="btn-primary"
              onClick={() => setEdit(Object.fromEntries(Object.keys(fields).map((k) => [k, String(profile[k] ?? '')])))}
            >
              <PenLine size={16} /> Edit Details
            </button>
          ) : undefined
        }
      />

      {!canEdit && (
        <div className="mb-6">
          <ReadOnlyNote who="Institution Administrator / Principal" what="The profile, signatories and institutional records" />
        </div>
      )}

      {/* Regulatory Action Alert if present */}
      {data.actions.length > 0 && (
        <div className="mb-6 space-y-2">
          {data.actions.map((a) => (
            <Callout key={a.id} tone="red" icon={<Gavel size={16} />} title={`${a.kind} from AICTE (${formatDate(a.decidedAt)})`}>
              {a.detail} <span className="text-ink-mute">Reason: {a.reason.split('\n')[0]}</span>
            </Callout>
          ))}
        </div>
      )}

      {/* ── Subpage Navigation Tabs (Section 2.2) ────────────────────── */}
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
            </button>
          );
        })}
      </div>

      {/* ── SUBPAGE 1: INSTITUTION DETAILS ─────────────────────────── */}
      {activeTab === 'details' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card title={inst.name} subtitle={`Established ${inst.established} · ${regionName(inst.region)} Regional Office`} className="lg:col-span-2">
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                <KeyValue label="Trust or Society">{inst.trust}</KeyValue>
                <KeyValue label="Institution Category">{inst.category}</KeyValue>
                <KeyValue label="Permanent AICTE ID">{inst.aicteId}</KeyValue>
                <KeyValue label="City & State">{inst.city}, {inst.state}</KeyValue>
                <KeyValue label="Sanctioned Intake">{inst.intake} seats</KeyValue>
                <KeyValue label="Land Ownership">{inst.land} (Registered)</KeyValue>
              </dl>
              <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap gap-2 text-xs text-ink-mute">
                <span className="inline-flex items-center gap-1 rounded-md bg-indgreen-50 px-2 py-1 font-semibold text-indgreen-700">
                  <ShieldCheck size={14} /> AICTE Recognized Baseline
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-medium text-ink">
                  GPS Coordinates: {inst.lat?.toFixed(4)}, {inst.lng?.toFixed(4)}
                </span>
              </div>
            </Card>

            <Card title="Trust & Contact Info" subtitle="Official communication channels">
              <dl className="space-y-3 text-xs">
                {Object.entries(fields).map(([k, label]) => (
                  <div key={k} className="border-b border-slate-50 pb-2">
                    <dt className="text-ink-mute font-medium">{label}</dt>
                    <dd className="font-semibold text-ink break-words">{profile[k] || '—'}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>
        </motion.div>
      )}

      {/* ── SUBPAGE 2: AUTHORISED REPRESENTATIVES & USERS ───────────── */}
      {activeTab === 'reps' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card
            title="Authorised Signatories & Leadership"
            subtitle="Under APH 1.4.6, submissions require the Digital Signature Certificate (DSC) of the Chairman or Secretary of the Trust."
            action={
              canEdit && (
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => setLeader({ name: '', position: 'Principal / Director', department: '', email: '', isSignatory: false, since: TODAY })}
                >
                  <Plus size={14} /> Add Representative
                </button>
              )
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-ink-mute">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Designation</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">DSC Signatory Status</th>
                    <th className="p-3">Term Since</th>
                    {canEdit && <th className="p-3 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentLeaders.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-bold text-ink">{l.name}</td>
                      <td className="p-3">{l.position}</td>
                      <td className="p-3 text-ink-mute">{l.department || 'Institutional'}</td>
                      <td className="p-3 font-mono text-ink-soft">{l.email || '—'}</td>
                      <td className="p-3">
                        {l.isSignatory ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-indgreen-50 px-2 py-0.5 font-bold text-indgreen-700">
                            <CheckCircle2 size={12} /> DSC Signatory (APH 1.4.6)
                          </span>
                        ) : (
                          <span className="text-ink-mute">Institutional Representative</span>
                        )}
                      </td>
                      <td className="p-3 text-ink-mute">{formatDate(l.since)}</td>
                      {canEdit && (
                        <td className="p-3 text-right">
                          <button
                            onClick={() => run(() => endLeader(l.id), 'Representative term ended.')}
                            className="text-red-600 hover:text-red-800 font-semibold"
                          >
                            End Term
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pastLeaders.length > 0 && (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-mute mb-3">Past Representatives History</h4>
                <div className="divide-y divide-slate-100 text-xs">
                  {pastLeaders.map((l) => (
                    <div key={l.id} className="py-2 flex items-center justify-between text-ink-mute">
                      <span><strong>{l.name}</strong> ({l.position})</span>
                      <span>{formatDate(l.since)} &mdash; {l.until ? formatDate(l.until) : 'Ended'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 3: COURSES & APPROVED INTAKE ─────────────────────── */}
      {activeTab === 'courses' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card
            title="Approved Programmes & Seat Matrix"
            subtitle="AICTE sanctioned intake, course duration, accreditation status, and faculty requirements per department."
            action={
              <Link to="/institution/courses" className="btn-secondary btn-sm">
                Simulate Seat Change &rarr;
              </Link>
            }
          >
            {seats.loading ? (
              <LoadingRows rows={4} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-ink-mute">
                    <tr>
                      <th className="p-3">Department</th>
                      <th className="p-3">Course / Programme</th>
                      <th className="p-3">Level</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3">Approved Intake</th>
                      <th className="p-3">Accreditation</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(seats.data?.programmes ?? []).map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-ink">{p.department}</td>
                        <td className="p-3 font-bold text-brand-900">{p.name}</td>
                        <td className="p-3"><Badge tone="slate">{p.level}</Badge></td>
                        <td className="p-3 text-ink-mute">{p.durationYears} Years</td>
                        <td className="p-3 font-bold tabular-nums text-ink">{p.approvedIntake} seats</td>
                        <td className="p-3">
                          {p.accreditation?.body ? (
                            <span className="inline-flex items-center gap-1 rounded bg-indgreen-50 px-2 py-0.5 font-bold text-indgreen-700">
                              {p.accreditation.body} (valid until {p.accreditation.validUntil})
                            </span>
                          ) : (
                            <span className="text-ink-mute">Not Accredited</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-indgreen-700 font-bold">
                            <CheckCircle2 size={13} /> {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 4: INSTITUTION & APPROVAL HISTORY ─────────────────── */}
      {activeTab === 'history' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Official Approval History" subtitle="Chronological archive of past decisions issued by AICTE.">
              <div className="divide-y divide-slate-100 text-xs">
                {[
                  { cycle: '2026-27', decision: 'Extension of Approval (EoA)', ref: 'AICTE/CRO/INS-001/2026-27/EOA', date: '2026-06-15', outcome: 'Approved' },
                  { cycle: '2025-26', decision: 'Extension of Approval (EoA)', ref: 'AICTE/CRO/INS-001/2025-26/EOA', date: '2025-05-20', outcome: 'Approved' },
                  { cycle: '2024-25', decision: 'New Course Approval (CSE-AI&ML)', ref: 'AICTE/CRO/INS-001/2024-25/NC', date: '2024-06-10', outcome: 'Approved' },
                  { cycle: '2023-24', decision: 'Extension of Approval (EoA)', ref: 'AICTE/CRO/INS-001/2023-24/EOA', date: '2023-05-18', outcome: 'Approved' },
                ].map((h, i) => (
                  <div key={i} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-ink">{h.decision} &mdash; Cycle {h.cycle}</p>
                      <p className="font-mono text-[11px] text-ink-mute mt-0.5">{h.ref}</p>
                    </div>
                    <div className="text-right">
                      <span className="rounded-md bg-indgreen-100 px-2 py-0.5 font-bold text-indgreen-800">
                        {h.outcome}
                      </span>
                      <p className="text-[10px] text-ink-mute mt-1">{formatDate(h.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Profile Audit & Evidence Chain" subtitle="Cryptographic hash log of field changes on this institutional record.">
              {data.history.length === 0 ? (
                <p className="p-4 text-xs text-ink-mute">No recorded modifications in current cycle.</p>
              ) : (
                <div className="space-y-3 text-xs">
                  {data.history.slice(0, 5).map((e, idx) => (
                    <div key={e.hash ?? idx} className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                      <div className="flex items-center justify-between text-ink-mute text-[11px]">
                        <span>{formatDateTime(e.at)}</span>
                        <span>{e.actor} {e.role ? `(${e.role})` : ''}</span>
                      </div>
                      <p className="mt-1 font-semibold text-ink">{e.action}</p>
                      {e.note && <p className="text-[11px] text-ink-soft mt-0.5">{e.note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </motion.div>
      )}

      {/* ── Modal: Edit Profile Details ── */}
      {edit && (
        <Modal open={!!edit} title="Edit Institutional Contact Details" onClose={() => setEdit(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => saveProfile(edit), 'Institutional profile updated.').then((ok) => ok && setEdit(null));
            }}
            className="space-y-4 text-xs"
          >
            {Object.entries(fields).map(([k, label]) => (
              <div key={k}>
                <label className="block font-semibold text-ink mb-1">{label}</label>
                <input
                  type={k.includes('email') ? 'email' : 'text'}
                  value={edit[k] ?? ''}
                  onChange={(ev) => setEdit({ ...edit, [k]: ev.target.value })}
                  className="input w-full"
                  required={k.includes('email') || k.includes('phone') || k.includes('address')}
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-3">
              <button type="button" onClick={() => setEdit(null)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-primary">
                {busy ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Add Representative ── */}
      {leader && (
        <Modal open={!!leader} title="Add Authorised Representative" onClose={() => setLeader(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => addLeader(leader), 'Authorised representative added.').then((ok) => ok && setLeader(null));
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="block font-semibold text-ink mb-1">Full Name</label>
              <input
                type="text"
                value={leader.name}
                onChange={(e) => setLeader({ ...leader, name: e.target.value })}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-ink mb-1">Position / Title</label>
              <select
                value={leader.position}
                onChange={(e) => setLeader({ ...leader, position: e.target.value, isSignatory: SIGNERS.includes(e.target.value) })}
                className="input w-full"
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-ink mb-1">Department</label>
              <input
                type="text"
                value={leader.department}
                onChange={(e) => setLeader({ ...leader, department: e.target.value })}
                className="input w-full"
                placeholder="e.g. Administration / Management"
              />
            </div>
            <div>
              <label className="block font-semibold text-ink mb-1">Email Address</label>
              <input
                type="email"
                value={leader.email}
                onChange={(e) => setLeader({ ...leader, email: e.target.value })}
                className="input w-full"
                required
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="signatory"
                checked={leader.isSignatory}
                onChange={(e) => setLeader({ ...leader, isSignatory: e.target.checked })}
                className="rounded border-slate-300"
              />
              <label htmlFor="signatory" className="font-semibold text-ink">
                Authorised DSC Signatory for AICTE Submissions (APH 1.4.6)
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button type="button" onClick={() => setLeader(null)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-primary">
                {busy ? 'Adding...' : 'Add Representative'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
