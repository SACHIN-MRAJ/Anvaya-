import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, CheckCircle2, Dices, Link2, Loader2, Lock, RotateCcw, UserX } from 'lucide-react';
import { APPLICATION_TYPES, STEP_LABEL } from '../data/rules';
import { sha256Hex, shortHash } from '../lib/hash';
import { cn, formatDate } from '../lib/utils';
import { fetchDrand, type DrandRound } from '../services/api';
import type { DemoKind } from '../data/novelties';
import type { StepKey } from '../types';

/** Small, self-contained demonstrations of the novelties on the "Our solution" page. Nothing here is saved. */
export function NoveltyDemo({ kind }: { kind: DemoKind }) {
  const Demo = { rules: RulesDemo, clock: ClockDemo, chain: ChainDemo, runway: RunwayDemo, draw: DrawDemo }[kind];
  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4 sm:p-5">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-brand-700">Try it</p>
      <Demo />
    </div>
  );
}

/* ---------------- 1. Rules as data ---------------- */

function RulesDemo() {
  const [id, setId] = useState('site');
  const t = APPLICATION_TYPES.find((x) => x.id === id) ?? APPLICATION_TYPES[0];
  const steps = (['selfDisclosure', 'scrutiny', 'evc', 'shc'] as StepKey[]).filter((k) => t.steps[k] !== 'none');
  return (
    <div>
      <label className="text-sm font-medium text-ink-soft" htmlFor="demo-type">
        Pick a request, and the rule table gives its exact path:
      </label>
      <select id="demo-type" value={id} onChange={(e) => setId(e.target.value)} className="input mt-1.5 max-w-md">
        {APPLICATION_TYPES.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
      <motion.ol key={id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {steps.map((k, i) => (
          <motion.li key={k} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex items-center gap-2">
            <span className={cn('rounded-xl px-3 py-1.5 font-semibold', t.steps[k] === 'required' ? 'bg-brand-700 text-white' : 'border-2 border-dashed border-brand-300 bg-white text-brand-700')}>
              {STEP_LABEL[k]}
              {t.steps[k] === 'conditional' && <span className="ml-1 text-[11px] font-medium">if needed</span>}
            </span>
            <ArrowRight size={14} className="text-ink-mute" />
          </motion.li>
        ))}
        <motion.li initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: steps.length * 0.08 }} className="rounded-xl bg-indgreen-600 px-3 py-1.5 font-semibold text-white">
          Executive Committee decision
        </motion.li>
      </motion.ol>
      <p className="mt-3 text-sm text-ink-soft">
        Target about <b>{t.targetDays} days</b> · <b>{t.documents.length} documents</b> · clause <b>{t.clause}</b>.{' '}
        <Link to={`/rules?type=${t.id}`} className="font-semibold text-brand-700 hover:underline">
          See the documents →
        </Link>
      </p>
    </div>
  );
}

/* ---------------- 2. Fair clock ---------------- */

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

function ClockDemo() {
  const [reply, setReply] = useState(8);
  const start = new Date('2026-10-01T00:00:00');
  const before = 6; // AICTE days used before raising the deficiency
  const target = 15;
  const total = target + reply;
  return (
    <div>
      <p className="text-sm text-ink-soft">
        Scrutiny starts on {formatDate(start)} with a {target}-day target. On day {before} the officer raises a deficiency. How long does the institution take to reply?
      </p>
      <label className="mt-3 flex items-center gap-3 text-sm font-medium text-ink" htmlFor="demo-reply">
        <span className="w-40 shrink-0">Institution’s reply: {reply} days</span>
        <input id="demo-reply" type="range" min={0} max={20} value={reply} onChange={(e) => setReply(+e.target.value)} className="w-full accent-brand-700" />
      </label>
      <div className="mt-4 flex h-9 overflow-hidden rounded-xl text-[11px] font-semibold text-white">
        <motion.span layout className="grid place-items-center bg-brand-600" style={{ width: `${(before / total) * 100}%` }}>
          AICTE {before}d
        </motion.span>
        {reply > 0 && (
          <motion.span layout className="grid place-items-center bg-slate-400" style={{ width: `${(reply / total) * 100}%`, backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 6px, rgba(255,255,255,.25) 6px 12px)' }}>
            paused {reply}d
          </motion.span>
        )}
        <motion.span layout className="grid place-items-center bg-brand-600" style={{ width: `${((target - before) / total) * 100}%` }}>
          AICTE {target - before}d
        </motion.span>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-ink-soft">
        <li>
          New due date: <b className="text-ink">{formatDate(addDays(start, total))}</b> (moved by exactly {reply} paused days).
        </li>
        <li>AICTE is measured on its own {target} days, never on the institution’s {reply}.</li>
        <li>If AICTE misses the date, the file escalates by itself: Regional officer, then Bureau head, then Member Secretary.</li>
      </ul>
    </div>
  );
}

/* ---------------- 6. Hash chain ---------------- */

const RECORDS = [
  'ANU-2026-0412 submitted by Narmada Valley Institute of Technology',
  'Scrutiny completed by the Dealing officer, Central region',
  'Expert panel drawn from a public drand round',
  'Executive Committee: Extension of Approval granted',
];

function ChainDemo() {
  const [texts, setTexts] = useState(RECORDS);
  const [stored, setStored] = useState<string[]>([]);
  const [now, setNow] = useState<string[]>([]);
  useEffect(() => {
    void (async () => {
      const out: string[] = [];
      let prev = '0'.repeat(64);
      for (const t of RECORDS) out.push((prev = await sha256Hex(prev + t)));
      setStored(out);
    })();
  }, []);
  useEffect(() => {
    if (!stored.length) return;
    void (async () => {
      const out: string[] = [];
      for (let i = 0; i < texts.length; i++) out.push(await sha256Hex((i ? stored[i - 1] : '0'.repeat(64)) + texts[i]));
      setNow(out);
    })();
  }, [texts, stored]);
  const firstBad = now.findIndex((h, i) => h !== stored[i]);
  return (
    <div>
      <p className="text-sm text-ink-soft">Each entry stores the fingerprint of the one before. Change any word below and see what happens.</p>
      <ol className="mt-3 space-y-2">
        {texts.map((t, i) => {
          const bad = firstBad !== -1 && i >= firstBad;
          return (
            <li key={i} className={cn('rounded-xl border p-2.5 transition-colors', bad ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white')}>
              <div className="flex items-center gap-2">
                <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold', bad ? 'bg-red-500 text-white' : 'bg-indgreen-500 text-white')}>{i + 1}</span>
                <input aria-label={`Record ${i + 1}`} value={t} onChange={(e) => setTexts(texts.map((x, k) => (k === i ? e.target.value : x)))} className="min-w-0 flex-1 rounded-md bg-transparent px-1 text-sm text-ink outline-none focus:bg-white focus:ring-2 focus:ring-brand-200" />
              </div>
              <p className="mt-1 flex items-center gap-1.5 pl-8 font-mono text-[11px] text-ink-mute">
                <Link2 size={11} /> {shortHash(now[i] ?? '', 12)} {bad ? <span className="font-sans font-semibold text-red-700">does not match the stored fingerprint</span> : <span className="font-sans text-indgreen-700">matches</span>}
              </p>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        {firstBad === -1 ? (
          <span className="flex items-center gap-1.5 font-semibold text-indgreen-700">
            <CheckCircle2 size={16} /> Chain intact: every record is exactly as written.
          </span>
        ) : (
          <span className="flex items-center gap-1.5 font-semibold text-red-700">
            <AlertTriangle size={16} /> Tampering detected at record {firstBad + 1}; every record after it is now suspect too.
          </span>
        )}
        {firstBad !== -1 && (
          <button className="btn-secondary btn-sm" onClick={() => setTexts(RECORDS)}>
            <RotateCcw size={13} /> Undo my change
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- 7. Lease runway ---------------- */

function RunwayDemo() {
  const [lease, setLease] = useState(4.7);
  const [course, setCourse] = useState(4);
  const runway = lease - course;
  const tone = runway < 0 ? 'red' : runway < 3 ? 'amber' : 'green';
  const by = new Date().getFullYear() + Math.max(0, Math.floor(runway));
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-ink" htmlFor="demo-lease">
          Years of land lease left: {lease.toFixed(1)}
          <input id="demo-lease" type="range" min={0} max={35} step={0.1} value={lease} onChange={(e) => setLease(+e.target.value)} className="mt-1 w-full accent-brand-700" />
        </label>
        <label className="text-sm font-medium text-ink" htmlFor="demo-course">
          Longest course: {course} years
          <input id="demo-course" type="range" min={1} max={5} value={course} onChange={(e) => setCourse(+e.target.value)} className="mt-1 w-full accent-brand-700" />
        </label>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
        <motion.div className={cn('h-full rounded-full', { red: 'bg-red-500', amber: 'bg-amber-500', green: 'bg-indgreen-500' }[tone])} animate={{ width: `${Math.min(100, Math.max(3, ((runway + 5) / 35) * 100))}%` }} />
      </div>
      <p className={cn('mt-2 text-sm font-semibold', { red: 'text-red-700', amber: 'text-amber-700', green: 'text-indgreen-700' }[tone])}>
        {tone === 'red'
          ? `Runway ${runway.toFixed(1)} years: the lease is shorter than the course, so Extension of Approval is blocked.`
          : tone === 'amber'
            ? `Runway ${runway.toFixed(1)} years: register a 30-year extension before ${by}, or renewal will be blocked.`
            : `Runway ${runway.toFixed(1)} years: safe. The radar will warn well before it gets short.`}
      </p>
    </div>
  );
}

/* ---------------- 9. Fair draw ---------------- */

const EXPERTS = [
  { id: 'E1', name: 'Dr A. Rao', note: '' },
  { id: 'E2', name: 'Prof S. Iyer', note: '' },
  { id: 'E3', name: 'Dr M. Khan', note: 'Linked to this institution' },
  { id: 'E4', name: 'Prof R. Das', note: '' },
  { id: 'E5', name: 'Dr P. Nair', note: 'Not available in the visit window' },
  { id: 'E6', name: 'Prof K. Singh', note: '' },
  { id: 'E7', name: 'Dr L. Menon', note: '' },
];

function DrawDemo() {
  const shortlist = useMemo(() => EXPERTS.filter((e) => !e.note), []);
  const [phase, setPhase] = useState<'idle' | 'committing' | 'waiting' | 'done'>('idle');
  const [commit, setCommit] = useState<{ round: number; hash: string } | null>(null);
  const [beacon, setBeacon] = useState<DrandRound | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const start = async () => {
    setPhase('committing');
    setPicked([]);
    setBeacon(null);
    const now = await fetchDrand();
    const round = now.round + 1; // a round that does not exist yet: nobody knows its number
    setCommit({ round, hash: await sha256Hex(`${shortlist.map((e) => e.id).join(',')}|${round}`) });
    setPhase('waiting');
    let b = now;
    for (let i = 0; i < 14 && b.round < round && b.source === 'live drand network'; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      b = await fetchDrand();
    }
    const used = { ...b, round: Math.max(b.round, round) };
    const pool = [...shortlist];
    const chosen: string[] = [];
    for (let i = 0; i < 3; i++) {
      const idx = parseInt((await sha256Hex(`${used.randomness}|${i}`)).slice(0, 8), 16) % pool.length;
      chosen.push(pool.splice(idx, 1)[0].id);
    }
    setBeacon(used);
    setPicked(chosen);
    setPhase('done');
  };

  return (
    <div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {EXPERTS.map((e) => (
          <li key={e.id} className={cn('rounded-xl border px-3 py-2 text-sm transition-all', e.note ? 'border-dashed border-slate-300 bg-slate-50 text-ink-mute line-through decoration-slate-400' : picked.includes(e.id) ? 'border-indgreen-400 bg-indgreen-50 font-semibold text-indgreen-800 shadow-card' : 'border-slate-200 bg-white text-ink')}>
            <span className="flex items-center gap-1.5">
              {e.note ? <UserX size={13} /> : picked.includes(e.id) ? <CheckCircle2 size={13} /> : null} {e.name}
            </span>
            {e.note && <span className="block text-[11px] no-underline">{e.note}</span>}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn-primary btn-sm" onClick={() => void start()} disabled={phase === 'committing' || phase === 'waiting'}>
          {phase === 'committing' || phase === 'waiting' ? <Loader2 size={14} className="animate-spin" /> : <Dices size={14} />} {phase === 'done' ? 'Draw again' : 'Commit, then draw'}
        </button>
        {commit && (
          <span className="flex items-center gap-1.5 text-xs text-ink-soft">
            <Lock size={12} /> Committed to drand round <b>{commit.round}</b> before it existed · fingerprint <span className="font-mono">{shortHash(commit.hash, 10)}</span>
          </span>
        )}
      </div>
      {phase === 'waiting' && <p className="mt-2 text-xs text-ink-mute">Waiting for that round to be published by the League of Entropy (a new one arrives every 30 seconds)…</p>}
      {phase === 'done' && beacon && (
        <p className="mt-2 text-xs text-ink-soft">
          Round {beacon.round} random value <span className="font-mono">{shortHash(beacon.randomness, 12)}</span> ({beacon.source}) picked the green experts. Anyone with the same round gets the same panel.
        </p>
      )}
    </div>
  );
}
