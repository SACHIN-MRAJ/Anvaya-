import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookA, Search } from 'lucide-react';
import { useGlossary } from '../../lib/live-data';
import { Badge, EmptyState, PageHeader } from '../../components/ui';
import { ReadAloud } from '../../components/speech';
import { cn } from '../../lib/utils';

export default function Glossary() {
  const [q, setQ] = useState('');
  const [letter, setLetter] = useState('');
  const loc = useLocation();
  const target = decodeURIComponent(loc.hash.slice(1));

  const glossary = useGlossary();
  const sorted = useMemo(() => [...glossary].sort((a, b) => a.key.localeCompare(b.key)), [glossary]);
  const letters = useMemo(() => Array.from(new Set(sorted.map((g) => g.key[0].toUpperCase()))), [sorted]);
  const rows = sorted.filter(
    (g) => (!letter || g.key[0].toUpperCase() === letter) && (!q || `${g.key} ${g.full} ${g.meaning}`.toLowerCase().includes(q.toLowerCase())),
  );

  useEffect(() => {
    if (!target) return;
    const el = document.getElementById(`term-${target}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [target]);

  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Plain language"
        title="Glossary of terms"
        description="Every abbreviation and term used in AICTE approvals, explained in one or two simple sentences. Across the portal, terms with a dotted underline open the same explanation."
      />

      <div className="card mb-6 flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <label htmlFor="g-q" className="sr-only">
            Search terms
          </label>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input id="g-q" className="input pl-9" placeholder="Search, for example “appeal” or “EVC”" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by first letter">
          <button onClick={() => setLetter('')} aria-pressed={!letter} className={cn('h-8 min-w-8 rounded-lg px-2 text-xs font-bold', !letter ? 'bg-brand-700 text-white' : 'text-ink-mute hover:bg-slate-100')}>
            All
          </button>
          {letters.map((l) => (
            <button key={l} onClick={() => setLetter(l === letter ? '' : l)} aria-pressed={letter === l} className={cn('h-8 min-w-8 rounded-lg px-2 text-xs font-bold', letter === l ? 'bg-brand-700 text-white' : 'text-ink-mute hover:bg-slate-100')}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<BookA size={22} />} title="No matching term" text="Try another word, or ask ANUMATI in plain language." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((g, i) => (
            <motion.li
              key={g.key}
              id={`term-${g.key}`}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.025, 0.4) }}
              className={cn('card card-hover spotlight scroll-mt-40 p-5', target === g.key && 'ring-4 ring-saffron-200')}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-xl font-extrabold tracking-tight text-brand-800">{g.key}</p>
                {g.clause && <Badge tone="saffron">{g.clause}</Badge>}
              </div>
              <p className="mt-0.5 text-sm font-semibold text-ink">{g.full}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-mute">{g.meaning}</p>
              <ReadAloud text={`${g.full}. ${g.meaning}`} className="mt-3" />
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
