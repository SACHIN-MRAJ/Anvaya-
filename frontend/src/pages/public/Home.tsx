import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Brand } from '../../components/brand';

/* ─── variants ──────────────────────────── */
const navIn   = { hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };
const navChip = { hidden: { opacity: 0, y: -10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } } };
const hCont   = { hidden: {}, visible: { transition: { staggerChildren: 0.15, delayChildren: 0.22 } } };
const hLine   = { hidden: { y: '108%' }, visible: { y: '0%', transition: { duration: 0.70, ease: [0.16, 1, 0.3, 1] } } };

/*
  Stage overlay positions — measured for the image rendered at 130% of container width.
  Image natural aspect: 1344 × 896.
  At 130% of a 650px column → 845px rendered width × 563px height.
  Left crop on each side: (845-650)/2 = 97.5px
  left% = ((845 × img_x_pct) - 97.5) / 650 * 100
  top%  = same as original image percentage (proportional height stays same)
*/
const STAGES = [
  { left:  '3%',  top: '58%', label: 'Document Upload',   color: '#D97706' },
  { left: '20%',  top: '53%', label: 'AI Verification',   color: '#D97706' },
  { left: '43%',  top: '54%', label: 'Expert Committee',  color: '#D97706' },
  { left: '70%',  top: '50%', label: 'Approval Granted',  color: '#059669' },
  { left: '91%',  top: '62%', label: 'Secured & Sealed',  color: '#059669' },
] as const;

function WorkflowIllustration() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % STAGES.length), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden">

      {/* ── Floating image ── */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ y: [0, -12, 0] }}
        transition={{ delay: 1.4, duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Entrance */}
        <motion.div
          className="relative"
          style={{ width: '130%', marginLeft: '-15%' }}
          initial={{ opacity: 0, scale: 0.96, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ delay: 0.3, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Shimmer sweep */}
          <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(108deg, transparent 35%, rgba(255,255,255,0.20) 50%, transparent 65%)',
                backgroundSize: '250% 100%',
              }}
              animate={{ backgroundPosition: ['-150% 0%', '250% 0%'] }}
              transition={{ delay: 1.8, duration: 3.5, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
            />
          </div>

          <img
            src="/workflow.png"
            alt="5-step digital approval workflow — document upload to signed letter"
            className="w-full h-auto block"
            draggable={false}
            style={{ userSelect: 'none' }}
          />

          {/* Stage overlay dots */}
          {STAGES.map((stage, i) => (
            <div
              key={i}
              className="absolute"
              style={{ left: stage.left, top: stage.top, transform: 'translate(-50%,-50%)' }}
            >
              {/* Dual expanding rings */}
              {[0, 0.45].map((d) => (
                <AnimatePresence key={d}>
                  {active === i && (
                    <motion.div
                      key={`r${d}`}
                      className="absolute rounded-full"
                      style={{ width: 44, height: 44, left: -22, top: -22, border: `2px solid ${stage.color}` }}
                      initial={{ scale: 0.5, opacity: 0.85 }}
                      animate={{ scale: 2.6, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.3, repeat: Infinity, ease: 'easeOut', delay: d }}
                    />
                  )}
                </AnimatePresence>
              ))}

              {/* Core dot */}
              <motion.div
                className="rounded-full border-2 border-white"
                style={{ width: 17, height: 17, marginLeft: -8.5, marginTop: -8.5 }}
                animate={{
                  backgroundColor: active === i ? stage.color : 'rgba(180,83,9,0.22)',
                  scale: active === i ? 1.4 : 0.85,
                  boxShadow: active === i
                    ? `0 0 16px ${stage.color}cc, 0 0 32px ${stage.color}44`
                    : 'none',
                }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              />

              {/* Label pill */}
              <AnimatePresence>
                {active === i && (
                  <motion.div
                    key="lbl"
                    className="absolute whitespace-nowrap"
                    style={{ bottom: '145%', left: '50%', x: '-50%' }}
                    initial={{ opacity: 0, y: 8, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.9 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold text-white shadow-xl"
                      style={{ backgroundColor: stage.color }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                      {stage.label}
                    </span>
                    <div className="mx-auto h-[7px] w-[7px] rotate-45" style={{ backgroundColor: stage.color }} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Edge fade masks — clean blend with page bg */}
      <div className="pointer-events-none absolute inset-y-0 left-0  w-[10%] bg-gradient-to-r from-white/70 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[10%] bg-gradient-to-l from-white/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0    h-16   bg-gradient-to-b from-white/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24   bg-gradient-to-t from-white/90 to-transparent" />

      {/* Progress strip + step label — overlaid at bottom of panel */}
      <div className="absolute bottom-5 inset-x-0 flex flex-col items-center gap-2 z-20">
        <div className="flex items-center gap-2">
          {STAGES.map((s, i) => (
            <motion.div
              key={i}
              animate={{
                width: active === i ? 22 : 7,
                backgroundColor:
                  active === i ? '#D97706' : active > i ? '#059669' : '#D4D4D4',
              }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="h-1.5 rounded-full"
            />
          ))}
        </div>

        <div className="h-5 overflow-hidden flex items-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="text-[11px] font-semibold text-neutral-500"
            >
              Step {active + 1} of {STAGES.length} · {STAGES[active].label}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   PAGE — h-screen, no scroll
══════════════════════════════════════════ */
export default function Home() {
  return (
    <div className="home-palette h-screen overflow-hidden flex flex-col bg-white">

      {/* Blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 right-[22%] h-[480px] w-[480px] rounded-full bg-brand-100/30 blur-[160px]" />
        <div className="absolute bottom-10 left-[8%]  h-[340px] w-[340px] rounded-full bg-indgreen-50/35 blur-[130px]" />
      </div>

      {/* Dot grid */}
      <div className="pointer-events-none absolute inset-0 decor"
        style={{ backgroundImage: 'radial-gradient(rgba(217,119,6,0.05) 1px, transparent 1px)', backgroundSize: '36px 36px' }}
        aria-hidden />

      {/* ── Nav ──────────────────────────────── */}
      <motion.header
        variants={navIn} initial="hidden" animate="visible"
        className="relative z-20 shrink-0 flex items-center justify-between px-8 sm:px-14 h-[68px] max-w-[1300px] mx-auto w-full"
      >
        <motion.div variants={navChip}><Brand /></motion.div>
        <nav className="flex items-center gap-1">
          {[{ to: '/solution', label: 'Our Solution' }, { to: '/about', label: 'About' }].map((item) => (
            <motion.div key={item.to} variants={navChip}>
              <Link to={item.to} className="rounded-lg px-4 py-2 text-sm font-semibold text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors">
                {item.label}
              </Link>
            </motion.div>
          ))}
          <motion.div variants={navChip}>
            <Link to="/login"
              className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white hover:bg-brand-700 transition-all"
              style={{ boxShadow: '0 4px 14px rgba(180,83,9,0.28)' }}>
              Get Started <ArrowRight size={14} />
            </Link>
          </motion.div>
        </nav>
      </motion.header>

      {/* ── Two-column layout ────────────────── */}
      <div className="relative z-10 flex-1 min-h-0 max-w-[1300px] mx-auto w-full grid lg:grid-cols-2">

        {/* LEFT — no overflow-hidden on the column so slide-up headline isn't clipped */}
        <div className="flex flex-col justify-center px-8 sm:px-14 pb-[8%]">

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.42 }}
            className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-semibold text-brand-700 w-fit mb-5"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
            AICTE · 3,200+ institutions · 100% auditable
          </motion.div>

          {/* Headline — overflow-hidden only on individual line wrappers */}
          <motion.h1
            variants={hCont} initial="hidden" animate="visible"
            className="font-display font-extrabold tracking-tight"
            style={{ fontSize: 'clamp(2.4rem, 4.0vw, 4.4rem)', lineHeight: 1.06 }}
          >
            {[
              { text: "India's Approval",  grad: false },
              { text: 'Platform. Built',   grad: false },
              { text: 'for Transparency.', grad: true  },
            ].map(({ text, grad }, i) => (
              <div key={i} style={{ overflow: 'hidden', lineHeight: 1.16, paddingBottom: '0.06em' }}>
                <motion.span variants={hLine}
                  className={`block ${grad
                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-brand-700 via-brand-600 to-brand-400'
                    : 'text-neutral-900'}`}>
                  {text}
                </motion.span>
              </div>
            ))}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.76, duration: 0.5 }}
            className="mt-5 text-base sm:text-lg leading-relaxed text-neutral-500 max-w-[400px]"
          >
            One platform for every AICTE institution — from first application to the final signed approval letter.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.94, duration: 0.48 }}
            className="mt-7 flex items-center gap-4 flex-wrap"
          >
            <Link to="/login"
              className="inline-flex items-center gap-2.5 rounded-full bg-brand-600 px-8 py-3.5 text-base font-bold text-white hover:bg-brand-700 active:scale-[0.98] transition-all"
              style={{ boxShadow: '0 8px 24px rgba(180,83,9,0.26)' }}>
              Get Started
              <motion.span
                animate={{ x: [0, 4, 0] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut', repeatDelay: 0.6 }}>
                <ArrowRight size={17} />
              </motion.span>
            </Link>
            <Link to="/solution" className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-neutral-900 transition-colors">
              See 19 innovations <ArrowRight size={14} />
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
            className="mt-9 flex items-center gap-7 pt-6 border-t border-neutral-100"
          >
            {[
              { n: '3,200+', label: 'Institutions' },
              { n: '94%',    label: 'On-time'       },
              { n: '100%',   label: 'Verifiable'    },
            ].map(({ n, label }, i) => (
              <div key={i} className="flex flex-col">
                <span className="text-xl font-extrabold text-neutral-900">{n}</span>
                <span className="text-xs text-neutral-400 mt-0.5">{label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* RIGHT — full height, illustration fills it completely */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.7 }}
          className="hidden lg:block h-full border-l border-neutral-100/50 relative"
          style={{
            background: 'linear-gradient(155deg, rgba(255,251,235,0.55) 0%, rgba(255,255,255,0.95) 50%, rgba(255,251,235,0.40) 100%)',
          }}
        >
          <WorkflowIllustration />
        </motion.div>
      </div>
    </div>
  );
}
