import { motion } from 'framer-motion';
import { CheckCircle2, CircleAlert, OctagonAlert, Plus, Sparkles, X } from 'lucide-react';
import type { Condition, Readiness } from '../services/records';
import { cn } from '../lib/utils';

const ICON = {
  ok: <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-indgreen-600" />,
  warn: <CircleAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />,
  block: <OctagonAlert size={16} className="mt-0.5 shrink-0 text-red-600" />,
};

/** The readiness checks: every line is worked out from the record, and names its clause. */
export function ReadinessList({ data, compact = false }: { data: Readiness; compact?: boolean }) {
  return (
    <ul className={cn('space-y-2', compact && 'space-y-1.5')}>
      {data.checks.map((c, i) => (
        <motion.li key={c.label} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex gap-2.5 text-sm">
          {ICON[c.state]}
          <span className="min-w-0">
            <span className="font-medium text-ink">{c.label}</span>
            {!compact && <span className="block text-xs text-ink-mute">{c.detail}</span>}
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

export function Suggestion({ data }: { data: Readiness }) {
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-3.5 py-2.5 text-sm">
      <p className="flex items-center gap-1.5 font-semibold text-brand-900">
        <Sparkles size={14} /> Suggested{data.suggestion.outcome ? `: ${data.suggestion.outcome}` : ''}
      </p>
      <p className="text-brand-900/80">{data.suggestion.text}</p>
      <p className="mt-1 text-[11px] text-brand-800/70">{data.note}</p>
    </div>
  );
}

/** Conditions that go with an approval. Each becomes an obligation with a due date and reminders. */
export function ConditionsEditor({ value, onChange, suggested }: { value: Condition[]; onChange: (c: Condition[]) => void; suggested: Condition[] }) {
  const unused = suggested.filter((s) => !value.some((v) => v.title === s.title));
  const set = (i: number, patch: Partial<Condition>) => onChange(value.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  return (
    <div>
      <p className="label">Conditions of approval</p>
      {value.length === 0 && <p className="text-sm text-ink-mute">None. Add one below if the approval depends on something still to be done.</p>}
      <ul className="space-y-2">
        {value.map((c, i) => (
          <li key={i} className="grid gap-2 rounded-xl border border-slate-200 p-2.5 sm:grid-cols-[1fr_150px_auto]">
            <input className="input" value={c.title} onChange={(e) => set(i, { title: e.target.value })} aria-label="Condition" />
            <input className="input" type="date" value={c.dueOn} onChange={(e) => set(i, { dueOn: e.target.value })} aria-label="Due on" />
            <button className="grid h-10 w-10 place-items-center rounded-lg text-ink-mute hover:bg-slate-100 hover:text-red-600" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label="Remove condition">
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {unused.map((s) => (
          <button key={s.title} className="rounded-full border border-dashed border-brand-300 px-2.5 py-1 text-xs font-medium text-brand-800 hover:bg-brand-50" onClick={() => onChange([...value, s])}>
            <Plus size={11} className="mr-0.5 inline" /> {s.title}
          </button>
        ))}
        <button className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-slate-50" onClick={() => onChange([...value, { title: '', dueOn: '', clause: 'APH 2.25' }])}>
          <Plus size={11} className="mr-0.5 inline" /> Write my own
        </button>
      </div>
    </div>
  );
}
