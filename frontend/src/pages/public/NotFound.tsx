import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Search } from 'lucide-react';
import { openPalette } from '../../components/palette';

/** A compass whose needle searches, then settles. */
function LostCompass() {
  return (
    <svg viewBox="0 0 160 160" className="decor h-40 w-40" aria-hidden>
      <defs>
        <linearGradient id="nf-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F58A1F" />
          <stop offset="100%" stopColor="#1E8C4E" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="80" r="70" fill="#EEF3FB" />
      <motion.circle cx="80" cy="80" r="70" fill="none" stroke="url(#nf-ring)" strokeWidth="5" strokeLinecap="round" strokeDasharray="330 440" initial={{ rotate: 0 }} animate={{ rotate: 360 }} transition={{ duration: 14, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: '80px 80px' }} />
      {[0, 90, 180, 270].map((a) => (
        <rect key={a} x="78" y="18" width="4" height="10" rx="2" fill="#7FA2DB" transform={`rotate(${a} 80 80)`} />
      ))}
      <motion.g style={{ transformOrigin: '80px 80px' }} initial={{ rotate: -40 }} animate={{ rotate: [-40, 70, -20, 35, 10] }} transition={{ duration: 2.6, ease: 'easeInOut' }}>
        <path d="M80 34 L89 80 L80 88 L71 80 Z" fill="#0A1D42" />
        <path d="M80 126 L89 80 L80 72 L71 80 Z" fill="#F58A1F" />
      </motion.g>
      <circle cx="80" cy="80" r="6" fill="#fff" stroke="#0A1D42" strokeWidth="2" />
    </svg>
  );
}

export default function NotFound() {
  return (
    <div className="container-page grid place-items-center py-20 text-center">
      <LostCompass />
      <p className="mt-6 font-display text-sm font-bold uppercase tracking-[0.2em] text-saffron-700">Error 404</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">This page has moved or never existed</h1>
      <p className="mt-3 max-w-md text-ink-mute">Search for what you need, or pick one of the most used pages below.</p>
      <button onClick={openPalette} className="btn-primary mt-6">
        <Search size={16} /> Search the portal <span className="kbd ml-1 border-white/30 bg-white/10 text-white">Ctrl K</span>
      </button>
      <ul className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
        {[
          ['Track or verify', '/verify'],
          ['Is my college approved?', '/institutions'],
          ['What an application needs', '/rules'],
        ].map(([l, to]) => (
          <li key={to}>
            <Link to={to} className="card card-hover group flex items-center justify-between px-4 py-3 text-sm font-semibold text-ink">
              {l} <ArrowRight size={15} className="text-brand-600 transition-transform group-hover:translate-x-1" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
