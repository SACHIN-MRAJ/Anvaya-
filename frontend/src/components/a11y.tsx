import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Accessibility, BookOpenText, Contrast, Feather, Link2, Monitor, Moon, RotateCcw, Sun, Wind, X } from 'lucide-react';
import { usePrefs, type ColorPalette, type FontStep, type Theme } from '../lib/prefs';
import { cn } from '../lib/utils';
import { Toggle } from './ui';

/**
 * Display and accessibility panel (GIGW 3.0 / UX4G accessibility widget).
 * Every setting applies site-wide at once and is remembered on this device.
 */
export function DisplayPanelButton() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn('flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold transition-colors', open ? 'bg-white text-brand-900' : 'text-brand-100 hover:bg-white/10')}
      >
        <Accessibility size={13} aria-hidden />
        <span className="hidden sm:inline">Accessibility</span>
        <span className="sr-only sm:hidden">Display and accessibility settings</span>
      </button>
      {createPortal(
        <AnimatePresence>{open && <DisplayPanel onClose={() => setOpen(false)} returnFocus={btnRef} />}</AnimatePresence>,
        document.body,
      )}
    </>
  );
}

function Row({ icon, title, text, checked, onChange }: { icon: ReactNode; title: string; text: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-ink-mute">{text}</span>
      </span>
      <Toggle checked={checked} onChange={onChange} label="" srLabel={title} />
    </li>
  );
}

function DisplayPanel({ onClose, returnFocus }: { onClose: () => void; returnFocus: React.RefObject<HTMLButtonElement> }) {
  const p = usePrefs();
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !returnFocus.current?.contains(t)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    const btn = returnFocus.current;
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
      btn?.focus();
    };
  }, [onClose, returnFocus]);

  const sizes: { v: FontStep; px: number; label: string }[] = [
    { v: -1, px: 12, label: 'Small' },
    { v: 0, px: 15, label: 'Default' },
    { v: 1, px: 18, label: 'Large' },
    { v: 2, px: 21, label: 'Largest' },
  ];
  const themes: { v: Theme; icon: ReactNode; label: string }[] = [
    { v: 'light', icon: <Sun size={15} />, label: 'Light' },
    { v: 'dark', icon: <Moon size={15} />, label: 'Dark' },
    { v: 'system', icon: <Monitor size={15} />, label: 'Device' },
  ];

  return (
    <motion.div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-label="Display and accessibility"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className="card fixed right-3 top-[52px] z-[90] w-[min(360px,calc(100vw-24px))] overflow-hidden focus:outline-none sm:right-6"
    >
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <p className="flex items-center gap-2 font-display text-sm font-bold text-ink">
          <Accessibility size={17} className="text-brand-600" /> Display and accessibility
        </p>
        <button onClick={onClose} className="rounded-lg p-1 text-ink-mute hover:bg-slate-100" aria-label="Close">
          <X size={17} />
        </button>
      </header>
      <div className="max-h-[calc(100vh-140px)] overflow-y-auto px-5 py-4 scroll-thin">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Text size</p>
        <div className="mt-2 grid grid-cols-4 gap-1.5" role="group" aria-label="Text size">
          {sizes.map((s) => (
            <button
              key={s.v}
              onClick={() => p.setFontStep(s.v)}
              aria-pressed={p.fontStep === s.v}
              className={cn('flex h-14 flex-col items-center justify-center rounded-xl border transition-colors', p.fontStep === s.v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 text-ink-soft hover:border-brand-300')}
            >
              <span className="font-display font-bold leading-none" style={{ fontSize: s.px }}>
                A
              </span>
              <span className="mt-1 text-[10px] font-semibold">{s.label}</span>
            </button>
          ))}
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-wider text-ink-mute">Theme</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1" role="group" aria-label="Theme">
          {themes.map((th) => (
            <button
              key={th.v}
              onClick={() => p.setTheme(th.v)}
              aria-pressed={p.theme === th.v}
              disabled={p.highContrast}
              className={cn('relative flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors disabled:opacity-50', p.theme === th.v ? 'text-brand-800' : 'text-ink-mute hover:text-ink')}
            >
              {p.theme === th.v && <motion.span layoutId="theme-pill" className="absolute inset-0 rounded-lg bg-white shadow-card" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
              <span className="relative flex items-center gap-1.5">
                {th.icon} {th.label}
              </span>
            </button>
          ))}
        </div>
        {p.highContrast && <p className="mt-1.5 text-xs text-ink-mute">Turn off high contrast to choose a theme.</p>}

        {/* ── Colour palettes ── */}
        <p className="mt-5 text-xs font-bold uppercase tracking-wider text-ink-mute">Colour Palette</p>
        <p className="mt-1 text-xs text-ink-mute">Preview 10 colour tones — pick whichever suits best.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(
            [
              { id: 'amber',   hex: '#D97706', label: 'Amber',   sub: 'Warm gold' },
              { id: 'ocean',   hex: '#2563EB', label: 'Ocean',   sub: 'Deep blue' },
              { id: 'forest',  hex: '#16A34A', label: 'Forest',  sub: 'Rich green' },
              { id: 'royal',   hex: '#7C3AED', label: 'Royal',   sub: 'Premium violet' },
              { id: 'crimson', hex: '#DC2626', label: 'Crimson', sub: 'Bold red' },
              { id: 'teal',    hex: '#0D9488', label: 'Teal',    sub: 'Cool teal — default' },
              { id: 'rose',    hex: '#E11D48', label: 'Rose',    sub: 'Warm rose' },
              { id: 'indigo',  hex: '#4F46E5', label: 'Indigo',  sub: 'Sophisticated' },
              { id: 'slate',   hex: '#475569', label: 'Slate',   sub: 'Neutral grey' },
              { id: 'mono',    hex: '#3F3F46', label: 'Mono',    sub: 'Black & white' },
              { id: 'emerald', hex: '#059669', label: 'Emerald', sub: 'Fresh emerald' },
            ] as { id: ColorPalette; hex: string; label: string; sub: string }[]
          ).map((pal) => {
            const isActive = p.colorPalette === pal.id;
            return (
              <button
                key={pal.id}
                onClick={() => p.setColorPalette(pal.id)}
                aria-pressed={isActive}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all',
                  isActive
                    ? 'border-neutral-400 bg-neutral-50 shadow-sm ring-1 ring-neutral-300'
                    : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                )}
              >
                <span
                  className="h-6 w-6 shrink-0 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: pal.hex }}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-ink leading-tight">{pal.label}</span>
                  <span className="block text-[10px] text-ink-mute leading-tight mt-0.5">{pal.sub}</span>
                </span>
                {isActive && (
                  <span className="ml-auto shrink-0 text-[11px] font-bold text-brand-600">✓</span>
                )}
              </button>
            );
          })}
        </div>

        <ul className="mt-4 divide-y divide-slate-100">
          <Row icon={<Contrast size={16} />} title="High contrast" text="Black and yellow for the strongest contrast" checked={p.highContrast} onChange={p.setHighContrast} />
          <Row icon={<BookOpenText size={16} />} title="Reading comfort" text="More space between lines, letters and words" checked={p.comfort} onChange={p.setComfort} />
          <Row icon={<Link2 size={16} />} title="Underline links" text="Make every link easy to spot" checked={p.underlineLinks} onChange={p.setUnderlineLinks} />
          <Row icon={<Wind size={16} />} title="Reduce motion" text="Stop animations and moving effects" checked={p.reduceMotion} onChange={p.setReduceMotion} />
          <Row icon={<Feather size={16} />} title="Data saver" text="Hide decorative art and effects on slow or costly connections" checked={p.dataSaver} onChange={p.setDataSaver} />
        </ul>
      </div>
      <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
        <span className="text-xs text-ink-mute">Saved on this device</span>
        <button onClick={p.reset} className="btn-ghost btn-sm">
          <RotateCcw size={13} /> Reset all
        </button>
      </footer>
    </motion.div>
  );
}

/** One-click light/dark switch for the government bar. */
export function ThemeSwitch() {
  const { isDark, setTheme, highContrast } = usePrefs();
  if (highContrast) return null;
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="relative grid h-6 w-6 place-items-center overflow-hidden rounded-md text-brand-100 transition-colors hover:bg-white/10"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={isDark ? 'moon' : 'sun'} initial={{ y: 14, rotate: -60, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }} exit={{ y: -14, rotate: 60, opacity: 0 }} transition={{ duration: 0.25 }}>
          {isDark ? <Moon size={13} /> : <Sun size={13} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
