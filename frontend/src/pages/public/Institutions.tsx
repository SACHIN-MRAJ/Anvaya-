import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertOctagon, Building2, Code2, Download, Flag, MapPin, Search, SearchX, ShieldCheck } from 'lucide-react';
import { getInstitutions, reportSuspicious } from '../../services/api';
import { useAsync } from '../../lib/useAsync';
import { nameSimilarity, REGIONS, regionName, UNAPPROVED } from '../../data/institutions';
import { Badge, Card, EmptyState, LoadingRows, Modal, PageHeader, toast } from '../../components/ui';
import { downloadCsv } from '../../lib/csv';
import { formatNumber } from '../../lib/utils';
import type { Institution } from '../../types';

const statusTone = (s: Institution['status']) => (s === 'Approved' ? 'green' : s === 'Under review' ? 'amber' : 'red');

/** Protects students from fake colleges: flags unapproved names and lookalikes of approved ones. */
function SafetyCheck({ q, all, matches, onPick }: { q: string; all: Institution[]; matches: number; onPick: (name: string) => void }) {
  if (q.trim().length < 4) return null;
  const flagged = UNAPPROVED.map((u) => ({ ...u, score: nameSimilarity(q, u.name) })).sort((a, b) => b.score - a.score)[0];
  const bestApproved = Math.max(0, ...all.map((i) => nameSimilarity(q, i.name)));
  // Warn only when the search is closer to an unapproved name than to any approved one.
  const isFlagged = !!flagged && flagged.score >= 0.75 && flagged.score > bestApproved + 0.03;
  const lookalikes = all
    .map((i) => ({ i, score: nameSimilarity(q, i.name) }))
    .filter((x) => x.score >= 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  if (isFlagged) {
    const real = all.map((i) => ({ i, score: nameSimilarity(flagged.name, i.name) })).sort((a, b) => b.score - a.score)[0];
    return (
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-4 overflow-hidden rounded-2xl border border-red-200 bg-red-50">
        <div className="flex gap-3 px-5 py-4">
          <AlertOctagon size={22} className="mt-0.5 shrink-0 text-red-600" />
          <div className="text-sm">
            <p className="font-display text-base font-bold text-red-800">Not approved by AICTE: {flagged.name}</p>
            <p className="mt-1 text-red-900">
              It appears on the {flagged.notice} of unapproved institutions. Degrees from unapproved institutions may not be recognised. Do not pay any fee or take admission.
            </p>
            {real && real.score > 0.5 && (
              <p className="mt-2 text-red-900">
                Its name is close to the approved <b>{real.i.name}</b> (AICTE ID {real.i.aicteId}). Always match the AICTE ID, not just the name.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {real && real.score > 0.5 && (
                <button className="btn-secondary btn-sm" onClick={() => onPick(real.i.name)}>
                  <ShieldCheck size={14} /> Show the approved institution
                </button>
              )}
              <button
                className="btn-ghost btn-sm"
                onClick={async () => {
                  const r = await reportSuspicious(flagged.name).catch(() => null);
                  toast(r ? r.message : 'Thank you. Your report will reach the regional office once you are back online.', 'brand');
                }}
              >
                <Flag size={14} /> Report this institution
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
  if (matches > 0) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm">
      <p className="flex items-center gap-2 font-display text-base font-bold text-amber-900">
        <SearchX size={18} /> “{q}” is not on the approved list
      </p>
      <p className="mt-1 text-amber-900">Fake colleges often use names close to real ones. Check the spelling and the AICTE ID before you pay any fee.</p>
      {lookalikes.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-amber-900">Did you mean</span>
          {lookalikes.map(({ i }) => (
            <button key={i.id} onClick={() => onPick(i.name)} className="chip hover:border-brand-300 hover:text-brand-700">
              {i.name}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function Institutions() {
  const { data, loading } = useAsync(getInstitutions);
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [region, setRegion] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Institution | null>(null);
  const [apiOpen, setApiOpen] = useState(false);

  const categories = useMemo(() => Array.from(new Set((data ?? []).map((i) => i.category))), [data]);
  const rows = useMemo(
    () =>
      (data ?? []).filter(
        (i) =>
          (!q || `${i.name} ${i.city} ${i.aicteId}`.toLowerCase().includes(q.toLowerCase())) &&
          (!region || i.region === region) &&
          (!category || i.category === category),
      ),
    [data, q, region, category],
  );

  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Public · for students and parents"
        title="Approved institutions"
        description="Check an institution's approval status, courses and intake before you take admission. Institutions under closure or review are clearly marked."
        actions={
          <>
            <button className="btn-secondary" onClick={() => setApiOpen(true)}>
              <Code2 size={16} /> Approved-list API
            </button>
            <button className="btn-secondary" onClick={() => downloadCsv('approved-institutions.csv', rows.map((r) => ({ 'AICTE ID': r.aicteId, Name: r.name, State: r.state, Category: r.category, Intake: r.intake, Status: r.status })))}>
              <Download size={16} /> Download
            </button>
          </>
        }
      />

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_200px_240px]">
        <div className="relative">
          <label htmlFor="inst-q" className="sr-only">
            Search by name, city or AICTE ID
          </label>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input id="inst-q" className="input pl-9" placeholder="Search by name, city or AICTE ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select aria-label="Filter by region" className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">All regions</option>
          {REGIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.office})
            </option>
          ))}
        </select>
        <select aria-label="Filter by category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      <SafetyCheck q={q} all={data ?? []} matches={rows.length} onPick={setQ} />

      <Card pad={false}>
        {loading ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Building2 size={22} />} title="No institutions match" text="Try a different name or clear the filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <caption className="sr-only">Approved institutions</caption>
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>AICTE ID</th>
                  <th>Category</th>
                  <th className="text-right">Intake</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i, idx) => (
                  <motion.tr key={i.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(idx * 0.02, 0.3) }}>
                    <td>
                      <button onClick={() => setSelected(i)} className="text-left">
                        <span className="block font-medium text-ink hover:text-brand-700 hover:underline">{i.name}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-mute">
                          <MapPin size={12} /> {i.state} · {regionName(i.region)}
                        </span>
                      </button>
                    </td>
                    <td className="font-mono text-xs">{i.aicteId}</td>
                    <td>{i.category}</td>
                    <td className="text-right tabular-nums">{formatNumber(i.intake)}</td>
                    <td>
                      <Badge tone={statusTone(i.status)}>{i.status}</Badge>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-ink-mute">Showing {rows.length} institutions.</p>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ''}>
        {selected && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-ink-mute">AICTE ID</dt>
              <dd className="mt-0.5 font-mono font-medium">{selected.aicteId}</dd>
            </div>
            <div>
              <dt className="text-ink-mute">Status</dt>
              <dd className="mt-0.5">
                <Badge tone={statusTone(selected.status)}>{selected.status}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-ink-mute">Established</dt>
              <dd className="mt-0.5 font-medium">{selected.established}</dd>
            </div>
            <div>
              <dt className="text-ink-mute">Approved intake</dt>
              <dd className="mt-0.5 font-medium">{formatNumber(selected.intake)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-ink-mute">Programmes</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {selected.programmes.map((p) => (
                  <Badge key={p} tone="brand">
                    {p}
                  </Badge>
                ))}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-ink-mute">Regional office</dt>
              <dd className="mt-0.5 font-medium">{regionName(selected.region)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-ink-mute">Promoted by</dt>
              <dd className="mt-0.5 font-medium">{selected.trust}</dd>
            </div>
          </dl>
        )}
      </Modal>

      <Modal open={apiOpen} onClose={() => setApiOpen(false)} title="Approved-list API for counselling bodies" wide>
        <p className="text-sm leading-relaxed text-ink-soft">
          State counselling authorities and affiliating universities get the approved list the moment a decision is final, instead of waiting for a letter. This removes the delay that led the Supreme Court to rebuke the approval schedule in 2016.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-brand-900 p-4 text-xs leading-relaxed text-brand-50">
{`GET /api/public/approved?state=Madhya%20Pradesh&cycle=2027-28
Authorization: Bearer <state-counselling-token>

200 OK
{
  "cycle": "2027-28",
  "rulesVersion": "2026.3",
  "generatedAt": "2026-10-22T10:00:00+05:30",
  "institutions": [
    { "aicteId": "${data?.[0]?.aicteId ?? '1-00000000'}", "name": "${data?.[0]?.name ?? ''}",
      "courses": [{ "name": "B.Tech CSE", "intake": 180, "status": "EoA" }],
      "letterFingerprint": "sha256:…" }
  ]
}`}
        </pre>
      </Modal>
    </div>
  );
}
