import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Building2, CornerDownLeft, FileText, LayoutGrid, Scale, Search } from 'lucide-react';
import { APPLICATIONS } from '../data/applications';
import { INSTITUTIONS, institutionById } from '../data/institutions';
import { APPLICATION_TYPES, typeById } from '../data/rules';
import { useSession } from '../lib/session';
import { cn } from '../lib/utils';

type Item = { id: string; group: 'Pages' | 'Applications' | 'Institutions' | 'Rules'; label: string; hint?: string; to: string };

const PUBLIC_PAGES: Item[] = [
  ['Home', '/'],
  ['Rules explorer', '/rules'],
  ['Approved institutions', '/institutions'],
  ['Verify a letter', '/verify'],
  ['Academic calendar', '/calendar'],
  ['Notices and circulars', '/notices'],
  ['Help and policies', '/help'],
  ['Our solution: the 19 novelties explained', '/solution'],
  ['About ANUMATI', '/about'],
  ['Glossary of terms', '/glossary'],
  ['Service status and deadline rush', '/status'],
  ['AICTE performance and open data', '/performance'],
  ['Sitemap', '/sitemap'],
].map(([label, to]) => ({ id: `p-${to}`, group: 'Pages', label, to }));

const AICTE_PAGES: Item[] = [
  ['Main Dashboard', '/aicte'],
  ['Alert Centre', '/aicte/alerts'],
  ['Regulation Bureau', '/aicte/bureau'],
  ['Scrutiny & Re-Scrutiny', '/aicte/scrutiny'],
  ['EVC Portal', '/aicte/evc'],
  ['SHC Portal', '/aicte/shc'],
  ['Executive Committee', '/aicte/executive'],
  ['Council Decision Stage', '/aicte/council'],
  ['Bottleneck insights', '/aicte/insights'],
  ['What-if simulator', '/aicte/simulator'],
  ['Reports & Analytics', '/aicte/reports'],
  ['Rules studio', '/aicte/rules'],
  ['Schedule Management', '/aicte/calendar'],
  ['Evidence log', '/aicte/evidence'],
  ['Settings', '/aicte/settings'],
  ['User access', '/aicte/admin'],
].map(([label, to]) => ({ id: `a-${to}`, group: 'Pages', label, hint: 'AICTE portal', to }));

const INST_PAGES: Item[] = [
  ['Dashboard', '/institution'],
  ['Institutional Profile', '/institution/profile'],
  ['Application & AI Verification', '/institution/apply'],
  ['Document Locker', '/institution/documents'],
  ['Application Tracking', '/institution/applications'],
  ['Compliance & Notifications', '/institution/compliance'],
  ['Infrastructure locker', '/institution/infrastructure'],
  ['Courses and seats', '/institution/courses'],
  ['Faculty roster', '/institution/faculty'],
  ['Team and access', '/institution/team'],
].map(([label, to]) => ({ id: `i-${to}`, group: 'Pages', label, hint: 'Institution portal', to }));

export const openPalette = () => window.dispatchEvent(new Event('anumati:palette'));

const ICON = { Pages: LayoutGrid, Applications: FileText, Institutions: Building2, Rules: Scale };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const nav = useNavigate();
  const { session } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('anumati:palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('anumati:palette', onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const all = useMemo<Item[]>(() => {
    const pages = [...PUBLIC_PAGES, ...(session?.portal === 'aicte' ? AICTE_PAGES : session?.portal === 'institution' ? INST_PAGES : [])];
    const apps =
      session?.portal === 'aicte'
        ? APPLICATIONS.map((a) => ({ id: a.id, group: 'Applications' as const, label: `${a.id} · ${institutionById(a.institutionId)?.name.split(',')[0]}`, hint: typeById(a.typeId).name, to: `/aicte/applications/${a.id}` }))
        : session?.portal === 'institution'
          ? APPLICATIONS.filter((a) => a.institutionId === session.institutionId).map((a) => ({ id: a.id, group: 'Applications' as const, label: a.id, hint: typeById(a.typeId).name, to: `/institution/applications/${a.id}` }))
          : [];
    const inst = INSTITUTIONS.map((i) => ({ id: i.id, group: 'Institutions' as const, label: i.name, hint: i.aicteId, to: `/institutions?q=${encodeURIComponent(i.name.split(',')[0])}` }));
    const rules = APPLICATION_TYPES.map((t) => ({ id: `r-${t.id}`, group: 'Rules' as const, label: t.name, hint: t.clause, to: `/rules?type=${t.id}` }));
    return [...pages, ...apps, ...inst, ...rules];
  }, [session]);

  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = terms.length ? all.filter((i) => terms.every((t) => `${i.label} ${i.hint ?? ''}`.toLowerCase().includes(t))) : all.filter((i) => i.group === 'Pages');
    return list.slice(0, 40);
  }, [q, all]);

  const go = (i: Item) => {
    setOpen(false);
    nav(i.to);
  };

  const groups = (['Pages', 'Applications', 'Institutions', 'Rules'] as const).map((g) => ({ g, items: results.filter((r) => r.group === g) })).filter((x) => x.items.length);
  const flat = groups.flatMap((g) => g.items);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-start justify-center bg-brand-950/40 px-4 pt-[12vh] backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search and jump"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-4">
              <Search size={18} className="text-slate-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActive((a) => Math.min(flat.length - 1, a + 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActive((a) => Math.max(0, a - 1));
                  } else if (e.key === 'Enter' && flat[active]) {
                    go(flat[active]);
                  }
                }}
                className="h-14 flex-1 bg-transparent text-[15px] text-ink placeholder:text-slate-400 focus:outline-none"
                placeholder="Search pages, applications, institutions, rules…"
                aria-label="Search"
              />
              <span className="kbd">Esc</span>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2 scroll-thin">
              {flat.length === 0 && <p className="px-3 py-8 text-center text-sm text-ink-mute">Nothing matches “{q}”.</p>}
              {groups.map(({ g, items }) => {
                const Icon = ICON[g];
                return (
                  <div key={g} className="mb-1">
                    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{g}</p>
                    {items.map((i) => {
                      const idx = flat.indexOf(i);
                      return (
                        <button
                          key={i.id}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => go(i)}
                          className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors', idx === active ? 'bg-brand-50 text-brand-800' : 'text-ink-soft')}
                        >
                          <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', idx === active ? 'bg-brand-700 text-white' : 'bg-slate-100 text-ink-mute')}>
                            <Icon size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{i.label}</span>
                            {i.hint && <span className="block truncate text-xs text-ink-mute">{i.hint}</span>}
                          </span>
                          {idx === active && <ArrowRight size={15} />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 text-[11px] text-ink-mute">
              <span className="flex items-center gap-1">
                <span className="kbd">↑</span>
                <span className="kbd">↓</span> move
              </span>
              <span className="flex items-center gap-1">
                <span className="kbd">
                  <CornerDownLeft size={10} />
                </span>{' '}
                open
              </span>
              <span className="ml-auto flex items-center gap-1">
                <span className="kbd">Ctrl</span>
                <span className="kbd">K</span> anywhere
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
