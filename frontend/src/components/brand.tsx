import { useId } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

/**
 * ANUMATI mark: an "A" for approval whose crossbar is a check, a green "approved"
 * node at the apex, and a tracking ring that is three-quarters complete.
 */
export function LogoMark({ size = 40, animated = false, className }: { size?: number; animated?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '');
  const draw = animated ? { initial: { pathLength: 0 }, animate: { pathLength: 1 } } : {};
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`bg${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2858A8" />
          <stop offset="0.55" stopColor="#0F2A5A" />
          <stop offset="1" stopColor="#06122B" />
        </linearGradient>
        <linearGradient id={`hl${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`arc${id}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#F58A1F" />
          <stop offset="1" stopColor="#3DB073" />
        </linearGradient>
        <linearGradient id={`tick${id}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#FFCB91" />
          <stop offset="1" stopColor="#F58A1F" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="17" fill={`url(#bg${id})`} />
      <rect x="2" y="2" width="60" height="28" rx="17" fill={`url(#hl${id})`} />
      <motion.circle
        cx="32"
        cy="33"
        r="22"
        fill="none"
        stroke={`url(#arc${id})`}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="104 34.2"
        transform="rotate(115 32 33)"
        {...(animated ? { initial: { strokeDashoffset: 138 }, animate: { strokeDashoffset: 0 }, transition: { duration: 1.4, ease: 'easeOut' } } : {})}
      />
      <motion.path d="M20.5 45.5 L32 19.5 L43.5 45.5" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" {...draw} transition={{ duration: 0.8, ease: 'easeOut' }} />
      <motion.path d="M25.2 36.8 L30.3 41.2 L40.2 30.6" fill="none" stroke={`url(#tick${id})`} strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" {...draw} transition={{ duration: 0.6, delay: 0.6, ease: 'easeOut' }} />
      <motion.circle cx="32" cy="19.5" r="3.7" fill="#3DB073" stroke="#fff" strokeWidth="1.6" {...(animated ? { initial: { scale: 0 }, animate: { scale: 1 }, transition: { delay: 0.9, type: 'spring', stiffness: 300 } } : {})} />
    </svg>
  );
}

export function Wordmark({ light = false, compact = false, sub }: { light?: boolean; compact?: boolean; sub?: string }) {
  return (
    <span className="leading-none">
      <span className={cn('block font-display font-extrabold tracking-[0.16em]', compact ? 'text-[15px]' : 'text-[19px]', light ? 'text-white' : 'text-ink')}>ANUMATI</span>
      {!compact && (
        <span className={cn('mt-1 block text-[11px] font-medium tracking-wide', light ? 'text-brand-200' : 'text-neutral-500')}>
          <span className="font-semibold" lang="hi">
            अनुमति
          </span>
          <span className="mx-1.5 opacity-50">·</span>
          {sub ?? 'Approvals and Norms Monitoring'}
        </span>
      )}
    </span>
  );
}

export function Brand({ compact = false, light = false, to = '/' }: { compact?: boolean; light?: boolean; to?: string }) {
  return (
    <Link to={to} className="group flex items-center gap-3" aria-label="ANUMATI home">
      <motion.span whileHover={{ rotate: -6, scale: 1.05 }} transition={{ type: 'spring', stiffness: 300 }}>
        <LogoMark size={compact ? 34 : 42} />
      </motion.span>
      <Wordmark light={light} compact={compact} />
    </Link>
  );
}

/** Official AICTE logo (downloaded from aicte.gov.in). Dark text for light backgrounds, white text for dark. */
export function AicteLogo({ variant = 'dark', className }: { variant?: 'dark' | 'light'; className?: string }) {
  return (
    <img
      src={variant === 'dark' ? '/brand/aicte-logo-dark-text.png' : '/brand/aicte-logo.png'}
      alt="All India Council for Technical Education (AICTE)"
      className={cn('h-8 w-auto select-none', className)}
      draggable={false}
    />
  );
}
