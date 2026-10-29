import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BadgeCheck, CheckCircle2, Clock3, Fingerprint, FolderLock, Languages, MessageCircle, PhoneCall, QrCode as QrIcon, ScanLine, Smartphone, Sparkles } from 'lucide-react';
import { Phone } from './channels';
import { QrCode, verifyUrl } from './qr';
import { openAssistant } from './assistant';
import { cn } from '../lib/utils';

/** A miniature decision letter that gets scanned and stamped genuine. */
function LetterPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <motion.div initial={{ rotate: -2, y: 12, opacity: 0.4 }} animate={{ rotate: -2, y: 0, opacity: 1 }} transition={{ duration: 0.5 }} className="keep-light overflow-hidden rounded-2xl border border-slate-200 bg-white text-ink shadow-lift">
        <div className="tricolour" />
        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <span className="h-2.5 w-24 rounded-full bg-slate-200" />
            <span className="h-2.5 w-14 rounded-full bg-slate-200" />
          </div>
          <div className="space-y-1.5">
            <span className="block h-2 w-40 rounded-full bg-slate-100" />
            <span className="block h-2 w-52 rounded-full bg-slate-100" />
          </div>
          <div className="rounded-xl bg-indgreen-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indgreen-700">Decision</p>
            <p className="font-display text-sm font-bold text-indgreen-700">Extension of Approval granted</p>
          </div>
          <div className="space-y-1.5">
            <span className="block h-2 w-full rounded-full bg-slate-100" />
            <span className="block h-2 w-11/12 rounded-full bg-slate-100" />
            <span className="block h-2 w-3/4 rounded-full bg-slate-100" />
          </div>
          <div className="flex items-center gap-3">
            <div className="relative overflow-hidden rounded-lg border border-slate-200 p-1">
              <QrCode value={verifyUrl('ANU-2026-0117')} size={64} />
              <motion.span className="absolute inset-x-0 h-6 bg-gradient-to-b from-transparent via-saffron-400/40 to-transparent" animate={{ top: ['-20%', '100%'] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} aria-hidden />
            </div>
            <p className="font-mono text-[10px] leading-relaxed text-slate-500">
              sha256
              <br />
              a91f0c3e…5e4f
            </p>
          </div>
        </div>
      </motion.div>
      <motion.div
        initial={{ scale: 1.8, rotate: -24, opacity: 0 }}
        animate={{ scale: 1, rotate: -12, opacity: 1 }}
        transition={{ delay: 0.6, type: 'spring', stiffness: 260, damping: 16 }}
        className="absolute -right-3 top-24 grid h-28 w-28 place-items-center rounded-full border-4 border-indgreen-600 bg-white/90 text-center text-indgreen-700 shadow-lift"
        aria-hidden
      >
        <span>
          <BadgeCheck size={26} className="mx-auto" />
          <span className="mt-0.5 block text-[11px] font-extrabold uppercase tracking-[0.18em]">Genuine</span>
          <span className="block text-[9px] font-semibold">22 Oct 2026</span>
        </span>
      </motion.div>
    </div>
  );
}

interface Tab {
  id: string;
  label: string;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  points: { icon: ReactNode; t: string; d: string }[];
  cta: ReactNode;
  note: string;
  visual: ReactNode;
}

/** “See it in action”: three everyday moments, one section. */
export function Showcase({ tracker }: { tracker: ReactNode }) {
  const tabs: Tab[] = [
    {
      id: 'track',
      label: 'Track live',
      icon: <Clock3 size={16} />,
      eyebrow: 'For institutions',
      title: 'See exactly where your file is, and who has it',
      points: [
        { icon: <Clock3 size={18} />, t: 'Three plain statuses', d: 'Ongoing, Action needed or Decision issued. No guessing.' },
        { icon: <Sparkles size={18} />, t: 'An expected decision date', d: 'A delivery-style window that moves as the file moves.' },
        { icon: <Fingerprint size={18} />, t: 'Every step on record', d: 'Each action is hash-chained in a tamper-evident log.' },
      ],
      cta: (
        <Link to="/login?portal=institution" className="btn-primary">
          Open the institution portal <ArrowRight size={16} />
        </Link>
      ),
      note: 'Sign in with your AICTE ID',
      visual: tracker,
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: <MessageCircle size={16} />,
      eyebrow: 'No app, no English needed',
      title: 'Ask on WhatsApp, in your own language',
      points: [
        { icon: <Languages size={18} />, t: 'Voice notes in 22 languages', d: 'Speech and translation run on Bhashini, the Government of India’s language platform.' },
        { icon: <Smartphone size={18} />, t: 'SMS for any phone', d: 'Text ANU and your reference to the AICTE short code.' },
        { icon: <PhoneCall size={18} />, t: 'Missed call', d: 'Get a call back in your language with the same answers.' },
      ],
      cta: (
        <button onClick={openAssistant} className="btn-primary">
          Try Ask ANUMATI <ArrowRight size={16} />
        </button>
      ),
      note: 'Works on any phone',
      visual: <Phone />,
    },
    {
      id: 'verify',
      label: 'Verify a letter',
      icon: <ScanLine size={16} />,
      eyebrow: 'For students, banks and employers',
      title: 'Check any approval letter in seconds',
      points: [
        { icon: <QrIcon size={18} />, t: 'Scan the QR or type the number', d: 'The official record answers, not the paper.' },
        { icon: <Fingerprint size={18} />, t: 'Any change is caught', d: 'Edit one letter of the file and its fingerprint no longer matches.' },
        { icon: <FolderLock size={18} />, t: 'In DigiLocker too', d: 'Letters are issued to DigiLocker and as verifiable credentials.' },
      ],
      cta: (
        <Link to="/verify" className="btn-primary">
          Verify a letter <ArrowRight size={16} />
        </Link>
      ),
      note: 'Free, no sign-in needed',
      visual: <LetterPreview />,
    },
  ];
  const [active, setActive] = useState(tabs[0].id);
  const tab = tabs.find((x) => x.id === active)!;

  return (
    <section className="container-page py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow justify-center">
          <span className="h-1.5 w-1.5 rounded-full bg-saffron-500" />
          See it in action
        </p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Three everyday moments, made simple</h2>
      </div>
      <div className="mt-8 flex justify-center">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1 scroll-thin" role="tablist" aria-label="Examples">
          {tabs.map((x) => (
            <button key={x.id} role="tab" aria-selected={active === x.id} onClick={() => setActive(x.id)} className={cn('relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors', active === x.id ? 'text-brand-800' : 'text-ink-mute hover:text-ink')}>
              {active === x.id && <motion.span layoutId="showcase-pill" className="absolute inset-0 rounded-xl bg-white shadow-card" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
              <span className="relative">{x.icon}</span>
              <span className="relative">{x.label}</span>
            </button>
          ))}
        </div>
      </div>

      <motion.div key={tab.id} role="tabpanel" initial={{ opacity: 0.3, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="mt-14 grid items-center gap-14 lg:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-saffron-700">{tab.eyebrow}</p>
          <h3 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{tab.title}</h3>
          <ul className="mt-8 space-y-5">
            {tab.points.map((pt, i) => (
              <motion.li key={pt.t} initial={{ opacity: 0.3, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.07 }} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">{pt.icon}</span>
                <span>
                  <span className="block font-display font-bold text-ink">{pt.t}</span>
                  <span className="text-sm leading-relaxed text-ink-mute">{pt.d}</span>
                </span>
              </motion.li>
            ))}
          </ul>
          <div className="mt-9 flex items-center gap-3">
            {tab.cta}
            <span className="flex items-center gap-1.5 text-xs text-ink-mute">
              <CheckCircle2 size={14} className="text-indgreen-600" /> {tab.note}
            </span>
          </div>
        </div>
        <div className="flex justify-center">{tab.visual}</div>
      </motion.div>
    </section>
  );
}
