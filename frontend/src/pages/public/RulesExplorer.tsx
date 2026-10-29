import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Download, FileText, Fingerprint, Info, Search, ShieldCheck } from 'lucide-react';
import { STEP_LABEL, typeById } from '../../data/rules';
import { useApplicationTypes } from '../../lib/live-data';
import { Badge, Callout, Card, PageHeader, WhyChip } from '../../components/ui';
import { Tour } from '../../components/live';
import { RULES_TOUR } from '../../data/tours';
import { cn, formatDate, TODAY } from '../../lib/utils';
import { downloadCsv } from '../../lib/csv';
import type { StepKey } from '../../types';

function LeaseRunway() {
  const [land, setLand] = useState<'Owned' | 'Leased'>('Leased');
  const [leaseEnd, setLeaseEnd] = useState('2031-06-30');
  const [course, setCourse] = useState(4);
  const years = (new Date(leaseEnd).getTime() - new Date(TODAY).getTime()) / (365.25 * 86_400_000);
  const runway = years - course;
  const tone = land === 'Owned' ? 'green' : runway <= 0 ? 'red' : runway < 2 ? 'amber' : 'green';
  return (
    <Card title="Lease runway check" subtitle="APH 2.1(e): renewal stops from the year the live lease equals the longest course">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="land">
            Land
          </label>
          <select id="land" className="input" value={land} onChange={(e) => setLand(e.target.value as 'Owned' | 'Leased')}>
            <option>Owned</option>
            <option>Leased</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="lease-end">
            Lease ends on
          </label>
          <input id="lease-end" type="date" className="input" value={leaseEnd} disabled={land === 'Owned'} onChange={(e) => setLeaseEnd(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="course">
            Longest course (years)
          </label>
          <input id="course" type="number" min={1} max={6} className="input" value={course} onChange={(e) => setCourse(Number(e.target.value) || 1)} />
        </div>
      </div>
      <motion.div key={`${land}${leaseEnd}${course}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
        {land === 'Owned' ? (
          <Callout tone="green" title="No lease risk">
            Land owned by the trust has no lease runway limit.
          </Callout>
        ) : (
          <Callout tone={tone === 'red' ? 'red' : tone === 'amber' ? 'amber' : 'green'} title={`Live lease ${years.toFixed(1)} years · runway ${runway.toFixed(1)} years`}>
            {runway <= 0
              ? 'Renewal (EoA) would be blocked now. Register a lease extension of a further 30 years before applying.'
              : runway < 2
                ? `Renewal will be blocked in about ${runway.toFixed(1)} years. Start the lease extension now; ANUMATI will remind you every quarter.`
                : 'Comfortable. ANUMATI will remind you well before the runway gets short.'}
          </Callout>
        )}
      </motion.div>
    </Card>
  );
}

const PATH_ORDER: StepKey[] = ['selfDisclosure', 'scrutiny', 'evc', 'shc'];

export default function RulesExplorer() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const types = useApplicationTypes();
  const selected = types.find((t) => t.id === (params.get('type') ?? 'site')) ?? typeById(params.get('type') ?? 'site');
  const list = useMemo(() => types.filter((t) => t.name.toLowerCase().includes(q.toLowerCase())), [q, types]);

  const pathSteps = PATH_ORDER.filter((k) => selected.steps[k] !== 'none');

  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Public · no sign-in needed"
        title="Rules explorer"
        description="Choose what your institution wants to do. You will see which stages apply, the documents needed and the target time, each linked to its clause in the Approval Process Handbook 2024-27."
        tourId="rules"
        actions={
          <Badge tone="brand" icon={<Fingerprint size={12} />}>
            Rules v2026.3 · effective {formatDate('2026-08-25')}
          </Badge>
        }
      />
      <Tour id="rules" steps={RULES_TOUR} />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Type list */}
        <aside data-tour="type-selector" className="card h-fit lg:sticky lg:top-32">
          <div className="border-b border-slate-100 p-4">
            <label htmlFor="type-search" className="sr-only">
              Search request types
            </label>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input id="type-search" className="input pl-9" placeholder="Search 22 request types" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto p-2 scroll-thin" role="listbox" aria-label="Request types">
            {list.map((t) => (
              <li key={t.id}>
                <button
                  role="option"
                  aria-selected={t.id === selected.id}
                  onClick={() => setParams({ type: t.id })}
                  className={cn('flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors', t.id === selected.id ? 'bg-brand-700 text-white' : 'text-ink-soft hover:bg-slate-100')}
                >
                  <span className="flex-1 leading-snug">{t.name}</span>
                  <span className={cn('shrink-0 text-[11px]', t.id === selected.id ? 'text-brand-100' : 'text-ink-mute')}>{t.chapter.replace('Chapter ', 'Ch. ')}</span>
                </button>
              </li>
            ))}
            {!list.length && <li className="p-4 text-sm text-ink-mute">No request type matches “{q}”.</li>}
          </ul>
        </aside>

        {/* Detail */}
        <>
          <motion.div key={selected.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-6">
            <Card data-tour="path-display">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="eyebrow">{selected.chapter} · {selected.clause}</p>
                  <h2 className="mt-1.5 text-xl font-semibold">{selected.name}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-mute">{selected.summary}</p>
                </div>
                <div className="rounded-xl bg-brand-50 px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-brand-800">{selected.targetDays}</p>
                  <p className="text-xs text-brand-700">target days</p>
                </div>
              </div>

              <h3 className="mt-8 text-sm font-semibold">Your path</h3>
              <ol className="mt-3 flex flex-wrap items-center gap-2">
                {pathSteps.map((k, i) => (
                  <motion.li key={k} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="flex items-center gap-2">
                    <span className={cn('inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium', selected.steps[k] === 'required' ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-dashed border-slate-300 bg-white text-ink-mute')}>
                      {STEP_LABEL[k]}
                      {selected.steps[k] === 'conditional' && <span className="text-[11px] font-normal">(if needed)</span>}
                    </span>
                    <ArrowRight size={14} className="text-slate-400" />
                  </motion.li>
                ))}
                <motion.li initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: pathSteps.length * 0.1 }} className="flex items-center gap-2">
                  <span className="rounded-lg border border-indgreen-100 bg-indgreen-50 px-3 py-2 text-sm font-medium text-indgreen-700">Executive Committee decision</span>
                  <ArrowRight size={14} className="text-slate-400" />
                </motion.li>
                <motion.li initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (pathSteps.length + 1) * 0.1 }}>
                  <span className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-ink-mute">Appeal in 7 days (if needed)</span>
                </motion.li>
              </ol>
              <div className="mt-3 flex items-center gap-2 text-xs text-ink-mute">
                <WhyChip rule={`Table 2.3 row: ${selected.name}`} clause={`${selected.clause}; APH Table 2.3`} detail="Dashed steps apply only when earlier stages find deficiencies (the handbook's “as applicable”)." />
                Path generated from the machine-readable handbook, not typed by hand.
              </div>
            </Card>

            <Card
              data-tour="documents-list"
              title="Documents you will need"
              subtitle="Illustrative list; the binding list is APH Annexure-1 and Annexure-2. All uploads must be digitally signed (APH 1.4.6)."
              pad={false}
              action={
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => downloadCsv(`checklist-${selected.id}.csv`, selected.documents.map((d) => ({ Document: d.name, 'Signed by': d.signedBy, Validity: d.validity ?? '', Clause: d.clause })))}
                >
                  <Download size={14} /> Download checklist
                </button>
              }
            >
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Signed by</th>
                      <th>Validity rule</th>
                      <th>Clause</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.documents.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <span className="flex items-center gap-2 font-medium text-ink">
                            <FileText size={15} className="shrink-0 text-brand-500" /> {d.name}
                          </span>
                          {d.sourceVerifiable && (
                            <span className="ml-6 mt-1 inline-flex items-center gap-1 text-[11px] text-indgreen-700">
                              <ShieldCheck size={12} /> Can be verified at source (DigiLocker / API Setu)
                            </span>
                          )}
                        </td>
                        <td>{d.signedBy}</td>
                        <td>{d.validity ?? '—'}</td>
                        <td className="whitespace-nowrap text-brand-700">{d.clause}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <LeaseRunway />

            <div className="card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 shrink-0 text-indgreen-600" size={20} />
                <div>
                  <p className="font-semibold">Ready to apply?</p>
                  <p className="text-sm text-ink-mute">Your checklist and an AI self-check carry over, so you can fix problems before final submission.</p>
                </div>
              </div>
              <Link to={`/institution/apply?type=${selected.id}`} className="btn-primary shrink-0">
                Start this application <ArrowRight size={16} />
              </Link>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-ink-mute">
              <Info size={13} /> Developers and state bodies can read these rules through the open API (planned: GET /api/rules/{'{type}'}).
            </p>
          </motion.div>
        </>
      </div>
    </div>
  );
}
