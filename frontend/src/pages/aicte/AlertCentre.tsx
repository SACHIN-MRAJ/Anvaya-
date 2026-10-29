import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Bell, CalendarClock, CheckCircle2, ChevronRight,
  Clock, FileText, Mail, Phone, Search, TrendingUp,
} from 'lucide-react';
import { Badge, Card, CountUp, LoadingRows, PageHeader } from '../../components/ui';
import { useResource } from '../../lib/resource';
import { getApplications, getDashboardStats } from '../../services/api';
import { useNotifications } from '../../lib/live-data';
import { INSTITUTIONS } from '../../data/institutions';
import { STAGE_LABEL } from '../../data/applications';
import { cn, daysBetween, formatDate, formatDateTime, TODAY } from '../../lib/utils';

const instName = (id: string) => INSTITUTIONS.find((i) => i.id === id)?.name ?? id;

const FALLBACK_ALERTS = [
  { id: 1, title: 'Escalation L3: security deposit proof overdue (Krishna Delta)', tone: 'red' as const,   ref: 'ANU-2026-0391', source: 'Deadline Engine',  createdAt: '2026-10-27T09:14:00Z', read: false },
  { id: 2, title: '6 new applications submitted in Central region',               tone: 'brand' as const, ref: null,            source: 'Applications',     createdAt: '2026-10-27T08:42:00Z', read: false },
  { id: 3, title: 'EVC panel drawn for ANU-2026-0412 (drand round committed)',   tone: 'green' as const, ref: 'ANU-2026-0412', source: 'EVC Scheduler',    createdAt: '2026-10-27T07:00:00Z', read: true  },
  { id: 4, title: 'Kanpur re-scrutiny queue crossed 25-day average',             tone: 'amber' as const, ref: null,            source: 'Insights',         createdAt: '2026-10-27T06:00:00Z', read: true  },
  { id: 5, title: 'Rule version 3.1 proposed — requires Bureau Admin review',   tone: 'brand' as const, ref: null,            source: 'Rules Studio',     createdAt: '2026-10-26T17:30:00Z', read: false },
  { id: 6, title: 'SHC hearing scheduled: Sunrise Technical Institute',          tone: 'amber' as const, ref: 'ANU-2026-0391', source: 'SHC Portal',       createdAt: '2026-10-26T14:00:00Z', read: true  },
  { id: 7, title: 'Faculty integrity flag on INS-003 (3 duplicate entries)',     tone: 'red' as const,   ref: null,            source: 'Integrity',        createdAt: '2026-10-26T11:45:00Z', read: false },
  { id: 8, title: 'Compliance submission accepted: Krishna Delta Polytechnic',   tone: 'green' as const, ref: 'ANU-2026-0405', source: 'Compliance',       createdAt: '2026-10-26T10:20:00Z', read: true  },
];

const ESC_RULES = [
  { id: 1, trigger: 'Scrutiny > 25 days',        escalateTo: 'Regulation Bureau Admin',      action: ['Email', 'In-app'], active: true  },
  { id: 2, trigger: 'EVC report pending > 5 d',  escalateTo: 'EVC Inspector',                action: ['In-app'],          active: true  },
  { id: 3, trigger: 'Deadline breached',          escalateTo: 'Regulation Bureau Admin',      action: ['Email', 'SMS'],    active: true  },
  { id: 4, trigger: 'SHC hearing overdue',        escalateTo: 'SHC Compliance Reviewer',      action: ['Email'],           active: true  },
  { id: 5, trigger: 'EC decision pending > 7 d', escalateTo: 'Executive Committee Approver', action: ['In-app'],          active: false },
  { id: 6, trigger: 'Appeal deadline < 2 days',  escalateTo: 'Council Decision Authority',   action: ['Email', 'SMS'],    active: true  },
];

const ESC_HISTORY = [
  { appId: 'ANU-2026-0391', reason: 'Deadline breached (security deposit)',    to: 'Regulation Bureau Admin',    date: '2026-10-25' },
  { appId: 'ANU-2026-0378', reason: 'Scrutiny exceeded 30 days',              to: 'Regulation Bureau Admin',    date: '2026-10-23' },
  { appId: 'ANU-2026-0392', reason: 'EVC report pending > 5 days',           to: 'EVC Inspector',              date: '2026-10-22' },
  { appId: 'ANU-2026-0405', reason: 'SHC hearing overdue by 3 days',         to: 'SHC Compliance Reviewer',    date: '2026-10-21' },
  { appId: 'ANU-2026-0371', reason: 'EC decision pending 8 days',            to: 'Executive Committee Approver', date: '2026-10-19' },
];

const TEMPLATES = [
  { id: 1, name: 'Scrutiny Deficiency Notice',  channels: ['Email'],           edited: '2026-10-10' },
  { id: 2, name: 'EVC Inspection Reminder',     channels: ['Email', 'In-app'], edited: '2026-10-08' },
  { id: 3, name: 'SHC Hearing Notification',    channels: ['Email', 'SMS'],    edited: '2026-10-05' },
  { id: 4, name: 'Deadline Breach Escalation',  channels: ['Email', 'SMS'],    edited: '2026-10-01' },
  { id: 5, name: 'Application Approval Letter', channels: ['Email'],           edited: '2026-09-28' },
  { id: 6, name: 'Compliance Acknowledgement',  channels: ['In-app'],          edited: '2026-09-20' },
];

const DELIVERY_LOG = [
  { time: '09:14', recipient: 'principal@krishna.edu',    template: 'Deadline Breach Escalation',  channel: 'Email',  status: 'Delivered' },
  { time: '08:42', recipient: 'r.verma@aicte.example',   template: 'Application Approval Letter',  channel: 'Email',  status: 'Delivered' },
  { time: '07:00', recipient: 'evc@aicte.example',        template: 'EVC Inspection Reminder',      channel: 'In-app', status: 'Delivered' },
  { time: '17:30', recipient: 'bureau@aicte.example',     template: 'Scrutiny Deficiency Notice',   channel: 'Email',  status: 'Delivered' },
  { time: '14:00', recipient: '+91 98765 43210',           template: 'SHC Hearing Notification',     channel: 'SMS',    status: 'Failed'    },
  { time: '11:45', recipient: 'auditor@aicte.example',    template: 'Compliance Acknowledgement',   channel: 'In-app', status: 'Delivered' },
  { time: '10:20', recipient: 'hod@sunrise.edu',           template: 'Application Approval Letter',  channel: 'Email',  status: 'Pending'   },
  { time: '09:00', recipient: 'r.verma@aicte.example',   template: 'Deadline Breach Escalation',  channel: 'Email',  status: 'Delivered' },
];

const TABS = ['Alert Inbox', 'Deadline & Overdue Monitor', 'EVC & Hearing Reminders', 'Escalation Rules', 'Notification Templates & Delivery Log'] as const;
type Tab = (typeof TABS)[number];

type AlertItem = { id: number; title: string; tone: 'red' | 'amber' | 'green' | 'brand'; ref: string | null; source: string; createdAt: string; read: boolean };

function toneDot(tone: string) {
  const c: Record<string, string> = { red: 'bg-red-500', amber: 'bg-amber-400', green: 'bg-indgreen-500', brand: 'bg-brand-500' };
  return c[tone] ?? 'bg-slate-400';
}

function agoText(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AlertCentre() {
  const [tab, setTab] = useState<Tab>('Alert Inbox');

  const { data: liveNotifs } = useNotifications();
  const { data: apps, loading: appsLoading } = useResource('alert-apps', getApplications, []);
  const { data: stats } = useResource('alert-stats', getDashboardStats, null);

  const alerts: AlertItem[] = (liveNotifs && liveNotifs.length > 0)
    ? liveNotifs.map((n) => ({ id: n.id, title: n.title, tone: n.tone, ref: n.ref ?? null, source: 'System', createdAt: n.createdAt, read: n.read }))
    : FALLBACK_ALERTS;

  const unread  = alerts.filter((a) => !a.read).length;
  const overdue = apps.filter((a) => daysBetween(a.dueOn, TODAY) < 0);
  const dueWeek = apps.filter((a) => { const d = daysBetween(a.dueOn, TODAY); return d >= 0 && d <= 7; });

  /* inbox state */
  const [inboxFilter, setInboxFilter] = useState<'All' | 'Unread' | 'Escalations' | 'Deadlines'>('All');
  const [readSet, setReadSet] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<AlertItem | null>(null);
  const [search, setSearch] = useState('');

  const filteredAlerts = alerts.filter((a) => {
    if (inboxFilter === 'Unread' && (a.read || readSet.has(a.id))) return false;
    if (inboxFilter === 'Escalations' && a.tone !== 'red') return false;
    if (inboxFilter === 'Deadlines' && a.tone !== 'amber') return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sortedApps = [...apps].sort((a, b) => daysBetween(a.dueOn, TODAY) - daysBetween(b.dueOn, TODAY));
  const daysColor = (d: number) =>
    d < 0 ? 'text-red-600 font-bold' : d <= 3 ? 'text-amber-600 font-bold' : d <= 7 ? 'text-amber-500' : 'text-indgreen-600';

  const [ruleStates, setRuleStates] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(ESC_RULES.map((r) => [r.id, r.active])));
  const [logFilter, setLogFilter] = useState('All');

  const channelIcon = (ch: string) =>
    ch === 'Email' ? <Mail size={11} /> : ch === 'SMS' ? <Phone size={11} /> : <Bell size={11} />;

  return (
    <div className="container-page py-6 space-y-5">
      <PageHeader eyebrow="Alert Centre" title="Alert Centre" description="Shared alerts, deadlines and escalation workspace for authorised administrative users." />

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Unread Alerts',     value: unread,          icon: <Bell size={15} />,          color: 'text-brand-600' },
          { label: 'Overdue Cases',      value: overdue.length,  icon: <AlertTriangle size={15} />, color: 'text-red-600'   },
          { label: 'Due This Week',      value: dueWeek.length,  icon: <Clock size={15} />,         color: 'text-amber-600' },
          { label: 'Active Escalations', value: stats?.breached ?? overdue.length, icon: <TrendingUp size={15} />, color: 'text-indgreen-600' },
        ].map(({ label, value, icon, color }, i) => (
          <motion.div key={label} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.06, duration:0.35 }}>
            <Card className="flex items-center gap-3 px-4 py-3">
              <span className={cn('shrink-0', color)}>{icon}</span>
              <div>
                <p className="text-xl font-extrabold text-ink tabular-nums"><CountUp value={value} /></p>
                <p className="text-[11px] text-ink-mute">{label}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-100/70 p-1 w-fit max-w-full">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('relative flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors',
              tab === t ? 'text-brand-800' : 'text-ink-mute hover:text-ink')}>
            {tab === t && <motion.span layoutId="ac-tab" className="absolute inset-0 rounded-xl bg-white shadow-card" transition={{ type:'spring', stiffness:400, damping:35 }} />}
            <span className="relative">
              {t}
              {t === 'Alert Inbox' && unread > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-600 px-1 text-[9px] font-bold text-white">{unread}</span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }} transition={{ duration:0.18 }}>

          {/* INBOX */}
          {tab === 'Alert Inbox' && (
            <div className="grid lg:grid-cols-[1fr_300px] gap-4">
              <Card className="overflow-hidden">
                <div className="border-b border-slate-100 px-4 py-3 space-y-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search alerts…"
                      className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 bg-white" />
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                    {(['All', 'Unread', 'Escalations', 'Deadlines'] as const).map((f) => (
                      <button key={f} onClick={() => setInboxFilter(f)}
                        className={cn('rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors',
                          inboxFilter === f ? 'bg-brand-600 text-white' : 'bg-slate-100 text-ink-soft hover:bg-slate-200')}>
                        {f}{f === 'Unread' && unread > 0 ? ` (${unread})` : ''}
                      </button>
                    ))}
                  </div>
                </div>
                <ul className="divide-y divide-slate-100">
                  {filteredAlerts.length === 0
                    ? <li className="flex flex-col items-center gap-2 py-10 text-ink-mute"><Bell size={22} /><span className="text-sm">No alerts match this filter.</span></li>
                    : filteredAlerts.map((a, i) => {
                        const isRead = a.read || readSet.has(a.id);
                        return (
                          <motion.li key={a.id} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay: i*0.03 }}
                            onClick={() => setSelected(a)}
                            className={cn('group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50',
                              selected?.id === a.id && 'bg-brand-50/60')}>
                            <span className={cn('h-2 w-2 rounded-full shrink-0', toneDot(a.tone))} />
                            <div className="flex-1 min-w-0">
                              <p className={cn('text-sm leading-snug truncate', isRead ? 'text-ink-soft' : 'text-ink font-semibold')}>{a.title}</p>
                              <p className="text-[11px] text-ink-mute mt-0.5">{a.source} · {agoText(a.createdAt)}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {!isRead && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                              <button onClick={(e) => { e.stopPropagation(); setReadSet((s) => { const n = new Set(s); n.add(a.id); return n; }); }}
                                className="hidden group-hover:block text-[10px] font-semibold text-brand-600 hover:text-brand-800">
                                Mark read
                              </button>
                              <ChevronRight size={13} className="text-slate-300" />
                            </div>
                          </motion.li>
                        );
                      })
                  }
                </ul>
                <div className="border-t border-slate-100 px-4 py-2.5 text-center">
                  <button className="text-xs font-semibold text-brand-600 hover:text-brand-800">Load more →</button>
                </div>
              </Card>

              <Card className="h-fit sticky top-4">
                <AnimatePresence mode="wait">
                  {selected ? (
                    <motion.div key={selected.id} initial={{ opacity:0, x:8 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0 }} className="p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <span className={cn('mt-1 h-2.5 w-2.5 rounded-full shrink-0', toneDot(selected.tone))} />
                        <p className="text-base font-bold text-ink leading-snug">{selected.title}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-ink-mute">
                        <span className="flex items-center gap-1"><Clock size={11} />{agoText(selected.createdAt)}</span>
                        <span>· {selected.source}</span>
                      </div>
                      {selected.ref && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                          <FileText size={10} />{selected.ref}
                        </span>
                      )}
                      <p className="text-sm text-ink-soft leading-relaxed">
                        Alert from the {selected.source} module. Review the linked application or act from the relevant portal section.
                      </p>
                      <div className="flex flex-col gap-2 pt-1">
                        {selected.ref && <button className="btn-primary btn-sm w-full justify-center">View Application</button>}
                        <button onClick={() => setReadSet((s) => { const n = new Set(s); n.add(selected!.id); return n; })} className="btn-secondary btn-sm w-full justify-center">Mark as Read</button>
                        <button className="text-xs text-ink-mute hover:text-red-600 transition-colors text-center">Archive</button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity:0 }} animate={{ opacity:1 }} className="flex flex-col items-center gap-3 py-16 px-4 text-ink-mute">
                      <Bell size={28} className="opacity-30" />
                      <p className="text-sm text-center">Select an alert to view details</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </div>
          )}

          {/* DEADLINES */}
          {tab === 'Deadline & Overdue Monitor' && (
            <div className="grid lg:grid-cols-[220px_1fr] gap-4">
              <div className="space-y-3">
                <Card className="card-pad">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-mute mb-3">On-time Rate</p>
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative flex items-center justify-center w-20 h-20">
                      <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor"
                          strokeWidth="3" strokeLinecap="round"
                          strokeDasharray={`${(stats?.onTimeRate ?? 0.94) * 100} 100`}
                          className="text-brand-600 transition-all duration-700" />
                      </svg>
                      <span className="absolute text-base font-extrabold text-ink">{Math.round((stats?.onTimeRate ?? 0.94) * 100)}%</span>
                    </div>
                    <p className="text-[11px] text-ink-mute text-center">applications on track</p>
                  </div>
                </Card>
                <Card className="card-pad space-y-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Breakdown</p>
                  {[
                    { label: 'Overdue',       value: overdue.length,                                  bg: 'bg-red-50 text-red-700'      },
                    { label: 'Due 7 days',    value: dueWeek.length,                                  bg: 'bg-amber-50 text-amber-700'  },
                    { label: 'On track',      value: apps.length - overdue.length - dueWeek.length,   bg: 'bg-indgreen-50 text-indgreen-700' },
                  ].map(({ label, value, bg }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-sm text-ink-soft">{label}</span>
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', bg)}>{value}</span>
                    </div>
                  ))}
                </Card>
              </div>

              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-bold text-ink">{appsLoading ? 'Loading…' : `${apps.length} cases tracked`}</p>
                  <div className="flex items-center gap-1 text-xs text-ink-mute"><CalendarClock size={13} /> Sorted by urgency</div>
                </div>
                {appsLoading
                  ? <div className="p-4"><LoadingRows rows={5} /></div>
                  : (
                    <table className="table-base">
                      <thead><tr><th>Application</th><th>Institution</th><th>Stage</th><th>Due</th><th className="text-right">Days</th></tr></thead>
                      <tbody>
                        {sortedApps.slice(0, 12).map((a, i) => {
                          const d = daysBetween(a.dueOn, TODAY);
                          return (
                            <motion.tr key={a.id} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay: i*0.03 }}>
                              <td className="font-mono text-xs font-bold text-brand-700">{a.id}</td>
                              <td className="max-w-[160px] truncate text-xs">{instName(a.institutionId)}</td>
                              <td><Badge tone={a.stage === 'decision' ? 'green' : a.clock === 'breached' ? 'red' : 'brand'}>{(STAGE_LABEL as Record<string,string>)[a.stage] ?? a.stage}</Badge></td>
                              <td className="text-xs text-ink-mute">{formatDate(a.dueOn)}</td>
                              <td className={cn('text-right text-sm tabular-nums', daysColor(d))}>{d < 0 ? `${Math.abs(d)}d late` : `${d}d`}</td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )
                }
              </Card>
            </div>
          )}

          {/* REMINDERS */}
          {tab === 'EVC & Hearing Reminders' && (
            <div className="grid lg:grid-cols-[1fr_200px] gap-4">
              <Card className="overflow-hidden">
                <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                  <p className="text-sm font-bold text-ink">Next 7 Days</p>
                  <Badge tone="brand">{apps.filter((a) => ['evc','shc'].includes(a.stage)).length} events</Badge>
                </div>
                {appsLoading
                  ? <div className="p-4"><LoadingRows rows={4} /></div>
                  : apps.filter((a) => ['evc','shc'].includes(a.stage)).length === 0
                  ? <div className="flex flex-col items-center gap-2 py-12 text-ink-mute"><CalendarClock size={22} className="opacity-30" /><span className="text-sm">No events scheduled.</span></div>
                  : (
                    <ul className="divide-y divide-slate-100">
                      {apps.filter((a) => ['evc','shc'].includes(a.stage)).slice(0, 6).map((a, i) => (
                        <motion.li key={a.id} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay: i*0.05 }}
                          className={cn('flex items-start gap-3 px-4 py-3 border-l-2', a.stage === 'evc' ? 'border-brand-500' : 'border-amber-400')}>
                          <div className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-center min-w-[48px]">
                            <p className="text-[9px] font-bold uppercase text-ink-mute">{new Date(a.dueOn).toLocaleString('en-IN', { month:'short' })}</p>
                            <p className="text-base font-extrabold text-ink leading-none">{new Date(a.dueOn).getDate()}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <Badge tone={a.stage === 'evc' ? 'brand' : 'amber'}>{a.stage === 'evc' ? 'EVC Visit' : 'SHC Hearing'}</Badge>
                            </div>
                            <p className="text-sm font-semibold text-ink truncate">{instName(a.institutionId)}</p>
                            <p className="text-xs text-ink-mute">{a.id} · 3 participants</p>
                          </div>
                        </motion.li>
                      ))}
                    </ul>
                  )
                }
              </Card>

              <Card className="card-pad">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-mute mb-3">October 2026</p>
                <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-ink-mute mb-1">
                  {['S','M','T','W','T','F','S'].map((d, i) => <span key={i}>{d}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {Array.from({ length: 4 }).map((_, i) => <span key={`x${i}`} />)}
                  {Array.from({ length: 31 }).map((_, i) => {
                    const day = i + 1;
                    const hasEvent = [5, 12, 18, 22, 25, 28].includes(day);
                    const isToday = day === 22;
                    return (
                      <div key={day} className={cn('flex flex-col items-center rounded py-0.5', isToday ? 'bg-brand-100' : '')}>
                        <span className={cn('text-[10px]', isToday ? 'font-bold text-brand-800' : 'text-ink-soft')}>{day}</span>
                        {hasEvent && <span className="h-1 w-1 rounded-full bg-brand-500" />}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3 space-y-1">
                  <div className="flex justify-between text-xs"><span className="text-ink-mute">This month</span><span className="font-bold text-ink">6</span></div>
                  <div className="flex justify-between text-xs"><span className="text-ink-mute">EVC</span><span className="font-bold text-brand-700">4</span></div>
                  <div className="flex justify-between text-xs"><span className="text-ink-mute">SHC</span><span className="font-bold text-amber-700">2</span></div>
                </div>
              </Card>
            </div>
          )}

          {/* ESCALATION RULES */}
          {tab === 'Escalation Rules' && (
            <div className="grid lg:grid-cols-[1fr_260px] gap-4">
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-bold text-ink">Active Rules</p>
                  <button disabled className="btn-secondary btn-sm opacity-50 cursor-not-allowed">+ Add Rule</button>
                </div>
                <table className="table-base">
                  <thead><tr><th>Trigger</th><th>Escalate To</th><th>Channels</th><th className="text-right">On</th></tr></thead>
                  <tbody>
                    {ESC_RULES.map((r, i) => (
                      <motion.tr key={r.id} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay: i*0.04 }}>
                        <td className="text-sm font-medium">{r.trigger}</td>
                        <td className="text-xs text-ink-soft max-w-[140px] truncate">{r.escalateTo}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {r.action.map((ch) => (
                              <span key={ch} className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-ink-mute">
                                {channelIcon(ch)}{ch}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="text-right">
                          <button onClick={() => setRuleStates((s) => ({ ...s, [r.id]: !s[r.id] }))}
                            className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', ruleStates[r.id] ? 'bg-brand-600' : 'bg-slate-300')}>
                            <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', ruleStates[r.id] ? 'translate-x-4' : 'translate-x-0.5')} />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <Card className="overflow-hidden">
                <div className="border-b border-slate-100 px-4 py-3"><p className="text-sm font-bold text-ink">Recent Escalations</p></div>
                <ul className="divide-y divide-slate-100">
                  {ESC_HISTORY.map((e, i) => (
                    <motion.li key={i} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay: i*0.05 }}
                      className="flex items-start gap-2.5 border-l-2 border-brand-600 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs font-bold text-brand-700">{e.appId}</p>
                        <p className="text-xs text-ink-soft mt-0.5 leading-snug">{e.reason}</p>
                        <p className="text-[10px] text-ink-mute mt-1">→ {e.to}</p>
                      </div>
                      <span className="text-[10px] text-ink-mute whitespace-nowrap shrink-0">{e.date}</span>
                    </motion.li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          {/* TEMPLATES */}
          {tab === 'Notification Templates & Delivery Log' && (
            <div className="grid lg:grid-cols-[1fr_280px] gap-4">
              <Card className="overflow-hidden">
                <div className="border-b border-slate-100 px-4 py-3"><p className="text-sm font-bold text-ink">Notification Templates</p></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-100">
                  {TEMPLATES.map((t, i) => (
                    <motion.div key={t.id} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay: i*0.05 }}
                      className="flex items-center gap-3 bg-white px-4 py-3 hover:bg-slate-50 transition-colors">
                      <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        {t.channels.includes('Email') ? <Mail size={14} /> : t.channels.includes('SMS') ? <Phone size={14} /> : <Bell size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{t.name}</p>
                        <div className="flex gap-1 mt-0.5">
                          {t.channels.map((ch) => <span key={ch} className="text-[9px] font-bold uppercase tracking-wide text-ink-mute border border-slate-200 rounded px-1">{ch}</span>)}
                        </div>
                      </div>
                      <button className="shrink-0 btn-secondary btn-sm">Edit</button>
                    </motion.div>
                  ))}
                </div>
              </Card>
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-bold text-ink">Delivery Log</p>
                  <select value={logFilter} onChange={(e) => setLogFilter(e.target.value)}
                    className="text-xs rounded-lg border border-slate-200 bg-white px-2 py-1 focus:outline-none">
                    {['All','Delivered','Failed','Pending'].map((f) => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <ul className="divide-y divide-slate-100">
                  {DELIVERY_LOG.filter((l) => logFilter === 'All' || l.status === logFilter).map((l, i) => (
                    <motion.li key={i} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay: i*0.03 }} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-ink-mute">{l.time}</span>
                        <span className="flex-1 text-xs text-ink-soft truncate">{l.recipient}</span>
                        <Badge tone={l.status === 'Delivered' ? 'green' : l.status === 'Failed' ? 'red' : 'amber'}>{l.status}</Badge>
                      </div>
                      <p className="text-[11px] text-ink-mute mt-0.5 truncate">{l.template} · {l.channel}</p>
                    </motion.li>
                  ))}
                </ul>
                <div className="border-t border-slate-100 px-4 py-2 text-[10px] text-ink-mute">Showing 1–8 of 247</div>
              </Card>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
