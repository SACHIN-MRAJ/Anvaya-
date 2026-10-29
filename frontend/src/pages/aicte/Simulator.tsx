import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BASELINE, simulate, type Scenario, type TwinResult } from '../../lib/twin';
import { apiMode, runSimulation } from '../../services/api';
import { Callout, Card, PageHeader } from '../../components/ui';
import { cn } from '../../lib/utils';

function Slider({ id, label, value, min, max, step, onChange, format }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-ink-soft">
          {label}
        </label>
        <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-brand-800">{format(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-brand-700" />
    </div>
  );
}

function Delta({ base, next, suffix = '', invert = false, digits = 0 }: { base: number; next: number; suffix?: string; invert?: boolean; digits?: number }) {
  const d = next - base;
  if (Math.abs(d) < 10 ** -digits / 2) return <span className="text-xs text-ink-mute">no change</span>;
  const good = invert ? d < 0 : d > 0;
  return (
    <span className={cn('text-xs font-semibold', good ? 'text-indgreen-700' : 'text-red-700')}>
      {d > 0 ? '+' : ''}
      {d.toFixed(digits)}
      {suffix} vs today
    </span>
  );
}

export default function Simulator() {
  const [s, setS] = useState<Scenario>(BASELINE);
  const base = useMemo(() => simulate(BASELINE), []);
  const local = useMemo(() => simulate(s), [s]);
  // Sliders answer instantly in the browser; the server then confirms the same scenario a moment later.
  const key = JSON.stringify(s);
  const [server, setServer] = useState<{ key: string; r: TwinResult } | null>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      void runSimulation(s)
        .then((r) => apiMode() === 'on' && setServer({ key, r }))
        .catch(() => undefined);
    }, 350);
    return () => clearTimeout(id);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const confirmed = server?.key === key;
  const run = confirmed ? server.r : local;
  const data = run.weeks.map((w, i) => ({ week: w.week, Today: base.weeks[i].total, Scenario: w.total }));

  return (
    <>
      <PageHeader
        eyebrow="Process digital twin"
        title="What-if simulator"
        description="Test a change before you make it: more officers in a slow region, more empanelled experts, a surge in applications, or a court-directed shift in the calendar. Results update as you move the sliders."
        actions={
          <>
            {apiMode() === 'on' && (
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors', confirmed ? 'bg-indgreen-50 text-indgreen-700' : 'bg-slate-100 text-ink-mute')} aria-live="polite">
                <span className={cn('h-1.5 w-1.5 rounded-full', confirmed ? 'bg-indgreen-500' : 'animate-pulse bg-slate-400')} aria-hidden />
                {confirmed ? 'Confirmed by the server' : 'Checking with the server…'}
              </span>
            )}
            <button className="btn-secondary" onClick={() => setS(BASELINE)}>
              <RotateCcw size={16} /> Reset
            </button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <Card title="Scenario" subtitle="Calibrated from this cycle’s mined log" action={<SlidersHorizontal size={18} className="text-ink-mute" />}>
          <div className="space-y-6">
            <Slider id="off" label="Extra officers in Kanpur and Hyderabad" value={s.extraOfficersBottleneck} min={0} max={8} step={1} onChange={(v) => setS({ ...s, extraOfficersBottleneck: v })} format={(v) => `+${v}`} />
            <Slider id="exp" label="Extra EVC experts empanelled" value={s.extraExperts} min={0} max={20} step={1} onChange={(v) => setS({ ...s, extraExperts: v })} format={(v) => `+${v}`} />
            <Slider id="vol" label="Change in applications" value={s.volumeChange} min={-0.2} max={0.4} step={0.05} onChange={(v) => setS({ ...s, volumeChange: v })} format={(v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`} />
            <Slider id="cal" label="Court-directed deadline extension" value={s.calendarShiftDays} min={0} max={60} step={5} onChange={(v) => setS({ ...s, calendarShiftDays: v })} format={(v) => `${v} days`} />
          </div>
        </Card>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Decided within target', v: `${(run.onTime * 100).toFixed(1)}%`, delta: <Delta base={base.onTime * 100} next={run.onTime * 100} suffix=" pts" digits={1} /> },
              { label: 'Average days to decision', v: run.avgDays.toFixed(0), delta: <Delta base={base.avgDays} next={run.avgDays} suffix=" days" invert /> },
              { label: 'Peak pending files', v: run.peak.toLocaleString('en-IN'), delta: <Delta base={base.peak} next={run.peak} invert /> },
            ].map((k) => (
              <motion.div key={k.label} layout className="card card-pad">
                <p className="text-xs font-medium text-ink-mute">{k.label}</p>
                <motion.p key={k.v} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-1 text-2xl font-semibold tabular-nums">
                  {k.v}
                </motion.p>
                <div className="mt-1">{k.delta}</div>
              </motion.div>
            ))}
          </div>
          <Card title="Pending files, week by week" subtitle="Today’s course versus your scenario, up to the decision deadline">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF2F7" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748B' }} interval={3} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine x={data[Math.min(data.length - 1, run.deadlineWeek - 1)]?.week} stroke="#D9700C" strokeDasharray="4 4" label={{ value: 'Decision deadline', fontSize: 11, fill: '#A9550A', position: 'insideTopRight' }} />
                  <Line type="monotone" dataKey="Today" stroke="#94A3B8" strokeWidth={2} dot={false} strokeDasharray="5 4" />
                  <Line type="monotone" dataKey="Scenario" stroke="#1D4F94" strokeWidth={2.5} dot={false} animationDuration={600} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Callout tone="brand" title="How to read this">
            The model replays this cycle’s arrival and handling rates. It is a planning aid for officials, not a forecast anyone is bound by. Production runs a SimPy discrete-event simulation over the full event log.
          </Callout>
        </div>
      </div>
    </>
  );
}
