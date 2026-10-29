import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAsync } from '../../lib/useAsync';
import { getVerificationList } from '../../services/records';
import { regionName } from '../../data/institutions';
import { Badge, Card, PageHeader, Stat } from '../../components/ui';
import { Tour } from '../../components/live';
import { VERIFICATION_TOUR } from '../../data/tours';
import { Pending } from '../../components/records-ui';
import { formatDate } from '../../lib/utils';

export default function Verification() {
  const { data, loading } = useAsync(getVerificationList);
  const [query, setQuery] = useState('');
  const rows = useMemo(() => (data ?? []).filter((r) => !query || `${r.name} ${r.city} ${r.id}`.toLowerCase().includes(query.toLowerCase())), [data, query]);

  if (!data) return <Pending loading={loading} what="Institutional verification" />;
  const totals = data.reduce((t, r) => ({ pending: t.pending + r.pendingCertificates + r.pendingFaculty, flagged: t.flagged + r.discrepancies, expired: t.expired + r.expiredCertificates }), { pending: 0, flagged: 0, expired: 0 });

  return (
    <>
      <PageHeader
        eyebrow="Processing"
        title="Institutional verification"
        description="Check each institution's own record once: campuses and land, certificates, rooms against the norms, courses, faculty and signatories. A record the institution changes goes back to awaiting check, so nothing verified can change quietly."
        tourId="verification"
      />
      <Tour id="verification" steps={VERIFICATION_TOUR} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Records awaiting a check" value={totals.pending} icon={<ShieldCheck size={18} />} tone="brand" hint="Certificates and faculty" />
        <Stat label="Discrepancies on record" value={totals.flagged} icon={<ShieldAlert size={18} />} tone={totals.flagged ? 'red' : 'green'} />
        <Stat label="Expired certificates" value={totals.expired} icon={<ShieldAlert size={18} />} tone={totals.expired ? 'red' : 'green'} />
      </div>
      <div data-tour="verify-list"><Card className="mt-6" pad={false}>
        <div className="border-b border-slate-100 px-6 py-4">
          <label className="relative block max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
            <input className="input pl-9" placeholder="Search institution or city" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search institutions" />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Institution</th>
                <th>Region</th>
                <th className="text-right">Certificates to check</th>
                <th className="text-right">Faculty to check</th>
                <th>Flags</th>
                <th>Last checked</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="font-medium">{r.name}</span>
                    <span className="block text-xs text-ink-mute">
                      {r.id} · {r.city}
                    </span>
                  </td>
                  <td className="text-sm">{regionName(r.region)}</td>
                  <td className="text-right tabular-nums">{r.pendingCertificates}</td>
                  <td className="text-right tabular-nums">{r.pendingFaculty}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {r.discrepancies > 0 && <Badge tone="red">{r.discrepancies} discrepancy</Badge>}
                      {r.expiredCertificates > 0 && <Badge tone="red">{r.expiredCertificates} expired</Badge>}
                      {!r.discrepancies && !r.expiredCertificates && <span className="text-xs text-ink-mute">None</span>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-sm">{r.lastChecked ? formatDate(r.lastChecked) : <span className="text-ink-mute">Never</span>}</td>
                  <td>
                    <Link to={`/aicte/verification/${r.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                      Open <ArrowRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card></div>
    </>
  );
}
