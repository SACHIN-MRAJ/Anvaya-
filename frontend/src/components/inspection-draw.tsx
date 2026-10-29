import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Dices, Loader2, ShieldCheck } from 'lucide-react';
import { ApiError, drawInspections, fetchDrand, type DrandRound } from '../services/api';
import { useInspectionWeights } from '../lib/live-data';
import { sha256Hex, shortHash } from '../lib/hash';
import { INSTITUTIONS } from '../data/institutions';
import { OBLIGATIONS } from '../data/misc';
import { Badge, Card, WhyChip, toast } from './ui';
import { cn, TODAY } from '../lib/utils';

interface Scored {
  id: string;
  name: string;
  weight: number;
  reasons: string[];
}

/** Risk weight per institution: more weight for overdue promises, short lease runway or an open review. */
function score(): Scored[] {
  return INSTITUTIONS.map((i) => {
    const obl = OBLIGATIONS.filter((o) => o.institutionId === i.id);
    const overdue = obl.filter((o) => o.status === 'Overdue' || o.status === 'Escalated').length;
    const soon = obl.filter((o) => o.status === 'Due soon').length;
    const runway = i.leaseEnd ? (new Date(i.leaseEnd).getTime() - new Date(TODAY).getTime()) / (365.25 * 86_400_000) - i.longestCourseYears : 99;
    const signals: [boolean, number, string][] = [
      [overdue > 0, 3 * overdue, `${overdue} overdue`],
      [soon > 0, 1.5 * soon, `${soon} due soon`],
      [runway < 3, 2, 'short lease'],
      [i.status !== 'Approved', 1, i.status.toLowerCase()],
    ];
    const hits = signals.filter(([on]) => on);
    return { id: i.id, name: i.name.split(',')[0], weight: 1 + hits.reduce((s, [, add]) => s + add, 0), reasons: hits.map(([, , why]) => why) };
  }).sort((a, b) => b.weight - a.weight);
}

/** Uniform number in [0, 1) from a hex hash; anyone can recompute it from the published round. */
const unit = (hex: string) => parseInt(hex.slice(0, 13), 16) / 16 ** 13;

/**
 * Weighted random sample without replacement (Efraimidis–Spirakis): each institution's key is u^(1/w),
 * highest keys win. A share of picks ignores risk entirely, so the model is checked against reality.
 */
async function draw(list: Scored[], randomness: string, k: number, pureRandom: number) {
  const keyed = await Promise.all(list.map(async (s) => ({ s, u: unit(await sha256Hex(`${randomness}|${s.id}`)) })));
  const byRisk = [...keyed].sort((a, b) => b.u ** (1 / b.s.weight) - a.u ** (1 / a.s.weight)).slice(0, k - pureRandom);
  const taken = new Set(byRisk.map((x) => x.s.id));
  const random = keyed.filter((x) => !taken.has(x.s.id)).sort((a, b) => a.u - b.u).slice(0, pureRandom);
  return [...byRisk.map((x) => ({ id: x.s.id, why: 'risk-weighted' as const })), ...random.map((x) => ({ id: x.s.id, why: 'pure random' as const }))];
}

export function InspectionDraw() {
  const { data: serverWeights } = useInspectionWeights();
  // The server's weights (from live obligations and records) when connected; the same formula on built-in data.
  const list = useMemo(() => serverWeights ?? score(), [serverWeights]);
  const total = list.reduce((s, x) => s + x.weight, 0);
  const [k, setK] = useState(5);
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState<DrandRound | null>(null);
  const [picked, setPicked] = useState<{ id: string; why: 'risk-weighted' | 'pure random' }[]>([]);
  const pure = Math.max(1, Math.round(k * 0.2));

  const run = async () => {
    setBusy(true);
    setPicked([]);
    try {
      // On the server the draw is recorded in the evidence log and can be re-checked later from the round and weights.
      const result = await drawInspections(k);
      if (result) {
        setRound({ round: result.round, randomness: result.randomness, source: result.source.includes('simulat') ? 'simulated (offline)' : 'live drand network' });
        setPicked(result.chosen);
        return;
      }
      const r = await fetchDrand();
      setRound(r);
      setPicked(await draw(list, r.randomness, k, pure));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'The draw could not run. Please try again.', 'red');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Risk-weighted surprise inspections"
      subtitle="Higher risk means a higher chance of being picked, never certainty. Some picks are purely random to keep the model honest."
      action={<WhyChip rule="OECD best practice: risk-proportionate inspections" clause="APH 2.3.5" detail="Weights come from overdue promises, lease runway and review status. The draw uses a public drand round, so it cannot be steered." />}
    >
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="insp-k" className="text-sm font-medium text-ink-soft">
          Inspections this month
        </label>
        <input id="insp-k" type="range" min={3} max={8} value={k} onChange={(e) => setK(Number(e.target.value))} className="w-28 accent-brand-700" />
        <span className="font-display text-lg font-bold tabular-nums">{k}</span>
        <span className="text-xs text-ink-mute">({k - pure} by risk + {pure} purely random)</span>
        <button className="btn-primary btn-sm ml-auto" onClick={run} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Dices size={14} />} Draw now
        </button>
      </div>

      <ul className="mt-4 space-y-1.5">
        {list.slice(0, 10).map((s) => {
          const hit = picked.find((p) => p.id === s.id);
          return (
            <li key={s.id} className={cn('relative overflow-hidden rounded-lg px-3 py-2 text-sm transition-colors', hit ? 'bg-saffron-50 ring-1 ring-saffron-200' : 'bg-slate-50')}>
              <motion.span className={cn('absolute inset-y-0 left-0', hit ? 'bg-saffron-200/50' : 'bg-brand-100/60')} initial={{ width: 0 }} animate={{ width: `${(s.weight / list[0].weight) * 100}%` }} transition={{ duration: 0.6 }} aria-hidden />
              <span className="relative flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-medium text-ink">{s.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-ink-mute">
                  {s.reasons.slice(0, 2).join(' · ') || 'no signals'}
                  <span className="tabular-nums">{((s.weight / total) * 100).toFixed(1)}%</span>
                  {hit && (
                    <motion.span initial={{ scale: 0.7, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }}>
                      <Badge tone={hit.why === 'pure random' ? 'brand' : 'saffron'}>{hit.why}</Badge>
                    </motion.span>
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {picked.some((p) => !list.slice(0, 10).some((s) => s.id === p.id)) && (
        <p className="mt-2 text-xs text-ink-mute">
          Also picked: {picked.filter((p) => !list.slice(0, 10).some((s) => s.id === p.id)).map((p) => list.find((s) => s.id === p.id)?.name).join(', ')}
        </p>
      )}
      {round && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex items-start gap-2 rounded-lg bg-indgreen-50 px-3 py-2 text-xs text-indgreen-700">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" /> Drawn with drand round #{round.round} ({round.source}), randomness {shortHash(round.randomness, 10)}. Anyone can repeat the draw from these numbers and the published weights.
        </motion.p>
      )}
    </Card>
  );
}
