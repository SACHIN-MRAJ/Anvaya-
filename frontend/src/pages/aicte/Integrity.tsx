import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Fingerprint, MailQuestion, ScanSearch, Users } from 'lucide-react';
import { FACULTY, findDuplicates } from '../../data/faculty';
import { useDuplicates } from '../../lib/live-data';
import { askToExplain } from '../../services/api';
import { INSTITUTIONS, institutionById } from '../../data/institutions';
import { Badge, Callout, Card, PageHeader, Stat, stagger, toast } from '../../components/ui';
import { cn, formatDate } from '../../lib/utils';

const SIZE = 420;
const C = SIZE / 2;
const RING = 165;

export default function Integrity() {
  // Cross-checked on the server over every institution's register (PAN kept only as a hash); the same check runs here offline.
  const { data: server } = useDuplicates();
  const clusters = useMemo(() => server?.clusters ?? findDuplicates(), [server]);
  const checked = server?.checked ?? FACULTY.length;
  const [active, setActive] = useState<string | null>(null);
  const [asked, setAsked] = useState<string[]>([]);
  const involved = new Set(clusters.flatMap((c) => c.records.map((r) => r.institutionId)));

  const node = (id: string) => {
    const i = INSTITUTIONS.findIndex((x) => x.id === id);
    const a = (i / INSTITUTIONS.length) * Math.PI * 2 - Math.PI / 2;
    return { x: C + RING * Math.cos(a), y: C + RING * Math.sin(a) };
  };
  const edges = clusters.flatMap((c) => {
    const ids = Array.from(new Set(c.records.map((r) => r.institutionId)));
    return ids.slice(1).map((to) => ({ key: `${c.panHash}-${to}`, panHash: c.panHash, from: ids[0], to }));
  });

  return (
    <>
      <PageHeader
        eyebrow="Data integrity"
        title="Faculty integrity check"
        description="A teacher cannot be full-time at two institutions in the same year. ANUMATI matches people across every institution using a salted hash of the PAN, so the number itself is never shown or stored with the record."
      />

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Faculty records checked" value={checked} hint="Cycle 2027-28 registers" icon={<ScanSearch size={20} />} />
        <Stat label="Same person, 2+ institutions" value={clusters.length} hint="Each needs an explanation" tone="red" icon={<Users size={20} />} />
        <Stat label="Institutions involved" value={involved.size} hint={`of ${INSTITUTIONS.length} in this view`} tone="amber" icon={<Fingerprint size={20} />} />
        <Stat label="Explanations requested" value={asked.length} hint="Replies tracked like any deficiency" tone="green" icon={<MailQuestion size={20} />} />
      </motion.div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[460px_1fr]">
        <Card title="Who shares faculty with whom" subtitle="Each line is one person listed full-time at both ends. Select a line or a row.">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[420px]" role="img" aria-label={`${edges.length} shared-faculty links between ${involved.size} institutions`}>
            <circle cx={C} cy={C} r={RING} fill="none" stroke="#E2E8F0" strokeDasharray="3 5" />
            {edges.map((e, i) => {
              const a = node(e.from);
              const b = node(e.to);
              const on = active === e.panHash;
              return (
                <motion.path
                  key={e.key}
                  d={`M${a.x} ${a.y} Q${C} ${C} ${b.x} ${b.y}`}
                  fill="none"
                  stroke={on ? '#C0352B' : '#F58A1F'}
                  strokeLinecap="round"
                  initial={{ opacity: 0.5, strokeWidth: 1 }}
                  animate={{ opacity: active && !on ? 0.25 : 1, strokeWidth: on ? 4 : 2.5 }}
                  transition={{ delay: active ? 0 : 0.15 + i * 0.08, duration: 0.3 }}
                  className="cursor-pointer"
                  onClick={() => setActive(on ? null : e.panHash)}
                />
              );
            })}
            {INSTITUTIONS.map((inst) => {
              const p = node(inst.id);
              const hit = involved.has(inst.id);
              return (
                <g key={inst.id}>
                  <circle cx={p.x} cy={p.y} r={hit ? 9 : 6} fill={hit ? '#0A1D42' : '#CBD5E1'} stroke="#fff" strokeWidth="2" />
                  <title>{inst.name}</title>
                </g>
              );
            })}
            <text x={C} y={C - 6} textAnchor="middle" fontSize="28" fontWeight="800" fill="#0A1D42">
              {clusters.length}
            </text>
            <text x={C} y={C + 14} textAnchor="middle" fontSize="11" fill="#5B6B82">
              people to explain
            </text>
          </svg>
          <p className="mt-2 flex items-center justify-center gap-4 text-[11px] text-ink-mute">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-900" /> involved
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> clear
            </span>
          </p>
        </Card>

        <Card title="People listed at more than one institution" subtitle="Sorted by number of institutions" pad={false}>
          <ul className="divide-y divide-slate-100">
            {[...clusters]
              .sort((a, b) => b.records.length - a.records.length)
              .map((c) => (
                <li key={c.panHash} onMouseEnter={() => setActive(c.panHash)} onMouseLeave={() => setActive(null)} className={cn('px-5 py-4 transition-colors', active === c.panHash && 'bg-red-50/60')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">
                        {c.name} <span className="ml-1 font-mono text-[11px] font-normal text-ink-mute">PAN hash {c.panHash.slice(0, 8)}…</span>
                      </p>
                      <ul className="mt-1.5 space-y-1 text-sm">
                        {c.records.map((r) => (
                          <li key={r.id} className="flex flex-wrap items-center gap-2 text-ink-soft">
                            <span className="h-1.5 w-1.5 rounded-full bg-saffron-500" />
                            {institutionById(r.institutionId)?.name.split(',')[0]}
                            <span className="text-xs text-ink-mute">
                              {r.designation} · joined {formatDate(r.joined)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.records.length > 2 && <Badge tone="red">{c.records.length} institutions</Badge>}
                      {asked.includes(c.panHash) ? (
                        <Badge tone="green" icon={<CheckCircle2 size={12} />}>
                          Asked
                        </Badge>
                      ) : (
                        <button
                          className="btn-secondary btn-sm"
                          onClick={async () => {
                            const done = await askToExplain(c.panHash).catch(() => null);
                            setAsked((x) => [...x, c.panHash]);
                            toast(`${done ? `${done.asked.length} institutions` : 'Both institutions'} asked to explain within 7 days. Recorded in the evidence log.`);
                          }}
                        >
                          <MailQuestion size={14} /> Ask to explain
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6">
        <Callout tone="brand" title="Why this check exists">
          Government replies in Parliament reported duplicate faculty records across thousands of institutes, from teachers moving without records being updated and from institutions listing the same person twice. A match here is a question, not a verdict: the officer asks both institutions and decides.
        </Callout>
      </div>
    </>
  );
}
