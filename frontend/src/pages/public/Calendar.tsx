import { motion } from 'framer-motion';
import { CalendarClock, History } from 'lucide-react';
import { useCalendar } from '../../lib/live-data';
import { Badge, Card, PageHeader } from '../../components/ui';
import { cn, daysBetween, formatDate, TODAY } from '../../lib/utils';

const START = '2026-08-01';
const END = '2027-06-30';
const MONTHS = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

export function CalendarGantt() {
  const calendar = useCalendar();
  const span = daysBetween(START, END);
  const x = (d: string) => (daysBetween(START, d) / span) * 100;
  const todayX = x(TODAY);
  return (
    <div className="overflow-x-auto scroll-thin">
      <div className="min-w-[760px]">
        <div className="ml-[260px] grid grid-cols-11 border-b border-slate-200 pb-2 text-xs font-medium text-ink-mute">
          {MONTHS.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
        <ul className="relative">
          <span className="absolute bottom-0 top-0 z-10 w-px bg-saffron-500" style={{ left: `calc(260px + (100% - 260px) * ${todayX / 100})` }} aria-hidden>
            <span className="absolute -top-1 left-1 whitespace-nowrap rounded bg-saffron-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">Today</span>
          </span>
          {calendar.map((c, i) => {
            const left = x(c.date);
            const width = c.endDate ? Math.max(1.2, x(c.endDate) - left) : 0;
            return (
              <li key={c.id} className="flex items-center border-b border-slate-100 py-3">
                <div className="w-[260px] shrink-0 pr-4">
                  <p className="text-sm font-medium leading-snug">{c.label}</p>
                  <p className="text-xs text-ink-mute">{c.clause}</p>
                </div>
                <div className="relative h-7 flex-1">
                  {c.endDate ? (
                    <motion.span
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.06, duration: 0.6, ease: 'easeOut' }}
                      className="absolute top-1 h-5 origin-left rounded-md bg-brand-200"
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${formatDate(c.date)} to ${formatDate(c.endDate)}`}
                    />
                  ) : (
                    <motion.span
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.06 }}
                      className={cn('absolute top-1.5 h-4 w-4 -translate-x-1/2 rotate-45 rounded-sm', c.kind === 'deadline' ? 'bg-red-600' : 'bg-brand-700')}
                      style={{ left: `${left}%` }}
                      title={formatDate(c.date)}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default function PublicCalendar() {
  const calendar = useCalendar();
  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Public"
        title="Academic and approval calendar 2027-28"
        description="All dates in one place, with every revision recorded. When a court order or notification changes a date, the old date stays visible with the reason."
      />
      <Card title="Timeline" subtitle="Bars are windows; diamonds are single dates." className="mb-6">
        <CalendarGantt />
      </Card>
      <Card title="All dates" pad={false}>
        <ul className="divide-y divide-slate-100">
          {calendar.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <CalendarClock size={18} className="mt-0.5 shrink-0 text-brand-600" />
                <div>
                  <p className="font-medium">{c.label}</p>
                  <p className="text-sm text-ink-mute">
                    {c.endDate ? `${formatDate(c.date)} to ${formatDate(c.endDate)}` : formatDate(c.date)} · {c.clause}
                  </p>
                  {c.revisedFrom && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-800">
                      <History size={12} /> Revised from <s>{formatDate(c.revisedFrom)}</s>. {c.revisionReason}
                    </p>
                  )}
                </div>
              </div>
              <Badge tone={c.kind === 'deadline' ? 'red' : c.kind === 'window' ? 'brand' : 'slate'}>{c.kind === 'deadline' ? 'Deadline' : c.kind === 'window' ? 'Window' : 'Milestone'}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
