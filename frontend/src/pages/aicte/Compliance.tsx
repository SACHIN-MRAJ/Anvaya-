import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertOctagon, CalendarClock, CheckCircle2, Landmark, Siren } from 'lucide-react';
import { useAsync } from '../../lib/useAsync';
import { ApiError, getObligations, remindObligation, verifyObligation } from '../../services/api';
import { INSTITUTIONS, institutionById } from '../../data/institutions';
import { Badge, Card, LoadingRows, ObligationBadge, PageHeader, Stat, Tabs, WhyChip, stagger, toast } from '../../components/ui';
import { cn, daysBetween, formatDate, TODAY } from '../../lib/utils';
import type { ObligationStatus } from '../../types';
import { InspectionDraw } from '../../components/inspection-draw';

export default function AicteCompliance() {
  const { data, loading, reload } = useAsync(() => getObligations());
  const [tab, setTab] = useState<'all' | ObligationStatus>('all');
  const [verified, setVerified] = useState<string[]>([]);
  const rows = (data ?? []).filter((o) => tab === 'all' || o.status === tab);
  const count = (s: ObligationStatus) => (data ?? []).filter((o) => o.status === s).length;

  const leases = useMemo(
    () =>
      INSTITUTIONS.filter((i) => i.land === 'Leased' && i.leaseEnd)
        .map((i) => {
          const live = (new Date(i.leaseEnd!).getTime() - new Date(TODAY).getTime()) / (365.25 * 86_400_000);
          return { i, live, runway: live - i.longestCourseYears };
        })
        .sort((a, b) => a.runway - b.runway),
    [],
  );

  return (
    <>
      <PageHeader eyebrow="Modules D and E" title="Compliance monitor" description="Every conditional approval, undertaking, lease and prescribed document across all institutions. Reminders go out before due dates; overdue items climb the escalation ladder automatically." />

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Escalated" value={count('Escalated')} hint="Beyond level 1" tone="red" icon={<Siren size={20} />} />
        <Stat label="Overdue" value={count('Overdue')} hint="Regional officer notified" tone="amber" icon={<AlertOctagon size={20} />} />
        <Stat label="Due in the next 30 days" value={(data ?? []).filter((o) => o.status !== 'Met' && daysBetween(TODAY, o.dueOn) >= 0 && daysBetween(TODAY, o.dueOn) <= 30).length} hint="Reminders scheduled" icon={<CalendarClock size={20} />} />
        <Stat label="Met and verified" value={count('Met') + verified.length} tone="green" icon={<CheckCircle2 size={20} />} />
      </motion.div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card pad={false}>
          <div className="px-4 pt-2">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'all', label: 'All', count: data?.length },
                { value: 'Escalated', label: 'Escalated', count: count('Escalated') },
                { value: 'Overdue', label: 'Overdue', count: count('Overdue') },
                { value: 'Due soon', label: 'Due soon', count: count('Due soon') },
                { value: 'On track', label: 'On track' },
              ]}
            />
          </div>
          {loading ? (
            <LoadingRows />
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((o) => {
                const d = daysBetween(TODAY, o.dueOn);
                const isVerified = verified.includes(o.id);
                return (
                  <motion.li layout key={o.id} className="grid gap-3 px-6 py-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="slate">{o.kind}</Badge>
                        <ObligationBadge status={isVerified ? 'Met' : o.status} />
                        {o.escalationLevel > 0 && !isVerified && <Badge tone="red">Level {o.escalationLevel}</Badge>}
                        <WhyChip rule={`Obligation: ${o.kind}`} clause={o.clause} detail={`Created from: ${o.source}`} />
                      </div>
                      <p className="mt-1.5 text-sm font-medium">{o.title}</p>
                      <p className="text-xs text-ink-mute">
                        {institutionById(o.institutionId)?.name} · due {formatDate(o.dueOn)} · <span className={cn(d < 0 && o.status !== 'Met' && !isVerified && 'font-medium text-red-700')}>{o.status === 'Met' || isVerified ? 'met' : d >= 0 ? `${d} days left` : `${-d} days overdue`}</span>
                      </p>
                    </div>
                    {o.status !== 'Met' && !isVerified && (
                      <div className="flex gap-2">
                        <button
                          className="btn-secondary btn-sm"
                          onClick={async () => {
                            try {
                              const done = await verifyObligation(o.id);
                              setVerified((v) => [...v, o.id]);
                              if (done) reload();
                              toast('Evidence verified and obligation closed. Recorded in the evidence log.');
                            } catch (e) {
                              toast(e instanceof ApiError ? e.message : 'Could not verify. Please try again.', 'red');
                            }
                          }}
                        >
                          Verify evidence
                        </button>
                        <button
                          className="btn-ghost btn-sm"
                          onClick={async () => {
                            const sent = await remindObligation(o.id).catch(() => null);
                            toast(sent ? `Reminder sent${sent.channels.length ? ` by ${sent.channels.join(', ')}` : ''} and recorded in the evidence log.` : 'Reminder sent by email, SMS and WhatsApp', 'brand');
                          }}
                        >
                          Remind
                        </button>
                      </div>
                    )}
                  </motion.li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Lease runway radar" subtitle="Leased campuses, shortest runway first (APH 2.1(e))" pad={false}>
            <ul className="divide-y divide-slate-100">
              {leases.slice(0, 7).map(({ i, live, runway }, idx) => (
                <li key={i.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <Landmark size={14} className="shrink-0 text-ink-mute" />
                      <span className="truncate font-medium">{i.name.split(',')[0]}</span>
                    </span>
                    <span className={cn('shrink-0 text-xs font-semibold tabular-nums', runway < 1 ? 'text-red-700' : runway < 3 ? 'text-amber-700' : 'text-indgreen-700')}>{runway.toFixed(1)} yrs</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <motion.div className={cn('h-full rounded-full', runway < 1 ? 'bg-red-600' : runway < 3 ? 'bg-amber-500' : 'bg-indgreen-500')} initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(4, (runway / 25) * 100))}%` }} transition={{ delay: idx * 0.06, duration: 0.6 }} />
                  </div>
                  <p className="mt-1 text-[11px] text-ink-mute">
                    Live lease {live.toFixed(1)} yrs · longest course {i.longestCourseYears} yrs
                  </p>
                </li>
              ))}
            </ul>
          </Card>
          <InspectionDraw />
        </div>
      </div>
    </>
  );
}
