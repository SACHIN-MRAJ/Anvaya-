import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useInView, animate, type Variants } from 'framer-motion';
import { AlertTriangle, Check, CheckCircle2, Clock3, Compass, Copy, Info, PauseCircle, Scale, X, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ClockState, ObligationStatus, PublicStatus } from '../types';

/* ---------------- Motion helpers ---------------- */

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

export const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function CountUp({ value, decimals = 0, suffix = '', className }: { value: number; decimals?: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [shown, setShown] = useState(0);
  useEffect(() => {
    // Always land on the real value, even if animation frames are paused (background tab, reduced motion).
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || document.hidden) {
      setShown(value);
      return;
    }
    const safety = setTimeout(() => setShown(value), 1600);
    if (!inView) return () => clearTimeout(safety);
    const controls = animate(0, value, { duration: 1.1, ease: 'easeOut', onUpdate: (v) => setShown(v) });
    return () => {
      controls.stop();
      clearTimeout(safety);
    };
  }, [inView, value]);
  return (
    <span ref={ref} className={className}>
      {shown.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/* ---------------- Layout primitives ---------------- */

export function PageHeader({ eyebrow, title, description, actions, tourId }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode; tourId?: string }) {
  const handleTour = tourId
    ? () => {
        // Lazy-import to avoid circular dependency (ui → live → ui)
        import('./live').then(({ startTour }) => startTour(tourId));
      }
    : undefined;

  return (
    <motion.div initial={{ opacity: 0.4, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="eyebrow mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-saffron-500" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-[1.6rem] font-bold leading-tight tracking-tight sm:text-[2rem]">{title}</h1>
        <motion.span
          aria-hidden
          className="mt-2.5 block h-[3px] w-16 origin-left rounded-full bg-gradient-to-r from-saffron-500 via-brand-400 to-indgreen-500"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        />
        {description && <p className="mt-2 max-w-3xl text-[0.94rem] leading-relaxed text-ink-mute">{description}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {handleTour && (
          <motion.button
            onClick={handleTour}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="btn-ghost btn-sm gap-1.5 border border-brand-200 text-brand-700 hover:bg-brand-50"
            title="Take a guided tour of this page"
          >
            <Compass size={14} className="text-saffron-600" />
            Take a tour
          </motion.button>
        )}
        {actions}
      </div>
    </motion.div>
  );
}

export function Card({ children, className, title, subtitle, action, pad = true }: { children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; pad?: boolean }) {
  return (
    <motion.section
      className={cn('card', className)}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-24px' }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {title && <h2 className="font-display text-[0.98rem] font-bold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-mute">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={pad ? 'card-pad' : ''}>{children}</div>
    </motion.section>
  );
}

const SPARK: Record<string, string> = { brand: '#2858A8', green: '#1E8C4E', amber: '#DB700A', red: '#C0352B', slate: '#64748B' };

export function Sparkline({ data, color = '#2858A8', width = 88, height = 30 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((d, i) => [(i / (data.length - 1)) * width, height - 3 - ((d - min) / Math.max(1, max - min)) * (height - 6)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <motion.path d={`${line} L${width} ${height} L0 ${height} Z`} fill={color} opacity={0.08} initial={{ opacity: 0 }} animate={{ opacity: 0.08 }} transition={{ delay: 0.4 }} />
      <motion.path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: 'easeOut' }} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3} fill={color} />
    </svg>
  );
}

export function Stat({ label, value, hint, tone = 'brand', icon, trend }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'brand' | 'green' | 'amber' | 'red' | 'slate'; icon?: ReactNode; trend?: number[] }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700 ring-brand-100',
    green: 'bg-indgreen-50 text-indgreen-700 ring-indgreen-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    red: 'bg-red-50 text-red-700 ring-red-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  };
  return (
    <motion.div variants={fadeUp} className="card card-pad card-hover flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-ink-mute">{label}</p>
        {icon && <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1', tones[tone])}>{icon}</div>}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[1.75rem] font-bold leading-none tabular-nums tracking-tight text-ink">{value}</p>
          {hint && <p className="mt-2 text-xs text-ink-mute">{hint}</p>}
        </div>
        {trend && <Sparkline data={trend} color={SPARK[tone]} />}
      </div>
    </motion.div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-ink-mute">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/* ---------------- Badges and status ---------------- */

type Tone = 'brand' | 'green' | 'amber' | 'red' | 'slate' | 'saffron';
const TONE: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  green: 'bg-indgreen-50 text-indgreen-700 ring-indgreen-100',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  saffron: 'bg-saffron-50 text-saffron-700 ring-saffron-100',
};

export function Badge({ children, tone = 'slate', className, icon }: { children: ReactNode; tone?: Tone; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', TONE[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export function ClockBadge({ state, label }: { state: ClockState; label?: string }) {
  const map: Record<ClockState, { tone: Tone; icon: ReactNode; text: string }> = {
    running: { tone: 'brand', icon: <Clock3 size={12} aria-hidden />, text: 'Clock running' },
    paused: { tone: 'slate', icon: <PauseCircle size={12} aria-hidden />, text: 'Paused: awaiting institution' },
    breached: { tone: 'red', icon: <AlertTriangle size={12} aria-hidden />, text: 'Deadline missed' },
    met: { tone: 'green', icon: <CheckCircle2 size={12} aria-hidden />, text: 'Completed on time' },
  };
  const m = map[state];
  return (
    <Badge tone={m.tone} icon={m.icon}>
      {label ?? m.text}
    </Badge>
  );
}

export function PublicStatusBadge({ status }: { status: PublicStatus }) {
  const tone: Record<PublicStatus, Tone> = { Ongoing: 'brand', 'Action needed': 'amber', 'Decision issued': 'green' };
  return <Badge tone={tone[status]}>{status}</Badge>;
}

export function ObligationBadge({ status }: { status: ObligationStatus }) {
  const tone: Record<ObligationStatus, Tone> = { Met: 'green', 'On track': 'brand', 'Due soon': 'amber', Overdue: 'red', Escalated: 'red' };
  return <Badge tone={tone[status]}>{status}</Badge>;
}

/** The "why" chip: every automated action shows the rule, clause and data it used. */
export function WhyChip({ rule, clause, detail }: { rule: string; clause: string; detail?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-full bg-saffron-50 px-2 py-0.5 text-[11px] font-semibold text-saffron-700 ring-1 ring-inset ring-saffron-100 hover:bg-saffron-100"
      >
        <Scale size={11} aria-hidden /> Why?
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute left-0 top-7 z-30 w-72 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs leading-relaxed text-ink-soft shadow-lift"
          >
            <span className="block font-semibold text-ink">{rule}</span>
            <span className="mt-1 block">
              Clause: <span className="font-medium text-brand-700">{clause}</span>
            </span>
            {detail && <span className="mt-1 block text-ink-mute">{detail}</span>}
            <span className="mt-2 block border-t border-slate-100 pt-2 text-[11px] text-ink-mute">Advisory only. The competent authority decides.</span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/* ---------------- Inputs ---------------- */

export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[]; className?: string }) {
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto border-b border-slate-200 scroll-thin', className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn('relative whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors', active ? 'text-brand-700' : 'text-ink-mute hover:text-ink')}
          >
            {t.label}
            {t.count !== undefined && <span className={cn('ml-1.5 rounded-full px-1.5 text-xs', active ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-ink-mute')}>{t.count}</span>}
            {active && <motion.span layoutId={`tab-underline-${tabs[0].value}`} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-700" />}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, srLabel }: { checked: boolean; onChange: (v: boolean) => void; label: string; srLabel?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label ? undefined : srLabel ?? 'Toggle'} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm text-ink-soft">
      <span className={cn('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-brand-600' : 'bg-slate-300')}>
        <motion.span layout className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {label}
    </button>
  );
}

/* ---------------- Feedback ---------------- */

export function Callout({ tone = 'brand', title, children, icon }: { tone?: 'brand' | 'amber' | 'red' | 'green'; title?: string; children: ReactNode; icon?: ReactNode }) {
  const styles = {
    brand: 'border-brand-200 bg-brand-50 text-brand-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    green: 'border-indgreen-100 bg-indgreen-50 text-indgreen-700',
  };
  const icons = { brand: <Info size={18} />, amber: <AlertTriangle size={18} />, red: <XCircle size={18} />, green: <CheckCircle2 size={18} /> };
  return (
    <div className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', styles[tone])}>
      <span className="mt-0.5 shrink-0" aria-hidden>
        {icon ?? icons[tone]}
      </span>
      <div className="min-w-0 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  // Rendered into <body>: a modal opened from inside an animated card or page must still cover the whole screen.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className={cn('card max-h-[88vh] w-full overflow-hidden', wide ? 'max-w-3xl' : 'max-w-lg')}
          >
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold">{title}</h2>
              <button onClick={onClose} className="rounded-md p-1 text-ink-mute hover:bg-slate-100" aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <div className="max-h-[64vh] overflow-y-auto px-5 py-4 scroll-thin">{children}</div>
            {footer && <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">{footer}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** One-tap copy for reference numbers and fingerprints, which people otherwise retype by hand. */
export function CopyButton({ value, label = 'Copy', className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      toast('Copy is blocked in this browser. Select the text instead.', 'red');
    }
  };
  return (
    <button type="button" onClick={copy} className={cn('inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-mute transition-colors hover:bg-slate-100 hover:text-brand-700', className)} aria-label={done ? 'Copied' : `${label}: ${value}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={done ? 'ok' : 'copy'} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.15 }} className="inline-flex items-center gap-1">
          {done ? <Check size={13} className="text-indgreen-600" /> : <Copy size={13} />}
          {done ? 'Copied' : label}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/* ---------------- Toasts ---------------- */

type ToastAction = { label: string; onClick: () => void };
type ToastItem = { id: number; text: string; tone: 'green' | 'brand' | 'red'; action?: ToastAction };
let pushToast: (t: Omit<ToastItem, 'id'>) => void = () => {};
/** Shows a short message. Pass an action (such as Undo) to keep it on screen a little longer. */
export const toast = (text: string, tone: ToastItem['tone'] = 'green', action?: ToastAction) => pushToast({ text, tone, action });

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    pushToast = (t) => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { ...t, id }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), t.action ? 6500 : 3800);
    };
  }, []);
  const dismiss = (id: number) => setItems((x) => x.filter((i) => i.id !== id));
  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[80] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-lg border bg-white px-4 py-3 text-sm shadow-lift',
              t.tone === 'green' ? 'border-indgreen-100' : t.tone === 'red' ? 'border-red-200' : 'border-brand-200',
            )}
          >
            {t.tone === 'green' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-indgreen-600" /> : t.tone === 'red' ? <XCircle size={18} className="mt-0.5 shrink-0 text-red-600" /> : <Info size={18} className="mt-0.5 shrink-0 text-brand-600" />}
            <span className="flex-1 text-ink-soft">{t.text}</span>
            {t.action && (
              <button
                className="shrink-0 rounded-md px-2 py-0.5 text-xs font-bold text-brand-700 hover:bg-brand-50"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- Progress ---------------- */

export function ProgressBar({ value, tone = 'brand', label }: { value: number; tone?: 'brand' | 'green' | 'amber' | 'red'; label?: string }) {
  const colors = { brand: 'bg-brand-600', green: 'bg-indgreen-500', amber: 'bg-amber-500', red: 'bg-red-600' };
  return (
    <div className="w-full" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <motion.div className={cn('h-full rounded-full', colors[tone])} initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
      </div>
    </div>
  );
}

export function RiskMeter({ value }: { value: number }) {
  const tone = value >= 0.6 ? 'red' : value >= 0.35 ? 'amber' : 'green';
  const text = value >= 0.6 ? 'High' : value >= 0.35 ? 'Medium' : 'Low';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16">
        <ProgressBar value={value} tone={tone} label="Delay risk" />
      </div>
      <span className={cn('text-xs font-semibold tabular-nums', tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : 'text-indgreen-700')}>
        {Math.round(value * 100)}% {text}
      </span>
    </div>
  );
}

export function Ring({ value, size = 96, stroke = 9, tone = '#1D4F94', children }: { value: number; size?: number; stroke?: number; tone?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0, value))) }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
