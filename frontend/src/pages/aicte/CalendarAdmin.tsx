import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarCog, Gavel } from 'lucide-react';
import { useCalendar } from '../../lib/live-data';
import { invalidate } from '../../lib/resource';
import { ApiError, reviseCalendar } from '../../services/api';
import { APPLICATIONS } from '../../data/applications';
import { OBLIGATIONS } from '../../data/misc';
import { CalendarGantt } from '../public/Calendar';
import { Badge, Callout, Card, PageHeader, toast } from '../../components/ui';
import { daysBetween, formatDate } from '../../lib/utils';

export default function CalendarAdmin() {
  const CALENDAR = useCalendar();
  const [sending, setSending] = useState(false);
  const deadlines = CALENDAR.filter((c) => c.kind === 'deadline' || c.kind === 'window');
  const [eventId, setEventId] = useState('C6');
  const ev = CALENDAR.find((c) => c.id === eventId) ?? CALENDAR[0];
  const [newDate, setNewDate] = useState('2027-05-31');
  const [basis, setBasis] = useState('Supreme Court order in MA ___ of 2027 extending the approval schedule');
  const shift = daysBetween(ev.endDate ?? ev.date, newDate);

  const impact = useMemo(() => {
    const open = APPLICATIONS.filter((a) => a.stage !== 'decision');
    return {
      applications: open.length,
      timers: open.length * 2 + 17,
      obligations: OBLIGATIONS.filter((o) => o.status !== 'Met').length,
      notices: 3,
    };
  }, []);

  return (
    <>
      <PageHeader eyebrow="Governance" title="Academic calendar" description="The calendar is configuration, not code. When a court order or Council decision moves a date, change it here: every dependent deadline, reminder and escalation is recalculated, and the old date stays on record." />
      <Card title="Cycle 2027-28" className="mb-6">
        <CalendarGantt />
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Change a date" subtitle="Preview the impact before publishing">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="ev">
                Date to change
              </label>
              <select id="ev" className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
                {deadlines.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label} ({formatDate(d.endDate ?? d.date)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="nd">
                New date
              </label>
              <input id="nd" type="date" className="input" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="basis">
                Legal basis (shown publicly)
              </label>
              <textarea id="basis" rows={2} className="input" value={basis} onChange={(e) => setBasis(e.target.value)} />
            </div>
          </div>
        </Card>
        <Card title="Impact preview" subtitle={`Shift of ${shift >= 0 ? '+' : ''}${shift} days`}>
          <motion.dl key={newDate + eventId} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-4">
            {[
              ['Open applications re-planned', impact.applications],
              ['Timers recalculated', impact.timers],
              ['Obligations re-dated', impact.obligations],
              ['Public notices updated', impact.notices],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-lg bg-slate-50 p-4">
                <dt className="text-xs text-ink-mute">{l}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </motion.dl>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="slate">
              <s>{formatDate(ev.endDate ?? ev.date)}</s>
            </Badge>
            →
            <Badge tone="brand">{formatDate(newDate)}</Badge>
          </div>
          <button
            className="btn-primary mt-5"
            disabled={basis.trim().length < 10 || sending}
            onClick={async () => {
              setSending(true);
              try {
                // A window keeps its start and moves its end; a deadline moves itself. The reason is published with it.
                const done = ev.endDate ? await reviseCalendar(ev.id, ev.date, basis.trim(), newDate) : await reviseCalendar(ev.id, newDate, basis.trim());
                invalidate('calendar');
                toast(done ? `“${ev.label}” revised to ${formatDate(newDate)}. The public calendar now shows the change and its reason.` : 'Calendar change submitted for approval. On approval, all deadlines update and the public calendar shows the revision.');
              } catch (e) {
                toast(e instanceof ApiError ? e.message : 'Could not revise the date.', 'red');
              } finally {
                setSending(false);
              }
            }}
          >
            <CalendarCog size={16} /> {sending ? 'Saving…' : 'Revise the date'}
          </button>
        </Card>
      </div>
      <div className="mt-6">
        <Callout tone="brand" icon={<Gavel size={18} />} title="Why this matters">
          Courts have shifted approval and admission dates in past cycles. Recalculating hundreds of deadlines by hand is where follow-ups get missed. Here it is one recorded change.
        </Callout>
      </div>
    </>
  );
}
