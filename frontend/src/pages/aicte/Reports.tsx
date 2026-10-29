import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Printer } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { REGIONS, institutionById } from '../../data/institutions';
import { Card, PageHeader, toast } from '../../components/ui';
import { useApplicationsLive, useObligationsLive } from '../../lib/live-data';
import { downloadReport } from '../../services/api';

const SERVER_REPORTS = [
  { name: 'pendency', label: 'Pendency (every open file)' },
  { name: 'obligations', label: 'Obligations and escalations' },
  { name: 'decisions', label: 'Decisions issued' },
] as const;
import { downloadCsv } from '../../lib/csv';
import { daysBetween, TODAY } from '../../lib/utils';

export default function Reports() {
  // Live records from the server (the officer's region only, for region-locked roles); built-in data otherwise.
  const { data: APPLICATIONS } = useApplicationsLive();
  const { data: OBLIGATIONS } = useObligationsLive();
  const [busy, setBusy] = useState('');
  const fetchReport = async (name: 'pendency' | 'regions' | 'obligations' | 'decisions', format: 'csv' | 'json' = 'csv') => {
    setBusy(name);
    const ok = await downloadReport(name, format);
    setBusy('');
    if (!ok && name === 'regions') downloadCsv('region-performance.csv', exportRows);
    else if (!ok) toast('Connect the server to download this report.', 'brand');
  };
  const rows = useMemo(
    () =>
      REGIONS.map((r) => {
        const apps = APPLICATIONS.filter((a) => a.region === r.id);
        const open = apps.filter((a) => a.stage !== 'decision');
        const decided = apps.filter((a) => a.stage === 'decision');
        const breached = open.filter((a) => a.clock === 'breached').length;
        const avgAge = open.length ? Math.round(open.reduce((s, a) => s + daysBetween(a.submittedOn, TODAY), 0) / open.length) : 0;
        const obl = OBLIGATIONS.filter((o) => institutionById(o.institutionId)?.region === r.id);
        return {
          Region: `${r.name} (${r.office})`,
          short: r.office,
          Received: apps.length,
          Pending: open.length,
          Decided: decided.length,
          'Disposal rate': apps.length ? Math.round((decided.length / apps.length) * 100) : 0,
          'Missed deadlines': breached,
          'Average age (days)': avgAge,
          'Open obligations': obl.filter((o) => o.status !== 'Met').length,
          Scrutiny: open.filter((a) => a.stage === 'scrutiny' || a.stage === 'rescrutiny').length,
          EVC: open.filter((a) => a.stage === 'evc').length,
          Committees: open.filter((a) => a.stage === 'shc' || a.stage === 'ec' || a.stage === 'appeal').length,
        };
      }),
    [APPLICATIONS, OBLIGATIONS],
  );

  const exportRows = rows.map(({ short, Scrutiny, EVC, Committees, ...r }) => r);

  return (
    <>
      <PageHeader
        eyebrow="Module F · consolidated reports"
        title="Reports"
        description="Region-wise processing performance, pendency by stage and compliance status. Export any table or print it for meetings."
        actions={
          <>
            <button className="btn-secondary" onClick={() => window.print()}>
              <Printer size={16} /> Print
            </button>
            <button className="btn-primary" onClick={() => downloadCsv('region-performance.csv', exportRows)}>
              <Download size={16} /> Export CSV
            </button>
          </>
        }
      />
      <Card title="Reports from the server" subtitle="Generated from the live records at the moment you download them" className="mb-6">
        <div className="flex flex-wrap gap-2">
          {SERVER_REPORTS.map((r) => (
            <button key={r.name} className="btn-secondary btn-sm" onClick={() => fetchReport(r.name)} disabled={busy === r.name}>
              {busy === r.name ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} {r.label}
            </button>
          ))}
        </div>
      </Card>
      <Card title="Pending files by region and stage" className="mb-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="#EEF2F7" vertical={false} />
              <XAxis dataKey="short" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} cursor={{ fill: '#EEF4FB' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Scrutiny" stackId="a" fill="#7FA6DC" animationDuration={900} />
              <Bar dataKey="EVC" stackId="a" fill="#1D4F94" animationDuration={900} />
              <Bar dataKey="Committees" stackId="a" fill="#D9700C" radius={[6, 6, 0, 0]} animationDuration={900} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Region-wise performance" subtitle="Cycle 2027-28 to date" pad={false}>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Region</th>
                <th className="text-right">Received</th>
                <th className="text-right">Pending</th>
                <th className="text-right">Decided</th>
                <th className="text-right">Disposal rate</th>
                <th className="text-right">Missed deadlines</th>
                <th className="text-right">Average age</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.Region}>
                  <td className="whitespace-nowrap font-medium text-ink">{r.Region}</td>
                  <td className="text-right tabular-nums">{r.Received}</td>
                  <td className="text-right tabular-nums">{r.Pending}</td>
                  <td className="text-right tabular-nums">{r.Decided}</td>
                  <td className="text-right tabular-nums">{r['Disposal rate']}%</td>
                  <td className="text-right tabular-nums">{r['Missed deadlines']}</td>
                  <td className="text-right tabular-nums">{r['Average age (days)']} d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
