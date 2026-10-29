import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ThumbsDown, ThumbsUp } from 'lucide-react';
import { sendFeedback } from '../services/api';

/** “Was this page helpful?” — a GIGW feedback mechanism on every public page. */
export function PageFeedback() {
  const loc = useLocation();
  const [state, setState] = useState<Record<string, 'yes' | 'no'>>({});
  const v = state[loc.pathname];
  const vote = (helpful: boolean) => {
    setState((s) => ({ ...s, [loc.pathname]: helpful ? 'yes' : 'no' }));
    void sendFeedback(loc.pathname, helpful).catch(() => undefined); // counted on the server for the content team
  };
  return (
    <div className="container-page no-print">
      <div className="mt-14 flex min-h-[64px] flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 sm:flex-row">
        {!v ? (
          <>
            <p className="text-sm font-medium text-ink-soft">Was this page helpful?</p>
            <div className="flex gap-2">
              <button className="btn-secondary btn-sm" onClick={() => vote(true)}>
                <ThumbsUp size={14} /> Yes
              </button>
              <button className="btn-secondary btn-sm" onClick={() => vote(false)}>
                <ThumbsDown size={14} /> No
              </button>
            </div>
          </>
        ) : (
          <motion.p key="thanks" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex w-full items-center justify-center gap-2 text-sm font-medium text-indgreen-700">
            <motion.span initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ duration: 0.5 }}>
              <Heart size={16} className="fill-indgreen-500 text-indgreen-500" />
            </motion.span>
            {v === 'yes' ? 'Thank you. Your feedback helps us improve.' : 'Thank you. We will use this to make the page clearer.'}
          </motion.p>
        )}
      </div>
    </div>
  );
}
