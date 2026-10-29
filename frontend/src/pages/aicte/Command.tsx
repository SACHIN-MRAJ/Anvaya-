import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Compass,
  Hourglass,
  Inbox,
  LayoutDashboard,
  MessageSquareDot,
  Network,
  PauseCircle,
  Scale,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAsync } from '../../lib/useAsync';
import { getApplications, getDashboardStats, getDisputes, getObligations } from '../../services/api';
import { institutionById, REGIONS } from '../../data/institutions';
import { typeById } from '../../data/rules';
import { STAGE_LABEL } from '../../data/applications';
import { Badge, Card, CountUp, LoadingRows, PageHeader, RiskMeter, Stat, stagger } from '../../components/ui';
import { Countdown, LiveActivity, Tour, startTour } from '../../components/live';
import { COMMAND_TOUR } from '../../data/tours';
import { useSession } from '../../lib/session';
import { BASELINE, simulate } from '../../lib/twin';
import { cn, formatDate, greeting, TODAY } from '../../lib/utils';

const STAGES = ['scrutiny', 'rescrutiny', 'evc', 'shc', 'ec'] as const;

/* ── Tab definitions matching Document Section 3.1 ── */
const TABS = [
  { id: 'overview',     label: 'System Overview & KPIs',          icon: <LayoutDashboard size={15} /> },
  { id: 'workqueue',    label: 'Work Queue Summary',              icon: <Inbox size={15} /> },
  { id: 'inspections',  label: 'Upcoming Inspections & Hearings', icon: <Calendar size={15} /> },
  { id: 'overdue',      label: 'Overdue & Deadline Monitor',      icon: <AlertTriangle size={15} /> },
  { id: 'workload',     label: 'Department Workload',             icon: <Network size={15} /> },
] as const;
type TabId = (typeof TABS)[number]['id'];

function heat(n: number, max: number) {
  if (n === 0) return 'bg-slate-50 text-slate-400';
  const r = n / max;
  if (r > 0.75) return 'bg-brand-800 text-white';
  if (r > 0.5) return 'bg-brand-600 text-white';
  if (r > 0.25) return 'bg-brand-300 text-brand-900';
  return 'bg-brand-100 text-brand-800';
}

function Digest() {
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem('anumati.digest') !== 'hidden';
    } catch {
      return true;
    }
  });
  if (!open) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="bg-navy-mesh relative mb-6 overflow-hidden rounded-2xl px-6 py-5 text-white">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-saffron-500/20 blur-2xl" aria-hidden />
      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="flex items-center gap-3 pr-8 xl:pr-0">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-saffron-300">
            <Sparkles size={19} />
          </span>
          <div>
            <p className="font-display font-bold">Since your last visit (yesterday, 18:40)</p>
            <p className="text-sm text-brand-200">Here is what changed across all 10 regions.</p>
          </div>
        </div>
        <ul className="flex flex-1 flex-wrap gap-2 xl:justify-end">
          {[
            ['6', 'new submissions'],
            ['3', 'decisions issued'],
            ['2', 'new escalations'],
            ['1', 'rule version pending approval'],
          ].map(([n, l]) => (
            <li key={l} className="rounded-xl bg-white/10 px-3 py-1.5 text-sm">
              <span className="font-display font-bold text-white">{n}</span> <span className="text-brand-100">{l}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={() => {
            setOpen(false);
            try {
              sessionStorage.setItem('anumati.digest', 'hidden');
            } catch {
              /* ignore */
            }
          }}
          className="absolute right-0 top-0 rounded-lg p-1 text-brand-200 hover:bg-white/10 xl:static"
          aria-label="Dismiss summary"
        >
          <X size={17} />
        </button>
      </div>
    </motion.div>
  );
}

export default function Command() {
  const { session } = useSession();
  const nav = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const stats = useAsync(getDashboardStats);
  const apps = useAsync(getApplications);
  const obl = useAsync(() => getObligations());
  const disputes = useAsync(() => getDisputes('pending'));
  const s = stats.data;
  const atRisk = (apps.data ?? []).filter((a) => a.stage !== 'decision').sort((a, b) => b.risk - a.risk).slice(0, 6);
  const max = Math.max(1, ...(s?.byRegionStage.flatMap((r) => STAGES.map((k) => r[k])) ?? [1]));
  const escalations = (obl.data ?? []).filter((o) => o.status === 'Escalated' || o.status === 'Overdue');
  const projBase = simulate(BASELINE);
  const projPlus = simulate({ ...BASELINE, extraOfficersBottleneck: 3 });

  return (
    <>
      <PageHeader
        eyebrow={`${greeting()}, ${session?.name ?? 'Officer'} · ${session?.officerRole ?? 'Regulation Bureau Admin'} view`}
        title="Main Administrative Dashboard"
        description="Cross-system overview for authorised administrative users: pendency across regions and stages, deadline risk and workload balancing."
        tourId="command"
        actions={
          <Link to="/aicte/bureau" className="btn-primary">
            <Inbox size={16} /> Open Work Queue
          </Link>
        }
      />
      <Digest />

      {/* ── Subpage Navigation Tabs (Section 3.1) ────────────────────── */}
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
              {t.id === 'overdue' && (s?.breached ?? 0) > 0 && (
                <span className="grid h-4 w-4 place-items-center rounded-full bg-red-500 text-[10px] text-white">
                  {s?.breached}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── SUBPAGE 1: SYSTEM OVERVIEW & KPIS ───────────────────────── */}
      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {stats.loading || !s ? (
            <LoadingRows rows={3} />
          ) : (
            <motion.div data-tour="stats" variants={stagger} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <Stat label="Pending applications" value={<CountUp value={s.pending} />} hint="Across 10 regions" icon={<Hourglass size={18} />} trend={[38, 41, 45, 44, 49, 52, s.pending]} />
              <Stat label="Likely to miss deadline" value={<CountUp value={s.atRisk} />} hint="Risk 50% or higher" tone="amber" icon={<TrendingUp size={18} />} trend={[4, 6, 5, 8, 9, 8, s.atRisk]} />
              <Stat label="Deadlines missed" value={<CountUp value={s.breached} />} hint="Escalated automatically" tone="red" icon={<AlertTriangle size={18} />} trend={[2, 3, 5, 4, 6, 7, s.breached]} />
              <Stat label="Paused, with institution" value={<CountUp value={s.paused} />} hint="Not counted against AICTE" tone="slate" icon={<PauseCircle size={18} />} trend={[3, 4, 3, 5, 4, 6, s.paused]} />
              <Stat label="Decided this cycle" value={<CountUp value={s.decided} />} hint={`${Math.round(s.onTimeRate * 100)}% within target`} tone="green" icon={<CheckCircle2 size={18} />} trend={[2, 4, 6, 8, 10, 12, s.decided]} />
              {(disputes.data?.length ?? 0) > 0 && (
                <Link to="/aicte/ai-disputes" className="block">
                  <Stat label="AI disputes pending" value={disputes.data?.length ?? 0} hint="Institutions disputed AI findings" tone="amber" icon={<MessageSquareDot size={18} />} />
                </Link>
              )}
            </motion.div>
          )}

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr]">
            <div data-tour="heatmap">
              <Card title="Pendency by region and stage" subtitle="Darker means more files waiting. Select a cell to open those files." pad={false}>
                {!s ? (
                  <LoadingRows />
                ) : (
                  <div className="overflow-x-auto p-4 sm:p-5">
                    <table className="w-full min-w-[560px] border-separate border-spacing-1.5 text-sm">
                      <thead>
                        <tr>
                          <th className="px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Region</th>
                          {STAGES.map((k) => (
                            <th key={k} className="px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
                              {STAGE_LABEL[k].replace(' (EVC)', '').replace(' (SHC)', '')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {s.byRegionStage.map((r, ri) => (
                          <tr key={r.region}>
                            <th scope="row" className="whitespace-nowrap px-2 py-1 text-left text-xs font-semibold text-ink-soft">
                              {REGIONS.find((x) => x.id === r.region)?.office}
                            </th>
                            {STAGES.map((k, ki) => (
                              <td key={k} className="p-0">
                                <motion.button
                                  initial={{ opacity: 0, scale: 0.7 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: (ri * 5 + ki) * 0.012 }}
                                  whileHover={{ scale: 1.08 }}
                                  onClick={() => nav(`/aicte/bureau?region=${r.region}&stage=${k}`)}
                                  className={cn('h-10 w-full rounded-lg text-sm font-bold tabular-nums transition-shadow hover:shadow-lift hover:ring-2 hover:ring-saffron-400', heat(r[k], max))}
                                  aria-label={`${r[k]} files in ${STAGE_LABEL[k]} at ${r.region}`}
                                >
                                  {r[k]}
                                </motion.button>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-3 text-xs text-ink-mute">Kanpur and Hyderabad carry the heaviest re-scrutiny and EVC queues. Bottleneck insights explains why.</p>
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-6">
              <div className="card overflow-hidden">
                <div className="bg-navy-mesh px-6 py-5 text-white">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-saffron-400">
                    <CalendarClock size={14} /> Decision deadline · 30 Apr 2027
                  </p>
                  <Countdown to="2027-04-30" dark className="mt-3" />
                </div>
                <div data-tour="forecast" className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="text-sm">
                    <p className="font-semibold">Projected within target: {(projBase.onTime * 100).toFixed(0)}%</p>
                    <p className="text-ink-mute">+3 officers in Kanpur and Hyderabad: {(projPlus.onTime * 100).toFixed(0)}%</p>
                  </div>
                  <Link to="/aicte/simulator" className="btn-secondary btn-sm shrink-0">
                    Simulate <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
              <div data-tour="live">
                <Card title="Live Activity Stream" subtitle="Cryptographic evidence events as they occur">
                  <LiveActivity />
                </Card>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── SUBPAGE 2: WORK QUEUE SUMMARY ──────────────────────────── */}
      {activeTab === 'workqueue' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card title="Work Queue Overview by Processing Stage" subtitle="Jump directly to the committee queue requiring action.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { title: 'Regulation Bureau Queue', stage: 'submitted', count: (apps.data ?? []).filter((a) => a.stage === 'submitted').length, path: '/aicte/bureau', desc: 'New submissions awaiting administrative review & routing' },
                { title: 'Scrutiny Review Queue', stage: 'scrutiny', count: (apps.data ?? []).filter((a) => a.stage === 'scrutiny' || a.stage === 'rescrutiny').length, path: '/aicte/scrutiny', desc: 'Files under document verification & deficiency management' },
                { title: 'EVC Inspection Queue', stage: 'evc', count: (apps.data ?? []).filter((a) => a.stage === 'evc').length, path: '/aicte/evc', desc: 'Site visit scheduling, panel selection & report drafting' },
                { title: 'SHC Hearing Queue', stage: 'shc', count: (apps.data ?? []).filter((a) => a.stage === 'shc').length, path: '/aicte/shc', desc: 'Show-cause hearings & institutional compliance reviews' },
                { title: 'Executive Committee Queue', stage: 'ec', count: (apps.data ?? []).filter((a) => a.stage === 'ec').length, path: '/aicte/executive', desc: 'Decision-ready cases awaiting competent authority recording' },
                { title: 'Council Decision Queue', stage: 'appeal', count: (apps.data ?? []).filter((a) => a.stage === 'appeal').length, path: '/aicte/council', desc: 'Ratifications & Standing Appellate Committee (SAC) appeals' },
              ].map((item, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 p-5 bg-white flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-display text-sm font-bold text-ink">{item.title}</h4>
                      <span className="font-black text-xl text-brand-900 tabular-nums">{item.count}</span>
                    </div>
                    <p className="text-xs text-ink-mute mt-1.5">{item.desc}</p>
                  </div>
                  <Link to={item.path} className="btn-secondary btn-sm mt-4 inline-flex items-center justify-center gap-1">
                    Open Queue &rarr;
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 3: UPCOMING INSPECTIONS & HEARINGS ───────────────── */}
      {activeTab === 'inspections' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card title="Scheduled EVC Visits & SHC Hearings" subtitle="Consolidated calendar coordinating expert visits and committee hearings across regions.">
            <div className="space-y-3">
              {[
                { type: 'EVC Inspection', inst: 'Narmada Valley Institute of Technology', date: '12 Nov 2026', ref: 'ANU-2026-0412', status: 'Panel Assigned (drand)', mode: 'Physical' },
                { type: 'SHC Hearing', inst: 'Sunrise Technical Institute', date: '18 Nov 2026', ref: 'ANU-2026-0391', status: 'Hearing Notice Issued', mode: 'Virtual (Online)' },
                { type: 'EVC Inspection', inst: 'Western Plateau Tech', date: '21 Nov 2026', ref: 'ANU-2026-0420', status: 'Panel Coordination', mode: 'Physical' },
                { type: 'Executive Committee Meeting', inst: 'National Approvals Batch 4', date: '28 Nov 2026', ref: 'EC-2026-B4', status: 'Docket Finalised', mode: 'Council Room' },
              ].map((ev, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between bg-white">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-800">{ev.type}</span>
                      <span className="font-mono text-xs text-ink-mute">{ev.ref}</span>
                      <Badge tone="slate">{ev.mode}</Badge>
                    </div>
                    <h4 className="font-display text-sm font-bold text-ink mt-1">{ev.inst}</h4>
                    <p className="text-xs text-ink-mute mt-0.5">Scheduled for: <strong>{ev.date}</strong> · Status: {ev.status}</p>
                  </div>
                  <Link to="/aicte/calendar" className="btn-secondary btn-sm shrink-0 self-start sm:self-center">
                    Calendar Details &rarr;
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 4: OVERDUE & DEADLINE MONITOR ───────────────────── */}
      {activeTab === 'overdue' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card title="Overdue Files & Auto-Escalation Monitor" subtitle="Applications exceeding statutory SLA deadlines, automatically escalated to senior bureau officials.">
            <div className="space-y-3">
              {atRisk.map((a, i) => (
                <div key={a.id} className="rounded-xl border border-red-200 bg-red-50/40 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-brand-900">{a.id}</span>
                      <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                        {a.clock === 'breached' ? 'SLA Breached' : 'High Delay Risk'}
                      </span>
                      <span className="text-xs text-ink-mute">{STAGE_LABEL[a.stage]}</span>
                    </div>
                    <h4 className="font-display text-sm font-bold text-ink mt-1">{institutionById(a.institutionId)?.name}</h4>
                    <p className="text-xs text-ink-mute mt-0.5">
                      Top contributing factor: <strong>{a.riskReasons[0]?.factor}</strong> (Target SLA was {formatDate(a.dueOn)})
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <RiskMeter value={a.risk} />
                    <Link to={`/aicte/applications/${a.id}`} className="btn-primary btn-sm">
                      Inspect Dossier &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 5: DEPARTMENT WORKLOAD ──────────────────────────── */}
      {activeTab === 'workload' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card title="Workload Distribution by AICTE Department" subtitle="Active cases across Scrutiny, Inspections, Hearings and Executive Review.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { dept: 'Regulation Bureau', active: 14, officers: 8, avgDays: '4.2 days', capacity: 'Normal' },
                { dept: 'Scrutiny Review Cell', active: 22, officers: 6, avgDays: '8.7 days', capacity: 'Heavy' },
                { dept: 'EVC Coordination', active: 9, officers: 4, avgDays: '14.1 days', capacity: 'Normal' },
                { dept: 'Standing Hearing Committee', active: 6, officers: 5, avgDays: '6.5 days', capacity: 'Normal' },
              ].map((d, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-4 bg-white text-xs">
                  <h4 className="font-display font-bold text-ink text-sm">{d.dept}</h4>
                  <div className="mt-3 space-y-1.5 text-ink-mute">
                    <div className="flex justify-between"><span>Active Files:</span><strong className="text-ink">{d.active}</strong></div>
                    <div className="flex justify-between"><span>Assigned Staff:</span><strong className="text-ink">{d.officers} Officers</strong></div>
                    <div className="flex justify-between"><span>Avg Stage Duration:</span><strong className="text-ink">{d.avgDays}</strong></div>
                    <div className="flex justify-between"><span>Load Capacity:</span><strong className={d.capacity === 'Heavy' ? 'text-amber-600' : 'text-indgreen-600'}>{d.capacity}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      <Tour id="command" steps={COMMAND_TOUR} />
    </>
  );
}
