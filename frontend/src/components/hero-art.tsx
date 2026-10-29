import { motion } from 'framer-motion';
import { BadgeCheck, Dices, FlaskConical, Fingerprint } from 'lucide-react';
import { cn } from '../lib/utils';

/* ---------- Isometric helpers ---------- */
const U = 30;
type V3 = [number, number, number];
const P = ([x, y, z]: V3) => [(x - y) * 0.866 * U, (x + y) * 0.5 * U - z * U * 0.95];
const pts = (arr: V3[]) => arr.map((p) => P(p).map((n) => n.toFixed(1)).join(',')).join(' ');

interface BoxProps {
  x0: number;
  y0: number;
  z0?: number;
  w: number;
  d: number;
  h: number;
  top: string;
  left: string;
  right: string;
  windows?: { rows: number; cols: number; lit?: number[] };
  delay?: number;
}

function Box({ x0, y0, z0 = 0, w, d, h, top, left, right, windows, delay = 0 }: BoxProps) {
  const x1 = x0 + w;
  const y1 = y0 + d;
  const z1 = z0 + h;
  const win: JSX.Element[] = [];
  if (windows) {
    const { rows, cols, lit = [] } = windows;
    const wx = (w - 0.6) / cols;
    const wz = (h - 0.7) / rows;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const xa = x0 + 0.3 + c * wx + wx * 0.22;
        const xb = xa + wx * 0.56;
        const za = z0 + 0.35 + r * wz + wz * 0.22;
        const zb = za + wz * 0.52;
        const idx = r * cols + c;
        const isLit = lit.includes(idx);
        win.push(
          <motion.polygon
            key={`l${idx}`}
            points={pts([
              [xa, y1, za],
              [xb, y1, za],
              [xb, y1, zb],
              [xa, y1, zb],
            ])}
            fill={isLit ? '#FFCB91' : '#C7D7F1'}
            initial={{ opacity: 0 }}
            animate={{ opacity: isLit ? [0.55, 1, 0.75, 1] : 0.9 }}
            transition={{ delay: delay + 0.6 + idx * 0.03, duration: isLit ? 3 : 0.4, repeat: isLit ? Infinity : 0, repeatType: 'reverse' }}
          />,
        );
      }
    const wy = (d - 0.6) / Math.max(1, Math.round(cols * (d / w)));
    const ycols = Math.max(1, Math.round(cols * (d / w)));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < ycols; c++) {
        const ya = y0 + 0.3 + c * wy + wy * 0.22;
        const yb = ya + wy * 0.56;
        const za = z0 + 0.35 + r * wz + wz * 0.22;
        const zb = za + wz * 0.52;
        win.push(
          <motion.polygon
            key={`r${r}-${c}`}
            points={pts([
              [x1, ya, za],
              [x1, yb, za],
              [x1, yb, zb],
              [x1, ya, zb],
            ])}
            fill="#5F86C9"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.85 }}
            transition={{ delay: delay + 0.7 + (r + c) * 0.04 }}
          />,
        );
      }
  }
  return (
    <motion.g initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
      <polygon
        points={pts([
          [x1, y0, z0],
          [x1, y1, z0],
          [x1, y1, z1],
          [x1, y0, z1],
        ])}
        fill={right}
      />
      <polygon
        points={pts([
          [x0, y1, z0],
          [x1, y1, z0],
          [x1, y1, z1],
          [x0, y1, z1],
        ])}
        fill={left}
      />
      <polygon
        points={pts([
          [x0, y0, z1],
          [x1, y0, z1],
          [x1, y1, z1],
          [x0, y1, z1],
        ])}
        fill={top}
      />
      {win}
    </motion.g>
  );
}

function Tree({ x, y, s = 1, delay = 0 }: { x: number; y: number; s?: number; delay?: number }) {
  const [bx, by] = P([x, y, 0]);
  return (
    <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay, type: 'spring', stiffness: 200 }} style={{ transformOrigin: `${bx}px ${by}px` }}>
      <rect x={bx - 2} y={by - 16 * s} width={4} height={16 * s} rx={2} fill="#8A6A4A" />
      <circle cx={bx} cy={by - 24 * s} r={14 * s} fill="#3DB073" />
      <circle cx={bx - 5 * s} cy={by - 28 * s} r={8 * s} fill="#5BC38A" />
    </motion.g>
  );
}

export function CampusIllustration({ className }: { className?: string }) {
  const seal = P([4.2, 1.8, 5.6]);
  const ground: V3[] = [
    [-1.2, -3.4, 0],
    [10.4, -3.4, 0],
    [10.4, 6.6, 0],
    [-1.2, 6.6, 0],
  ];
  const path: V3[] = [
    [2.5, 4.9, 0],
    [3.7, 4.9, 0],
    [3.7, 6.6, 0],
    [2.5, 6.6, 0],
  ];
  return (
    <svg viewBox="-215 -205 560 440" className={cn('h-auto w-full', className)} role="img" aria-label="Illustration of a technical institution campus with an approval seal">
      <defs>
        <linearGradient id="hero-ground" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E3ECF9" />
          <stop offset="1" stopColor="#D2E9DC" />
        </linearGradient>
        <radialGradient id="hero-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#F58A1F" stopOpacity="0.55" />
          <stop offset="1" stopColor="#F58A1F" stopOpacity="0" />
        </radialGradient>
      </defs>
      <motion.polygon points={pts(ground)} fill="url(#hero-ground)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} />
      <polygon points={pts(path)} fill="#FFFFFF" opacity={0.85} />
      <Tree x={-0.4} y={-2.4} s={0.9} delay={0.9} />
      <Box x0={1} y0={-2.6} w={4} d={2.6} h={2.4} top="#EEF3FB" left="#7FA2DB" right="#4A78C4" windows={{ rows: 2, cols: 5, lit: [2, 6] }} delay={0.05} />
      <Box x0={0} y0={0} w={6} d={4} h={3.4} top="#F2F6FC" left="#2858A8" right="#153874" windows={{ rows: 3, cols: 6, lit: [1, 4, 9, 14] }} delay={0.15} />
      <Box x0={6} y0={0.6} w={3.2} d={3} h={2.2} top="#EEF3FB" left="#4A78C4" right="#1C4790" windows={{ rows: 2, cols: 3, lit: [4] }} delay={0.3} />
      {/* Portico with columns */}
      <Box x0={2} y0={4} w={2.2} d={0.9} h={2.6} top="#FFFFFF" left="#F5F7FB" right="#D9E4F6" delay={0.45} />
      {[2.25, 2.75, 3.25, 3.75].map((cx) => (
        <motion.polygon
          key={cx}
          points={pts([
            [cx, 4.91, 0.1],
            [cx + 0.18, 4.91, 0.1],
            [cx + 0.18, 4.91, 2.3],
            [cx, 4.91, 2.3],
          ])}
          fill="#C9D6EA"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        />
      ))}
      <motion.polygon
        points={pts([
          [2, 4.9, 2.6],
          [4.2, 4.9, 2.6],
          [3.1, 4.9, 3.45],
        ])}
        fill="#FFFFFF"
        stroke="#D9E4F6"
        strokeWidth={1}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.75 }}
      />
      <motion.polygon
        points={pts([
          [3.1, 4.9, 3.45],
          [3.1, 4, 3.45],
          [4.2, 4, 2.6],
          [4.2, 4.9, 2.6],
        ])}
        fill="#E3ECF9"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.75 }}
      />
      <Tree x={8.8} y={4.6} s={1} delay={1} />
      <Tree x={0.2} y={5.6} s={0.8} delay={1.1} />
      <Tree x={9.6} y={-1.6} s={0.7} delay={1.2} />

      {/* Floating approval seal */}
      <motion.g initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }} transition={{ opacity: { delay: 1.1 }, scale: { delay: 1.1, type: 'spring' }, y: { delay: 1.6, duration: 4, repeat: Infinity, ease: 'easeInOut' } }} style={{ transformOrigin: `${seal[0]}px ${seal[1]}px` }}>
        <circle cx={seal[0]} cy={seal[1]} r={52} fill="url(#hero-glow)" />
        <circle cx={seal[0]} cy={seal[1]} r={27} fill="#FFFFFF" stroke="#F58A1F" strokeWidth={3} />
        <motion.circle cx={seal[0]} cy={seal[1]} r={33} fill="none" stroke="#3DB073" strokeWidth={2} strokeDasharray="6 6" animate={{ rotate: 360 }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: `${seal[0]}px ${seal[1]}px` }} />
        <motion.path d={`M${seal[0] - 11} ${seal[1]} l7 7 l15 -16`} fill="none" stroke="#1E8C4E" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.5, duration: 0.6 }} />
      </motion.g>
    </svg>
  );
}

function Chip({ icon, title, sub, className, delay = 0, tone = 'brand' }: { icon: JSX.Element; title: string; sub: string; className?: string; delay?: number; tone?: 'brand' | 'green' | 'saffron' }) {
  const toneCls = tone === 'green' ? 'bg-indgreen-50 text-indgreen-700' : tone === 'saffron' ? 'bg-saffron-50 text-saffron-700' : 'bg-brand-50 text-brand-700';
  return (
    <motion.div initial={{ opacity: 0, y: 14, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className={cn('absolute', className)}>
      <div className="glass flex animate-float items-center gap-2.5 rounded-2xl border border-white/80 px-3 py-2.5 shadow-lift" style={{ animationDelay: `${delay}s` }}>
        <span className={cn('grid h-8 w-8 place-items-center rounded-xl', toneCls)}>{icon}</span>
        <span className="leading-tight">
          <span className="block text-xs font-bold text-ink">{title}</span>
          <span className="block text-[11px] text-ink-mute">{sub}</span>
        </span>
      </div>
    </motion.div>
  );
}

/** Hero scene: campus + floating live-status chips. */
export function HeroScene() {
  return (
    <div className="hero-art decor relative mx-auto w-full max-w-[580px]">
      <div className="pointer-events-none absolute -inset-10 rounded-full bg-gradient-to-tr from-brand-200/40 via-transparent to-saffron-200/40 blur-3xl" aria-hidden />
      <CampusIllustration className="relative" />
      <Chip icon={<FlaskConical size={16} />} title="Rules v2026.3 live" sub="50 of 50 golden tests passed" className="left-0 top-[6%] sm:-left-4" delay={1.3} />
      <Chip icon={<Dices size={16} />} title="EVC panel drawn" sub="Public drand round · verified" className="right-0 top-[30%] sm:-right-6" delay={1.55} tone="saffron" />
      <Chip icon={<Fingerprint size={16} />} title="Decision sealed" sub="sha256 a91f…3c0e · time-stamped" className="bottom-[4%] left-[4%]" delay={1.8} tone="green" />
      <Chip icon={<BadgeCheck size={16} />} title="On track" sub="ANU-2026-0412 · EVC stage" className="bottom-[18%] right-0 hidden sm:block" delay={2.05} />
    </div>
  );
}
