import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, BadgeCheck, CircleSlash, Clock3, CloudOff, Lock, OctagonAlert, ShieldAlert } from 'lucide-react';
import { apiMode } from '../services/api';
import type { Certificate, Finding } from '../services/records';
import { Badge, Callout, EmptyState, LoadingRows } from './ui';
import { cn, formatDate } from '../lib/utils';

/** Loading while the server answers; a plain explanation when the site is running on built-in data. */
export function Pending({ loading, what }: { loading: boolean; what: string }) {
  if (loading && apiMode() === 'on') return <LoadingRows rows={6} />;
  return (
    <EmptyState
      icon={<CloudOff size={22} />}
      title="This page needs the ANUMATI server"
      text={`${what} lives in the institution's record on the server. Start the backend (backend/run.cmd) and reload; the sample data in the browser does not include it.`}
    />
  );
}

export function FindingList({ items, empty = 'Nothing to fix.' }: { items: Finding[]; empty?: string }) {
  if (!items.length)
    return (
      <p className="flex items-center gap-2 text-sm text-indgreen-700">
        <BadgeCheck size={16} /> {empty}
      </p>
    );
  return (
    <ul className="space-y-2">
      {items.map((f, i) => (
        <motion.li
          key={f.title}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className={cn('flex gap-3 rounded-xl border px-3.5 py-2.5 text-sm', f.severity === 'blocker' ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60')}
        >
          {f.severity === 'blocker' ? <OctagonAlert size={17} className="mt-0.5 shrink-0 text-red-600" /> : <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />}
          <span className="min-w-0">
            <span className="block font-medium text-ink">{f.title}</span>
            {f.detail && <span className="block text-ink-mute">{f.detail}</span>}
            <span className="mt-0.5 block text-[11px] font-semibold text-ink-mute">{f.clause}</span>
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

export function VerificationBadge({ status }: { status: 'Pending' | 'Verified' | 'Discrepancy' | string }) {
  if (status === 'Verified')
    return (
      <Badge tone="green" icon={<BadgeCheck size={12} />}>
        Verified by AICTE
      </Badge>
    );
  if (status === 'Discrepancy')
    return (
      <Badge tone="red" icon={<ShieldAlert size={12} />}>
        Discrepancy
      </Badge>
    );
  return (
    <Badge tone="slate" icon={<Clock3 size={12} />}>
      Awaiting AICTE check
    </Badge>
  );
}

export const DOC_STATUS: Record<string, { tone: 'slate' | 'brand' | 'green' | 'red' | 'amber'; label: string }> = {
  missing: { tone: 'red', label: 'Missing' },
  uploaded: { tone: 'slate', label: 'Uploaded' },
  'awaiting verification': { tone: 'brand', label: 'Awaiting verification' },
  verified: { tone: 'green', label: 'Verified' },
  'needs correction': { tone: 'amber', label: 'Needs correction' },
};
export function DocStatus({ status }: { status: string }) {
  const s = DOC_STATUS[status] ?? DOC_STATUS.uploaded;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** Have against need, as a bar that turns amber when short. */
export function Meter({ label, have, need, unit = '', hint }: { label: ReactNode; have: number; need: number; unit?: string; hint?: ReactNode }) {
  const ok = have >= need;
  const pct = need ? Math.min(100, (have / need) * 100) : 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium text-ink">{label}</span>
        <span className={cn('shrink-0 tabular-nums', ok ? 'text-ink-soft' : 'font-semibold text-amber-700')}>
          {have.toLocaleString('en-IN')}
          {unit} / {need.toLocaleString('en-IN')}
          {unit}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100" role="meter" aria-valuemin={0} aria-valuemax={need} aria-valuenow={have} aria-label={typeof label === 'string' ? label : undefined}>
        <motion.div className={cn('h-full rounded-full', ok ? 'bg-indgreen-500' : 'bg-amber-500')} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
      </div>
      {hint && <p className="mt-1 text-xs text-ink-mute">{hint}</p>}
    </div>
  );
}

/** Certificates on a one-year line: expired ones on the left edge, the nearest expiry first in the list. */
export function ExpiryRadar({ certificates }: { certificates: Certificate[] }) {
  const dated = certificates.filter((c) => c.days !== null);
  const span = 365;
  return (
    <div>
      <div className="relative mt-2 h-14">
        <div className="absolute inset-x-0 top-7 h-1.5 rounded-full bg-gradient-to-r from-red-200 via-amber-100 to-indgreen-100" />
        {[0, 30, 90, 180, 365].map((d) => (
          <span key={d} className="absolute top-10 -translate-x-1/2 text-[10px] text-ink-mute" style={{ left: `${(d / span) * 100}%` }}>
            {d === 0 ? 'today' : `${d}d`}
          </span>
        ))}
        {dated.map((c, i) => {
          const x = Math.max(0, Math.min(span, c.days ?? 0));
          return (
            <motion.span
              key={c.id}
              title={`${c.kind}: ${c.state}${c.validUntil ? ` (${formatDate(c.validUntil)})` : ''}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.05, type: 'spring', stiffness: 300, damping: 18 }}
              className={cn('absolute top-[22px] grid h-4 w-4 -translate-x-1/2 place-items-center rounded-full ring-2 ring-white', c.tone === 'red' ? 'bg-red-500' : c.tone === 'amber' ? 'bg-amber-500' : 'bg-indgreen-500')}
              style={{ left: `${(x / span) * 100}%` }}
            />
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-mute">Reminders go out 60, 30, 15, 7 and 1 day before a certificate expires, by email, SMS and WhatsApp.</p>
    </div>
  );
}

export function ReadOnlyNote({ who, what }: { who: string; what: string }) {
  return (
    <Callout tone="brand" icon={<Lock size={16} />} title="View only for your role">
      {what} can be changed by the {who}. Ask them, or ask the Principal to change your access on the Team page.
    </Callout>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-ink-mute">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-ink">{children || <span className="text-ink-mute">Not given</span>}</dd>
    </div>
  );
}

export function NotAllowed({ text }: { text: string }) {
  return <EmptyState icon={<CircleSlash size={22} />} title="Not available for your role" text={text} />;
}
