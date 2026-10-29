import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Hourglass, Route, Shuffle, TimerOff, Users } from 'lucide-react';
import { useAsync } from '../../lib/useAsync';
import { useSession } from '../../lib/session';
import { ApiError } from '../../services/api';
import { getRouting, reassignFile, type RouteFile } from '../../services/records';
import { STAGE_LABEL } from '../../data/applications';
import { typeById } from '../../data/rules';
import { Badge, Card, Modal, PageHeader, Stat, Tabs, toast } from '../../components/ui';
import { Tour } from '../../components/live';
import { ROUTING_TOUR } from '../../data/tours';
import { Pending } from '../../components/records-ui';
import { cn, formatDate } from '../../lib/utils';

const CAN_REASSIGN = ['Bureau head', 'Regional officer', 'EVC coordinator'];

export default function Routing() {
  const { session } = useSession();
  const canReassign = CAN_REASSIGN.includes(session?.officerRole ?? '');
  const { data, loading, reload } = useAsync(getRouting);
  const [view, setView] = useState<'flagged' | 'all'>('flagged');
  const [move, setMove] = useState<{ f: RouteFile; holder: string; reason: string } | null>(null);
  const files = useMemo(() => (data?.files ?? []).filter((f) => view === 'all' || f.flags.length), [data, view]);

  if (!data) return <Pending loading={loading} what="The routing monitor" />;
  const maxLoad = Math.max(1, ...data.holders.map((h) => h.files));

  const save = async () => {
    if (!move) return;
    try {
      await reassignFile(move.f.id, move.holder, move.reason);
      toast(`${move.f.id} handed to ${move.holder}. The reason is in the file's history.`);
      setMove(null);
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not reassign.', 'red');
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Processing"
        title="Routing and handoffs"
        description={`Who holds each open file, how long it has waited, and where handoffs stall. Routes come from the published rules (v${data.rulesVersion}); a reassignment always records its reason.`}
        tourId="routing"
      />
      <Tour id="routing" steps={ROUTING_TOUR} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open files" value={data.summary.open} icon={<Route size={18} />} />
        <Stat label="Need attention" value={data.summary.flagged} tone={data.summary.flagged ? 'amber' : 'green'} icon={<Hourglass size={18} />} hint="Past target, idle, or sent back twice" />
        <Stat label="Past their target" value={data.summary.pastTarget} tone={data.summary.pastTarget ? 'red' : 'green'} icon={<TimerOff size={18} />} />
        <Stat label="Waiting on the institution" value={data.summary.waitingOnInstitution} tone="slate" icon={<Users size={18} />} hint="Clock paused" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card pad={false}>
          <div className="px-4 pt-2">
            <Tabs
              value={view}
              onChange={setView}
              tabs={[
                { value: 'flagged', label: 'Need attention', count: data.summary.flagged },
                { value: 'all', label: 'All open files', count: data.summary.open },
              ]}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Holder</th>
                  <th className="text-right">At stage</th>
                  <th className="text-right">Idle</th>
                  <th>Why flagged</th>
                  {canReassign && <th />}
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link to={`/aicte/applications/${f.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                        {f.id}
                      </Link>
                      <span className="block max-w-[220px] truncate text-xs text-ink-mute">
                        {f.institution} · {typeById(f.typeId).name}
                      </span>
                    </td>
                    <td>
                      <span className="block text-sm">{f.holder}</span>
                      <span className="text-xs text-ink-mute">
                        {STAGE_LABEL[f.stage as keyof typeof STAGE_LABEL] ?? f.stage} · {f.handoffs} handoff{f.handoffs === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className={cn('text-right tabular-nums', f.targetDays !== null && f.daysAtStage > f.targetDays && 'font-semibold text-red-700')}>
                      {f.daysAtStage}d{f.targetDays !== null && <span className="text-xs font-normal text-ink-mute"> / {f.targetDays}d</span>}
                    </td>
                    <td className={cn('text-right tabular-nums', f.idleDays >= 7 && f.clock !== 'paused' && 'font-semibold text-amber-700')}>{f.idleDays}d</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {f.flags.length ? f.flags.map((x) => <Badge key={x} tone={x === 'Past target' ? 'red' : x.startsWith('Waiting') ? 'slate' : 'amber'}>{x}</Badge>) : <span className="text-xs text-ink-mute">On track · due {formatDate(f.dueOn)}</span>}
                      </div>
                      {f.lastHandoff && <span className="mt-1 block max-w-[260px] truncate text-[11px] text-ink-mute">Last: {f.lastHandoff.action}</span>}
                    </td>
                    {canReassign && (
                      <td>
                        {f.clock !== 'paused' && (
                          <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => setMove({ f, holder: '', reason: '' })}>
                            <Shuffle size={13} /> Reassign
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {files.length === 0 && <p className="px-6 py-8 text-center text-sm text-ink-mute">No file needs attention. Every open file is within its target and moving.</p>}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Load by holder" subtitle="Open files each officer or committee holds">
            <ul className="space-y-3">
              {data.holders.map((h, i) => (
                <li key={h.holder}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{h.holder}</span>
                    <span className="shrink-0 text-xs text-ink-mute">
                      {h.files} files{h.pastTarget ? ` · ${h.pastTarget} late` : ''}
                    </span>
                  </div>
                  <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-slate-100">
                    <motion.div className="h-full bg-red-500" initial={{ width: 0 }} animate={{ width: `${(h.pastTarget / maxLoad) * 100}%` }} transition={{ delay: i * 0.05, duration: 0.6 }} />
                    <motion.div className="h-full bg-brand-500" initial={{ width: 0 }} animate={{ width: `${((h.files - h.pastTarget) / maxLoad) * 100}%` }} transition={{ delay: i * 0.05, duration: 0.6 }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-mute">Red: past target. Blue: within target.</p>
          </Card>
          <Card title="Configured routes" subtitle="Each request type's path, from the rules studio" pad={false}>
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {data.routes.map((r) => (
                <li key={r.typeId} className="px-6 py-2.5 text-sm">
                  <span className="block font-medium">{r.name}</span>
                  <span className="flex flex-wrap items-center gap-1 text-xs text-ink-mute">
                    {r.path.map((s, i) => (
                      <span key={`${s}-${i}`} className="flex items-center gap-1">
                        {i > 0 && <ArrowRight size={11} />} {s}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Modal
        open={!!move}
        onClose={() => setMove(null)}
        title={move ? `Reassign ${move.f.id}` : ''}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setMove(null)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={!move || move.holder.trim().length < 3 || move.reason.trim().length < 5} onClick={save}>
              Reassign
            </button>
          </>
        }
      >
        {move && (
          <div className="space-y-4">
            <p className="text-sm text-ink-mute">
              Now with {move.f.holder} for {move.f.daysAtStage} days. The clock does not change; the handoff and its reason go into the file's history.
            </p>
            <label className="block">
              <span className="label">Hand to</span>
              <input className="input" list="holders" value={move.holder} onChange={(e) => setMove({ ...move, holder: e.target.value })} placeholder="Dealing officer (S. Rao)" />
              <datalist id="holders">
                {data.holders.map((h) => (
                  <option key={h.holder} value={h.holder} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="label">Reason</span>
              <textarea className="input min-h-[90px]" value={move.reason} onChange={(e) => setMove({ ...move, reason: e.target.value })} placeholder="Balancing the scrutiny load before the deadline" />
            </label>
          </div>
        )}
      </Modal>
    </>
  );
}
