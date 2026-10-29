import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeCheck, Calendar, CheckCircle2, ChevronDown, ChevronRight,
  FileText, Landmark, Loader2, Scale,
} from 'lucide-react';
import { Badge, Card, CountUp, LoadingRows, PageHeader } from '../../components/ui';
import { useResource } from '../../lib/resource';
import { getApplications, getDashboardStats } from '../../services/api';
import { INSTITUTIONS } from '../../data/institutions';
import { typeById } from '../../data/rules';
import { cn, daysBetween, formatDate, TODAY } from '../../lib/utils';

const instName = (id: string) => INSTITUTIONS.find(i => i.id === id)?.name ?? id;

const TABS = ['Council Dashboard & Queue', 'Decision Review', 'Ratification & Decision Records', 'Appeal Decision', 'Decision History'] as const;
type Tab = typeof TABS[number];

/* ── Sample data ── */
const SAMPLE_RECORDS = [
  { appId: 'ANU-2026-0380', outcome: 'Ratified',    ecRef: 'EC-2026-0380', date: '2026-10-15', officer: 'P. Nair'  },
  { appId: 'ANU-2026-0362', outcome: 'Deferred',    ecRef: 'EC-2026-0362', date: '2026-10-12', officer: 'P. Nair'  },
  { appId: 'ANU-2026-0375', outcome: 'Ratified',    ecRef: 'EC-2026-0375', date: '2026-10-08', officer: 'R. Verma' },
];

const HISTORY_ENTRIES = [
  { appId: 'ANU-2026-0391', inst: 'Sunrise Technical Institute', type: 'Greenfield',  outcome: 'Deferred',          date: '2026-10-20', officer: 'P. Nair',  year: '2026' },
  { appId: 'ANU-2026-0380', inst: 'Krishna Delta Polytechnic',   type: 'Seat increase', outcome: 'Ratified',          date: '2026-10-15', officer: 'R. Verma', year: '2026' },
  { appId: 'ANU-2026-0365', inst: 'Deccan College of Engg.',     type: 'New programme', outcome: 'Ratified',          date: '2026-10-01', officer: 'P. Nair',  year: '2026' },
  { appId: 'ANU-2026-0350', inst: 'Narmada Valley Institute',    type: 'EoA renewal',  outcome: 'Not Ratified',       date: '2026-09-22', officer: 'R. Verma', year: '2026' },
  { appId: 'ANU-2025-0812', inst: 'Western Plateau Tech',        type: 'Greenfield',  outcome: 'Ratified',           date: '2025-11-18', officer: 'P. Nair',  year: '2025' },
  { appId: 'ANU-2025-0798', inst: 'Eastern Hills College',       type: 'Seat increase', outcome: 'Upheld (Appeal)',   date: '2025-11-10', officer: 'R. Verma', year: '2025' },
  { appId: 'ANU-2025-0750', inst: 'Southern Poly Institute',     type: 'New programme', outcome: 'Dismissed (Appeal)', date: '2025-10-28', officer: 'P. Nair',  year: '2025' },
  { appId: 'ANU-2024-1102', inst: 'Northern Tech Academy',       type: 'EoA renewal',  outcome: 'Ratified',           date: '2024-12-14', officer: 'R. Verma', year: '2024' },
];

function outcomeTone(o: string): 'green' | 'red' | 'amber' | 'brand' {
  if (o.includes('Ratified') || o.includes('Upheld'))   return 'green';
  if (o.includes('Not Ratified') || o.includes('Dismissed')) return 'red';
  return 'amber';
}

const REVIEW_PANELS = [
  {
    title: 'Application Summary',
    content: (app: { id: string; institutionId: string; typeId: string; cycle: string; submittedOn: string; stage: string } | null) =>
      app ? (
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          {([
            ['Application ID', app.id],
            ['Institution', instName(app.institutionId)],
            ['Programme', typeById(app.typeId)?.name ?? app.typeId],
            ['Cycle', app.cycle],
            ['Submitted', formatDate(app.submittedOn)],
            ['Stage', app.stage.toUpperCase()],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-mute">{k}</p>
              <p className="font-medium text-ink mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      ) : null,
  },
  {
    title: 'EC Decision & Observations',
    content: () => (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge tone="green">Approved (Conditional)</Badge>
          <span className="text-xs text-ink-mute">EC-2026-0391 · 18 Oct 2026</span>
        </div>
        <p className="text-sm text-ink-soft leading-relaxed">
          The Executive Committee approved the application subject to submission of the outstanding security deposit proof
          within 30 days of this decision. Faculty targets must be met before commencement of the academic session.
        </p>
      </div>
    ),
  },
  {
    title: 'SHC Recommendations',
    content: () => (
      <div className="space-y-3">
        <p className="text-sm text-ink-soft leading-relaxed">
          SHC recommended conditional approval following the hearing conducted on 25 Oct 2026. The committee noted
          that the institution has addressed 4 of 5 deficiencies and requested a 30-day window for the remaining item.
        </p>
        <div className="flex gap-1.5 flex-wrap">
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Security deposit (APH 2.18) — outstanding</span>
        </div>
      </div>
    ),
  },
  {
    title: 'EVC Key Findings',
    content: () => (
      <div className="space-y-3">
        <p className="text-sm text-ink-soft leading-relaxed">
          EVC panel (3 members, drand-verified draw) conducted the inspection on 14 Sep 2026. Infrastructure meets
          minimum norms. Faculty shortage of 2 posts noted; appointment letters for 1 post provided.
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[['Infrastructure', 'Meets norms'], ['Faculty', 'Minor shortfall'], ['Library', 'Adequate'], ['Labs', 'Meets norms']].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2">
              <p className="text-ink-mute">{k}</p>
              <p className="font-semibold text-ink mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

/* ════════════════════════════════════════ */
export default function Council() {
  const [tab, setTab]               = useState<Tab>('Council Dashboard & Queue');
  const [openPanels, setOpenPanels] = useState<Set<number>>(new Set());
  const [ratForm, setRatForm]       = useState({ caseId: 'ANU-2026-0391', ecRef: 'EC-2026-0391', outcome: 'Ratified', notes: '', date: formatDate(TODAY) });
  const [ratBusy, setRatBusy]       = useState(false);
  const [ratDone, setRatDone]       = useState(false);
  const [appealForm, setAppealForm] = useState({ grounds: '', submission: '', outcome: 'Upheld', notes: '' });
  const [appealBusy, setAppealBusy] = useState(false);
  const [appealDone, setAppealDone] = useState(false);
  const [yearFilter, setYearFilter]     = useState('All');
  const [outcomeFilter, setOutcomeFilter] = useState('All');

  const { data: apps, loading } = useResource('council-apps', getApplications, []);
  const { data: stats }         = useResource('council-stats', getDashboardStats, null);

  const councilQueue = apps.filter(a => a.stage === 'ec');
  const selectedApp  = councilQueue[0] ?? apps[0] ?? null;

  const togglePanel = (i: number) => setOpenPanels(prev => {
    const s = new Set(prev);
    if (s.has(i)) s.delete(i); else s.add(i);
    return s;
  });

  const filteredHistory = HISTORY_ENTRIES.filter(h =>
    (yearFilter === 'All' || h.year === yearFilter) &&
    (outcomeFilter === 'All' || h.outcome.includes(outcomeFilter))
  );

  const statCards = [
    { label: 'Awaiting Council',   value: councilQueue.length || 3,   icon: <Landmark size={18} />,  color: 'text-brand-600 bg-brand-50'     },
    { label: 'Ratified This Cycle', value: stats?.decided ?? 42,        icon: <BadgeCheck size={18} />, color: 'text-indgreen-600 bg-indgreen-50' },
    { label: 'Appeals Pending',    value: 1,                           icon: <Scale size={18} />,     color: 'text-amber-600 bg-amber-50'      },
  ];

  return (
    <div className="container-page py-6 space-y-5">
      <PageHeader
        eyebrow="Council"
        title="Council Decision Stage"
        description="Council consideration, ratification of executive decisions and final appeal outcomes."
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
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
              <motion.span layoutId="council-tab" className="absolute inset-0 rounded-xl bg-white shadow-card"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
            )}
            <span className="relative">{t}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>

          {/* ── Tab 1: Dashboard & Queue ── */}
          {tab === 'Council Dashboard & Queue' && (
            <div className="space-y-3">
              {loading ? (
                <Card className="card-pad"><LoadingRows rows={3} /></Card>
              ) : (
                <>
                  {/* Real data */}
                  {councilQueue.map((app, i) => (
                    <motion.div key={app.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
                      <Card className="card-pad flex items-center gap-5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs font-bold text-brand-700">{app.id}</span>
                            <Badge tone="brand">EC Stage</Badge>
                          </div>
                          <p className="text-sm font-semibold text-ink truncate">{instName(app.institutionId)}</p>
                          <p className="text-xs text-ink-mute">{typeById(app.typeId)?.name ?? app.typeId} · Cycle {app.cycle}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-ink-mute">Days in EC</p>
                          <p className="text-2xl font-extrabold text-ink">{daysBetween(app.stageEnteredOn, TODAY)}</p>
                        </div>
                        <button className="btn-primary btn-sm shrink-0 flex items-center gap-1 text-xs">
                          Review <ChevronRight size={13} />
                        </button>
                      </Card>
                    </motion.div>
                  ))}
                  {/* Fallback sample when no EC-stage apps */}
                  {councilQueue.length === 0 && [
                    { id: 'ANU-2026-0391', name: 'Sunrise Technical Institute', type: 'Greenfield Application', cycle: '2027-28', days: 12 },
                    { id: 'ANU-2026-0405', name: 'Krishna Delta Polytechnic',   type: 'Seat increase',           cycle: '2027-28', days: 7  },
                    { id: 'ANU-2026-0412', name: 'Deccan College of Engineering', type: 'New programme',         cycle: '2027-28', days: 3  },
                  ].map((c, i) => (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
                      <Card className="card-pad flex items-center gap-5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs font-bold text-brand-700">{c.id}</span>
                            <Badge tone="brand">EC Stage</Badge>
                          </div>
                          <p className="text-sm font-semibold text-ink">{c.name}</p>
                          <p className="text-xs text-ink-mute">{c.type} · Cycle {c.cycle}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-ink-mute">Days in stage</p>
                          <p className="text-2xl font-extrabold text-ink">{c.days}</p>
                        </div>
                        <button className="btn-primary btn-sm shrink-0 flex items-center gap-1 text-xs">
                          Review <ChevronRight size={13} />
                        </button>
                      </Card>
                    </motion.div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── Tab 2: Decision Review ── */}
          {tab === 'Decision Review' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm mb-1">
                <span className="font-mono font-bold text-brand-700">{selectedApp?.id ?? 'ANU-2026-0391'}</span>
                <span className="text-ink-mute">·</span>
                <span className="text-ink-mute">{selectedApp ? instName(selectedApp.institutionId) : 'Sunrise Technical Institute'}</span>
              </div>
              {REVIEW_PANELS.map((panel, i) => (
                <motion.div key={panel.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.35 }}>
                  <div className="rounded-2xl border border-neutral-200 overflow-hidden">
                    <button onClick={() => togglePanel(i)}
                      className="w-full flex items-center justify-between px-5 py-3.5 bg-neutral-50/80 hover:bg-neutral-100 transition-colors">
                      <span className="text-sm font-bold text-ink">{panel.title}</span>
                      <motion.span animate={{ rotate: openPanels.has(i) ? 0 : -90 }} transition={{ duration: 0.2 }}>
                        <ChevronDown size={16} className="text-neutral-400" />
                      </motion.span>
                    </button>
                    <AnimatePresence initial={false}>
                      {openPanels.has(i) && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                          <div className="px-5 py-4">
                            {i === 0 ? panel.content(selectedApp) : (panel.content as () => JSX.Element)()}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
              <AnimatePresence>
                {openPanels.size === REVIEW_PANELS.length && (
                  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-3 rounded-2xl border border-indgreen-200 bg-indgreen-50 px-5 py-4">
                    <CheckCircle2 size={20} className="text-indgreen-600 shrink-0" />
                    <p className="text-sm font-semibold text-indgreen-800">All sections reviewed. Case is ready for ratification.</p>
                    <button onClick={() => setTab('Ratification & Decision Records')} className="ml-auto btn-primary btn-sm text-xs">
                      Proceed
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── Tab 3: Ratification & Records ── */}
          {tab === 'Ratification & Decision Records' && (
            <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
              <div>
                <h3 className="text-sm font-bold text-ink mb-4">Record Ratification</h3>
                <AnimatePresence mode="wait">
                  {!ratDone ? (
                    <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Card className="card-pad space-y-4">
                        {([
                          ['Case ID',               'caseId'],
                          ['EC Decision Reference', 'ecRef' ],
                          ['Date',                  'date'  ],
                        ] as [string, keyof typeof ratForm][]).map(([label, field]) => (
                          <div key={field}>
                            <label className="label">{label}</label>
                            <input type="text" className="input" value={ratForm[field]}
                              onChange={e => setRatForm(f => ({ ...f, [field]: e.target.value }))} />
                          </div>
                        ))}
                        <div>
                          <label className="label">Council Outcome</label>
                          <select className="input" value={ratForm.outcome} onChange={e => setRatForm(f => ({ ...f, outcome: e.target.value }))}>
                            <option>Ratified</option><option>Not Ratified</option><option>Deferred</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">Notes</label>
                          <textarea className="input min-h-[80px]" value={ratForm.notes} placeholder="Add any council observations…"
                            onChange={e => setRatForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>
                        <button onClick={() => { setRatBusy(true); setTimeout(() => { setRatBusy(false); setRatDone(true); }, 1200); }}
                          disabled={ratBusy} className="btn-primary w-full flex items-center justify-center gap-2">
                          {ratBusy ? <><Loader2 size={15} className="animate-spin" />Recording…</> : 'Record Ratification'}
                        </button>
                      </Card>
                    </motion.div>
                  ) : (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
                      <Card className="card-pad text-center py-10">
                        <CheckCircle2 size={40} className="mx-auto text-indgreen-500 mb-3" />
                        <p className="font-bold text-ink">Ratification Recorded</p>
                        <p className="text-sm text-ink-mute mt-1">{ratForm.caseId} · <strong>{ratForm.outcome}</strong></p>
                        <button className="btn-secondary btn-sm mt-4" onClick={() => setRatDone(false)}>Record Another</button>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink mb-4">Recent Records</h3>
                <Card className="overflow-hidden">
                  <table className="table-base">
                    <thead><tr><th>Case ID</th><th>Outcome</th><th>EC Ref</th><th>Date</th><th>Officer</th></tr></thead>
                    <tbody>
                      {SAMPLE_RECORDS.map((r, i) => (
                        <motion.tr key={r.appId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.07 }}>
                          <td className="font-mono text-xs font-bold text-brand-700">{r.appId}</td>
                          <td><Badge tone={outcomeTone(r.outcome)}>{r.outcome}</Badge></td>
                          <td className="text-xs text-ink-mute">{r.ecRef}</td>
                          <td className="text-xs text-ink-mute">{formatDate(r.date)}</td>
                          <td className="text-xs text-ink-soft">{r.officer}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            </div>
          )}

          {/* ── Tab 4: Appeal Decision ── */}
          {tab === 'Appeal Decision' && (
            <div className="grid lg:grid-cols-2 gap-5">
              <Card className="card-pad space-y-4">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <FileText size={16} className="text-brand-600" /> Original Decision
                </h3>
                <div className="space-y-2.5">
                  {([
                    ['Application ID',   'ANU-2026-0391'],
                    ['Institution',      'Sunrise Technical Institute'],
                    ['EC Decision',      'Conditional Approval'],
                    ['Date of Decision', '18 Oct 2026'],
                    ['Appeal Filed',     '25 Oct 2026'],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2 border-b border-neutral-100 pb-2">
                      <span className="text-xs text-ink-mute">{k}</span>
                      <span className="text-xs font-semibold text-ink">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1">Grounds of Appeal</p>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Institution disputes the 30-day condition, citing force majeure documentation submitted to scrutiny.
                  </p>
                </div>
              </Card>
              <div>
                <h3 className="text-sm font-bold text-ink mb-4 flex items-center gap-2">
                  <Scale size={16} className="text-brand-600" /> Record Appeal Outcome
                </h3>
                <AnimatePresence mode="wait">
                  {!appealDone ? (
                    <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Card className="card-pad space-y-4">
                        <div>
                          <label className="label">Appeal Grounds (summary)</label>
                          <textarea className="input min-h-[70px]" value={appealForm.grounds} placeholder="Summarise grounds of appeal…"
                            onChange={e => setAppealForm(f => ({ ...f, grounds: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label">Institution's Submission</label>
                          <textarea className="input min-h-[70px]" value={appealForm.submission} placeholder="Institution's key arguments…"
                            onChange={e => setAppealForm(f => ({ ...f, submission: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label">Final Outcome</label>
                          <select className="input" value={appealForm.outcome} onChange={e => setAppealForm(f => ({ ...f, outcome: e.target.value }))}>
                            <option>Upheld</option><option>Dismissed</option><option>Partially Upheld</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">Council Notes</label>
                          <textarea className="input min-h-[70px]" value={appealForm.notes} placeholder="Council reasoning and conditions…"
                            onChange={e => setAppealForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>
                        <button onClick={() => { setAppealBusy(true); setTimeout(() => { setAppealBusy(false); setAppealDone(true); }, 1200); }}
                          disabled={appealBusy} className="btn-primary w-full flex items-center justify-center gap-2">
                          {appealBusy ? <><Loader2 size={15} className="animate-spin" />Recording…</> : 'Record Appeal Outcome'}
                        </button>
                      </Card>
                    </motion.div>
                  ) : (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
                      <Card className="card-pad text-center py-10">
                        <BadgeCheck size={40} className="mx-auto text-indgreen-500 mb-3" />
                        <p className="font-bold text-ink">Appeal Outcome Recorded</p>
                        <p className="text-sm text-ink-mute mt-1">ANU-2026-0391 · <strong>{appealForm.outcome}</strong></p>
                        <button className="btn-secondary btn-sm mt-4" onClick={() => setAppealDone(false)}>Record Another</button>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* ── Tab 5: Decision History ── */}
          {tab === 'Decision History' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <select className="input h-9 w-auto py-1 text-sm" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                  {['All', '2026', '2025', '2024'].map(y => <option key={y}>{y}</option>)}
                </select>
                <select className="input h-9 w-auto py-1 text-sm" value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)}>
                  {['All', 'Ratified', 'Not Ratified', 'Deferred', 'Upheld', 'Dismissed'].map(o => <option key={o}>{o}</option>)}
                </select>
                <span className="text-xs text-ink-mute ml-auto">{filteredHistory.length} records</span>
              </div>
              {filteredHistory.length === 0 ? (
                <Card className="card-pad text-center py-8">
                  <p className="text-sm text-ink-mute">No records match the selected filters.</p>
                </Card>
              ) : (
                <div className="space-y-2.5">
                  {filteredHistory.map((h, i) => (
                    <motion.div key={h.appId + i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className={cn('flex items-center gap-4 rounded-xl border bg-white px-5 py-3.5 border-l-4',
                        h.outcome.includes('Ratified') || h.outcome.includes('Upheld') ? 'border-l-indgreen-400' :
                        h.outcome.includes('Not') || h.outcome.includes('Dismissed')    ? 'border-l-red-400'      : 'border-l-amber-400')}>
                      <div className="shrink-0 text-center min-w-[56px]">
                        <p className="text-[10px] font-bold text-ink-mute leading-tight">{h.date.slice(5, 10).replace('-', ' ')}</p>
                        <p className="text-[10px] text-ink-mute">{h.date.slice(0, 4)}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-brand-700">{h.appId}</span>
                          <Badge tone={outcomeTone(h.outcome)}>{h.outcome}</Badge>
                        </div>
                        <p className="text-sm font-medium text-ink truncate">{h.inst}</p>
                        <p className="text-xs text-ink-mute">{h.type}</p>
                      </div>
                      <span className="text-xs text-ink-mute shrink-0">{h.officer}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
