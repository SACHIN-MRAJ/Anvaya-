import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BookOpen, Building2, ChevronDown, CircleDashed, CircleDot, Landmark, Lightbulb, Route, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { Badge, PageHeader, Reveal } from '../../components/ui';
import { NoveltyDemo } from '../../components/novelty-demos';
import { JOURNEY, NOVELTIES, PROBLEMS, STATUS_LABEL, noveltyByN, type Novelty, type NoveltyArea, type NoveltyStatus } from '../../data/novelties';
import { useSession } from '../../lib/session';
import { cn } from '../../lib/utils';

const STATUS_TONE: Record<NoveltyStatus, 'green' | 'amber' | 'slate'> = { live: 'green', simpler: 'amber', designed: 'slate' };
const STATUS_ICON = { live: ShieldCheck, simpler: CircleDot, designed: CircleDashed };
const AREAS: ('All' | NoveltyArea)[] = ['All', 'Workflow', 'Compliance', 'Fairness', 'Trust', 'Insight', 'Reach'];

/** A link into a portal screen; people who are not signed in to that portal go through sign-in first. */
export function useLiveLink() {
  const { session } = useSession();
  return (to: string) => {
    const portal = to.startsWith('/aicte') ? 'aicte' : to.startsWith('/institution') ? 'institution' : null;
    return portal && session?.portal !== portal ? `/login?portal=${portal}&next=${encodeURIComponent(to)}` : to;
  };
}

function Num({ n, className }: { n: number; className?: string }) {
  return <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-saffron-400 to-saffron-600 font-display text-sm font-extrabold text-brand-950 shadow-glow', className)}>{n}</span>;
}

function StatusBadge({ s }: { s: NoveltyStatus }) {
  const Icon = STATUS_ICON[s];
  return (
    <Badge tone={STATUS_TONE[s]} icon={<Icon size={12} aria-hidden />}>
      {STATUS_LABEL[s]}
    </Badge>
  );
}

function NoveltyCard({ x, open, onToggle }: { x: Novelty; open: boolean; onToggle: () => void }) {
  const live = useLiveLink();
  return (
    <motion.article layout id={`n-${x.n}`} className={cn('scroll-mt-28 overflow-hidden rounded-3xl border bg-white transition-shadow', open ? 'border-brand-200 shadow-lift' : 'border-slate-200 shadow-card hover:border-brand-200')}>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-4 p-5 text-left">
        <Num n={x.n} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-bold text-ink">{x.title}</span>
            <StatusBadge s={x.status} />
            <Badge tone="brand">{x.area}</Badge>
          </span>
          <span className="mt-1 block text-sm text-ink-soft">{x.short}</span>
        </span>
        <ChevronDown size={20} className={cn('mt-1 shrink-0 text-ink-mute transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            <div className="grid gap-5 border-t border-slate-100 px-5 pb-6 pt-5 lg:grid-cols-[1.25fr_1fr]">
              <div className="space-y-4">
                <section>
                  <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-700">
                    <Target size={13} /> The problem
                  </h4>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{x.problem}</p>
                </section>
                <section>
                  <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indgreen-700">
                    <Lightbulb size={13} /> Our answer
                  </h4>
                  <p className="mt-1 text-sm leading-relaxed text-ink">{x.solution}</p>
                </section>
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-700">How it works</h4>
                  <ol className="mt-2 space-y-2">
                    {x.how.map((s, i) => (
                      <li key={s} className="flex gap-3 text-sm text-ink-soft">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
                        <span className="pt-0.5">{s}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
              <aside className="space-y-3">
                <div className="rounded-2xl bg-saffron-50/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-saffron-800">What is new</p>
                  <p className="mt-1 text-sm text-ink">{x.isNew}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-mute">
                    <BookOpen size={12} /> Where the idea comes from
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">{x.source}</p>
                </div>
                <div className={cn('rounded-2xl p-4', { live: 'bg-indgreen-50', simpler: 'bg-amber-50', designed: 'bg-slate-50' }[x.status])}>
                  <StatusBadge s={x.status} />
                  {x.statusNote && <p className="mt-1.5 text-sm text-ink-soft">{x.statusNote}</p>}
                </div>
                <Link to={live(x.see.to)} className="btn-primary w-full justify-center">
                  {x.see.label} <ArrowRight size={15} />
                </Link>
              </aside>
              {x.demo && (
                <div className="lg:col-span-2">
                  <NoveltyDemo kind={x.demo} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export default function Solution() {
  const loc = useLocation();
  const live = useLiveLink();
  const [area, setArea] = useState<(typeof AREAS)[number]>('All');
  const [open, setOpen] = useState<Set<number>>(() => new Set([1]));
  const shown = NOVELTIES.filter((x) => area === 'All' || x.area === area);
  const count = (s: NoveltyStatus) => NOVELTIES.filter((x) => x.status === s).length;

  const pendingScroll = useRef<number | null>(null);

  const jump = (n: number) => {
    setArea('All');
    setOpen((o) => new Set(o).add(n));
    pendingScroll.current = n;
  };

  // After state update + DOM repaint, scroll to the target element
  useEffect(() => {
    if (pendingScroll.current == null) return;
    const n = pendingScroll.current;
    pendingScroll.current = null;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(`n-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  });

  // /solution#n-7 opens and scrolls to novelty 7 (used by the strip on every screen).
  useEffect(() => {
    const m = /^#n-(\d+)$/.exec(loc.hash);
    if (m) jump(Number(m[1]));
  }, [loc.hash]);

  return (
    <div className="container-page py-12">
      <PageHeader
        eyebrow="Our solution"
        title="How ANUMATI solves AICTE approvals"
        description="Nineteen novelties, each explained: the problem it fixes, how it works, what is new compared with today, where the idea comes from, and an honest status. Open any one to try it, or go straight to the screen where it runs."
      />

      {/* ---------------- Honest status ---------------- */}
      <Reveal>
        <div className="grid gap-3 sm:grid-cols-3">
          {(['live', 'simpler', 'designed'] as NoveltyStatus[]).map((s) => {
            const Icon = STATUS_ICON[s];
            return (
              <div key={s} className={cn('flex items-center gap-4 rounded-2xl border p-4', { live: 'border-indgreen-200 bg-indgreen-50/60', simpler: 'border-amber-200 bg-amber-50/60', designed: 'border-slate-200 bg-slate-50' }[s])}>
                <Icon size={26} className={{ live: 'text-indgreen-600', simpler: 'text-amber-600', designed: 'text-slate-500' }[s]} />
                <div>
                  <p className="font-display text-2xl font-extrabold text-ink">{count(s)}</p>
                  <p className="text-sm text-ink-soft">{STATUS_LABEL[s]}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Reveal>

      {/* ---------------- The problem ---------------- */}
      <section className="mt-14">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-saffron-700">The problem we were given</p>
          <h2 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">Approvals, compliance and alerts, done by hand</h2>
          <p className="mt-2 max-w-3xl text-ink-soft">AICTE approves thousands of technical institutions every year, then has to make sure every condition is met. These are the six problems ANUMATI was built to solve, and the novelties that solve each one.</p>
        </Reveal>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.05}>
              <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
                <p className="font-display text-base font-bold text-ink">{p.title}</p>
                <p className="mt-1 text-sm text-ink-mute">{p.text}</p>
                <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-indgreen-700">Solved by</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {p.solvedBy.map((n) => (
                    <button key={n} onClick={() => jump(n)} className="chip hover:border-brand-300 hover:text-brand-700">
                      <b>#{n}</b> {noveltyByN(n).title}
                    </button>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------- One file's journey ---------------- */}
      <section className="mt-16">
        <Reveal>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-saffron-700">
            <Route size={14} /> Follow one file
          </p>
          <h2 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">From the first click to years after approval</h2>
        </Reveal>
        <ol className="relative mt-6 space-y-3 border-l-2 border-dashed border-brand-200 pl-6 sm:ml-3">
          {JOURNEY.map((j, i) => (
            <Reveal key={j.step} delay={i * 0.04}>
              <li className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                <span className="absolute -left-[2.15rem] top-4 grid h-7 w-7 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white ring-4 ring-white">{i + 1}</span>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{j.step}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">{j.text}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {j.novelties.map((n) => (
                        <button key={n} onClick={() => jump(n)} className="chip hover:border-brand-300 hover:text-brand-700">
                          <Sparkles size={11} className="text-saffron-500" /> #{n} {noveltyByN(n).title}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Link to={live(j.to)} className="btn-secondary btn-sm shrink-0">
                    See it <ArrowRight size={13} />
                  </Link>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ---------------- The 19 novelties ---------------- */}
      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-saffron-700">The 19 novelties</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">Each one explained, and most of them to try</h2>
          </Reveal>
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm" onClick={() => setOpen(new Set(shown.map((x) => x.n)))}>
              Open all
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setOpen(new Set())}>
              Close all
            </button>
          </div>
        </div>
        <div role="tablist" aria-label="Filter by area" className="mt-5 flex flex-wrap gap-2">
          {AREAS.map((a) => (
            <button key={a} role="tab" aria-selected={area === a} onClick={() => setArea(a)} className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors', area === a ? 'bg-brand-700 text-white' : 'bg-slate-100 text-ink-soft hover:bg-slate-200')}>
              {a}
              <span className="ml-1.5 opacity-70">{a === 'All' ? NOVELTIES.length : NOVELTIES.filter((x) => x.area === a).length}</span>
            </button>
          ))}
        </div>
        <motion.div layout className="mt-6 space-y-3">
          {shown.map((x) => (
            <NoveltyCard key={x.n} x={x} open={open.has(x.n)} onToggle={() => setOpen((o) => (o.has(x.n) ? new Set([...o].filter((k) => k !== x.n)) : new Set(o).add(x.n)))} />
          ))}
        </motion.div>
      </section>

      {/* ---------------- Try it ---------------- */}
      <Reveal className="mt-16">
        <div className="bg-navy-mesh flex flex-col items-start gap-5 overflow-hidden rounded-3xl p-8 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-display text-2xl font-extrabold">See them working together</p>
            <p className="mt-1 max-w-xl text-brand-200">Sign in as an institution to apply and track a file, or as an AICTE official to work the queue, draw an expert panel and record a decision.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/login?portal=institution" className="btn bg-white text-brand-800 hover:bg-brand-50">
              <Building2 size={16} /> Institution portal
            </Link>
            <Link to="/login?portal=aicte" className="btn bg-saffron-500 text-brand-950 hover:bg-saffron-400">
              <Landmark size={16} /> AICTE officials
            </Link>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
