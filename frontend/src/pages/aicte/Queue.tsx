import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, Bookmark, BookmarkPlus, Download, Filter, Play, Search, UserPlus, X } from 'lucide-react';
import { startFocus } from './focus';
import { useAsync } from '../../lib/useAsync';
import { bulkAction, deleteView, getApplications, saveView, undoBulk } from '../../services/api';
import { useSavedViews } from '../../lib/live-data';
import { invalidate } from '../../lib/resource';
import { institutionById, REGIONS, regionName } from '../../data/institutions';
import { typeById } from '../../data/rules';
import { STAGE_LABEL } from '../../data/applications';
import { Badge, Card, ClockBadge, EmptyState, LoadingRows, PageHeader, RiskMeter, toast } from '../../components/ui';
import { Tour } from '../../components/live';
import { QUEUE_TOUR } from '../../data/tours';
import { useSession } from '../../lib/session';
import { cn, daysBetween, formatDate, TODAY } from '../../lib/utils';
import { downloadCsv } from '../../lib/csv';
import type { ClockState, Stage } from '../../types';

const PRESETS = [
  { name: 'Missed deadlines', q: 'clock=breached' },
  { name: 'Waiting on institutions', q: 'clock=paused' },
  { name: 'EVC queue', q: 'stage=evc' },
  { name: 'Highest delay risk', q: 'sort=risk' },
  { name: 'Green channel', q: 'lane=green' },
];

/** Low-risk files with no deficiency can be decided on self-certification and audited later. */
const greenLane = (a: { risk: number; deficiencies: number }) => a.risk < 0.25 && a.deficiencies === 0;

/** Saved filter sets: kept on the officer's account when connected, on this device otherwise. */
function SavedViews({ current, apply }: { current: string; apply: (q: string) => void }) {
  const { data: server } = useSavedViews();
  const [local, setLocal] = useState<{ name: string; q: string }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('anumati.views') ?? '[]');
    } catch {
      return [];
    }
  });
  const saved = server ? server.map((v) => ({ id: v.id, name: v.name, q: v.query })) : local.map((v) => ({ id: undefined as number | undefined, ...v }));
  const save = async () => {
    if (!current) return;
    const name = `My view ${saved.length + 1}`;
    const stored = await saveView(name, current).catch(() => null);
    if (stored) {
      invalidate('views');
      toast(`Saved “${name}” to your account`);
      return;
    }
    const next = [...local, { name, q: current }];
    setLocal(next);
    try {
      localStorage.setItem('anumati.views', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  const remove = async (id?: number, name?: string) => {
    if (id) {
      await deleteView(id).catch(() => undefined);
      invalidate('views');
    } else {
      const next = local.filter((v) => v.name !== name);
      setLocal(next);
      try {
        localStorage.setItem('anumati.views', JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="mr-1 flex items-center gap-1 text-xs font-semibold text-ink-mute">
        <Bookmark size={13} /> Views
      </span>
      {PRESETS.map((v) => (
        <button key={v.name} onClick={() => apply(v.q)} aria-pressed={current === v.q} className={cn('chip transition-colors', current === v.q ? 'border-brand-600 bg-brand-700 text-white' : 'hover:border-brand-300 hover:text-brand-700')}>
          {v.name}
        </button>
      ))}
      <AnimatePresence initial={false}>
        {saved.map((v) => (
          <motion.span key={`${v.id ?? v.name}`} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="group inline-flex items-center">
            <button onClick={() => apply(v.q)} aria-pressed={current === v.q} className={cn('chip rounded-r-none transition-colors', current === v.q ? 'border-brand-600 bg-brand-700 text-white' : 'hover:border-brand-300 hover:text-brand-700')}>
              {v.name}
            </button>
            <button onClick={() => remove(v.id, v.name)} className="chip rounded-l-none border-l-0 px-1.5 text-ink-mute hover:text-red-600" aria-label={`Delete view ${v.name}`}>
              <X size={12} />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <button onClick={() => apply('')} className="chip hover:border-brand-300">
        Clear
      </button>
      <button onClick={save} disabled={!current} className="chip border-dashed text-brand-700 hover:border-brand-400 disabled:opacity-40">
        <BookmarkPlus size={13} /> Save this view
      </button>
    </div>
  );
}

export default function Queue() {
  const { session } = useSession();
  const [params, setParams] = useSearchParams();
  const { data, loading, reload } = useAsync(getApplications);
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const remind = async () => {
    const ids = [...selected];
    setSelected(new Set());
    const done = await bulkAction('remind', ids).catch(() => null);
    const n = done?.count ?? ids.length;
    toast(`Reminder sent for ${n} file${n === 1 ? '' : 's'}. Logged in the evidence log.`, 'green', {
      label: 'Undo',
      onClick: async () => {
        const undone = done ? await undoBulk(done.undoToken).catch(() => null) : null;
        toast(undone ? `${undone.withdrawn} reminder${undone.withdrawn === 1 ? '' : 's'} withdrawn before delivery.` : done ? 'Too late to undo: reminders already went out.' : 'Reminders withdrawn before delivery.', 'brand');
      },
    });
  };
  const assign = async () => {
    const ids = [...selected];
    setSelected(new Set());
    const done = await bulkAction('assign', ids).catch(() => null);
    if (done) reload();
    toast(`${done?.count ?? ids.length} file${ids.length === 1 ? '' : 's'} assigned to you${done ? ' and recorded in each evidence log' : ''}.`, 'brand');
  };
  const regionLocked = session?.officerRole === 'Regulation Bureau Admin';
  const region = regionLocked ? session?.region ?? 'CRO' : params.get('region') ?? '';
  const stage = (params.get('stage') ?? '') as Stage | '';
  const clock = (params.get('clock') ?? '') as ClockState | '';
  const sort = params.get('sort') ?? 'due';
  const lane = params.get('lane') ?? '';

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };

  const rows = useMemo(() => {
    const list = (data ?? []).filter(
      (a) =>
        a.stage !== 'decision' &&
        (!region || a.region === region) &&
        (!stage || a.stage === stage) &&
        (!clock || a.clock === clock) &&
        (lane !== 'green' || greenLane(a)) &&
        (!q || `${a.id} ${institutionById(a.institutionId)?.name}`.toLowerCase().includes(q.toLowerCase())),
    );
    return [...list].sort((a, b) => (sort === 'risk' ? b.risk - a.risk : a.dueOn.localeCompare(b.dueOn)));
  }, [data, region, stage, clock, q, sort, lane]);

  return (
    <>
      <PageHeader
        eyebrow={`${session?.officerRole} · ${regionLocked ? regionName(region) : 'all regions'}`}
        title="Work queue"
        description="All active files for your region and role, sorted by deadline. Green = on time · amber = paused (file is with institution) · red = missed deadline and escalated. Click any file to open it."
        tourId="queue"
        actions={
          <>
          <button
            data-tour="focus-mode"
            className="btn-primary"
            disabled={!rows.length}
            onClick={() => {
              const first = startFocus(rows);
              if (first) nav(`/aicte/applications/${first}`);
            }}
            title="Opens the most urgent file first, then the next, one by one"
          >
            <Play size={16} /> Start next file
          </button>
          <button
            className="btn-secondary"
            onClick={() =>
              downloadCsv(
                'work-queue.csv',
                rows.map((a) => ({ Reference: a.id, Institution: institutionById(a.institutionId)?.name ?? '', Request: typeById(a.typeId).name, Stage: STAGE_LABEL[a.stage], Due: a.dueOn, Clock: a.clock, Risk: Math.round(a.risk * 100) })),
              )
            }
          >
            <Download size={16} /> Export
          </button>
          </>
        }
      />

      <Tour id="queue" steps={QUEUE_TOUR} />
      <div data-tour="filters" className="card mb-4 flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <label htmlFor="qq" className="sr-only">
            Search by reference or institution
          </label>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input id="qq" className="input pl-9" placeholder="Search by reference or institution" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={16} className="text-ink-mute" aria-hidden />
          <select aria-label="Region" className="input w-auto" value={region} disabled={regionLocked} onChange={(e) => set('region', e.target.value)}>
            <option value="">All regions</option>
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.office}
              </option>
            ))}
          </select>
          <select aria-label="Stage" className="input w-auto" value={stage} onChange={(e) => set('stage', e.target.value)}>
            <option value="">All stages</option>
            {(['scrutiny', 'rescrutiny', 'evc', 'shc', 'ec', 'appeal'] as Stage[]).map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
          <select aria-label="Clock" className="input w-auto" value={clock} onChange={(e) => set('clock', e.target.value)}>
            <option value="">Any clock</option>
            <option value="running">Running</option>
            <option value="paused">Paused</option>
            <option value="breached">Missed</option>
          </select>
          <select aria-label="Sort" className="input w-auto" value={sort} onChange={(e) => set('sort', e.target.value)}>
            <option value="due">Sort: due date</option>
            <option value="risk">Sort: delay risk</option>
          </select>
        </div>
      </div>
      <SavedViews current={params.toString()} apply={(q) => setParams(new URLSearchParams(q), { replace: true })} />
      {regionLocked && <p className="mb-3 text-xs text-ink-mute">Your role sees only its own region. This is enforced in the database (row-level security), not just hidden on screen.</p>}

      <Card data-tour="file-list" pad={false}>
        {loading ? (
          <LoadingRows rows={8} />
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing waiting here" text="No files match these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all files"
                      className="h-4 w-4 accent-brand-700"
                      checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
                      onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                    />
                  </th>
                  <th>Reference</th>
                  <th>Institution</th>
                  <th>Stage</th>
                  <th>Clock</th>
                  <th>Due</th>
                  <th>With</th>
                  <th>Delay risk</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a, i) => {
                  const d = daysBetween(TODAY, a.dueOn);
                  return (
                    <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.015, 0.3) }} className={selected.has(a.id) ? 'bg-brand-50/60' : undefined}>
                      <td>
                        <input type="checkbox" aria-label={`Select ${a.id}`} className="h-4 w-4 accent-brand-700" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                      </td>
                      <td>
                        <Link to={`/aicte/applications/${a.id}`} className="link font-mono text-xs">
                          {a.id}
                        </Link>
                        <p className="text-xs text-ink-mute">{typeById(a.typeId).name}</p>
                        {greenLane(a) && (
                          <Badge tone="green" className="mt-1">
                            Green channel
                          </Badge>
                        )}
                      </td>
                      <td className="max-w-[240px]">
                        <p className="truncate font-medium text-ink">{institutionById(a.institutionId)?.name}</p>
                        <p className="text-xs text-ink-mute">{regionName(a.region)}</p>
                      </td>
                      <td>
                        <Badge tone="slate">{STAGE_LABEL[a.stage]}</Badge>
                      </td>
                      <td>
                        <ClockBadge state={a.clock} label={a.clock === 'paused' ? 'Paused' : a.clock === 'breached' ? 'Missed' : 'Running'} />
                      </td>
                      <td className="whitespace-nowrap">
                        <span className={cn('font-medium', a.clock === 'breached' ? 'text-red-700' : d <= 3 && a.clock === 'running' ? 'text-amber-700' : 'text-ink')}>{formatDate(a.dueOn)}</span>
                        <p className="text-xs text-ink-mute">{a.clock === 'paused' ? 'clock stopped' : d >= 0 ? `${d} days left` : `${-d} days late`}</p>
                      </td>
                      <td className="text-xs">{a.holder}</td>
                      <td>
                        <RiskMeter value={a.risk} />
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-ink-mute">{rows.length} files</p>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            data-tour="bulk"
            role="toolbar"
            aria-label="Bulk actions"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            className="bottom-bar-aware fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-brand-950 py-2 pl-4 pr-2 text-sm text-white shadow-lift"
          >
            <span className="mr-2 font-semibold tabular-nums">{selected.size} selected</span>
            <button className="btn btn-sm bg-white/10 text-white hover:bg-white/20" onClick={remind}>
              <BellRing size={14} /> Send reminder
            </button>
            <button className="btn btn-sm bg-white/10 text-white hover:bg-white/20" onClick={assign}>
              <UserPlus size={14} /> Assign to me
            </button>
            <button className="grid h-8 w-8 place-items-center rounded-lg text-brand-200 hover:bg-white/10" onClick={() => setSelected(new Set())} aria-label="Clear selection">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
