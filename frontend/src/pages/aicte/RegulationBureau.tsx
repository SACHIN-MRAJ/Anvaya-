import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  GitBranch,
  Inbox,
  PlayCircle,
  RefreshCw,
  Search,
  Sliders,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { Badge, Card, CountUp, LoadingRows, PageHeader, Reveal } from '../../components/ui';
import { useResource } from '../../lib/resource';
import {
  type DashboardStats,
  type RuleVersion,
  getApplications,
  getDashboardStats,
  getRuleVersions,
  runSimulation,
} from '../../services/api';
import type { Application, Stage } from '../../types';
import { INSTITUTIONS } from '../../data/institutions';
import { STAGE_LABEL } from '../../data/applications';
import { typeById } from '../../data/rules';
import { BASELINE, type Scenario, type TwinResult } from '../../lib/twin';
import { cn, TODAY, daysBetween } from '../../lib/utils';

/* ── helpers ─────────────────────────────────────────── */
const instName = (id: string) => INSTITUTIONS.find((i) => i.id === id)?.name ?? id;

const stageTone = (stage: Stage): 'green' | 'amber' | 'red' | 'brand' => {
  if (stage === 'decision') return 'green';
  if (stage === 'evc' || stage === 'shc' || stage === 'ec') return 'amber';
  if (stage === 'rescrutiny') return 'red';
  return 'brand';
};

const PIPELINE_STAGES: Stage[] = ['submitted', 'scrutiny', 'rescrutiny', 'evc', 'shc', 'ec'];

const TABS = [
  { id: 'queue',    label: 'Application Queue',        icon: <Inbox size={15} /> },
  { id: 'schedule', label: 'Scheduling & Coordination', icon: <CalendarDays size={15} /> },
  { id: 'monitor',  label: 'Application Monitoring',   icon: <BarChart3 size={15} /> },
  { id: 'reports',  label: 'Committee Reports',        icon: <ClipboardList size={15} /> },
  { id: 'decision', label: 'Decision Preparation',     icon: <CheckCircle2 size={15} /> },
  { id: 'simulator',label: 'What-if Simulator',        icon: <GitBranch size={15} /> },
] as const;
type TabId = typeof TABS[number]['id'];

const SAMPLE_REPORTS = [
  { id: 'R-2026-091', type: 'Scrutiny Report', institution: 'NIT Bhopal', date: '2026-10-18', status: 'Final' },
  { id: 'R-2026-090', type: 'EVC Report',      institution: 'Sunrise Tech', date: '2026-10-15', status: 'Final' },
  { id: 'R-2026-089', type: 'SHC Report',      institution: 'VIST Patna',  date: '2026-10-12', status: 'Draft' },
  { id: 'R-2026-088', type: 'Scrutiny Report', institution: 'GEC Jaipur',  date: '2026-10-08', status: 'Final' },
];

const tabVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.18 } },
};

/* ════════════════════════════════════════════════════════
   TAB 1 — Application Queue
════════════════════════════════════════════════════════ */
function QueueTab({ apps, loading }: { apps: Application[]; loading: boolean }) {
  const [q, setQ] = useState('');
  const filtered = apps.filter(
    (a) => !q || instName(a.institutionId).toLowerCase().includes(q.toLowerCase()) || a.id.toLowerCase().includes(q.toLowerCase()),
  );
  const pending    = apps.filter((a) => a.stage !== 'decision').length;
  const atRisk     = apps.filter((a) => a.risk >= 0.5).length;
  const breached   = apps.filter((a) => a.clock === 'breached').length;

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total applications', value: apps.length, icon: <Inbox size={18} />, color: 'text-brand-600' },
          { label: 'Pending (open)',     value: pending,      icon: <TrendingUp size={18} />, color: 'text-amber-600' },
          { label: 'Deadline breached',  value: breached,     icon: <AlertTriangle size={18} />, color: 'text-red-600' },
        ].map((s) => (
          <Card key={s.label} className="card-pad flex items-center gap-4">
            <span className={cn('rounded-xl bg-neutral-100 p-2.5', s.color)}>{s.icon}</span>
            <div>
              <p className="text-2xl font-extrabold text-ink tabular-nums">
                <CountUp value={s.value} />
              </p>
              <p className="text-xs text-ink-mute">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 shadow-card">
        <Search size={16} className="text-neutral-400 shrink-0" />
        <input
          className="flex-1 text-sm outline-none placeholder:text-neutral-400"
          placeholder="Search by institution or application ID…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && <button onClick={() => setQ('')} className="text-neutral-400 hover:text-ink"><XCircle size={15} /></button>}
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Application ID</th>
                <th>Institution</th>
                <th>Type</th>
                <th>Stage</th>
                <th>Days in stage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={6}><LoadingRows rows={5} /></td></tr>
                : filtered.length === 0
                ? <tr><td colSpan={6} className="py-8 text-center text-sm text-ink-mute">No applications match.</td></tr>
                : filtered.map((a, i) => (
                  <motion.tr
                    key={a.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <td className="font-mono text-xs font-semibold text-brand-700">{a.id}</td>
                    <td className="max-w-[200px] truncate text-sm">{instName(a.institutionId)}</td>
                    <td className="text-sm">{typeById(a.typeId)?.name ?? a.typeId}</td>
                    <td><Badge tone={stageTone(a.stage)}>{STAGE_LABEL[a.stage]}</Badge></td>
                    <td className="tabular-nums text-sm">
                      {daysBetween(a.stageEnteredOn, TODAY)}d
                    </td>
                    <td>
                      <Badge tone={a.clock === 'breached' ? 'red' : a.clock === 'paused' ? 'amber' : 'green'}>
                        {a.clock === 'breached' ? 'Breached' : a.clock === 'paused' ? 'Paused' : 'On time'}
                      </Badge>
                    </td>
                  </motion.tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   TAB 2 — Scheduling
════════════════════════════════════════════════════════ */
function SchedulingTab({ stats }: { stats: DashboardStats | null }) {
  const events = [
    { date: '2026-10-28', type: 'Scrutiny session',  count: 8, region: 'NRO' },
    { date: '2026-10-29', type: 'EVC site visit',    count: 3, region: 'CRO' },
    { date: '2026-10-30', type: 'Re-scrutiny',       count: 5, region: 'SRO' },
    { date: '2026-11-02', type: 'SHC hearing',       count: 2, region: 'WRO' },
    { date: '2026-11-04', type: 'EC meeting',        count: 1, region: 'HQ' },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Scrutiny sessions (week)',  value: 8 },
          { label: 'EVC visits scheduled',      value: stats ? stats.pending : 3 },
          { label: 'Committee meetings',         value: 4 },
        ].map((s) => (
          <Reveal key={s.label}>
            <Card className="card-pad text-center">
              <p className="text-3xl font-extrabold text-brand-600 tabular-nums"><CountUp value={s.value} /></p>
              <p className="mt-1 text-xs text-ink-mute">{s.label}</p>
            </Card>
          </Reveal>
        ))}
      </div>
      <Reveal>
        <Card>
          <div className="card-pad border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-ink">Upcoming schedule (next 10 days)</h3>
          </div>
          <div className="divide-y divide-neutral-100">
            {events.map((ev, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center justify-between px-5 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-brand-50 text-center">
                    <span className="text-[10px] font-bold text-brand-600">{ev.date.slice(5, 7)}/{ev.date.slice(8, 10)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">{ev.type}</p>
                    <p className="text-xs text-ink-mute">Region: {ev.region}</p>
                  </div>
                </div>
                <Badge tone="brand">{ev.count} cases</Badge>
              </motion.div>
            ))}
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   TAB 3 — Application Monitoring (pipeline)
════════════════════════════════════════════════════════ */
function MonitoringTab({ apps, stats }: { apps: Application[]; stats: DashboardStats | null }) {
  const stageCount = (s: Stage) => apps.filter((a) => a.stage === s).length;
  const total = apps.filter((a) => a.stage !== 'decision').length || 1;

  return (
    <div className="space-y-5">
      <Reveal>
        <Card className="card-pad">
          <h3 className="mb-4 text-sm font-semibold text-ink">Live pipeline — applications by stage</h3>
          <div className="space-y-3">
            {PIPELINE_STAGES.map((stage, i) => {
              const count = stageCount(stage);
              const pct   = Math.round((count / total) * 100);
              return (
                <motion.div
                  key={stage}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-4"
                >
                  <div className="w-28 shrink-0 text-xs font-semibold text-ink-soft">{STAGE_LABEL[stage]}</div>
                  <div className="flex-1 rounded-full bg-neutral-100 h-3 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(pct, 2)}%` }}
                      transition={{ delay: 0.3 + i * 0.08, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-bold text-ink tabular-nums">
                    <CountUp value={count} />
                  </span>
                </motion.div>
              );
            })}
          </div>
        </Card>
      </Reveal>
      {stats && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'At-risk cases',  value: stats.atRisk,   color: 'text-amber-600' },
            { label: 'Breached',       value: stats.breached, color: 'text-red-600' },
            { label: 'Decided',        value: stats.decided,  color: 'text-indgreen-600' },
            { label: 'On-time rate',   value: Math.round(stats.onTimeRate * 100), suffix: '%', color: 'text-brand-600' },
          ].map((s) => (
            <Reveal key={s.label}>
              <Card className="card-pad">
                <p className={cn('text-2xl font-extrabold tabular-nums', s.color)}>
                  <CountUp value={s.value} />{s.suffix}
                </p>
                <p className="mt-0.5 text-xs text-ink-mute">{s.label}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   TAB 4 — Committee Reports
════════════════════════════════════════════════════════ */
function ReportsTab() {
  return (
    <div className="space-y-3">
      {SAMPLE_REPORTS.map((r, i) => (
        <Reveal key={r.id}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
                  <FileText size={18} className="text-brand-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{r.type} — {r.institution}</p>
                  <p className="text-xs text-ink-mute">{r.id} · {r.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={r.status === 'Final' ? 'green' : 'amber'}>{r.status}</Badge>
                <button className="btn btn-secondary btn-sm gap-1.5">
                  <Download size={13} /> Download
                </button>
              </div>
            </Card>
          </motion.div>
        </Reveal>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   TAB 5 — Decision Preparation
════════════════════════════════════════════════════════ */
function DecisionTab({ apps }: { apps: Application[] }) {
  const ecReady = apps.filter((a) => a.stage === 'ec').length;
  const items = [
    { label: 'Cases at EC stage',              done: ecReady > 0, note: `${ecReady} case${ecReady !== 1 ? 's' : ''} awaiting review` },
    { label: 'All scrutiny reports present',   done: true,        note: 'Reports verified' },
    { label: 'EVC reports received',           done: true,        note: '3 / 3 reports filed' },
    { label: 'SHC recommendations available',  done: true,        note: 'Checked 2 h ago' },
    { label: 'No missing enclosures',          done: false,       note: '1 case: land document pending' },
    { label: 'Deadline compliance confirmed',  done: ecReady < 5, note: ecReady >= 5 ? 'Review overdue cases' : 'All within limit' },
  ];
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <Reveal key={it.label}>
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card className="flex items-center gap-4 px-5 py-4">
              <span className={it.done ? 'text-indgreen-500' : 'text-red-500'}>
                {it.done ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">{it.label}</p>
                <p className="text-xs text-ink-mute">{it.note}</p>
              </div>
              {it.done
                ? <Badge tone="green">Complete</Badge>
                : <Badge tone="red">Action needed</Badge>
              }
            </Card>
          </motion.div>
        </Reveal>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   TAB 6 — What-if Simulator  (rule-aware)
════════════════════════════════════════════════════════ */
function SimulatorTab() {
  const { data: versions, loading: versionsLoading } = useResource<RuleVersion[] | null>('rule-versions', getRuleVersions, null);

  const [selectedVersion, setSelectedVersion] = useState<RuleVersion | null>(null);
  const [scenario, setScenario] = useState<Scenario>(BASELINE);
  const [running, setRunning]   = useState(false);
  const [result, setResult]     = useState<TwinResult | null>(null);

  const runSim = async () => {
    setRunning(true);
    setResult(null);
    try {
      const r = await runSimulation(scenario);
      setResult(r);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      {/* Left: rule versions */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">Rule book versions</h3>
        {versionsLoading
          ? <LoadingRows rows={4} />
          : !versions || versions.length === 0
          ? (
            <Card className="card-pad text-center">
              <GitBranch size={28} className="mx-auto mb-2 text-neutral-300" />
              <p className="text-sm text-ink-mute">No rule versions available from server.</p>
              <p className="mt-1 text-xs text-neutral-400">Connect to the backend or publish a rule version from Rules Studio.</p>
            </Card>
          )
          : versions.map((v) => (
            <button
              key={v.version}
              onClick={() => setSelectedVersion(v === selectedVersion ? null : v)}
              className={cn(
                'w-full rounded-xl border p-4 text-left transition-all duration-200',
                selectedVersion?.version === v.version
                  ? 'border-brand-400 bg-brand-50 shadow-sm'
                  : 'border-neutral-200 bg-white hover:border-brand-300',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink truncate">{v.reason || `v${v.version}`}</p>
                <Badge tone={v.status === 'published' ? 'green' : 'amber'}>
                  {v.status}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-ink-mute">
                v{v.version} · {v.author}
                {v.effectiveFrom && ` · From ${v.effectiveFrom}`}
              </p>
              {v.reason && (
                <p className="mt-1.5 text-xs text-ink-soft line-clamp-2">{v.reason}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 rounded-full bg-neutral-100 h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indgreen-500"
                    style={{ width: `${v.testsTotal > 0 ? (v.testsPassed / v.testsTotal) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[10px] text-ink-mute">{v.testsPassed}/{v.testsTotal} tests</span>
              </div>
            </button>
          ))
        }

        {/* Selected version detail */}
        <AnimatePresence>
          {selectedVersion && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="card-pad space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Selected version detail</p>
                <p className="text-sm font-semibold text-ink">Version {selectedVersion.version}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-ink-mute">
                  <span>Status: <strong className="text-ink">{selectedVersion.status}</strong></span>
                  <span>Author: <strong className="text-ink">{selectedVersion.author}</strong></span>
                  {selectedVersion.effectiveFrom && (
                    <span>Effective: <strong className="text-ink">{selectedVersion.effectiveFrom}</strong></span>
                  )}
                  {selectedVersion.publishedAt && (
                    <span>Published: <strong className="text-ink">{selectedVersion.publishedAt.slice(0, 10)}</strong></span>
                  )}
                </div>
                {selectedVersion.reason && (
                  <p className="text-xs text-ink-soft border-t border-neutral-100 pt-2">{selectedVersion.reason}</p>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: simulation controls + result */}
      <div className="space-y-4">
        <Card className="card-pad">
          <div className="flex items-center gap-2 mb-4">
            <Sliders size={16} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-ink">Simulation parameters</h3>
          </div>

          <div className="space-y-5">
            {[
              {
                label: 'Extra officers at bottleneck regions',
                key: 'extraOfficersBottleneck' as keyof Scenario,
                min: 0, max: 20, step: 1,
                desc: 'Additional dealing officers at Kanpur + Hyderabad',
              },
              {
                label: 'Extra EVC experts empanelled',
                key: 'extraExperts' as keyof Scenario,
                min: 0, max: 30, step: 1,
                desc: 'New experts added to the national empanelment list',
              },
              {
                label: 'Volume change',
                key: 'volumeChange' as keyof Scenario,
                min: -20, max: 40, step: 5,
                multiplier: 0.01,
                desc: `${scenario.volumeChange > 0 ? '+' : ''}${scenario.volumeChange}% applications this cycle`,
              },
              {
                label: 'Calendar extension (days)',
                key: 'calendarShiftDays' as keyof Scenario,
                min: 0, max: 60, step: 5,
                desc: 'Additional days granted by court / Council order',
              },
            ].map((p) => {
              const rawVal = scenario[p.key] as number;
              const displayVal = p.multiplier ? Math.round(rawVal / p.multiplier) : rawVal;
              return (
                <div key={p.key}>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-xs font-semibold text-ink-soft">{p.label}</label>
                    <span className="text-xs font-bold text-brand-700 tabular-nums">{p.desc}</span>
                  </div>
                  <input
                    type="range"
                    min={p.min} max={p.max} step={p.step}
                    value={displayVal}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setScenario((s) => ({ ...s, [p.key]: p.multiplier ? v * p.multiplier : v }));
                      setResult(null);
                    }}
                    className="w-full accent-brand-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-400 mt-0.5">
                    <span>{p.min}</span><span>{p.max}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={runSim}
              disabled={running}
              className="btn-primary flex-1 py-2.5 gap-2"
            >
              {running
                ? <><RefreshCw size={15} className="animate-spin" /> Running…</>
                : <><PlayCircle size={15} /> Run Simulation</>
              }
            </button>
            {selectedVersion && (
              <span className="text-xs text-ink-mute">
                Simulating against <strong>v{selectedVersion.version}</strong>
              </span>
            )}
          </div>
        </Card>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <Card className="card-pad space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-indgreen-600" />
                  <h3 className="text-sm font-semibold text-ink">Simulation results</h3>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'On-time rate',   value: `${Math.round(result.onTime * 100)}%` },
                    { label: 'Avg. days',      value: `${Math.round(result.avgDays)}d` },
                    { label: 'Peak queue',     value: `${result.peak}` },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-brand-50 px-3 py-2.5 text-center">
                      <p className="text-xl font-extrabold text-brand-700">{s.value}</p>
                      <p className="text-[10px] text-ink-mute">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Mini chart: weekly queue */}
                <div>
                  <p className="mb-2 text-xs font-semibold text-ink-mute">Weekly queue projection</p>
                  <div className="flex items-end gap-px h-20">
                    {result.weeks.slice(0, 20).map((w, i) => {
                      const maxTotal = Math.max(...result.weeks.map((x) => x.total), 1);
                      const hPct = (w.total / maxTotal) * 100;
                      return (
                        <motion.div
                          key={i}
                          title={`${w.week}: ${w.total}`}
                          className="flex-1 rounded-t bg-brand-400/70 hover:bg-brand-600 transition-colors cursor-pointer min-w-0"
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{ delay: i * 0.02, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                          style={{ height: `${Math.max(hPct, 4)}%`, transformOrigin: 'bottom' }}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-neutral-400">
                    <span>{result.weeks[0]?.week}</span>
                    <span>{result.weeks[19]?.week}</span>
                  </div>
                </div>

                <p className="text-xs text-ink-mute border-t border-neutral-100 pt-3">
                  Bottleneck closes in estimated week {result.deadlineWeek}. Results are indicative; AI findings are advisory.
                </p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════ */
export default function RegulationBureau() {
  const [activeTab, setActiveTab] = useState<TabId>('queue');

  const { data: apps,  loading: appsLoading  } = useResource<Application[]>('bureau-apps',   getApplications,   []);
  const { data: stats, loading: statsLoading  } = useResource<DashboardStats | null>('bureau-stats', getDashboardStats, null);

  return (
    <div className="container-page py-8">
      <PageHeader
        eyebrow="Regulation Bureau"
        title="Regulation Bureau Portal"
        description="Coordinate the application queue, scheduling, monitoring and case forwarding."
      />

      {/* Tab strip */}
      <div className="mt-6 flex flex-wrap gap-1 rounded-2xl bg-neutral-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors',
              activeTab === tab.id ? 'text-brand-800' : 'text-ink-mute hover:text-ink',
            )}
          >
            {activeTab === tab.id && (
              <motion.span
                layoutId="bureau-tab"
                className="absolute inset-0 rounded-xl bg-white shadow-card"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} {...tabVariants}>
            {activeTab === 'queue'    && <QueueTab      apps={apps ?? []} loading={appsLoading} />}
            {activeTab === 'schedule' && <SchedulingTab stats={stats} />}
            {activeTab === 'monitor'  && <MonitoringTab apps={apps ?? []} stats={stats} />}
            {activeTab === 'reports'  && <ReportsTab />}
            {activeTab === 'decision' && <DecisionTab   apps={apps ?? []} />}
            {activeTab === 'simulator'&& <SimulatorTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
