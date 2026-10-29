import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, ChevronRight, Clock,
  FileText, MessageSquare, Search, XCircle,
} from 'lucide-react';
import { Badge, Card, CountUp, LoadingRows, PageHeader, Reveal } from '../../components/ui';
import { useResource } from '../../lib/resource';
import { getDashboardStats, getApplications } from '../../services/api';
import { INSTITUTIONS } from '../../data/institutions';
import { typeById } from '../../data/rules';
import { STAGE_LABEL } from '../../data/applications';
import { cn, daysBetween, TODAY } from '../../lib/utils';

const instName = (id: string) => INSTITUTIONS.find((i) => i.id === id)?.name ?? id;

/* ── Sample data ── */
const ASSIGNED = [
  { id: 'ANU-2026-0412', institution: 'Narmada Valley IT', type: 'New Course', assigned: '2026-10-20', priority: 'High', days: 7 },
  { id: 'ANU-2026-0408', institution: 'Westcoast Engineering College', type: 'Seat Increase', assigned: '2026-10-18', priority: 'Normal', days: 9 },
  { id: 'ANU-2026-0402', institution: 'South Delhi Polytechnic', type: 'Course Modification', assigned: '2026-10-15', priority: 'Normal', days: 12 },
  { id: 'ANU-2026-0398', institution: 'Krishna Delta Engineering', type: 'Greenfield', assigned: '2026-10-12', priority: 'High', days: 15 },
];

const DOCS = [
  { name: 'Land Ownership Certificate', required: true, submitted: true, aiResult: 'Pass', confidence: 97 },
  { name: 'Affiliation Letter', required: true, submitted: true, aiResult: 'Pass', confidence: 94 },
  { name: 'Fire Safety Certificate', required: true, submitted: true, aiResult: 'Warning', confidence: 72, note: 'Expiry date 18 months from now — within allowed window' },
  { name: 'Faculty Appointment Letters', required: true, submitted: true, aiResult: 'Pass', confidence: 91 },
  { name: 'Bank Solvency Certificate', required: true, submitted: false, aiResult: null, confidence: null },
  { name: 'Building Completion Certificate', required: false, submitted: true, aiResult: 'Pass', confidence: 88 },
];

const DEFICIENCIES = [
  { id: 'DEF-001', appId: 'ANU-2026-0398', doc: 'Bank Solvency Certificate', message: 'Document not submitted. Please upload a valid solvency certificate issued within the last 6 months.', status: 'Sent', sent: '2026-10-18' },
  { id: 'DEF-002', appId: 'ANU-2026-0398', doc: 'Faculty Appointment Letters', message: 'Three faculty appointment letters are missing signatures from authorised signatories.', status: 'Response received', sent: '2026-10-18' },
  { id: 'DEF-003', appId: 'ANU-2026-0412', doc: 'Infrastructure Layout Plan', message: 'Submitted plan does not include laboratory dimensions as required under APH 2.4.3.', status: 'Draft', sent: null },
];

const RESCRUTINY = [
  {
    deficiency: 'Bank Solvency Certificate missing',
    original: 'Document not submitted at time of scrutiny.',
    evidence: 'Solvency certificate dated 2026-10-01, issued by State Bank of India. Amount: ₹2.5 Cr.',
    outcome: null as null | 'Accept' | 'Reject' | 'Partial',
  },
  {
    deficiency: 'Faculty appointments — missing signatures',
    original: 'Three letters lacked authorised signatory.',
    evidence: 'Revised letters uploaded with Principal and Management signatures on all three appointments.',
    outcome: 'Accept' as null | 'Accept' | 'Reject' | 'Partial',
  },
];

const REPORTS = [
  { id: 'SCR-2026-041', appId: 'ANU-2026-0387', institution: 'Central Institute of Mgmt', outcome: 'Recommended', date: '2026-10-18', reviewer: 'A. Sharma' },
  { id: 'SCR-2026-039', appId: 'ANU-2026-0376', institution: 'Deccan Technical University', outcome: 'Deficiency Issued', date: '2026-10-12', reviewer: 'A. Sharma' },
  { id: 'SCR-2026-035', appId: 'ANU-2026-0354', institution: 'Coastal Engineering', outcome: 'Recommended', date: '2026-10-05', reviewer: 'K. Iyer' },
];

const TABS = ['Scrutiny Dashboard', 'Assigned Applications', 'Document Verification', 'Deficiency Management', 'Re-Scrutiny Workspace', 'Scrutiny Reports'];

const priorityColor: Record<string, string> = {
  High:   'bg-red-50 text-red-700 border-red-200',
  Normal: 'bg-blue-50 text-blue-700 border-blue-200',
};

const outcomeStyle: Record<string, string> = {
  Accept:  'bg-indgreen-100 text-indgreen-700',
  Reject:  'bg-red-100 text-red-700',
  Partial: 'bg-amber-100 text-amber-700',
};

export default function Scrutiny() {
  const [tab, setTab] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<number, 'Accept' | 'Reject' | 'Partial'>>(
    Object.fromEntries(RESCRUTINY.map((r, i) => r.outcome ? [i, r.outcome] : []).filter(e => e.length))
  );
  const { data: stats } = useResource('scrutiny-stats', getDashboardStats, null);
  const { data: liveApps, loading: appsLoading } = useResource('scrutiny-apps', getApplications, []);

  return (
    <div className="container-page py-8">
      <PageHeader
        eyebrow="Scrutiny & Re-Scrutiny"
        title="Scrutiny Portal"
        description="Review application documents, record deficiencies and verify corrected submissions. AI findings are advisory; reviewer judgement is final."
      />

      {/* Tabs */}
      <div className="mt-6 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
              tab === i ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-100 text-ink-mute hover:bg-slate-200 hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="mt-6"
        >
          {/* ── TAB 0: Dashboard ── */}
          {tab === 0 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Assigned',          value: liveApps.length || 12,                                            suffix: '' },
                  { label: 'In scrutiny',        value: liveApps.filter((a) => a.stage === 'scrutiny').length || 4,     suffix: '' },
                  { label: 'Decided this cycle', value: stats?.decided ?? 3,                                             suffix: '' },
                  { label: 'At risk',            value: stats?.atRisk ?? 2,                                              suffix: '' },
                ].map(({ label, value, suffix }) => (
                  <Reveal key={label}>
                    <Card className="card-pad text-center">
                      <p className="text-2xl font-extrabold text-ink tabular-nums">
                        <CountUp value={Math.round(value)} />{suffix}
                      </p>
                      <p className="text-xs text-ink-mute mt-1">{label}</p>
                    </Card>
                  </Reveal>
                ))}
              </div>

              <Reveal>
                <Card className="card-pad">
                  <p className="text-sm font-bold text-ink mb-3">Priority Indicators</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Urgent — pending more than 25 days', count: liveApps.filter((a) => daysBetween(a.submittedOn, TODAY) > 25).length || 2, color: 'bg-red-500' },
                      { label: 'Ageing — pending more than 10 days', count: liveApps.filter((a) => daysBetween(a.submittedOn, TODAY) > 10).length || 3, color: 'bg-amber-400' },
                      { label: 'Normal — within SLA',               count: liveApps.filter((a) => daysBetween(a.submittedOn, TODAY) <= 10).length || 7, color: 'bg-brand-400' },
                    ].map(({ label, count, color }) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${color}`} />
                        <span className="text-sm text-ink-soft flex-1">{label}</span>
                        <span className="text-sm font-bold text-ink">{count}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </Reveal>
            </div>
          )}

          {/* ── TAB 1: Assigned Applications (live data) ── */}
          {tab === 1 && (
            <Card className="overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
                <p className="text-sm font-bold text-ink">
                  {appsLoading ? 'Loading…' : `${liveApps.length || ASSIGNED.length} application${(liveApps.length || ASSIGNED.length) !== 1 ? 's' : ''}`}
                </p>
                <button className="btn-secondary btn-sm flex items-center gap-1.5"><Search size={13} />Filter</button>
              </div>
              {appsLoading ? (
                <div className="p-5"><LoadingRows rows={4} /></div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {liveApps.length > 0
                    ? liveApps.map((a, i) => {
                        const elapsed = daysBetween(a.submittedOn, TODAY);
                        return (
                          <motion.li key={a.id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.04, duration:0.35, ease:[0.22,1,0.36,1] }} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-brand-700">{a.id}</span>
                                {elapsed > 15 && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">Urgent</span>}
                              </div>
                              <p className="text-sm font-semibold text-ink mt-0.5">{instName(a.institutionId)}</p>
                              <p className="text-xs text-ink-mute">{typeById(a.typeId)?.name ?? a.typeId} · {STAGE_LABEL[a.stage] ?? a.stage}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-bold ${elapsed > 10 ? 'text-amber-600' : 'text-ink'}`}>{elapsed}d</p>
                              <p className="text-[10px] text-ink-mute">elapsed</p>
                            </div>
                            <ChevronRight size={16} className="text-slate-400 shrink-0" />
                          </motion.li>
                        );
                      })
                    : ASSIGNED.map((a, i) => (
                        <motion.li key={a.id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.04 }} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-brand-700">{a.id}</span>
                              {a.days > 15 && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">Urgent</span>}
                            </div>
                            <p className="text-sm font-semibold text-ink mt-0.5">{a.institution}</p>
                            <p className="text-xs text-ink-mute">{a.type}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold ${a.days > 10 ? 'text-amber-600' : 'text-ink'}`}>{a.days}d</p>
                            <p className="text-[10px] text-ink-mute">elapsed</p>
                          </div>
                          <ChevronRight size={16} className="text-slate-400 shrink-0" />
                        </motion.li>
                      ))
                  }
                </ul>
              )}
            </Card>
          )}

          {/* ── TAB 2: Document Verification ── */}
          {tab === 2 && (
            <div className="space-y-4">
              <Reveal>
                <Card className="card-pad">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-ink">Reviewing: ANU-2026-0412 — Narmada Valley IT</p>
                    <Badge tone="amber">In review</Badge>
                  </div>
                  <p className="text-xs text-ink-mute mb-4">AI extracted fields and rule checks are advisory. Reviewer judgement overrides.</p>
                  <div className="space-y-2">
                    {DOCS.map((d) => (
                      <div key={d.name} className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3">
                        <div className="mt-0.5">
                          {!d.submitted ? (
                            <XCircle size={16} className="text-red-400" />
                          ) : d.aiResult === 'Pass' ? (
                            <CheckCircle2 size={16} className="text-indgreen-500" />
                          ) : (
                            <AlertTriangle size={16} className="text-amber-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink">{d.name}</p>
                          {d.note && <p className="text-xs text-amber-700 mt-0.5">{d.note}</p>}
                          {!d.submitted && <p className="text-xs text-red-600 mt-0.5">Not submitted</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          {d.aiResult && (
                            <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${d.aiResult === 'Pass' ? 'bg-indgreen-50 text-indgreen-700' : 'bg-amber-50 text-amber-700'}`}>
                              AI: {d.aiResult} {d.confidence}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </Reveal>
            </div>
          )}

          {/* ── TAB 3: Deficiency Management ── */}
          {tab === 3 && (
            <div className="space-y-4">
              <Reveal>
                <Card className="card-pad">
                  <p className="text-sm font-bold text-ink mb-3">Recorded Deficiencies</p>
                  <ul className="space-y-3">
                    {DEFICIENCIES.map((d, i) => (
                      <motion.li key={d.id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.05, duration:0.35, ease:[0.22,1,0.36,1] }} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <span className="font-mono text-xs font-bold text-brand-700">{d.id}</span>
                            <span className="ml-2 text-xs text-ink-mute">· {d.appId}</span>
                          </div>
                          <Badge tone={d.status === 'Draft' ? 'brand' : d.status === 'Sent' ? 'amber' : 'green'}>
                            {d.status}
                          </Badge>
                        </div>
                        <p className="text-sm font-semibold text-ink">{d.doc}</p>
                        <p className="text-xs text-ink-mute mt-1 leading-relaxed">{d.message}</p>
                        {d.sent && <p className="text-[10px] text-ink-mute mt-2 flex items-center gap-1"><Clock size={10} />Sent {d.sent}</p>}
                      </motion.li>
                    ))}
                  </ul>
                </Card>
              </Reveal>
            </div>
          )}

          {/* ── TAB 4: Re-Scrutiny Workspace ── */}
          {tab === 4 && (
            <div className="space-y-4">
              {RESCRUTINY.map((r, i) => (
                <Reveal key={i}>
                  <Card className="overflow-hidden">
                    <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                      <div className="p-5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-mute mb-2">Original Deficiency</p>
                        <p className="text-sm font-semibold text-ink mb-1">{r.deficiency}</p>
                        <p className="text-xs text-ink-mute leading-relaxed">{r.original}</p>
                      </div>
                      <div className="p-5 bg-brand-50/30">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-mute mb-2">Institution Evidence</p>
                        <div className="flex items-start gap-2">
                          <FileText size={14} className="text-brand-500 mt-0.5 shrink-0" />
                          <p className="text-xs text-ink-soft leading-relaxed">{r.evidence}</p>
                        </div>
                      </div>
                      <div className="p-5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-mute mb-3">Reviewer Outcome</p>
                        {outcomes[i] ? (
                          <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${outcomeStyle[outcomes[i]]}`}>
                            {outcomes[i] === 'Accept' && <CheckCircle2 size={13} />}
                            {outcomes[i] === 'Reject' && <XCircle size={13} />}
                            {outcomes[i]}
                          </div>
                        ) : (
                          <div className="flex gap-2 flex-wrap">
                            {(['Accept', 'Reject', 'Partial'] as const).map(opt => (
                              <button
                                key={opt}
                                onClick={() => setOutcomes(prev => ({ ...prev, [i]: opt }))}
                                className="btn-secondary btn-sm"
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </Reveal>
              ))}
            </div>
          )}

          {/* ── TAB 5: Scrutiny Reports ── */}
          {tab === 5 && (
            <div className="space-y-3">
              <ul className="space-y-3">
                {REPORTS.map((r, i) => (
                  <motion.div key={r.id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.06, duration:0.35 }}>
                    <Reveal>
                      <Card className="card-pad">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs font-bold text-brand-700">{r.id}</span>
                              <span className="text-xs text-ink-mute">· {r.appId}</span>
                              <Badge tone={r.outcome === 'Recommended' ? 'green' : 'amber'}>{r.outcome}</Badge>
                            </div>
                            <p className="text-sm font-semibold text-ink">{r.institution}</p>
                            <p className="text-xs text-ink-mute mt-0.5">Reviewed by {r.reviewer} · {r.date}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button className="btn-secondary btn-sm flex items-center gap-1"><MessageSquare size={12} />View</button>
                          </div>
                        </div>
                      </Card>
                    </Reveal>
                  </motion.div>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
