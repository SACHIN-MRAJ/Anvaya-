import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getActivity, openActivityStream, type ActivityItem } from '../services/api';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ArrowRight, CheckCircle2, FilePlus2, Gavel, PauseCircle, Siren, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { prefersLessMotion } from './motion';

/* ---------------- Live countdown ---------------- */

export function Countdown({ to, className, dark = false }: { to: string; className?: string; dark?: boolean }) {
  const target = new Date(`${to}T23:59:59+05:30`).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, target - now);
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left / 3_600_000) % 24);
  const m = Math.floor((left / 60_000) % 60);
  const s = Math.floor((left / 1000) % 60);
  const cell = (v: number, l: string) => (
    <div className={cn('min-w-[56px] rounded-xl px-2 py-2 text-center', dark ? 'bg-white/10' : 'bg-brand-50')}>
      <motion.p key={v} initial={{ y: -6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className={cn('font-display text-xl font-bold tabular-nums', dark ? 'text-white' : 'text-brand-800')}>
        {String(v).padStart(2, '0')}
      </motion.p>
      <p className={cn('text-[10px] font-semibold uppercase tracking-wider', dark ? 'text-brand-200' : 'text-brand-600')}>{l}</p>
    </div>
  );
  return (
    <div className={cn('flex gap-1.5', className)} role="timer" aria-label={`${d} days ${h} hours ${m} minutes left`}>
      {cell(d, 'days')}
      {cell(h, 'hrs')}
      {cell(m, 'min')}
      {cell(s, 'sec')}
    </div>
  );
}

/* ---------------- Live activity stream ---------------- */

type Ev = { id: number; kind: 'submit' | 'decision' | 'pause' | 'escalate' | 'evc'; text: string; where: string };
const POOL: Omit<Ev, 'id'>[] = [
  { kind: 'submit', text: 'New application: increase in intake', where: 'Pune · Western' },
  { kind: 'decision', text: 'EoA issued by Executive Committee', where: 'Coimbatore · Southern' },
  { kind: 'pause', text: 'Deficiency recorded, clock paused', where: 'Lucknow · Northern' },
  { kind: 'escalate', text: 'Escalated to regional officer (Level 1)', where: 'Warangal · South-Central' },
  { kind: 'evc', text: 'EVC panel drawn with drand round', where: 'Bhubaneswar · Eastern' },
  { kind: 'submit', text: 'New application: change of site', where: 'Jaipur · North-Western' },
  { kind: 'decision', text: 'LoA issued to new institution', where: 'Mysuru · South-Western' },
  { kind: 'pause', text: 'Institution uploaded corrected NOC, clock restarted', where: 'Indore · Central' },
];
const ICON = { submit: FilePlus2, decision: CheckCircle2, pause: PauseCircle, escalate: Siren, evc: Gavel };
const TONE = { submit: 'bg-brand-50 text-brand-700', decision: 'bg-indgreen-50 text-indgreen-700', pause: 'bg-slate-100 text-slate-600', escalate: 'bg-red-50 text-red-700', evc: 'bg-saffron-50 text-saffron-700' };

type Feed = Ev & { at?: string };

/** What kind of event an evidence-log entry is, from its wording. */
function kindOf(action: string): Ev['kind'] {
  const a = action.toLowerCase();
  if (a.includes('escalat')) return 'escalate';
  if (a.includes('evc') || a.includes('panel') || a.includes('inspection')) return 'evc';
  if (a.includes('sent back') || a.includes('paused') || a.includes('deficien')) return 'pause';
  if (a.includes('decision') || a.includes('decided') || a.includes('eoa') || a.includes('loa') || a.includes('lod') || a.includes('published')) return 'decision';
  return 'submit';
}
const fromEntry = (e: ActivityItem): Feed => ({ id: e.id, kind: kindOf(e.action), text: e.action, where: `${e.ref} · ${e.actor}`, at: e.at });

function since(at?: string): string {
  if (!at) return 'just now';
  const s = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 1000));
  return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86_400 ? `${Math.round(s / 3600)} h ago` : new Date(at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * Recent evidence-log entries from the server, then each new one as it happens (Server-Sent Events).
 * Region-locked officers only see their region. Without the server, a labelled sample stream plays instead.
 */
export function LiveActivity() {
  const [items, setItems] = useState<Feed[]>([]);
  const [mode, setMode] = useState<'connecting' | 'live' | 'sample'>('connecting');
  const [, tick] = useState(0);

  useEffect(() => {
    let alive = true;
    let stream: EventSource | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    const sample = () => {
      setMode('sample');
      setItems(POOL.slice(0, 4).map((e, i) => ({ ...e, id: -i - 1 })));
      let n = 4;
      timer = setInterval(() => {
        const next = { ...POOL[n % POOL.length], id: -n - 1 };
        n += 1;
        setItems((x) => [next, ...x].slice(0, 5));
      }, 4200);
    };
    void getActivity(5)
      .then((recent) => {
        if (!alive) return;
        if (!recent) return sample();
        setItems(recent.map(fromEntry));
        setMode('live');
        stream = openActivityStream();
        if (stream)
          stream.onmessage = (m) => {
            const e = JSON.parse(m.data) as ActivityItem;
            setItems((x) => (x.some((y) => y.id === e.id) ? x : [fromEntry(e), ...x].slice(0, 6)));
          };
      })
      .catch(() => alive && sample());
    const clock = setInterval(() => tick((t) => t + 1), 30_000); // keeps "2 min ago" current
    return () => {
      alive = false;
      stream?.close();
      clearInterval(timer);
      clearInterval(clock);
    };
  }, []);

  return (
    <div>
      <div className={cn('mb-3 flex items-center gap-2 text-xs font-semibold', mode === 'sample' ? 'text-ink-mute' : 'text-indgreen-700')}>
        <span className="relative flex h-2.5 w-2.5">
          {mode === 'live' && <span className="absolute inline-flex h-full w-full animate-ring rounded-full bg-indgreen-400" />}
          <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', mode === 'live' ? 'bg-indgreen-500' : mode === 'sample' ? 'bg-slate-400' : 'bg-amber-400')} />
        </span>
        {mode === 'live' ? 'Live from the evidence log' : mode === 'sample' ? 'Sample activity (server not connected)' : 'Connecting…'}
      </div>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {items.map((e) => {
            const Icon = ICON[e.kind];
            return (
              <motion.li key={e.id} layout initial={{ opacity: 0, y: -14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5">
                <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', TONE[e.kind])}>
                  <Icon size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{e.text}</span>
                  <span className="block truncate text-xs text-ink-mute">
                    {e.where} · {since(e.at)}
                  </span>
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}

/* ---------------- Guided tour ---------------- */

export interface TourStep {
  target: string; // value of data-tour attribute
  title: string;
  text: string;
}

export function Tour({ id, steps }: { id: string; steps: TourStep[] }) {
  const key = `anumati.tour.${id}`;
  const [i, setI] = useState<number | null>(() => {
    try {
      return localStorage.getItem(key) ? null : 0;
    } catch {
      return null;
    }
  });
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const onStart = () => setI(0);
    window.addEventListener(`anumati:tour:${id}`, onStart);
    return () => window.removeEventListener(`anumati:tour:${id}`, onStart);
  }, [id]);
  useEffect(() => {
    if (i === null) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useLayoutEffect(() => {
    if (i === null) return;
    let el: Element | null = null;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => el && setRect(el.getBoundingClientRect()));
    };
    // The page may still be loading its data: wait for the highlighted part, then bring it into view.
    let tries = 0;
    const find = setInterval(() => {
      el = document.querySelector(`[data-tour="${steps[i].target}"]`);
      if (!el && ++tries < 20) return;
      clearInterval(find);
      if (!el) return setI((k) => (k !== null && k + 1 < steps.length ? k + 1 : null));
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const roomForCard = r.bottom + 250 < vh || r.top - 250 > 0;
      if (r.top < 80 || r.bottom > vh - 24 || !roomForCard) {
        // Centre it when there is room for the card above or below; otherwise lift it to just under the header.
        const fitsCentred = r.height + 2 * 250 < vh;
        window.scrollBy({ top: fitsCentred ? r.top + r.height / 2 - vh / 2 : r.top - 96, behavior: prefersLessMotion() ? 'auto' : 'smooth' });
      }
      update();
      setTimeout(update, 450); // after the smooth scroll settles
    }, 100);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      clearInterval(find);
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [i, steps]);

  const close = () => {
    setI(null);
    setRect(null);
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
  };

  if (i === null || !rect) return null;
  const step = steps[i];
  // The card goes where there is room: below, above, then beside the highlight; it is always kept on screen.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const W = Math.min(340, vw - 32);
  const H = 210;
  const hole = { top: Math.max(8, rect.top - 8), left: Math.max(8, rect.left - 8), right: Math.min(vw - 8, rect.right + 8), bottom: Math.min(vh - 8, rect.bottom + 8) };
  const clampX = (x: number) => Math.min(Math.max(16, x), vw - W - 16);
  const clampY = (y: number) => Math.min(Math.max(16, y), vh - H - 16);
  let pos: { left: number; top: number };
  if (hole.bottom + 12 + H < vh) pos = { left: clampX(hole.left), top: hole.bottom + 12 };
  else if (hole.top - 12 - H > 0) pos = { left: clampX(hole.left), top: hole.top - 12 - H };
  else if (hole.right + 12 + W < vw) pos = { left: hole.right + 12, top: clampY(hole.top) };
  else if (hole.left - 12 - W > 0) pos = { left: hole.left - 12 - W, top: clampY(hole.top) };
  else pos = { left: clampX(vw - W - 16), top: clampY(vh - H - 16) };
  // Rendered into <body> so no animated or transformed ancestor can move it away from what it highlights.
  return createPortal(
    <div className="fixed inset-0 z-[65] overflow-hidden" aria-live="polite">
      <motion.div
        className="pointer-events-none absolute rounded-2xl"
        initial={false}
        animate={{ top: hole.top, left: hole.left, width: hole.right - hole.left, height: hole.bottom - hole.top }}
        transition={prefersLessMotion() ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}
        style={{ boxShadow: '0 0 0 9999px rgba(6, 18, 43, 0.55)', outline: '3px solid #F58A1F' }}
      />
      <motion.div
        key={i}
        role="dialog"
        aria-label={step.title}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute rounded-2xl border border-slate-200 bg-white p-5 shadow-lift"
        style={{ ...pos, width: W }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-saffron-700">
            <Activity size={13} /> Tour · {i + 1} of {steps.length}
          </p>
          <button onClick={close} className="rounded-md p-1 text-ink-mute hover:bg-slate-100" aria-label="Skip tour">
            <X size={16} />
          </button>
        </div>
        <p className="mt-2 font-display font-bold text-ink">{step.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-mute">{step.text}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, k) => (
              <span key={k} className={cn('h-1.5 rounded-full transition-all', k === i ? 'w-5 bg-brand-700' : 'w-1.5 bg-slate-200')} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button className="btn-ghost btn-sm" onClick={() => setI(i - 1)}>
                Back
              </button>
            )}
            <button className="btn-primary btn-sm" onClick={() => (i + 1 < steps.length ? setI(i + 1) : close())} autoFocus>
              {i + 1 < steps.length ? 'Next' : 'Finish'} <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

export const startTour = (id: string) => {
  try {
    localStorage.removeItem(`anumati.tour.${id}`);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(`anumati:tour:${id}`));
};
