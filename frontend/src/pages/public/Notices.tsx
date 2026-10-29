import { useMemo, useState } from 'react';
import { WithTerms } from '../../components/term';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useNotices } from '../../lib/live-data';
import { Badge, EmptyState, PageHeader } from '../../components/ui';
import { ReadAloud } from '../../components/speech';
import { cn, formatDate } from '../../lib/utils';
import type { Notice } from '../../types';

const AUD: (Notice['audience'] | 'All')[] = ['All', 'Institutions', 'Students', 'Experts', 'Public'];

export default function Notices() {
  const [aud, setAud] = useState<(typeof AUD)[number]>('All');
  const [q, setQ] = useState('');
  const notices = useNotices();
  const list = useMemo(() => notices.filter((n) => (aud === 'All' || n.audience === aud) && `${n.title} ${n.summary}`.toLowerCase().includes(q.toLowerCase())), [aud, q, notices]);
  return (
    <div className="container-page max-w-4xl py-10">
      <PageHeader eyebrow="Public" title="Notices and circulars" description="Filter by who the notice is for. Every title says what the notice is about, so you never have to open a file to find out." />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Audience">
          {AUD.map((a) => (
            <button key={a} aria-pressed={aud === a} onClick={() => setAud(a)} className={cn('rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors', aud === a ? 'bg-brand-700 text-white' : 'bg-white text-ink-soft ring-1 ring-slate-200 hover:bg-slate-50')}>
              {a}
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <label htmlFor="nq" className="sr-only">
            Search notices
          </label>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input id="nq" className="input pl-9" placeholder="Search notices" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <ul className="space-y-3">
        {list.map((n, i) => (
          <motion.li key={n.id} id={n.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="card p-5 target:ring-2 target:ring-saffron-500">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-mute">
              <time dateTime={n.date}>{formatDate(n.date)}</time>
              <span>·</span>
              <span>{n.category}</span>
              <Badge tone="brand">{n.audience}</Badge>
            </div>
            <h2 className="mt-1.5 font-semibold">{n.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-mute"><WithTerms text={n.summary} /></p>
            <div className="mt-3 flex flex-wrap items-center gap-3"><ReadAloud text={`${n.title}. ${n.summary}`} /><span className="text-xs text-ink-mute">Accessible web page; a PDF copy is optional, never the only format.</span></div>
          </motion.li>
        ))}
      </ul>
      {!list.length && <EmptyState title="No notices match" text="Clear the search or choose another audience." />}
    </div>
  );
}
