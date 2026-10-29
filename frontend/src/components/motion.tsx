import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useScroll, useSpring } from 'framer-motion';
import { ArrowUp, CloudOff, Radio } from 'lucide-react';
import { apiMode } from '../services/api';
import { cn } from '../lib/utils';

/** True when the person asked for less motion (device setting, Reduce motion or Data saver in Accessibility). */
export function prefersLessMotion(): boolean {
  if (typeof window === 'undefined') return true;
  const html = document.documentElement.classList;
  return html.contains('reduce-motion') || html.contains('lite') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** A thin bar at the very top that fills as the page is read. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 220, damping: 32, mass: 0.4 });
  return <motion.div aria-hidden className="no-print pointer-events-none fixed inset-x-0 top-0 z-[95] h-[2px] origin-left bg-gradient-to-r from-brand-500 via-saffron-400 to-indgreen-500" style={{ scaleX }} />;
}

/** Appears after scrolling down a screen or two; returns smoothly to the top. */
export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 1.2);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={{ opacity: 0, y: 16, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.8 }}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => window.scrollTo({ top: 0, behavior: prefersLessMotion() ? 'auto' : 'smooth' })}
          className="no-print fixed bottom-24 left-5 z-40 grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white/90 text-brand-700 shadow-lift backdrop-blur hover:border-brand-300 lg:bottom-8"
          aria-label="Back to top"
        >
          <ArrowUp size={18} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/** Where the numbers on screen come from: the live server, or the built-in sample data. */
export function ConnectionBadge({ className }: { className?: string }) {
  const [mode, setMode] = useState(apiMode());
  useEffect(() => {
    const id = setInterval(() => setMode(apiMode()), 4000);
    return () => clearInterval(id);
  }, []);
  const live = mode === 'on';
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', live ? 'bg-indgreen-50 text-indgreen-700' : 'bg-slate-100 text-ink-mute', className)}
      title={live ? 'Connected: every figure comes from the live server' : mode === 'fallback' ? 'The server could not be reached: showing the built-in sample data' : 'Showing the built-in sample data'}
    >
      {live ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ring rounded-full bg-indgreen-400" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-indgreen-500" />
        </span>
      ) : mode === 'fallback' ? (
        <CloudOff size={12} />
      ) : (
        <Radio size={12} />
      )}
      {live ? 'Live' : 'Sample data'}
    </span>
  );
}

/** A short burst of confetti in the national colours for real milestones (a submission, a decision). */
export function celebrate(origin?: { x: number; y: number }) {
  if (prefersLessMotion() || typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '200' });
  document.body.appendChild(canvas);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.remove();
  ctx.scale(dpr, dpr);
  const colors = ['#F58A1F', '#FFFFFF', '#1E8C4E', '#2858A8', '#FFCB91'];
  const ox = origin?.x ?? window.innerWidth / 2;
  const oy = origin?.y ?? window.innerHeight * 0.35;
  const parts = Array.from({ length: 140 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    return { x: ox, y: oy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 6, size: 4 + Math.random() * 6, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, color: colors[(Math.random() * colors.length) | 0] };
  });
  const start = performance.now();
  const frame = (t: number) => {
    const elapsed = t - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - elapsed / 1900);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (elapsed < 1900) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
