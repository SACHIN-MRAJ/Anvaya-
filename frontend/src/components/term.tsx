import { Fragment, useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BookA } from 'lucide-react';
import { GLOSSARY_BY_KEY, TERM_PATTERN, termFor } from '../data/glossary';

/** An abbreviation or term with a plain-language explanation on hover, focus or tap. */
export function Term({ k, children }: { k: string; children?: ReactNode }) {
  const g = GLOSSARY_BY_KEY[k.toLowerCase()];
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!g) return <>{children ?? k}</>;
  return (
    <span className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="term font-[inherit] text-[inherit]" aria-describedby={open ? id : undefined} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen((o) => !o)}>
        {children ?? g.key}
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="card absolute left-1/2 top-full z-40 mt-2 block w-64 -translate-x-1/2 p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal shadow-lift"
          >
            <span className="flex items-center gap-1.5 font-display text-[13px] font-bold text-ink">
              <BookA size={13} className="text-saffron-600" /> {g.full}
            </span>
            <span className="mt-1 block text-ink-soft">{g.meaning}</span>
            <span className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px]">
              <span className="text-ink-mute">{g.clause ?? 'Glossary'}</span>
              <Link to={`/glossary#${encodeURIComponent(g.key)}`} className="font-semibold text-brand-700 hover:underline">
                All terms
              </Link>
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** Finds known abbreviations in plain text and explains the first use of each. */
export function WithTerms({ text }: { text: string }) {
  const parts = text.split(TERM_PATTERN);
  const seen = new Set<string>();
  return (
    <>
      {parts.map((part, i) => {
        const key = termFor(part);
        if (i % 2 === 0 || seen.has(key)) return <Fragment key={i}>{part}</Fragment>;
        seen.add(key);
        return (
          <Term key={i} k={key}>
            {part}
          </Term>
        );
      })}
    </>
  );
}
