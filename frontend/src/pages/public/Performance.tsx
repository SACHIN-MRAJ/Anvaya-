import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarCheck2, Download, FileJson, Gauge, Hourglass, Inbox, TriangleAlert } from 'lucide-react';
import { Card, PageHeader, Reveal, Stat, stagger } from '../../components/ui';
import { downloadCsv } from '../../lib/csv';
import { downloadText } from '../../lib/files';
import { usePerformance } from '../../lib/live-data';
import { cn, formatDate, TODAY } from '../../lib/utils';
import type { Stage } from '../../types';

export default function Performance() {
  const { data: perf } = usePerformance();
  const all = perf.national;
  const regions = useMemo(() => perf.regions.filter((r) => r.decided + r.open > 0).sort((a, b) => b.onTimePct - a.onTimePct), [perf]);
  const stages = perf.stages;
  const outcomes = perf.outcomes;
  const maxOutcome = Math.max(1, ...outcomes.map((x) => x.n));
  const exportJson = () => downloadText('anumati-performance.json', JSON.stringify({ ...perf, regions }, null, 2), 'application/json');

  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Open and accountable"
        title="How AICTE is performing"
        description="Published every night from the same records officers work on, so nobody prepares these numbers by hand. Download them as open data, or connect to the API."
        actions={
          <>
            <button className="btn-secondary" onClick={() => downloadCsv('anumati-regions.csv', regions.map((r) => ({ Region: r.name, Office: r.office, Decided: r.decided, 'On time %': r.onTimePct, 'Median days': r.medianDays, Open: r.open, 'Missed deadlines': r.missed })))}>
              <Download size={16} /> CSV
            </button>
            <button className="btn-secondary" onClick={exportJson}>
              <FileJson size={16} /> JSON
            </button>
          </>
        }
      />

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Decisions issued" value={all.decided} hint="This cycle" tone="green" icon={<CalendarCheck2 size={20} />} />
        <Stat label="Decided on time" value={`${all.onTimePct}%`} hint="Within the handbook target" tone="brand" icon={<Gauge size={20} />} />
        <Stat label="Median days to decide" value={all.medianDays} hint="From submission to letter" tone="slate" icon={<Hourglass size={20} />} />
        <Stat label="Files open" value={all.open} hint="Being processed now" tone="brand" icon={<Inbox size={20} />} />
        <Stat label="Deadlines missed" value={all.missed} hint="Escalated automatically" tone="red" icon={<TriangleAlert size={20} />} />
      </motion.div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Reveal>
          <Card title="Regional offices, most on-time first" subtitle="Every office measured the same way" pad={false}>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Regional office</th>
                    <th>On time</th>
                    <th className="text-right">Median days</th>
                    <th className="text-right">Open</th>
                    <th className="text-right">Missed</th>
                  </tr>
                </thead>
                <tbody>
                  {regions.map((r, i) => (
                    <tr key={r.id}>
                      <td>
                        <p className="font-medium text-ink">{r.office}</p>
                        <p className="text-xs text-ink-mute">{r.name}</p>
                      </td>
                      <td className="min-w-[150px]">
                        <div className="flex items-center gap-2">
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <motion.span className={cn('block h-full rounded-full', r.onTimePct >= 80 ? 'bg-indgreen-500' : r.onTimePct >= 60 ? 'bg-amber-500' : 'bg-red-600')} initial={{ width: 0 }} whileInView={{ width: `${r.onTimePct}%` }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.6 }} />
                          </span>
                          <span className="w-10 text-right text-xs font-semibold tabular-nums">{r.onTimePct}%</span>
                        </div>
                      </td>
                      <td className="text-right tabular-nums">{r.medianDays || '–'}</td>
                      <td className="text-right tabular-nums">{r.open}</td>
                      <td className={cn('text-right tabular-nums', r.missed ? 'font-semibold text-red-700' : '')}>{r.missed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>

        <div className="space-y-6">
          <Reveal delay={0.05}>
            <Card title="Where files are waiting now" subtitle="Orange part of each bar: past its deadline">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stages} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                    <CartesianGrid stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="stage" tick={{ fontSize: 10 }} interval={0} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="onTime" name="Within deadline" stackId="a" fill="#2858A8" />
                    <Bar dataKey="late" name="Past deadline" stackId="a" fill="#F58A1F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.1}>
            <Card title="Decisions by outcome">
              <ul className="space-y-3">
                {outcomes.map(({ o, n }) => (
                  <li key={o} className="text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-ink">{o === 'EoA' ? 'Extension of Approval' : o === 'LoA' ? 'Letter of Approval' : o === 'LoD' ? 'Letter of Deficiency' : 'Letter of Rejection'}</span>
                      <span className="tabular-nums text-ink-mute">{n}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <motion.div className={cn('h-full rounded-full', o === 'LoR' ? 'bg-red-600' : o === 'LoD' ? 'bg-amber-500' : 'bg-indgreen-500')} initial={{ width: 0 }} whileInView={{ width: `${(n / maxOutcome) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.6 }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>
      </div>

      <Reveal className="mt-6">
        <div className="card flex flex-col gap-3 p-5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-mute">
            Updated {formatDate(TODAY)}, 2:00 am · Open data under the Government Open Data License, India · API: <span className="font-mono text-xs text-ink">GET /public/performance</span>
          </p>
        </div>
      </Reveal>
    </div>
  );
}
