import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CloudOff, LogOut, ShieldCheck, Wifi } from 'lucide-react';
import { useSession } from '../lib/session';
import { apiRefresh } from '../services/api';
import { Modal } from './ui';

/** Thin progress bar at the top of the page on every navigation. */
export function RouteProgress() {
  const loc = useLocation();
  return (
    <motion.div
      key={loc.pathname}
      aria-hidden
      className="no-print pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] origin-left bg-gradient-to-r from-saffron-500 via-brand-400 to-indgreen-500"
      initial={{ scaleX: 0, opacity: 1 }}
      animate={{ scaleX: 1, opacity: [1, 1, 0] }}
      transition={{ scaleX: { duration: 0.45, ease: 'easeOut' }, opacity: { duration: 0.75, times: [0, 0.7, 1] } }}
    />
  );
}

/** Tells people when the connection drops and reassures them that drafts are kept. */
export function NetworkBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [justBack, setJustBack] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = () => {
      setOnline(true);
      setJustBack(true);
      timer = setTimeout(() => setJustBack(false), 3500);
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  const show = !online || justBack;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={online ? 'no-print overflow-hidden bg-indgreen-600 text-white' : 'no-print overflow-hidden bg-amber-400 text-brand-950'}
        >
          <p className="container-page flex items-center justify-center gap-2 py-1.5 text-center text-xs font-semibold">
            {online ? <Wifi size={14} /> : <CloudOff size={14} />}
            {online ? 'Back online. Saved drafts are syncing now.' : 'You are offline. Keep working: drafts are saved on this device and sync when you reconnect.'}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const IDLE_MS = 14 * 60_000;
const WARN_SECONDS = 60;

/** Signed-in portals: warn before an idle session ends, as GIGW and CERT-In guidance expect. */
export function SessionGuard() {
  const { signOut } = useSession();
  const nav = useNavigate();
  const [warn, setWarn] = useState(false);
  const [left, setLeft] = useState(WARN_SECONDS);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const arm = () => {
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        setLeft(WARN_SECONDS);
        setWarn(true);
      }, IDLE_MS);
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
    const onActivity = () => !warn && arm();
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    // Lets a presenter show the warning without waiting 14 minutes.
    const test = () => {
      setLeft(WARN_SECONDS);
      setWarn(true);
    };
    window.addEventListener('anumati:idle-test', test);
    arm();
    return () => {
      clearTimeout(idleTimer.current);
      events.forEach((e) => window.removeEventListener(e, onActivity));
      window.removeEventListener('anumati:idle-test', test);
    };
  }, [warn]);

  useEffect(() => {
    if (!warn) return;
    if (left <= 0) {
      setWarn(false);
      signOut();
      nav('/login?reason=timeout');
      return;
    }
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [warn, left, signOut, nav]);

  return (
    <Modal
      open={warn}
      onClose={() => setWarn(false)}
      title="Are you still there?"
      footer={
        <>
          <button
            className="btn-secondary"
            onClick={() => {
              setWarn(false);
              signOut();
              nav('/');
            }}
          >
            <LogOut size={16} /> Sign out now
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              setWarn(false);
              void apiRefresh();
            }}
          >
            <ShieldCheck size={16} /> Stay signed in
          </button>
        </>
      }
    >
      <div className="flex items-center gap-4">
        <div className="relative grid h-16 w-16 shrink-0 place-items-center">
          <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="32" cy="32" r="28" fill="none" stroke="#E2E8F0" strokeWidth="6" />
            <circle cx="32" cy="32" r="28" fill="none" stroke="#F58A1F" strokeWidth="6" strokeLinecap="round" strokeDasharray={176} strokeDashoffset={176 * (1 - left / WARN_SECONDS)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
          </svg>
          <span className="font-display text-lg font-bold tabular-nums text-ink">{left}</span>
        </div>
        <p className="text-sm leading-relaxed text-ink-soft">
          For your security you will be signed out in <b className="text-ink">{left} seconds</b> because there has been no activity. Unsaved form entries stay in your draft on this device.
        </p>
      </div>
    </Modal>
  );
}
