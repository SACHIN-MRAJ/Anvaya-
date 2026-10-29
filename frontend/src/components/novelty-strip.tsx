import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { noveltiesFor, STATUS_LABEL, type Novelty } from '../data/novelties';
import { cn } from '../lib/utils';

const KEY = 'anumati.noveltyStrip';
const read = () => {
  try {
    return localStorage.getItem(KEY) !== 'hidden';
  } catch {
    return true;
  }
};

/** Names ANUMATI's novelties on the current screen; each opens a short explanation that links to the full one. */
export function NoveltyStrip({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const items = noveltiesFor(pathname);
  const [shown, setShown] = useState(read);
  const [active, setActive] = useState<Novelty | null>(null);
  useEffect(() => setActive(null), [pathname]);
  if (!items.length || pathname === '/solution') return null;

  const toggle = (on: boolean) => {
    setShown(on);
    setActive(null);
    try {
      localStorage.setItem(KEY, on ? 'shown' : 'hidden');
    } catch {
      /* the choice just isn't remembered */
    }
  };

  if (!shown)
    return (
      <div className={cn('no-print mb-4 flex justify-end', className)}>
        <button onClick={() => toggle(true)} className="chip text-saffron-800 hover:border-saffron-300">
          <Sparkles size={12} className="text-saffron-500" /> {items.length} novelt{items.length === 1 ? 'y' : 'ies'} on this screen
        </button>
      </div>
    );

  return (
    <div className={cn('no-print mb-5 rounded-2xl border border-saffron-200/80 bg-gradient-to-r from-saffron-50/80 to-white', className)}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-saffron-800">
          <Sparkles size={13} className="text-saffron-500" /> Our novelties on this screen
        </span>
        {items.map((x) => (
          <button
            key={x.n}
            onClick={() => setActive(active?.n === x.n ? null : x)}
            aria-expanded={active?.n === x.n}
            className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors', active?.n === x.n ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200 bg-white text-ink-soft hover:border-brand-300 hover:text-brand-700')}
          >
            #{x.n} {x.title}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1">
          <Link to="/solution" className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">
            All 18 explained
          </Link>
          <button onClick={() => toggle(false)} className="rounded-lg p-1 text-ink-mute hover:bg-slate-100" aria-label="Hide the novelty guide" title="Hide">
            <X size={14} />
          </button>
        </span>
      </div>
      <AnimatePresence initial={false}>
        {active && (
          <motion.div key={active.n} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <div className="grid gap-3 border-t border-saffron-100 px-4 py-3 text-sm md:grid-cols-[1fr_1fr_auto] md:items-start">
              <p className="text-ink-soft">
                <b className="text-red-700">Problem: </b>
                {active.problem}
              </p>
              <p className="text-ink">
                <b className="text-indgreen-700">Our answer: </b>
                {active.solution}
              </p>
              <div className="flex flex-col items-start gap-2 md:items-end">
                <span className="text-xs font-semibold text-ink-mute">{STATUS_LABEL[active.status]}</span>
                <Link to={`/solution#n-${active.n}`} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-brand-700 hover:underline">
                  How it works <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
