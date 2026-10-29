import { type ReactNode, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, Calendar, CheckCircle2, ChevronDown, ChevronRight, ChevronUp,
  Download, FileText, Loader2, PlusCircle, Scale, Shield, Users, XCircle,
} from 'lucide-react';
import { Badge, Card, CountUp, LoadingRows, PageHeader } from '../../components/ui';
import { useResource } from '../../lib/resource';
import { getApplications, getDashboardStats } from '../../services/api';
import { INSTITUTIONS } from '../../data/institutions';
import { STAGE_LABEL } from '../../data/applications';
import { typeById } from '../../data/rules';
import { cn, daysBetween, formatDate, TODAY } from '../../lib/utils';

const instName = (id: string) => INSTITUTIONS.find(i => i.id === id)?.name ?? id;

const TABS = ['SHC Dashboard & Case Queue', 'Compliance, Deficiency & Show-Cause Review', 'Hearing Records & Proceedings', 'Recommendations & Reports'] as const;
type Tab = typeof TABS[number];

/* ── Hardcoded sample data for sections without a dedicated API ── */
const SHOW_CAUSE = [
  { id: 'SCN-2026-001', inst: 'Sunrise Technical Institute', appId: 'ANU-2026-0391', date: '2026-10-05', response: true },
  { id: 'SCN-2026-002', inst: 'Western Plateau Tech',         appId: 'ANU-2026-0420', date: '2026-10-12', response: false },
];

const EVIDENCE = [
  { doc: 'Security deposit proof (revised)',     appId: 'ANU-2026-0391', deficiency: 'DEF-001', uploaded: '2026-10-18', status: 'Pending'   as const },
  { doc: 'Faculty appointment letters bundle',  appId: 'ANU-2026-0405', deficiency: 'DEF-003', uploaded: '2026-10-15', status: 'Accepted'  as const },
  { doc: 'Lab equipment purchase orders',       appId: 'ANU-2026-0412', deficiency: 'DEF-004', uploaded: '2026-10-20', status: 'Pending'   as const },
  { doc: 'Land ownership clarification affidavit', appId: 'ANU-2026-0391', deficiency: 'DEF-002', uploaded: '2026-10-17', status: 'Rejected' as const },
];

type EvidenceStatus = 'Accepted' | 'Pending' | 'Rejected';
type RecOutcome    = 'Approve' | 'Reject' | 'Conditional';

const RECS: { appId: string; inst: string; summary: string; unresolved: string[]; outcome: RecOutcome; draft: boolean }[] = [
  {
    appId: 'ANU-2026-0391', inst: 'Sunrise Technical Institute',
    summary: 'Institution addressed 4 of 5 deficiencies. Security deposit remains outstanding. Hearing completed 25 Oct 2026.',
    unresolved: ['Security deposit (APH 2.18)', 'Land ownership clarity (APH 2.11)'],
    outcome: 'Conditional', draft: true,
  },
];

const SUBMITTED_REPORTS = [
  { appId: 'ANU-2026-0405', outcome: 'Approve',      date: '2026-10-22' },
  { appId: 'ANU-2026-0398', outcome: 'Reject',       date: '2026-10-10' },
  { appId: 'ANU-2026-0385', outcome: 'Conditional',  date: '2026-09-28' },
];

/* ── Helpers ── */
function urgencyChip(daysLeft: number) {
  if (daysLeft < 0) return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Overdue {Math.abs(daysLeft)}d</span>;
  if (daysLeft <= 7) return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Due in {daysLeft}d</span>;
  return <span className="rounded-full bg-indgreen-50 px-2 py-0.5 text-[10px] font-bold text-indgreen-700">On track · {daysLeft}d</span>;
}

function evStatusChip(s: EvidenceStatus) {
  return s === 'Accepted' ? <span className="rounded-full bg-indgreen-50 px-2 py-0.5 text-[10px] font-semibold text-indgreen-700">Accepted</span>
    : s === 'Rejected'   ? <span className="rounded-full bg-red-100   px-2 py-0.5 text-[10px] font-semibold text-red-700">Rejected</span>
    :                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Pending</span>;
}

function outcomeTone(o: string): 'green' | 'red' | 'amber' | 'brand' {
  if (o === 'Approve' || o === 'Ratified') return 'green';
  if (o === 'Reject')                      return 'red';
  return 'amber';
}

/* ── Collapsible section ── */
function Section({ title, count, children, defaultOpen = true }: {
  title: string; count?: number; children: ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-neutral-200 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-neutral-50/80 hover:bg-neutral-100 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-ink">
          {title}
          {count !== undefined && (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-700">{count}</span>
          )}
        </span>
        <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} className="text-neutral-400" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 py-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Hearing card ── */
function HearingCard({ appId, institution, date, time, completed, index }: {
  appId: string; institution: string; date: string; time: string; completed: boolean; index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [checks, setChecks]     = useState([false, false, false]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-4">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            completed ? 'bg-indgreen-50 text-indgreen-600' : 'bg-brand-50 text-brand-600')}>
            {completed ? <CheckCircle2 size={18} /> : <Calendar size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-brand-700">{appId}</span>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold',
                completed ? 'bg-indgreen-50 text-indgreen-700' : 'bg-brand-50 text-brand-700')}>
                {completed ? 'Completed' : 'Scheduled'}
              </span>
            </div>
            <p className="text-sm font-semibold text-ink mt-0.5 truncate">{institution}</p>
            <p className="text-xs text-ink-mute">{date} · {time} · Principal, HoD, Compliance Officer</p>
          </div>
          <button onClick={() => setExpanded(e => !e)} className="btn-ghost btn-sm shrink-0 flex items-center gap-1 text-xs">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {completed ? 'Observations' : 'Checklist'}
          </button>
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden border-t border-neutral-100"
            >
              <div className="bg-neutral-50/60 px-5 py-4">
                {completed ? (
                  <>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-mute mb-2">Key Observations</p>
                    <p className="text-sm text-ink-soft leading-relaxed">
                      Institution acknowledged all deficiencies. Undertaking submitted in writing. Security deposit proof to be
                      submitted within 14 days. Faculty appointments confirmed verbally; formal letters to follow.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-mute mb-3">Pre-hearing Checklist</p>
                    <div className="space-y-2">
                      {["Review institution's compliance submissions", "Prepare deficiency question sheet", "Confirm attendee availability"].map((item, j) => (
                        <label key={j} className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox" checked={checks[j]}
                            onChange={() => setChecks(prev => prev.map((v, k) => k === j ? !v : v))}
                            className="rounded border-neutral-300 text-brand-600 focus:ring-brand-400"
                          />
                          <span className={cn('text-sm', checks[j] ? 'line-through text-ink-mute' : 'text-ink-soft')}>{item}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

/* ── Recommendation card ── */
function RecCard({ rec, index, submitting, submitted, onSubmit }: {
  rec: typeof RECS[0]; index: number; submitting: boolean; submitted: boolean; onSubmit: () => void;
}) {
  const [outcome, setOutcome] = useState<RecOutcome>(rec.outcome);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="card-pad space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="font-mono text-xs font-bold text-brand-700">{rec.appId}</span>
            <p className="text-sm font-semibold text-ink mt-0.5">{rec.inst}</p>
          </div>
          <Badge tone="amber">Draft</Badge>
        </div>
        <p className="text-sm text-ink-soft leading-relaxed">{rec.summary}</p>
        {rec.unresolved.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-mute mb-2">Unresolved Issues</p>
            <div className="flex flex-wrap gap-1.5">
              {rec.unresolved.map(u => (
                <span key={u} className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">{u}</span>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-neutral-100">
          <label className="label mb-0 text-xs shrink-0">Recommendation</label>
          <select value={outcome} onChange={e => setOutcome(e.target.value as RecOutcome)} className="input h-9 w-auto py-1 text-sm">
            <option value="Approve">Approve</option>
            <option value="Reject">Reject</option>
            <option value="Conditional">Conditional</option>
          </select>
          <button onClick={onSubmit} disabled={submitting || submitted} className="btn-primary ml-auto flex items-center gap-2 text-xs">
            {submitting ? <><Loader2 size={13} className="animate-spin" />Submitting…</>
              : submitted ? <><CheckCircle2 size={13} />Submitted</>
              : 'Finalise & Submit'}
          </button>
        </div>
      </Card>
    </motion.div>
  );
}

/* ══════════════════════════════════════════ */
export default function SHC() {
  const [tab, setTab]           = useState<Tab>('SHC Dashboard & Case Queue');
  const [expandedApp, setExpanded] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitted, setSubmitted]   = useState<Set<string>>(new Set());

  const { data: apps, loading } = useResource('shc-apps', getApplications, []);
  const { data: stats }         = useResource('shc-stats', getDashboardStats, null);

  const activeApps   = apps.filter(a => ['shc', 'scrutiny', 'evc'].includes(a.stage));
  const defApps      = apps.filter(a => a.deficiencies > 0);
  const hearingApps  = apps.filter(a => a.stage === 'shc').slice(0, 4);

  const statCards = [
    { label: 'Cases in SHC',        value: apps.filter(a => a.stage === 'shc').length || 5, icon: <Scale size={18} />,         color: 'text-brand-600 bg-brand-50' },
    { label: 'Show-Cause Pending',  value: SHOW_CAUSE.length,                                icon: <AlertTriangle size={18} />, color: 'text-amber-600 bg-amber-50' },
    { label: 'Hearings Scheduled',  value: 5,                                                icon: <Calendar size={18} />,      color: 'text-indgreen-600 bg-indgreen-50' },
    { label: 'At Risk',             value: stats?.atRisk ?? 8,                               icon: <Shield size={18} />,        color: 'text-red-600 bg-red-50' },
  ];

  return (
    <div className="container-page py-6 space-y-5">
      <PageHeader
        eyebrow="SHC"
        title="Standing Hearing Committee Portal"
        description="Review compliance cases, show-cause matters, hearing records and prepare recommendations for the committee."
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
            <Card className="card-pad flex items-center gap-4">
              <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', s.color)}>{s.icon}</span>
              <div>
                <p className="text-2xl font-extrabold text-ink tabular-nums"><CountUp value={s.value} /></p>
                <p className="text-xs text-ink-mute mt-0.5">{s.label}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-100/70 p-1 w-fit max-w-full">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('relative shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
              tab === t ? 'text-brand-800' : 'text-ink-mute hover:text-ink')}>
            {tab === t && (
              <motion.span layoutId="shc-tab" className="absolute inset-0 rounded-xl bg-white shadow-card"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
            )}
            <span className="relative">{t}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>

          {/* ── Dashboard & Queue ── */}
          {tab === 'SHC Dashboard & Case Queue' && (
            <div className="space-y-3">
              {loading ? (
                <Card className="card-pad"><LoadingRows rows={4} /></Card>
              ) : activeApps.length === 0 ? (
                <Card className="card-pad flex flex-col items-center py-12 text-center gap-3">
                  <CheckCircle2 size={36} className="text-indgreen-400" />
                  <p className="font-semibold text-ink">No active cases in SHC stage.</p>
                  <p className="text-sm text-ink-mute">Cases appear here when they reach this committee stage.</p>
                </Card>
              ) : (
                activeApps.map((app, i) => {
                  const daysLeft = daysBetween(TODAY, app.dueOn);
                  const isExpanded = expandedApp === app.id;
                  return (
                    <motion.div key={app.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
                      <Card className="overflow-hidden">
                        <button onClick={() => setExpanded(isExpanded ? null : app.id)}
                          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-neutral-50 transition-colors text-left">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-brand-700">{app.id}</span>
                              <Badge tone={app.stage === 'shc' ? 'brand' : app.stage === 'evc' ? 'amber' : 'green'}>
                                {STAGE_LABEL[app.stage as keyof typeof STAGE_LABEL] ?? app.stage}
                              </Badge>
                            </div>
                            <p className="text-sm font-semibold text-ink mt-1 truncate">{instName(app.institutionId)}</p>
                            <p className="text-xs text-ink-mute">{typeById(app.typeId)?.name ?? app.typeId} · Cycle {app.cycle}</p>
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1.5">
                            {urgencyChip(daysLeft)}
                            <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                              <ChevronDown size={16} className="text-neutral-400" />
                            </motion.span>
                          </div>
                        </button>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                              className="overflow-hidden border-t border-neutral-100">
                              <div className="px-5 py-4 grid sm:grid-cols-3 gap-4 bg-neutral-50/50">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-mute mb-1">Deficiencies</p>
                                  <p className="text-2xl font-extrabold text-ink">{app.deficiencies}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-mute mb-1">Risk Score</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 h-2 rounded-full bg-neutral-200 overflow-hidden">
                                      <div className={cn('h-full rounded-full', app.risk > 0.6 ? 'bg-red-500' : app.risk > 0.3 ? 'bg-amber-400' : 'bg-indgreen-500')}
                                        style={{ width: `${app.risk * 100}%` }} />
                                    </div>
                                    <span className="text-xs font-bold text-ink">{Math.round(app.risk * 100)}%</span>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-mute mb-1">Clock</p>
                                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold mt-1 inline-block',
                                    app.clock === 'breached' ? 'bg-red-100 text-red-700' :
                                    app.clock === 'paused'   ? 'bg-neutral-100 text-neutral-600' :
                                                               'bg-indgreen-50 text-indgreen-700')}>
                                    {app.clock}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </div>
          )}

          {/* ── Compliance Review ── */}
          {tab === 'Compliance, Deficiency & Show-Cause Review' && (
            <div className="space-y-4">
              <Section title="Deficiency Review" count={defApps.length} defaultOpen>
                {defApps.length === 0 ? (
                  <p className="text-sm text-ink-mute">No deficiencies to review at this time.</p>
                ) : (
                  <div className="overflow-x-auto -mx-1">
                    <table className="table-base">
                      <thead>
                        <tr><th>App ID</th><th>Institution</th><th>Items</th><th>Source</th><th>Evidence</th><th>Status</th><th></th></tr>
                      </thead>
                      <tbody>
                        {defApps.map((app, i) => (
                          <motion.tr key={app.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05, duration: 0.3 }}>
                            <td className="font-mono text-xs font-bold text-brand-700">{app.id}</td>
                            <td className="max-w-[150px] truncate text-xs">{instName(app.institutionId)}</td>
                            <td className="text-xs font-semibold">{app.deficiencies}</td>
                            <td className="text-xs text-ink-mute">Scrutiny</td>
                            <td><span className="rounded-full bg-indgreen-50 px-2 py-0.5 text-[10px] font-semibold text-indgreen-700">Uploaded</span></td>
                            <td><Badge tone={app.deficiencies > 2 ? 'red' : 'amber'}>Pending</Badge></td>
                            <td>
                              <div className="flex gap-1">
                                <button className="btn-ghost btn-sm text-[11px]">View</button>
                                <button className="btn-secondary btn-sm text-[11px]">Resolve</button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section title="Show-Cause Notices" count={SHOW_CAUSE.length}>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800 font-medium">AI analysis: 2 unresolved issues require attention before proceeding to hearing.</p>
                </div>
                <div className="space-y-3">
                  {SHOW_CAUSE.map((n, i) => (
                    <motion.div key={n.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.35 }}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-brand-700">{n.id}</span>
                          <span className="font-mono text-xs text-ink-mute">→ {n.appId}</span>
                        </div>
                        <p className="text-sm font-semibold text-ink mt-0.5">{n.inst}</p>
                        <p className="text-xs text-ink-mute">Sent {formatDate(n.date)}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {n.response
                          ? <span className="rounded-full bg-indgreen-50 px-2 py-0.5 text-[10px] font-bold text-indgreen-700">Response received</span>
                          : <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Awaiting response</span>
                        }
                        <button className="btn-secondary btn-sm text-xs">View Response</button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Section>

              <Section title="Compliance Evidence" count={EVIDENCE.length}>
                <div className="overflow-x-auto -mx-1">
                  <table className="table-base">
                    <thead><tr><th>Document</th><th>App ID</th><th>Deficiency ref.</th><th>Uploaded</th><th>Status</th></tr></thead>
                    <tbody>
                      {EVIDENCE.map((e, i) => (
                        <motion.tr key={e.doc} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                          <td className="text-xs font-medium text-ink max-w-[180px] truncate">{e.doc}</td>
                          <td className="font-mono text-xs text-brand-700">{e.appId}</td>
                          <td className="text-xs text-ink-mute">{e.deficiency}</td>
                          <td className="text-xs text-ink-mute">{formatDate(e.uploaded)}</td>
                          <td>{evStatusChip(e.status)}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>
          )}

          {/* ── Hearing Records ── */}
          {tab === 'Hearing Records & Proceedings' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink-mute">{hearingApps.length > 0 ? hearingApps.length : 3} hearing records</p>
                <button className="btn-primary text-xs flex items-center gap-1.5">
                  <PlusCircle size={13} /> Schedule Hearing
                </button>
              </div>
              {hearingApps.length > 0
                ? hearingApps.map((app, i) => (
                    <HearingCard key={app.id} appId={app.id} institution={instName(app.institutionId)}
                      date={formatDate(app.stageEnteredOn)} time={i % 2 === 0 ? '10:00 IST' : '14:30 IST'}
                      completed={i < 2} index={i} />
                  ))
                : [
                    { appId: 'ANU-2026-0391', inst: 'Sunrise Technical Institute', date: '25 Oct 2026', time: '10:00 IST', completed: true  },
                    { appId: 'ANU-2026-0405', inst: 'Krishna Delta Polytechnic',   date: '2 Nov 2026',  time: '14:00 IST', completed: false },
                    { appId: 'ANU-2026-0412', inst: 'Deccan College of Engg.',     date: '8 Nov 2026',  time: '11:30 IST', completed: false },
                  ].map((h, i) => (
                    <HearingCard key={h.appId} appId={h.appId} institution={h.inst}
                      date={h.date} time={h.time} completed={h.completed} index={i} />
                  ))
              }
            </div>
          )}

          {/* ── Recommendations ── */}
          {tab === 'Recommendations & Reports' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-ink mb-3">Draft Recommendations</h3>
                <div className="space-y-4">
                  {RECS.map((rec, i) => (
                    <RecCard key={rec.appId} rec={rec} index={i}
                      submitting={submitting === rec.appId}
                      submitted={submitted.has(rec.appId)}
                      onSubmit={() => {
                        setSubmitting(rec.appId);
                        setTimeout(() => {
                          setSubmitting(null);
                          setSubmitted(prev => new Set(prev).add(rec.appId));
                        }, 1200);
                      }} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink mb-3">Submitted Reports</h3>
                <div className="space-y-2">
                  {SUBMITTED_REPORTS.map((r, i) => (
                    <motion.div key={r.appId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.35 }}
                      className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                      <span className="font-mono text-xs font-bold text-brand-700">{r.appId}</span>
                      <Badge tone={outcomeTone(r.outcome)}>{r.outcome}</Badge>
                      <span className="text-xs text-ink-mute flex-1">{formatDate(r.date)}</span>
                      <button className="btn-ghost btn-sm text-xs flex items-center gap-1">
                        <Download size={12} /> Download
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
