import { motion } from 'framer-motion';
import { Undo2 } from 'lucide-react';
import { useAsync } from '../lib/useAsync';
import { getReturnReasons } from '../services/records';
import { Badge, Card } from './ui';
import { STAGE_LABEL } from '../data/applications';
import type { Stage } from '../types';

const stage = (s: string) => STAGE_LABEL[s as Stage] ?? s;

/** Why files are sent back: deficiencies grouped by what they are about, with the clause, stage and time to fix. */
export function ReturnReasons() {
  const { data } = useAsync(getReturnReasons);
  if (!data) return null; // needs the server; the rest of the page works on built-in data
  const max = Math.max(1, ...data.categories.map((c) => c.count));
  return (
    <Card
      className="mt-6"
      title="Why files are sent back"
      subtitle={`${data.total} deficiencies across ${data.files} files, grouped by what they are about. Tell institutions about the top ones before the cycle opens.`}
      action={<Undo2 size={16} className="text-ink-mute" />}
    >
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <ul className="space-y-4">
          {data.categories.map((c, i) => (
            <li key={c.category}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold text-ink">{c.category}</span>
                <span className="text-xs text-ink-mute">
                  {c.count} ({c.share}%){c.medianDaysToFix !== null ? ` · fixed in ${c.medianDaysToFix} days (median)` : ''}
                  {c.open ? ` · ${c.open} open` : ''}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                <motion.div className="h-full rounded-full bg-saffron-500" initial={{ width: 0 }} animate={{ width: `${(c.count / max) * 100}%` }} transition={{ delay: i * 0.06, duration: 0.6 }} />
              </div>
              <p className="mt-1 text-xs text-ink-mute">
                {c.clauses.join(', ')} · raised at {Object.entries(c.stages).map(([s, n]) => `${stage(s)} (${n})`).join(', ')}. <span className="text-ink-soft">{c.advice}</span>
              </p>
            </li>
          ))}
        </ul>
        <div>
          <p className="text-sm font-bold text-ink">Most recent</p>
          <ul className="mt-3 space-y-2.5">
            {data.recent.map((r) => (
              <li key={`${r.applicationId}-${r.raisedAt}`} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <p className="text-ink-soft">{r.text}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-ink-mute">
                  <span className="font-mono">{r.applicationId}</span> · {stage(r.stage)} <Badge tone={r.status === 'open' ? 'amber' : 'green'}>{r.status}</Badge>
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-ink-mute">{data.note}</p>
        </div>
      </div>
    </Card>
  );
}
