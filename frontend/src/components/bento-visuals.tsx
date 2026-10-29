import { motion } from 'framer-motion';
import { Check, Pause } from 'lucide-react';

/** Small illustrations for the dark “what makes ANUMATI different” grid. Decorative: hidden from screen readers. */

export function RuleCodeVisual() {
  return (
    <div className="rounded-2xl border border-white/10 bg-brand-950/60 p-4 font-mono text-[12px] leading-relaxed" aria-hidden>
      <p>
        <span className="text-saffron-300">rule</span> <span className="text-white">intake_increase</span> <span className="text-brand-300">// APH 2.6, Table 2.3</span>
      </p>
      <p className="pl-4">
        <span className="text-brand-300">when</span> <span className="text-white">type</span> = <span className="text-indgreen-400">"intake"</span>
      </p>
      <p className="pl-4">
        <span className="text-brand-300">path</span> = [<span className="text-indgreen-400">Scrutiny</span>, <span className="text-indgreen-400">EVC</span>, <span className="text-indgreen-400">EC</span>]
      </p>
      <motion.p initial={{ opacity: 0.4 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.4 }} className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-indgreen-500/15 px-2 py-0.5 text-indgreen-400">
        <Check size={12} /> 50 / 50 golden tests pass
      </motion.p>
    </div>
  );
}

export function ClockVisual() {
  const c = 2 * Math.PI * 26;
  return (
    <div className="flex items-center gap-4" aria-hidden>
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
          <motion.circle cx="32" cy="32" r="26" fill="none" stroke="#FFA24C" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} whileInView={{ strokeDashoffset: c * 0.38 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: 'easeOut' }} />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-saffron-300">
          <Pause size={18} />
        </span>
      </div>
      <div className="text-xs leading-relaxed text-brand-200">
        <p className="font-semibold text-white">Paused · 9 days left</p>
        <p>waiting on the college</p>
      </div>
    </div>
  );
}

export function ChainVisual() {
  return (
    <div className="flex items-center" aria-hidden>
      {['a91f', '3c0e', '7b2d'].map((h, i) => (
        <div key={h} className="flex items-center">
          <motion.div initial={{ opacity: 0.4, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }} className="rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-center">
            <p className="text-[10px] text-brand-300">#{i + 1}</p>
            <p className="font-mono text-[11px] text-white">{h}…</p>
          </motion.div>
          {i < 2 && <span className="h-0.5 w-4 bg-gradient-to-r from-saffron-400 to-indgreen-400" />}
        </div>
      ))}
    </div>
  );
}

export function DrawVisual() {
  return (
    <div className="flex flex-wrap gap-1.5" aria-hidden>
      {['RK', 'AS', 'MP', 'NI', 'VD', 'SJ'].map((n, i) => {
        const chosen = [1, 3, 4].includes(i);
        return (
          <motion.span
            key={n}
            initial={{ opacity: 0.5 }}
            whileInView={{ opacity: 1, scale: chosen ? 1.08 : 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.08 }}
            className={chosen ? 'grid h-8 w-8 place-items-center rounded-full bg-saffron-400 text-[10px] font-bold text-brand-950' : 'grid h-8 w-8 place-items-center rounded-full border border-white/15 text-[10px] font-semibold text-brand-200'}
          >
            {n}
          </motion.span>
        );
      })}
    </div>
  );
}

export function FlowVisual() {
  const nodes = [
    { x: 14, label: 'Scrutiny', hot: false },
    { x: 70, label: 'Re-check', hot: true },
    { x: 126, label: 'EVC', hot: false },
  ];
  return (
    <svg viewBox="0 0 140 44" className="h-12 w-full max-w-[220px]" aria-hidden>
      <line x1="14" y1="16" x2="126" y2="16" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
      <motion.line x1="14" y1="16" x2="126" y2="16" stroke="#FFA24C" strokeWidth="2" strokeDasharray="4 6" animate={{ strokeDashoffset: [0, -20] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} />
      {nodes.map((n) => (
        <g key={n.label}>
          <circle cx={n.x} cy="16" r={n.hot ? 8 : 6} fill={n.hot ? '#F58A1F' : '#2858A8'} stroke="#0A1D42" strokeWidth="2" />
          <text x={n.x} y="38" textAnchor="middle" fontSize="8" fill={n.hot ? '#FFCB91' : '#B3C8EC'}>
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function ChatVisual() {
  return (
    <div className="space-y-1.5 text-xs" aria-hidden>
      <p className="ml-auto w-fit rounded-xl rounded-tr-sm bg-white/10 px-3 py-1.5 text-white">Which documents for a change of site?</p>
      <p className="w-fit max-w-[90%] rounded-xl rounded-tl-sm bg-saffron-400 px-3 py-1.5 text-brand-950">Seven, starting with the new land deed. <b>APH 2.17</b></p>
    </div>
  );
}

export function AccessVisual() {
  return (
    <div className="flex flex-wrap items-end gap-3" aria-hidden>
      <span className="flex items-end gap-1 text-white">
        <span className="text-xs">A</span>
        <span className="text-base">A</span>
        <span className="text-xl font-bold">A</span>
      </span>
      {['हिन्दी', 'English', 'தமிழ்', 'বাংলা'].map((l) => (
        <span key={l} className="rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] text-brand-200">
          {l}
        </span>
      ))}
    </div>
  );
}
