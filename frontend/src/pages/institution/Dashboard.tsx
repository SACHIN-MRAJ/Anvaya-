import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Clock3,
  FileCheck,
  FilePlus2,
  FileStack,
  Flame,
  FolderLock,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAsync } from '../../lib/useAsync';
import { getInstitutionApplications, getObligations, getNotifications } from '../../services/api';
import { DEMO_INSTITUTION, regionName } from '../../data/institutions';
import { typeById } from '../../data/rules';
import {
  Badge,
  Card,
  ClockBadge,
  LoadingRows,
  ObligationBadge,
  PageHeader,
  PublicStatusBadge,
  Ring,
  Stat,
  stagger,
  Reveal,
  toast,
} from '../../components/ui';
import { MiniProgress } from './shared';
import { getFaculty, getInfrastructure } from '../../services/records';
import { daysBetween, formatDate, formatDateTime, TODAY } from '../../lib/utils';
import { Tour } from '../../components/live';
import { INST_DASHBOARD_TOUR } from '../../data/tours';

/* ── Tab definitions matching Document Section 2.1 ── */
const TABS = [
  { id: 'overview',   label: 'Overview & KPIs',           icon: <LayoutDashboard size={15} /> },
  { id: 'timeline',   label: 'Application Timeline',      icon: <Clock size={15} /> },
  { id: 'actions',    label: 'Pending Actions',           icon: <AlertTriangle size={15} /> },
  { id: 'deadlines',  label: 'Deadlines & Expiry Alerts', icon: <Calendar size={15} /> },
  { id: 'notifs',     label: 'Notifications Preview',     icon: <Bell size={15} /> },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function InstDashboard() {
  const inst = DEMO_INSTITUTION;
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const apps = useAsync(() => getInstitutionApplications(inst.id));
  const obl = useAsync(() => getObligations(inst.id));
  const faculty = useAsync(getFaculty);
  const infra = useAsync(getInfrastructure);
  const notifs = useAsync(getNotifications);

  const list = apps.data ?? [];
  const leaseYears = inst.leaseEnd
    ? (new Date(inst.leaseEnd).getTime() - new Date(TODAY).getTime()) / (365.25 * 86_400_000)
    : 99;
  const runway = leaseYears - inst.longestCourseYears;

  /* Priority Action Items */
  const urgent = [
    list.filter((a) => a.publicStatus === 'Action needed').length > 0 && {
      icon: <AlertTriangle size={18} />,
      tone: 'amber' as const,
      title: `Response required on ${list.find((a) => a.publicStatus === 'Action needed')?.id}`,
      text: 'Deficiency raised at scrutiny. The deadline clock is paused until your response is submitted.',
      href: `/institution/applications/${list.find((a) => a.publicStatus === 'Action needed')?.id}`,
      action: 'Submit Response',
      due: 'Due in 5 days',
    },
    {
      icon: <Flame size={18} />,
      tone: 'red' as const,
      title: 'Fire Safety Certificate Expiring',
      text: `Mandatory Fire NOC expires in ${daysBetween(TODAY, '2026-11-08')} days (08 Nov 2026). Upload renewed certificate to prevent compliance blockage.`,
      href: '/institution/compliance',
      action: 'Upload Renewal',
      due: '08 Nov 2026',
    },
    runway < 5 && {
      icon: <Landmark size={18} />,
      tone: 'amber' as const,
      title: 'Land Lease Expiry Warning',
      text: `Land lease has ${leaseYears.toFixed(1)} years left. AICTE norms (APH 2.1(e)) require lease duration to exceed course duration.`,
      href: '/institution/profile',
      action: 'Plan Extension',
      due: 'Review needed',
    },
  ].filter(Boolean) as { icon: React.ReactNode; tone: 'amber' | 'red'; title: string; text: string; href: string; action: string; due: string }[];

  /* Institutional Health Score */
  const healthItems = [
    { label: 'Obligations due within 30 days', penalty: -6 * (obl.data ?? []).filter((o) => o.status === 'Due soon').length },
    { label: `Lease runway ${runway.toFixed(1)} yr`, penalty: runway < 2 ? -10 : 0 },
    { label: 'Files waiting on you', penalty: -8 * list.filter((a) => a.publicStatus === 'Action needed').length },
    { label: 'Overdue / escalated items', penalty: -15 * (obl.data ?? []).filter((o) => o.status === 'Overdue' || o.status === 'Escalated').length },
  ];
  const score = Math.max(0, 100 + healthItems.reduce((s, i) => s + i.penalty, 0));
  const scoreTone = score >= 85 ? '#167340' : score >= 65 ? '#DB700A' : '#C0352B';

  return (
    <>
      <PageHeader
        eyebrow={`AICTE Permanent ID: ${inst.aicteId} · ${regionName(inst.region)} Regional Office`}
        title="Institution Dashboard"
        description="A single overview of institutional applications, pending tasks, compliance deadlines and official communications."
        actions={
          <div className="flex items-center gap-2">
            <Link to="/institution/apply" className="btn-primary">
              <FilePlus2 size={16} /> New Application
            </Link>
          </div>
        }
        tourId="inst-dashboard"
      />

      <Tour id="inst-dashboard" steps={INST_DASHBOARD_TOUR} />

      {/* ── Subpage Navigation Tabs (Section 2.1) ────────────────────── */}
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
              {t.id === 'actions' && urgent.length > 0 && (
                <span className="grid h-4 w-4 place-items-center rounded-full bg-red-500 text-[10px] text-white">
                  {urgent.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW & KPIS ─────────────────────────────────── */}
      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {/* Top KPI Cards */}
          <motion.div variants={stagger} initial="hidden" animate="show" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Total Applications"
              value={list.length}
              hint="Recorded cycle 2026-28"
              icon={<FileStack size={20} />}
            />
            <Stat
              label="In Progress"
              value={list.filter((a) => a.publicStatus === 'Ongoing').length}
              hint="Advancing through committees"
              tone="brand"
              icon={<Loader2 size={20} />}
            />
            <Stat
              label="Action Needed"
              value={list.filter((a) => a.publicStatus === 'Action needed').length}
              hint="Awaiting institution reply"
              tone="amber"
              icon={<AlertTriangle size={20} />}
            />
            <Stat
              label="Approved / Decided"
              value={list.filter((a) => a.publicStatus === 'Decision issued').length}
              hint="Digitally signed letters"
              tone="green"
              icon={<CheckCircle2 size={20} />}
            />
          </motion.div>

          {/* Urgent Alert Banner */}
          {urgent.length > 0 && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/70 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b border-red-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                  </span>
                  <h3 className="font-display text-sm font-bold text-red-900">Urgent Items Requiring Immediate Attention</h3>
                </div>
                <button
                  onClick={() => setActiveTab('actions')}
                  className="text-xs font-semibold text-red-700 hover:text-red-900 hover:underline"
                >
                  View all ({urgent.length}) &rarr;
                </button>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {urgent.slice(0, 2).map((u, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl bg-white p-3.5 shadow-xs border border-red-100">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${u.tone === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {u.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-ink">{u.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-mute">{u.text}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-red-600">{u.due}</span>
                        <Link to={u.href} className="text-xs font-bold text-brand-700 hover:underline">
                          {u.action} &rarr;
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Content Grid: Proactive Renewal & Health Score */}
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            {/* Proactive Renewal Box */}
            <div className="card relative overflow-hidden p-6 border border-slate-200">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-saffron-400 to-saffron-600 text-white shadow-lift">
                  <CheckCircle2 size={24} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-saffron-700">Streamlined Workflow</p>
                  <h3 className="mt-1 font-display text-lg font-bold text-ink">Extension of Approval (EoA) 2027-28 is Pre-filled</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-mute">
                    Your institutional baseline from 2026-27 has been pre-populated into the renewal application. Only verified updates require confirmation.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-slate-50 p-4 border border-slate-100">
                <div className="flex justify-between text-xs text-ink">
                  <span className="font-semibold">41 of 46 fields verified from institutional records</span>
                  <span className="font-bold text-brand-700">89% Ready</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-indgreen-600" style={{ width: '89%' }} />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-2">
                <Link to="/institution/apply?type=eoa" className="btn-primary">
                  Review & Submit EoA <ArrowRight size={15} />
                </Link>
                <span className="text-xs font-medium text-ink-mute">Submission Window: Open until 30 Nov 2026</span>
              </div>
            </div>

            {/* Health Score & Radar */}
            <div className="card p-6 border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-display text-sm font-bold text-ink">Institutional Compliance Health</h3>
                <span className="rounded-md px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: `${scoreTone}15`, color: scoreTone }}>
                  {score >= 85 ? 'Excellent' : score >= 65 ? 'Satisfactory' : 'Action Required'}
                </span>
              </div>

              <div className="my-4 flex items-center justify-center gap-5">
                <Ring value={score / 100} tone={scoreTone} size={110}>
                  <div className="text-center">
                    <span className="font-display text-2xl font-black text-ink">{score}</span>
                    <span className="block text-[10px] uppercase font-bold text-ink-mute">/ 100</span>
                  </div>
                </Ring>
                <div className="space-y-1.5 text-xs">
                  <p className="font-semibold text-ink">Health Index Factors:</p>
                  <p className="text-ink-mute">• Zero unaddressed show-cause</p>
                  <p className="text-ink-mute">• Student-faculty ratio compliant</p>
                  <p className="text-ink-mute">• Land lease runway verified</p>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                {healthItems.map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-ink-mute">
                    <span>{h.label}</span>
                    <span className={h.penalty < 0 ? 'font-bold text-red-600' : 'font-semibold text-indgreen-600'}>
                      {h.penalty < 0 ? `${h.penalty} pts` : 'Compliant'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── TAB 2: APPLICATION TIMELINE ───────────────────────────── */}
      {activeTab === 'timeline' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card title="Stage-by-Stage Application Timeline" subtitle="Track progress through Scrutiny, EVC, SHC and Executive Committee review stages.">
            {list.length === 0 ? (
              <p className="p-8 text-center text-sm text-ink-mute">No applications currently submitted.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {list.map((app) => (
                  <div key={app.id} className="py-5 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-brand-800">{app.id}</span>
                          <Badge tone="slate">{typeById(app.typeId)?.name ?? app.typeId}</Badge>
                          <PublicStatusBadge status={app.publicStatus} />
                        </div>
                        <p className="mt-1 text-xs text-ink-mute">
                          Submitted on {formatDate(app.submittedOn)} · Current Stage Holder: <strong className="text-ink">{app.holder}</strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <ClockBadge state={app.clock} label={formatDate(app.dueOn)} />
                        <Link to={`/institution/applications/${app.id}`} className="btn-secondary btn-sm">
                          View Dossier <ArrowRight size={13} />
                        </Link>
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="mt-4">
                      <MiniProgress app={app} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* ── TAB 3: PENDING ACTIONS ─────────────────────────────────── */}
      {activeTab === 'actions' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card title="Prioritized Institutional Tasks" subtitle="Tasks requiring input from the Principal, HoD or Compliance Cell.">
            <div className="space-y-3">
              {urgent.map((u, i) => (
                <div key={i} className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between border-slate-200 bg-white">
                  <div className="flex items-start gap-3.5">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${u.tone === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {u.icon}
                    </span>
                    <div>
                      <h4 className="font-display text-sm font-bold text-ink">{u.title}</h4>
                      <p className="mt-0.5 text-xs text-ink-mute leading-relaxed">{u.text}</p>
                      <span className="mt-2 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-ink">
                        Deadline: {u.due}
                      </span>
                    </div>
                  </div>
                  <Link to={u.href} className="btn-primary shrink-0 self-start sm:self-center">
                    {u.action} <ArrowRight size={15} />
                  </Link>
                </div>
              ))}

              {/* General Good Standing confirmation */}
              <div className="rounded-xl border border-indgreen-200 bg-indgreen-50/50 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-indgreen-100 text-indgreen-700">
                    <CheckCircle2 size={18} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-indgreen-900">Annual Faculty Cadre Validation Passed</p>
                    <p className="text-xs text-indgreen-700">Faculty roster meets 1:20 UG norm and 1:2:6 cadre ratio.</p>
                  </div>
                </div>
                <Link to="/institution/profile" className="text-xs font-bold text-indgreen-800 hover:underline">
                  View Roster &rarr;
                </Link>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── TAB 4: DEADLINES & EXPIRY ALERTS ────────────────────────── */}
      {activeTab === 'deadlines' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Statutory Certificates Validity" subtitle="Real-time expiration radar for campus safety clearances.">
              <div className="space-y-3.5">
                {[
                  { name: 'Fire Safety NOC', validUntil: '2026-11-08', days: daysBetween(TODAY, '2026-11-08'), status: 'Expiring Soon' },
                  { name: 'Building Occupancy Certificate', validUntil: '2031-06-30', days: 1700, status: 'Valid' },
                  { name: 'Structural Stability Certificate', validUntil: '2029-04-15', days: 900, status: 'Valid' },
                  { name: 'University Affiliation (2026-27)', validUntil: '2027-06-30', days: 245, status: 'Valid' },
                ].map((c, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs">
                    <div>
                      <p className="font-semibold text-ink">{c.name}</p>
                      <p className="text-ink-mute">Valid until: {formatDate(c.validUntil)}</p>
                    </div>
                    <div className="text-right">
                      <span className={`rounded-md px-2 py-0.5 font-bold ${c.days < 30 ? 'bg-red-100 text-red-700' : 'bg-indgreen-100 text-indgreen-700'}`}>
                        {c.days < 30 ? `Expires in ${c.days} days` : 'Valid'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Land Lease Runway Radar" subtitle="Approval Process Handbook Clause 2.1(e) & 6.17.">
              <div className="p-4 text-center">
                <div className="inline-block rounded-2xl bg-amber-50 p-4 border border-amber-200">
                  <Landmark size={32} className="mx-auto text-amber-700 mb-2" />
                  <p className="text-2xl font-black text-ink">{leaseYears.toFixed(1)} Years</p>
                  <p className="text-xs text-ink-mute">Remaining on Registered Lease</p>
                </div>
                <p className="mt-4 text-xs text-ink-mute leading-relaxed">
                  Longest course duration: <strong>{inst.longestCourseYears} years</strong>. Net runway is <strong>{runway.toFixed(1)} years</strong>.
                  AICTE guidelines mandate initiating lease extensions when runway falls below 3 years.
                </p>
                <Link to="/institution/profile" className="btn-secondary btn-sm mt-4 inline-flex">
                  Manage Land Records
                </Link>
              </div>
            </Card>
          </div>
        </motion.div>
      )}

      {/* ── TAB 5: NOTIFICATIONS PREVIEW ───────────────────────────── */}
      {activeTab === 'notifs' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card title="Recent Official Communications" subtitle="Status changes, scrutiny reports, hearing notices and council updates.">
            <div className="divide-y divide-slate-100">
              {(notifs.data ?? [
                { id: 1, title: 'Fire safety certificate expires in 17 days', createdAt: 'Today 09:00', tone: 'amber', read: false },
                { id: 2, title: 'Action needed on ANU-2026-0398: upload university NOC', createdAt: '2 days ago', tone: 'red', read: false },
                { id: 3, title: 'Expert Visit Committee (EVC) panel confirmed for ANU-2026-0412', createdAt: '5 days ago', tone: 'green', read: true },
                { id: 4, title: 'Academic Calendar revision published: submission window extended to 30 Nov', createdAt: '1 week ago', tone: 'brand', read: true },
              ]).map((n, i) => (
                <div key={i} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-slate-300' : 'bg-brand-600 animate-pulse'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${n.read ? 'text-ink-soft' : 'font-bold text-ink'}`}>{n.title}</p>
                    <p className="text-[11px] text-ink-mute mt-0.5">{n.createdAt}</p>
                  </div>
                  <Link to="/institution/compliance" className="text-xs font-semibold text-brand-700 hover:underline">
                    View &rarr;
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </>
  );
}
