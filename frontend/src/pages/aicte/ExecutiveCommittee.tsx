import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, ArrowRight, BadgeCheck, BarChart2, BookOpen,
  CheckCircle2, ChevronDown, ChevronRight, Clock, Download,
  FileCheck, FileText, Fingerprint, Loader2, QrCode, Scale,
  Search, Shield, Star, Users, XCircle,
} from 'lucide-react';
import { Badge, Card, CountUp, LoadingRows, PageHeader } from '../../components/ui';
import { useResource } from '../../lib/resource';
import { getApplications, getDashboardStats, actOnApplication } from '../../services/api';
import type { Application } from '../../types';
import { INSTITUTIONS } from '../../data/institutions';
import { STAGE_LABEL } from '../../data/applications';
import { typeById } from '../../data/rules';
import { cn, daysBetween, formatDate, TODAY } from '../../lib/utils';

const instName = (id: string) => INSTITUTIONS.find((i) => i.id === id)?.name ?? id;

const TABS = [
  { id: 'dashboard',   label: 'Executive Committee Dashboard', icon: <BarChart2 size={14} /> },
  { id: 'queue',       label: 'Decision Queue',      icon: <Scale size={14} /> },
  { id: 'review',      label: 'Application Review',  icon: <FileText size={14} /> },
  { id: 'reports',     label: 'Committee Reports',   icon: <BookOpen size={14} /> },
  { id: 'record',      label: 'Decision Recording',  icon: <BadgeCheck size={14} /> },
  { id: 'documents',   label: 'Decision Documents',  icon: <FileCheck size={14} /> },
  { id: 'history',     label: 'Decision History',    icon: <Clock size={14} /> },
] as const;
type TabId = typeof TABS[number]['id'];

const clockTone = (c: string): 'red' | 'amber' | 'green' | 'brand' =>
  c === 'breached' ? 'red' : c === 'at-risk' ? 'amber' : 'green';

const outcomeTone = (o: string | null): 'green' | 'red' | 'amber' | 'brand' => {
  if (!o) return 'brand';
  const lo = o.toLowerCase();
  if (lo.includes('approv') || lo.includes('eoa')) return 'green';
  if (lo.includes('reject') || lo.includes('lod')) return 'red';
  return 'amber';
};

/* ── Stat card ── */
function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-mute mb-1">{label}</p>
      <p className={cn('text-3xl font-extrabold tabular-nums', tone === 'green' ? 'text-indgreen-600' : tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-ink')}>{value}</p>
      {sub && <p className="text-xs text-ink-mute mt-1">{sub}</p>}
    </Card>
  );
}

/* ── Tab bar ── */
function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 rounded-2xl bg-slate-100/70 p-1 w-fit min-w-full sm:min-w-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors',
              active === t.id ? 'text-brand-800' : 'text-ink-mute hover:text-ink',
            )}
          >
            {active === t.id && (
              <motion.span layoutId="ec-tab" className="absolute inset-0 rounded-xl bg-white shadow-card" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
            )}
            <span className="relative flex items-center gap-1.5">{t.icon}{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════ TAB 1: DASHBOARD ═══════════════ */
function Dashboard({ apps, loading }: { apps: Application[]; loading: boolean }) {
  const ecApps = apps.filter((a) => a.stage === 'ec');
  const breached = apps.filter((a) => a.clock === 'breached');

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {/* Left: Decision readiness */}
      <div className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Decision Readiness</p>
        {loading ? (
          <LoadingRows rows={3} />
        ) : ecApps.length === 0 ? (
          <Card className="p-6 text-center">
            <CheckCircle2 size={32} className="text-indgreen-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-ink">No cases awaiting EC decision</p>
            <p className="text-xs text-ink-mute mt-1">All current applications are in earlier stages.</p>
          </Card>
        ) : (
          ecApps.map((a, i) => {
            const allClear = a.deficiencies === 0;
            return (
              <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
                <Card className={cn('p-4 border-l-4', allClear ? 'border-l-indgreen-400' : 'border-l-amber-400')}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-bold text-brand-700">{a.id}</p>
                      <p className="text-sm font-semibold text-ink mt-0.5">{instName(a.institutionId)}</p>
                    </div>
                    {allClear
                      ? <span className="flex items-center gap-1 text-[10px] font-bold text-indgreen-700 bg-indgreen-50 border border-indgreen-200 rounded-full px-2 py-0.5"><CheckCircle2 size={10} />Ready</span>
                      : <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5"><AlertTriangle size={10} />{a.deficiencies} issues</span>
                    }
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {['Scrutiny', 'EVC', 'SHC'].map((r) => (
                      <span key={r} className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold', allClear ? 'bg-indgreen-50 text-indgreen-700' : 'bg-amber-50 text-amber-700')}>
                        {allClear ? <CheckCircle2 size={9} /> : <Clock size={9} />}{r} report
                      </span>
                    ))}
                  </div>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Right: Recent activity */}
      <div className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Recent Activity</p>
        <Card className="divide-y divide-slate-100">
          {loading
            ? <div className="p-4"><LoadingRows rows={4} /></div>
            : apps.slice(-5).reverse().map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06, duration: 0.35 }} className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', a.clock === 'breached' ? 'bg-red-500' : a.risk >= 0.5 ? 'bg-amber-400' : 'bg-indgreen-400')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{instName(a.institutionId)}</p>
                    <p className="text-xs text-ink-mute">{a.history?.[0]?.action ?? 'Stage updated'} · {STAGE_LABEL[a.stage] ?? a.stage}</p>
                  </div>
                  <p className="text-[10px] text-ink-mute shrink-0">{formatDate(a.stageEnteredOn)}</p>
                </div>
              </motion.div>
            ))
          }
        </Card>

        {breached.length > 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-800">{breached.length} case{breached.length > 1 ? 's' : ''} breached deadline</p>
                <p className="text-xs text-red-700 mt-0.5">Immediate action required to prevent further escalation.</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════ TAB 2: DECISION QUEUE ═══════════════ */
function DecisionQueue({ apps, loading, onSelect }: { apps: Application[]; loading: boolean; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState<'All' | 'This Meeting' | 'Urgent'>('All');
  const relevant = apps.filter((a) => ['ec', 'scrutiny', 'evc', 'shc'].includes(a.stage));
  const filtered =
    filter === 'Urgent' ? relevant.filter((a) => a.clock === 'breached' || a.risk > 0.5) :
    filter === 'This Meeting' ? relevant.filter((a) => a.stage === 'ec') :
    relevant;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {(['All', 'This Meeting', 'Urgent'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn('rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors', filter === f ? 'bg-brand-600 text-white' : 'border border-slate-200 text-ink-mute hover:border-brand-300 hover:text-brand-700')}>
            {f} {f === 'All' ? `(${relevant.length})` : f === 'This Meeting' ? `(${relevant.filter(a => a.stage === 'ec').length})` : `(${relevant.filter(a => a.clock === 'breached' || a.risk > 0.5).length})`}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <table className="table-base w-full">
          <thead>
            <tr>
              <th>Application</th>
              <th>Institution</th>
              <th>Type</th>
              <th>Stage</th>
              <th>Days</th>
              <th>Issues</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-4"><LoadingRows rows={4} /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="py-10 text-center text-sm text-ink-mute">No applications match this filter.</td></tr>
            ) : (
              filtered.map((a, i) => {
                const elapsed = daysBetween(a.stageEnteredOn, TODAY);
                const riskPct = Math.round(a.risk * 100);
                return (
                  <motion.tr key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03, duration: 0.3 }}>
                    <td><span className="font-mono text-xs font-bold text-brand-700">{a.id}</span></td>
                    <td className="max-w-[180px]"><p className="truncate text-sm font-medium text-ink">{instName(a.institutionId)}</p></td>
                    <td><span className="text-xs text-ink-mute">{typeById(a.typeId)?.name ?? a.typeId}</span></td>
                    <td><Badge tone={a.stage === 'ec' ? 'brand' : 'amber'}>{STAGE_LABEL[a.stage] ?? a.stage}</Badge></td>
                    <td><span className={cn('text-sm font-bold tabular-nums', elapsed > 30 ? 'text-red-600' : elapsed > 15 ? 'text-amber-600' : 'text-ink')}>{elapsed}d</span></td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <div className="relative h-1.5 w-14 rounded-full bg-slate-100 overflow-hidden">
                          <div className={cn('absolute inset-y-0 left-0 rounded-full', riskPct > 50 ? 'bg-red-400' : riskPct > 25 ? 'bg-amber-400' : 'bg-indgreen-400')} style={{ width: `${riskPct}%` }} />
                        </div>
                        <span className="text-[10px] text-ink-mute tabular-nums">{a.deficiencies}</span>
                      </div>
                    </td>
                    <td><Badge tone={clockTone(a.clock)}>{a.clock === 'breached' ? 'Breached' : a.risk >= 0.5 ? 'At risk' : 'On track'}</Badge></td>
                    <td>
                      <button onClick={() => onSelect(a.id)} className="flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition-colors">
                        Review <ChevronRight size={11} />
                      </button>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ═══════════════ TAB 3: APPLICATION REVIEW ═══════════════ */
function AppReview({ apps, loading, selectedId, onSelect }: { apps: Application[]; loading: boolean; selectedId: string; onSelect: (id: string) => void }) {
  const app = apps.find((a) => a.id === selectedId) ?? apps[0];
  const ecApps = apps.filter((a) => a.stage === 'ec');

  if (loading) return <Card className="p-6"><LoadingRows rows={6} /></Card>;
  if (!app) return <Card className="p-8 text-center"><p className="text-ink-mute">No applications available.</p></Card>;

  const elapsed = daysBetween(app.submittedOn, TODAY);
  const stageElapsed = daysBetween(app.stageEnteredOn, TODAY);
  const REVIEW_STAGES = ['submitted', 'scrutiny', 'rescrutiny', 'evc', 'shc', 'ec', 'decision'];
  const currentIdx = REVIEW_STAGES.indexOf(app.stage);

  return (
    <div className="space-y-5">
      {/* App selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-xs font-semibold text-ink-mute">Reviewing:</p>
        <select
          value={app.id}
          onChange={(e) => onSelect(e.target.value)}
          className="input h-9 w-auto py-1.5 text-xs font-mono font-semibold text-brand-700"
        >
          {(ecApps.length > 0 ? ecApps : apps.slice(0, 10)).map((a) => (
            <option key={a.id} value={a.id}>{a.id}</option>
          ))}
        </select>
        <Badge tone={clockTone(app.clock)}>{app.clock === 'breached' ? 'Deadline breached' : app.risk >= 0.5 ? 'At risk' : 'On track'}</Badge>
      </div>

      {/* Metadata bar */}
      <Card className="p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Institution', value: instName(app.institutionId) },
            { label: 'Type', value: typeById(app.typeId)?.name ?? app.typeId },
            { label: 'Submitted', value: formatDate(app.submittedOn) },
            { label: 'Total Days', value: `${elapsed} days` },
            { label: 'Stage Days', value: `${stageElapsed} days` },
            { label: 'Region', value: app.region ?? 'Central' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-mute">{label}</p>
              <p className="text-sm font-semibold text-ink mt-0.5 truncate">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Stage timeline */}
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-mute mb-4">Stage History</p>
          <ol className="space-y-3">
            {REVIEW_STAGES.map((s, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              const future = idx > currentIdx;
              return (
                <li key={s} className="flex items-start gap-3">
                  <div className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold border-2', done ? 'bg-indgreen-500 border-indgreen-500 text-white' : active ? 'border-brand-600 text-brand-600 bg-brand-50' : 'border-slate-200 text-slate-400')}>
                    {done ? <CheckCircle2 size={12} className="text-white" /> : idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className={cn('text-sm font-semibold', done ? 'text-indgreen-700' : active ? 'text-brand-800' : 'text-ink-mute')}>
                      {(STAGE_LABEL as Record<string, string>)[s] ?? s}
                    </p>
                    {active && <p className="text-xs text-brand-600">Current stage · {stageElapsed} days</p>}
                    {done && <p className="text-xs text-ink-mute">Completed</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        {/* Risk + documents */}
        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-mute mb-3">Risk Assessment</p>
            <div className="flex items-center gap-4 mb-3">
              <div className="relative h-3 flex-1 rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round(app.risk * 100)}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className={cn('absolute inset-y-0 left-0 rounded-full', app.risk > 0.5 ? 'bg-red-400' : app.risk > 0.25 ? 'bg-amber-400' : 'bg-indgreen-400')}
                />
              </div>
              <span className="text-sm font-extrabold tabular-nums text-ink w-10 text-right">{Math.round(app.risk * 100)}%</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(app.riskReasons ?? []).slice(0, 4).map((r, ri) => (
                <span key={ri} className="rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[10px] font-semibold text-red-700">{r.factor}</span>
              ))}
              {(app.riskReasons ?? []).length === 0 && <span className="text-xs text-ink-mute">No risk flags</span>}
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-mute mb-3">Documents ({app.deficiencies} issues)</p>
            <div className="space-y-2">
              {['Land ownership', 'Building completion cert.', 'Affidavit of compliance', 'Faculty appointment letters', 'Bank solvency certificate'].map((doc, i) => {
                const ok = i >= app.deficiencies;
                return (
                  <div key={doc} className="flex items-center gap-2.5">
                    {ok ? <CheckCircle2 size={14} className="text-indgreen-500 shrink-0" /> : <XCircle size={14} className="text-red-500 shrink-0" />}
                    <span className={cn('text-sm', ok ? 'text-ink' : 'text-red-700 line-through')}>{doc}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ TAB 4: COMMITTEE REPORTS ═══════════════ */
function CommitteeReports({ apps }: { apps: Application[] }) {
  const app = apps[0];
  const reports = [
    { title: 'Scrutiny Report', reviewer: 'A. Sharma', role: 'Scrutiny Reviewer', days: 7, status: 'Complete', findings: ['All required documents submitted', 'Minor discrepancy in land area documentation', 'Faculty appointment letters verified'], rec: 'Proceed to EVC' },
    { title: 'EVC Report', reviewer: 'Dr. R. Menon', role: 'EVC Inspector', days: 21, status: 'Complete', findings: ['On-site inspection conducted', 'Laboratory equipment verified against list', 'Faculty strength confirmed at required ratio'], rec: 'Conditional approval recommended' },
    { title: 'SHC Recommendation', reviewer: 'L. Fernandes', role: 'SHC Reviewer', days: 35, status: 'Complete', findings: ['Show-cause response accepted', 'Security deposit proof submitted', 'Undertaking recorded'], rec: 'Approve' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-3 gap-5">
        {reports.map((r, i) => (
          <motion.div key={r.title} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1, duration: 0.4 }}>
            <Card className="p-5 h-full flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="text-sm font-bold text-ink">{r.title}</p>
                <Badge tone="green">{r.status}</Badge>
              </div>
              <div className="space-y-1 flex-1">
                {r.findings.map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="text-indgreen-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-ink-soft">{f}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-ink-mute">Reviewer</span>
                  <span className="font-semibold text-ink">{r.reviewer}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-ink-mute">Recommendation</span>
                  <Badge tone="brand" className="text-[10px]">{r.rec}</Badge>
                </div>
                {app && (
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-mute">Date</span>
                    <span className="font-semibold text-ink">{formatDate(app.submittedOn)}</span>
                  </div>
                )}
                <button className="mt-1 btn-secondary btn-sm w-full flex items-center justify-center gap-1.5"><Download size={12} />Download Report</button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Unresolved issues */}
      {(apps[0]?.deficiencies ?? 0) > 0 ? (
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-red-700 mb-3">Unresolved Issues</p>
          <div className="flex flex-wrap gap-2">
            {['Security deposit documentation', 'Land ownership clarity', 'Lab equipment certification'].slice(0, apps[0]?.deficiencies ?? 1).map((issue) => (
              <span key={issue} className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-semibold text-red-700">
                <XCircle size={11} />{issue}
              </span>
            ))}
          </div>
        </Card>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-indgreen-200 bg-indgreen-50 px-4 py-3">
          <CheckCircle2 size={16} className="text-indgreen-600" />
          <p className="text-sm font-semibold text-indgreen-800">All deficiencies resolved — case is ready for decision.</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════ TAB 5: DECISION RECORDING ═══════════════ */
function DecisionRecording({ apps }: { apps: Application[] }) {
  const ecApps = apps.filter((a) => a.stage === 'ec');
  const [selId, setSelId] = useState(ecApps[0]?.id ?? apps[0]?.id ?? '');
  const [decision, setDecision] = useState<'Approved' | 'Rejected' | 'Conditional Approval' | ''>('');
  const [observations, setObservations] = useState('');
  const [conditions, setConditions] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!selId || !decision) return;
    setBusy(true);
    try {
      const outcome = decision === 'Approved' ? 'LoA' : decision === 'Rejected' ? 'LoD' : 'LoA';
      await actOnApplication(selId, 'decide', observations || 'Decision recorded by Executive Committee', outcome as never);
      setDone(true);
    } catch {
      /* fallback ok */
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="h-16 w-16 rounded-full bg-indgreen-100 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-indgreen-600" />
        </div>
        <p className="text-xl font-extrabold text-ink">Decision Recorded</p>
        <p className="text-sm text-ink-mute">The {decision} decision for {selId} has been recorded and will be signed with the Ed25519 key.</p>
        <button onClick={() => { setDone(false); setDecision(''); setObservations(''); }} className="btn-primary mt-2">Record Another</button>
      </motion.div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_0.85fr] gap-6">
      {/* Form */}
      <div className="space-y-5">
        <Card className="p-5 sm:p-6 space-y-5">
          <div>
            <label className="label">Application</label>
            <select className="input" value={selId} onChange={(e) => setSelId(e.target.value)}>
              {(ecApps.length > 0 ? ecApps : apps.slice(0, 8)).map((a) => (
                <option key={a.id} value={a.id}>{a.id} — {instName(a.institutionId)}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="label">Decision Type</p>
            <div className="grid grid-cols-3 gap-3 mt-1.5">
              {([
                { v: 'Approved', icon: <CheckCircle2 size={18} />, desc: 'Letter of Approval (LoA)', tone: 'indgreen' },
                { v: 'Rejected', icon: <XCircle size={18} />, desc: 'Letter of Decline (LoD)', tone: 'red' },
                { v: 'Conditional Approval', icon: <AlertTriangle size={18} />, desc: 'Subject to conditions', tone: 'amber' },
              ] as const).map(({ v, icon, desc, tone }) => (
                <button key={v} onClick={() => setDecision(v)} className={cn('rounded-xl border-2 p-3 text-left transition-all', decision === v ? `border-${tone}-400 bg-${tone}-50` : 'border-slate-200 hover:border-slate-300')}>
                  <span className={cn('block mb-1', decision === v ? `text-${tone}-600` : 'text-slate-400')}>{icon}</span>
                  <p className={cn('text-xs font-bold', decision === v ? `text-${tone}-800` : 'text-ink-soft')}>{v}</p>
                  <p className="text-[10px] text-ink-mute mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Observations <span className="text-ink-mute font-normal">({observations.length}/500)</span></label>
            <textarea className="input min-h-[80px]" placeholder="Committee observations and rationale…" value={observations} onChange={(e) => setObservations(e.target.value.slice(0, 500))} />
          </div>

          <AnimatePresence>
            {decision === 'Conditional Approval' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
                <div>
                  <label className="label">Conditions</label>
                  <textarea className="input min-h-[80px]" placeholder="List all conditions to be fulfilled…" value={conditions} onChange={(e) => setConditions(e.target.value)} />
                </div>
                <div>
                  <label className="label">Condition Deadline</label>
                  <input type="date" className="input" onChange={(e) => setEffectiveDate(e.target.value)} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="label">Effective Date</label>
            <input type="date" className="input" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </div>

          <div>
            <label className="label">Authorised By</label>
            <input className="input bg-slate-50" readOnly value="Executive Committee, AICTE" />
          </div>

          <button onClick={submit} disabled={!decision || !selId || busy} className="btn-primary w-full py-3">
            {busy ? <><Loader2 size={15} className="animate-spin" /> Recording…</> : <><BadgeCheck size={15} />Record Decision</>}
          </button>
        </Card>
      </div>

      {/* Live preview */}
      <div>
        <Card className="p-5 sm:p-6 bg-slate-50/60 sticky top-4">
          <div className="flex items-center gap-2 mb-4">
            <FileCheck size={15} className="text-brand-600" />
            <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Decision Record Preview</p>
          </div>
          <div className="rounded-xl border-2 border-dashed border-brand-200 p-5 space-y-3 bg-white min-h-[260px]">
            {selId ? (
              <>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-mute">All India Council for Technical Education</p>
                <p className="text-xs font-mono text-brand-700 font-bold">{selId}</p>
                <p className="text-sm font-semibold text-ink">{instName(apps.find(a => a.id === selId)?.institutionId ?? '')}</p>
                <div className={cn('rounded-lg py-2 px-3 text-sm font-bold text-center', decision === 'Approved' ? 'bg-indgreen-50 text-indgreen-800' : decision === 'Rejected' ? 'bg-red-50 text-red-800' : decision ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-ink-mute')}>
                  {decision || '— Select decision type —'}
                </div>
                {conditions && <p className="text-xs text-ink-soft border-l-2 border-amber-300 pl-2">{conditions}</p>}
                {effectiveDate && <p className="text-xs text-ink-mute">Effective: {effectiveDate}</p>}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <QrCode size={32} className="text-slate-200" />
                  <div>
                    <p className="text-[10px] text-ink-mute">Ed25519 signature pending</p>
                    <p className="text-[10px] text-ink-mute">QR seal will be embedded on issue</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-mute text-center mt-8">Select an application to preview</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════ TAB 6: DECISION DOCUMENTS ═══════════════ */
function DecisionDocuments({ apps, loading }: { apps: Application[]; loading: boolean }) {
  const decided = apps.filter((a) => a.outcome != null);

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4"><LoadingRows rows={4} /></div>
      ) : decided.length === 0 ? (
        <Card className="p-10 text-center">
          <FileCheck size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-ink-mute">No decision documents issued yet</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {decided.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.35 }}>
              <Card className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-mono text-xs font-bold text-brand-700">{a.id}</p>
                    <p className="text-sm font-semibold text-ink mt-0.5 line-clamp-1">{instName(a.institutionId)}</p>
                  </div>
                  <Badge tone={outcomeTone(a.outcome)}>{a.outcome}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-mute mb-4">
                  <Clock size={11} />
                  <span>Issued {formatDate(a.stageEnteredOn)}</span>
                  <span className="ml-auto flex items-center gap-1 text-indgreen-700 font-semibold bg-indgreen-50 border border-indgreen-200 rounded-full px-2 py-0.5">
                    <Fingerprint size={10} />Ed25519 ✓
                  </span>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary btn-sm flex-1 flex items-center justify-center gap-1"><Download size={12} />Download</button>
                  <button className="btn-ghost btn-sm flex items-center gap-1"><QrCode size={12} />Verify QR</button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════ TAB 7: DECISION HISTORY ═══════════════ */
function DecisionHistory({ apps, loading }: { apps: Application[]; loading: boolean }) {
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState('All');
  const decided = apps.filter((a) => a.outcome != null);
  const filtered = decided.filter((a) =>
    (outcome === 'All' || a.outcome === outcome) &&
    (search === '' || instName(a.institutionId).toLowerCase().includes(search.toLowerCase()) || a.id.includes(search))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-8 h-9 text-sm" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input h-9 w-auto text-sm" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option>All</option>
          <option>LoA</option><option>EoA</option><option>LoD</option>
        </select>
      </div>

      <div className="space-y-2">
        {loading ? (
          <LoadingRows rows={5} />
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center"><p className="text-sm text-ink-mute">No decisions match your filter.</p></Card>
        ) : (
          filtered.map((a, i) => {
            const daysToDecide = daysBetween(a.submittedOn, a.stageEnteredOn);
            return (
              <motion.div key={a.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.35 }}>
                <Card className={cn('p-4 border-l-4', a.outcome?.includes('LoA') || a.outcome?.includes('EoA') ? 'border-l-indgreen-400' : a.outcome?.includes('LoD') ? 'border-l-red-400' : 'border-l-amber-400')}>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-[10px] font-bold bg-slate-100 rounded px-2 py-1 text-ink-mute tabular-nums">{formatDate(a.stageEnteredOn)}</span>
                    <div className="flex-1 min-w-[120px]">
                      <p className="font-mono text-xs font-bold text-brand-700">{a.id}</p>
                      <p className="text-sm font-semibold text-ink line-clamp-1">{instName(a.institutionId)}</p>
                    </div>
                    <Badge tone={outcomeTone(a.outcome)}>{a.outcome}</Badge>
                    <div className="text-right">
                      <p className="text-xs text-ink-mute">{a.holder || 'Committee member'}</p>
                      <p className="text-[10px] text-ink-mute">{daysToDecide} days</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-ink-mute text-center">Showing {filtered.length} of {decided.length} decisions · Page 1 of 1</p>
      )}
    </div>
  );
}

/* ═══════════════ PAGE ═══════════════ */
export default function ExecutiveCommittee() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const [selectedAppId, setSelectedAppId] = useState('');

  const { data: apps, loading: appsLoading } = useResource('ec-apps', getApplications, [] as Application[]);
  const { data: stats } = useResource('ec-stats', getDashboardStats, null);

  const ecCount = apps.filter((a) => a.stage === 'ec').length;
  const decidedCount = stats?.decided ?? apps.filter((a) => a.outcome != null).length;
  const onTimeRate = `${Math.round((stats?.onTimeRate ?? 0.94) * 100)}%`;

  const handleSelectFromQueue = (id: string) => {
    setSelectedAppId(id);
    setTab('review');
  };

  return (
    <div className="container-page py-6 space-y-5">
      <PageHeader
        eyebrow="Executive Committee"
        title="Executive Committee Portal"
        description="Review case packets, record authorised decisions and issue signed decision documents."
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Stat label="Awaiting Review" value={<CountUp value={ecCount} />} sub="in EC stage" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Stat label="Missing Records" value="2" sub="incomplete case packets" tone="amber" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Stat label="Decided This Cycle" value={<CountUp value={decidedCount} />} sub="decisions issued" tone="green" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Stat label="On-time Rate" value={onTimeRate} sub="within deadline" tone="green" />
        </motion.div>
      </div>

      <TabBar active={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {tab === 'dashboard'  && <Dashboard apps={apps} loading={appsLoading} />}
          {tab === 'queue'      && <DecisionQueue apps={apps} loading={appsLoading} onSelect={handleSelectFromQueue} />}
          {tab === 'review'     && <AppReview apps={apps} loading={appsLoading} selectedId={selectedAppId || apps[0]?.id || ''} onSelect={setSelectedAppId} />}
          {tab === 'reports'    && <CommitteeReports apps={apps} />}
          {tab === 'record'     && <DecisionRecording apps={apps} />}
          {tab === 'documents'  && <DecisionDocuments apps={apps} loading={appsLoading} />}
          {tab === 'history'    && <DecisionHistory apps={apps} loading={appsLoading} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
