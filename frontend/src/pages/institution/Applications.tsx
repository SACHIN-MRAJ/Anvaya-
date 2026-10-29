import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FilePlus2,
  FileStack,
  Filter,
  ListFilter,
  Loader2,
  Network,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAsync } from '../../lib/useAsync';
import { getInstitutionApplications } from '../../services/api';
import { DEMO_INSTITUTION } from '../../data/institutions';
import { typeById } from '../../data/rules';
import { STAGE_LABEL } from '../../data/applications';
import {
  Badge,
  Card,
  ClockBadge,
  LoadingRows,
  PageHeader,
  PublicStatusBadge,
} from '../../components/ui';
import { MiniProgress } from './shared';
import { formatDate, TODAY } from '../../lib/utils';
import type { Application } from '../../types';

/* ── Tab definitions matching Document Section 2.5 ── */
const TABS = [
  { id: 'list',       label: 'Application List & Filters',       icon: <FileStack size={15} /> },
  { id: 'timeline',   label: 'Stage-by-Stage Timeline',          icon: <Clock size={15} /> },
  { id: 'committee',  label: 'Responsible Unit / Committee',     icon: <Network size={15} /> },
  { id: 'deficiency', label: 'Deficiencies & Next Action',       icon: <AlertTriangle size={15} /> },
  { id: 'inspection', label: 'Inspection & Schedule Details',    icon: <Calendar size={15} /> },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function InstApplications() {
  const { data, loading } = useAsync(() => getInstitutionApplications(DEMO_INSTITUTION.id));
  const [activeTab, setActiveTab] = useState<TabId>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Ongoing' | 'Action needed' | 'Decision issued'>('All');

  const apps = data ?? [];

  const filteredApps = useMemo(() => {
    return apps.filter((a) => {
      const matchSearch =
        a.id.toLowerCase().includes(search.toLowerCase()) ||
        typeById(a.typeId)?.name.toLowerCase().includes(search.toLowerCase()) ||
        a.holder.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || a.publicStatus === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [apps, search, statusFilter]);

  return (
    <>
      <PageHeader
        eyebrow="Application Management"
        title="Application Tracking"
        description="Monitor processing stages, committee handoffs, SLA clocks and required responses for all submitted files."
        actions={
          <Link to="/institution/apply" className="btn-primary">
            <FilePlus2 size={16} /> New Application
          </Link>
        }
      />

      {/* ── Subpage Navigation Tabs (Section 2.5) ────────────────────── */}
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
              {t.id === 'deficiency' && apps.some((a) => a.publicStatus === 'Action needed') && (
                <span className="grid h-4 w-4 place-items-center rounded-full bg-red-500 text-[10px] text-white">
                  {apps.filter((a) => a.publicStatus === 'Action needed').length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── SUBPAGE 1: APPLICATION LIST & FILTERS ──────────────────── */}
      {activeTab === 'list' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by reference ID, course type, holder..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9 w-full text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink-mute flex items-center gap-1">
                <Filter size={14} /> Filter:
              </span>
              {(['All', 'Ongoing', 'Action needed', 'Decision issued'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    statusFilter === st ? 'bg-brand-900 text-white' : 'bg-slate-100 text-ink-mute hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <Card pad={false}>
            {loading ? (
              <LoadingRows rows={4} />
            ) : filteredApps.length === 0 ? (
              <p className="p-8 text-center text-sm text-ink-mute">No applications match the selected criteria.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base text-xs">
                  <thead>
                    <tr>
                      <th>Application Ref</th>
                      <th>Request Type</th>
                      <th className="min-w-[160px]">Progress</th>
                      <th>Current Stage</th>
                      <th>SLA Clock</th>
                      <th>Status</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApps.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/50">
                        <td>
                          <Link to={`/institution/applications/${a.id}`} className="font-mono font-bold text-brand-800 hover:underline">
                            {a.id}
                          </Link>
                          <p className="text-[11px] text-ink-mute">Cycle {a.cycle} · {formatDate(a.submittedOn)}</p>
                        </td>
                        <td className="font-semibold text-ink">{typeById(a.typeId)?.name ?? a.typeId}</td>
                        <td>
                          <MiniProgress app={a} />
                        </td>
                        <td>
                          <span className="font-semibold text-ink">{STAGE_LABEL[a.stage]}</span>
                          <p className="text-[10px] text-ink-mute">{a.holder}</p>
                        </td>
                        <td>
                          <ClockBadge state={a.clock} label={formatDate(a.dueOn)} />
                        </td>
                        <td>
                          <PublicStatusBadge status={a.publicStatus} />
                        </td>
                        <td className="text-right">
                          <Link to={`/institution/applications/${a.id}`} className="btn-secondary btn-sm inline-flex items-center gap-1">
                            <Eye size={13} /> View
                          </Link>
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

      {/* ── SUBPAGE 2: STAGE-BY-STAGE TIMELINE ──────────────────────── */}
      {activeTab === 'timeline' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card title="Stage-by-Stage Progress Timelines" subtitle="Visual tracking showing completed, current and upcoming stages for all institutional files.">
            <div className="divide-y divide-slate-100">
              {apps.map((app) => (
                <div key={app.id} className="py-5 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-brand-800">{app.id}</span>
                        <Badge tone="slate">{typeById(app.typeId)?.name ?? app.typeId}</Badge>
                        <PublicStatusBadge status={app.publicStatus} />
                      </div>
                      <p className="text-xs text-ink-mute mt-1">Target decision: within SLA ({formatDate(app.dueOn)})</p>
                    </div>
                    <Link to={`/institution/applications/${app.id}`} className="btn-secondary btn-sm self-start sm:self-center">
                      Detailed Tracker &rarr;
                    </Link>
                  </div>
                  <div className="mt-4">
                    <MiniProgress app={app} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 3: RESPONSIBLE UNIT / COMMITTEE ─────────────────── */}
      {activeTab === 'committee' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card title="Current Responsibility & Handoff Ownership" subtitle="Clear transparency into which AICTE department or committee currently holds each file.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {apps.map((app) => (
                <div key={app.id} className="rounded-xl border border-slate-200 p-4 bg-white">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-brand-800">{app.id}</span>
                    <Badge tone="slate">{app.stage.toUpperCase()}</Badge>
                  </div>
                  <h4 className="mt-2 text-xs font-bold text-ink">{typeById(app.typeId)?.name ?? app.typeId}</h4>
                  <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs border border-slate-100">
                    <p className="text-ink-mute text-[11px] font-bold uppercase">Responsible Authority:</p>
                    <p className="font-bold text-brand-900 mt-0.5">{app.holder}</p>
                    <p className="text-ink-mute text-[11px] mt-1">Regional Scope: {app.region} Region</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-ink-mute">
                    <span>Due Date: {formatDate(app.dueOn)}</span>
                    <ClockBadge state={app.clock} label={formatDate(app.dueOn)} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 4: DEFICIENCIES & NEXT ACTION ────────────────────── */}
      {activeTab === 'deficiency' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card title="Recorded Deficiencies & Required Action" subtitle="When a deficiency is raised, the countdown clock pauses until the institution submits its response.">
            {apps.filter((a) => a.publicStatus === 'Action needed').length === 0 ? (
              <div className="rounded-xl bg-indgreen-50/50 p-6 text-center border border-indgreen-200">
                <CheckCircle2 size={32} className="mx-auto text-indgreen-600 mb-2" />
                <h4 className="font-display text-sm font-bold text-indgreen-900">Zero Unresolved Deficiencies</h4>
                <p className="text-xs text-indgreen-700 mt-1">All active applications have completed their required scrutiny submissions.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {apps.filter((a) => a.publicStatus === 'Action needed').map((app) => (
                  <div key={app.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-brand-900">{app.id}</span>
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Deficiency Raised</span>
                        </div>
                        <h4 className="font-display text-sm font-bold text-ink mt-1">
                          Scrutiny Committee Correction Notice on {typeById(app.typeId)?.name}
                        </h4>
                      </div>
                      <Link to={`/institution/applications/${app.id}`} className="btn-primary shrink-0">
                        Submit Response &rarr;
                      </Link>
                    </div>
                    <div className="mt-3 rounded-lg bg-white p-3.5 text-xs border border-amber-200">
                      <p className="font-semibold text-ink">Required Action:</p>
                      <p className="text-ink-mute mt-1">
                        Please upload the updated University NOC and structural stability endorsement. Clock is currently <strong>PAUSED</strong>; submitting your reply restarts the review clock.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 5: INSPECTION & SCHEDULE DETAILS ─────────────────── */}
      {activeTab === 'inspection' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card title="Expert Visit Committee (EVC) Schedule" subtitle="Authorized inspection schedules, panel assignment status, and inspection checklists.">
            <div className="space-y-4">
              {[
                {
                  appId: 'ANU-2026-0412',
                  type: 'New Programme / Level (MCA)',
                  date: '12 Nov 2026',
                  mode: 'Physical On-Site Visit',
                  status: 'Panel Formed via Drand Randomness',
                  checklist: 'Laboratories, Computer Centre, Library, Faculty Interviews',
                },
              ].map((ev, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-5 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-brand-800">{ev.appId}</span>
                      <Badge tone="green">{ev.mode}</Badge>
                    </div>
                    <span className="text-xs font-bold text-indgreen-700 bg-indgreen-50 px-2 py-0.5 rounded">
                      {ev.status}
                    </span>
                  </div>
                  <h4 className="font-display text-sm font-bold text-ink mt-2">{ev.type}</h4>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <span className="text-ink-mute font-semibold">Scheduled Visit Date:</span>
                      <p className="font-bold text-ink mt-0.5">{ev.date} (10:00 AM - 05:00 PM IST)</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <span className="text-ink-mute font-semibold">Verification Scope:</span>
                      <p className="font-semibold text-ink mt-0.5">{ev.checklist}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </>
  );
}
