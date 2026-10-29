import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, BellRing, CheckCircle2, Clock4, Gauge, ShieldCheck, Signal, TimerReset } from 'lucide-react';
import { Badge, Card, PageHeader, Reveal, toast } from '../../components/ui';
import { mulberry32 } from '../../lib/rng';
import { useForecast, useStatus } from '../../lib/live-data';
import { ApiError, pingApi, subscribeStatus } from '../../services/api';
import { addDays, cn, formatDate, TODAY } from '../../lib/utils';

const WINDOW_START = '2026-10-01';
const WINDOW_END = '2026-11-30';

const SERVICES = ['Public portal', 'Institution portal', 'AICTE officials portal', 'Document upload and storage', 'Digital signature check', 'DigiLocker source check', 'Alerts: email, SMS, WhatsApp', 'Evidence log', 'Fee payment gateway'];

type Day = 'ok' | 'slow' | 'down';

function history(seed: number): Day[] {
  const r = mulberry32(seed);
  return Array.from({ length: 90 }, () => {
    const x = r();
    return x > 0.996 ? 'down' : x > 0.982 ? 'slow' : 'ok';
  });
}

/** Expected submissions per day across the application window: flat, then the familiar last-week surge. */
function forecast() {
  const r = mulberry32(2611);
  const days = Math.round((new Date(WINDOW_END).getTime() - new Date(WINDOW_START).getTime()) / 86_400_000) + 1;
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(WINDOW_START, i);
    const left = days - 1 - i;
    const expected = Math.round(14 + i * 0.35 + 300 * Math.exp(-left / 3.2));
    const past = date <= TODAY;
    return { date, label: formatDate(date).replace(' 2026', ''), actual: past ? Math.round(expected * (0.85 + r() * 0.3)) : null, expected: past ? null : expected, all: expected };
  });
}

export default function Status() {
  const [checkedAt, setCheckedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [latency, setLatency] = useState<number | null>(null);
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number } }).connection;

  useEffect(() => {
    const measure = async () => {
      setLatency(await pingApi());
      setCheckedAt(Date.now());
    };
    measure();
    const probe = setInterval(measure, 30_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(probe);
      clearInterval(tick);
    };
  }, []);

  // The server's real checks and history when connected; a simulated history on built-in data.
  const { data: server } = useStatus();
  const { data: fc } = useForecast();
  const services = useMemo(() => server?.services.map((s) => ({ name: s.service, days: s.days })) ?? SERVICES.map((name, i) => ({ name, days: history(100 + i * 17) })), [server]);
  const data = useMemo(
    () =>
      fc?.days.map((d) => ({ date: d.date, label: formatDate(d.date).replace(' 2026', ''), actual: d.date <= TODAY ? d.submitted : null, expected: d.date <= TODAY ? null : d.expected, all: d.expected })) ??
      forecast(),
    [fc],
  );
  const total = data.reduce((s, d) => s + d.all, 0);
  const lastWeek = data.slice(-7).reduce((s, d) => s + d.all, 0);
  const today = data.find((d) => d.date === TODAY)?.all ?? 1;
  const rushStart = fc?.rushFrom ?? data.find((d) => d.date > TODAY && d.all > today * 2.5)?.date ?? WINDOW_END;
  const healthy = server?.ok ?? true;
  const since = Math.max(0, Math.round((now - checkedAt) / 1000));

  return (
    <div className="container-page py-10">
      <PageHeader eyebrow="Open and accountable" title="Service status" description="Live health of every ANUMATI service, the last 90 days of uptime, and when the submission rush is expected, so nobody loses a deadline to a busy portal." />

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card mb-6 flex flex-col gap-4 overflow-hidden p-0 md:flex-row md:items-stretch">
        <div className={cn('flex flex-1 items-center gap-4 bg-gradient-to-r to-transparent px-6 py-5', healthy ? 'from-indgreen-50' : 'from-amber-50')}>
          <span className={cn('relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white', healthy ? 'bg-indgreen-600' : 'bg-amber-500')}>
            <span className={cn('absolute inset-0 animate-ring rounded-2xl', healthy ? 'bg-indgreen-400' : 'bg-amber-300')} aria-hidden />
            <CheckCircle2 size={24} className="relative" />
          </span>
          <div>
            <p className="font-display text-lg font-bold text-ink">{server?.overall ?? 'All services are running normally'}</p>
            <p className="text-sm text-ink-mute">Checked {since < 3 ? 'just now' : `${since} seconds ago`} · checks repeat every 30 seconds</p>
            {server && (
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Live checks from the server">
                {Object.entries(server.checks).map(([name, c]) => (
                  <li key={name} className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', c.ok ? 'bg-indgreen-50 text-indgreen-700' : 'bg-amber-50 text-amber-800')}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', c.ok ? 'bg-indgreen-500' : 'bg-amber-500')} aria-hidden />
                    {name}
                    {typeof c.ms === 'number' && <span className="font-normal tabular-nums opacity-80">{c.ms} ms</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100 md:w-[420px] md:border-l md:border-t-0">
          <div className="bg-white px-5 py-4">
            <dt className="flex items-center gap-1.5 text-xs text-ink-mute">
              <Gauge size={13} /> Response time from ANUMATI
            </dt>
            <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{latency === null ? '…' : `${latency} ms`}</dd>
          </div>
          <div className="bg-white px-5 py-4">
            <dt className="flex items-center gap-1.5 text-xs text-ink-mute">
              <Signal size={13} /> Your connection
            </dt>
            <dd className="mt-1 font-display text-2xl font-bold uppercase text-ink">{conn?.effectiveType ?? 'Good'}</dd>
          </div>
        </dl>
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Reveal>
          <Card title="Deadline rush forecast" subtitle={`Expected submissions per day, ${formatDate(WINDOW_START)} to ${formatDate(WINDOW_END)}`}>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g-act" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2858A8" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2858A8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g-exp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F58A1F" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#F58A1F" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={9} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v: number, n: string) => [v, n === 'actual' ? 'Submitted' : 'Expected']} />
                  <ReferenceLine x={formatDate(TODAY).replace(' 2026', '')} stroke="#0A1D42" strokeDasharray="4 4" label={{ value: 'Today', position: 'insideTopLeft', fontSize: 11, fill: '#5B6B82' }} />
                  <Area type="monotone" dataKey="actual" stroke="#2858A8" strokeWidth={2} fill="url(#g-act)" connectNulls={false} />
                  <Area type="monotone" dataKey="expected" stroke="#F58A1F" strokeWidth={2} strokeDasharray="5 4" fill="url(#g-exp)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs text-ink-mute">Last 7 days bring</p>
                <p className="font-display text-xl font-bold text-ink">{Math.round((lastWeek / total) * 100)}% of files</p>
              </div>
              <div className="rounded-xl bg-saffron-50 px-4 py-3">
                <p className="text-xs text-ink-mute">Rush expected from</p>
                <p className="font-display text-xl font-bold text-saffron-700">{formatDate(rushStart)}</p>
              </div>
              <div className="rounded-xl bg-indgreen-50 px-4 py-3">
                <p className="text-xs text-ink-mute">Best time to submit</p>
                <p className="font-display text-xl font-bold text-indgreen-700">This week</p>
              </div>
            </div>
            <div className="mt-4 flex gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
              <ShieldCheck size={18} className="mt-0.5 shrink-0" />
              <p>
                <b>Your deadline is protected.</b> A submission is time-stamped the moment you press Submit and placed in a durable queue, so a busy portal can never make you miss the date. In past cycles, portal load near the last date forced repeated extensions.
              </p>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.06}>
          <Card title="Services" subtitle="Each bar is one day. Hover a bar for the date." pad={false}>
            <ul className="divide-y divide-slate-100">
              {services.map((s) => {
                // A slow day still serves requests; an outage day loses about 20 minutes.
                const lostMinutes = s.days.filter((d) => d === 'down').length * 20;
                const up = 100 - (lostMinutes / (s.days.length * 1440)) * 100;
                return (
                  <li key={s.name} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 font-medium text-ink">
                        <span className="h-2 w-2 rounded-full bg-indgreen-500" aria-hidden /> {s.name}
                      </span>
                      <span className="text-xs tabular-nums text-ink-mute">{up.toFixed(2)}% uptime</span>
                    </div>
                    <div className="mt-2 flex h-6 gap-[2px]" aria-label={`${s.name}: last 90 days`}>
                      {s.days.map((d, i) => (
                        <span
                          key={i}
                          title={`${formatDate(addDays(TODAY, i - 89))}: ${d === 'ok' ? 'No issues' : d === 'slow' ? 'Slower than usual' : 'Short outage'}`}
                          className={cn('flex-1 rounded-[2px] transition-opacity hover:opacity-60', d === 'ok' ? 'bg-indgreen-400' : d === 'slow' ? 'bg-amber-400' : 'bg-red-500')}
                        />
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </Reveal>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Reveal>
          <Card title="Recent incidents">
            <ol className="space-y-4 text-sm">
              {[
                { d: '12 Oct 2026', t: 'Slow document uploads for 18 minutes', c: 'Storage maintenance overran its window. Uploads queued and completed; no file was lost.' },
                { d: '27 Sep 2026', t: 'SMS alerts delayed by up to 40 minutes', c: 'Provider congestion. Email and in-portal alerts were unaffected; the provider has a standby route now.' },
              ].map((x) => (
                <li key={x.t} className="flex gap-3">
                  <TimerReset size={18} className="mt-0.5 shrink-0 text-ink-mute" />
                  <div>
                    <p className="font-semibold text-ink">
                      {x.t} <Badge tone="green">Resolved</Badge>
                    </p>
                    <p className="text-xs text-ink-mute">{x.d}</p>
                    <p className="mt-1 text-ink-mute">{x.c}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </Reveal>
        <Reveal delay={0.06}>
          <Card title="Get status alerts" subtitle="Planned maintenance is announced 72 hours ahead and never scheduled in the last 10 days of a window.">
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const contact = (form.elements.namedItem('contact') as HTMLInputElement).value;
                try {
                  const done = await subscribeStatus(contact);
                  toast(done ? done.message : 'You will get maintenance and incident alerts.');
                  form.reset();
                } catch (err) {
                  toast(err instanceof ApiError ? err.message : 'Could not subscribe. Please try again.', 'red');
                }
              }}
            >
              <label htmlFor="st-mail" className="sr-only">
                Email or mobile number
              </label>
              <input id="st-mail" name="contact" className="input flex-1" placeholder="Email or mobile number" autoComplete="email" required />
              <button className="btn-primary">
                <BellRing size={16} /> Subscribe
              </button>
            </form>
            <ul className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <li className="flex items-center gap-2 text-ink-soft">
                <Activity size={16} className="text-brand-600" /> Target availability 99.9%
              </li>
              <li className="flex items-center gap-2 text-ink-soft">
                <Clock4 size={16} className="text-brand-600" /> Incident note within 30 minutes
              </li>
            </ul>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
