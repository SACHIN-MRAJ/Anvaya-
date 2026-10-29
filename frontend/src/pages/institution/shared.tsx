import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { CalendarPlus, Check, CheckCircle2, CircleDashed, Clock, ScanText } from 'lucide-react';
import type { Application } from '../../types';
import { evaluatePath, baselineTable } from '../../data/rules';
import { addDays, cn, daysBetween, formatDate, TODAY } from '../../lib/utils';

/** Stage path for an application, computed from the rules (not hard-coded per screen). */
export function pathFor(app: Application): string[] {
  const path = evaluatePath(baselineTable(), { typeId: app.typeId, deficienciesFound: app.deficiencies > 0 || app.stage === 'rescrutiny', appeal: app.stage === 'appeal' });
  return ['Submitted', ...path, 'Decision'];
}

const STAGE_TO_STEP: Record<Application['stage'], string> = {
  submitted: 'Submitted',
  scrutiny: 'Scrutiny',
  rescrutiny: 'Re-scrutiny',
  evc: 'EVC',
  shc: 'SHC',
  ec: 'Executive Committee',
  decision: 'Decision',
  appeal: 'SAC appeal',
};

export function currentIndex(app: Application, path: string[]): number {
  if (app.stage === 'decision') return path.length - 1;
  const step = STAGE_TO_STEP[app.stage];
  const i = path.indexOf(step);
  if (i >= 0) return i;
  return app.stage === 'submitted' ? 0 : 1;
}

export function MiniProgress({ app }: { app: Application }) {
  const path = pathFor(app);
  const cur = currentIndex(app, path);
  return (
    <div className="flex items-center gap-1" aria-label={`Stage ${cur + 1} of ${path.length}: ${path[cur]}`}>
      {path.map((p, i) => (
        <motion.span
          key={p + i}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: i * 0.05 }}
          title={p}
          className={cn('h-1.5 flex-1 origin-left rounded-full', i < cur ? 'bg-brand-600' : i === cur ? (app.clock === 'paused' ? 'bg-amber-500' : app.clock === 'breached' ? 'bg-red-600' : app.stage === 'decision' ? 'bg-indgreen-500' : 'bg-brand-400') : 'bg-slate-200')}
        />
      ))}
    </div>
  );
}

const STEP_DAYS: Record<string, number> = { 'Self-disclosure': 10, Scrutiny: 15, 'Re-scrutiny': 10, EVC: 30, SHC: 15, 'Executive Committee': 10, 'SAC appeal': 7 };

/**
 * Expected decision date, like a parcel's delivery window: the current stage's due date plus the
 * target days of every stage still ahead. The window widens with the file's delay risk.
 */
export function expectedDecision(app: Application) {
  if (app.stage === 'decision') return null;
  const path = pathFor(app);
  const cur = currentIndex(app, path);
  const ahead = path.slice(cur + 1, -1).reduce((s, p) => s + (STEP_DAYS[p] ?? 10), 0);
  // A paused clock waits on the institution; assume a typical one-week reply.
  const stageEnd = app.clock === 'paused' ? addDays(TODAY, 7) : app.dueOn < TODAY ? addDays(TODAY, 5) : app.dueOn;
  const likely = addDays(stageEnd, ahead);
  return { likely, early: addDays(likely, -4), late: addDays(likely, 5 + Math.round(app.risk * 20)), start: app.submittedOn };
}

export function DecisionEta({ app, onCalendar }: { app: Application; onCalendar?: () => void }) {
  const eta = expectedDecision(app);
  if (!eta) return null;
  const span = Math.max(1, daysBetween(eta.start, eta.late));
  const at = (d: string) => `${Math.min(100, Math.max(0, (daysBetween(eta.start, d) / span) * 100))}%`;
  return (
    <div>
      <p className="text-xs font-semibold text-ink-mute">Expected decision</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink">{formatDate(eta.likely)}</p>
      <p className="text-xs text-ink-mute">
        Most likely between {formatDate(eta.early)} and {formatDate(eta.late)}
      </p>
      <div className="relative mt-5 h-2 rounded-full bg-slate-100" aria-hidden>
        <motion.span className="absolute inset-y-0 left-0 rounded-full bg-brand-600" initial={{ width: 0 }} animate={{ width: at(TODAY) }} transition={{ duration: 0.9, ease: 'easeOut' }} />
        <span className="absolute inset-y-0 rounded-full bg-saffron-200/80" style={{ left: at(eta.early), right: `calc(100% - ${at(eta.late)})` }} />
        <motion.span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-saffron-500 shadow" style={{ left: at(eta.likely) }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.7, type: 'spring' }} />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink-mute">
        <span>{formatDate(eta.start)}</span>
        <span>{formatDate(eta.late)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-mute">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-full bg-brand-600" /> Time so far
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-full bg-saffron-200" /> Likely window
        </span>
      </div>
      {app.clock === 'paused' && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Assumes you reply within 7 days. Replying sooner brings this date forward.</p>}
      {onCalendar && (
        <button onClick={onCalendar} className="btn-secondary btn-sm mt-4 w-full">
          <CalendarPlus size={14} /> Add to my calendar
        </button>
      )}
    </div>
  );
}

/** Full 6-stage application timeline matching the workflow diagram.
 *  Shows AI Verification as an explicit step between Document Upload and Officer Scrutiny. */
export function ApplicationTimeline({ app }: { app: Application }) {
  const eta = expectedDecision(app);
  const aiVerified = app.history.some((h) => h.action.toLowerCase().includes('submitted'));

  // Build the 6 canonical stages with dates and status
  const submittedDate = app.submittedOn;
  const path = pathFor(app);
  const cur = currentIndex(app, path);
  const isDecided = app.stage === 'decision';

  // Pre-compute expected dates to avoid IIFE side-effects in array literals
  const rolling = app.dueOn < TODAY ? addDays(TODAY, 3) : app.dueOn;
  const evcExpected = path.includes('EVC') ? addDays(rolling, 30) : null;
  const scrutinyIdx = path.indexOf('Scrutiny');
  const evcIdx = path.indexOf('EVC');

  type TimelineStage = {
    key: string; label: string; sublabel: string;
    date: string | null; expectedDate: string | null;
    status: 'done' | 'active' | 'pending' | 'ai';
    icon?: ReactNode;
  };

  const stages: TimelineStage[] = [
    {
      key: 'submitted', label: 'Application Submitted', sublabel: 'Receipt issued',
      date: submittedDate, expectedDate: null, status: 'done',
    },
    {
      key: 'ai', label: 'AI Verification', sublabel: 'OCR · NLP · Rules · ML',
      date: aiVerified ? submittedDate : null,
      expectedDate: aiVerified ? null : submittedDate,
      status: aiVerified ? 'ai' : 'pending',
      icon: <ScanText size={14} />,
    },
    {
      key: 'scrutiny',
      label: 'Officer Scrutiny',
      sublabel: 'Documents checked against APH',
      date: (path.includes('Scrutiny') && cur >= scrutinyIdx) || isDecided ? addDays(submittedDate, 2) : null,
      expectedDate: path.includes('Scrutiny') ? addDays(submittedDate, 15) : null,
      status: isDecided ? 'done' : app.stage === 'scrutiny' || app.stage === 'rescrutiny' ? 'active' : cur > scrutinyIdx ? 'done' : 'pending',
    },
    {
      key: 'evc',
      label: 'EVC Inspection',
      sublabel: path.includes('EVC') ? 'Expert visit required' : 'Not required for this type',
      date: isDecided && path.includes('EVC') ? addDays(submittedDate, 45) : null,
      expectedDate: evcExpected,
      status: !path.includes('EVC') ? 'pending' : isDecided ? 'done' : app.stage === 'evc' ? 'active' : cur > evcIdx ? 'done' : 'pending',
    },
    {
      key: 'ec',
      label: 'Final Decision',
      sublabel: 'Executive Committee',
      date: isDecided ? app.stageEnteredOn : null,
      expectedDate: eta ? eta.likely : null,
      status: isDecided ? 'done' : app.stage === 'ec' ? 'active' : 'pending',
    },
  ];

  return (
    <div className="relative">
      {/* Vertical connector line — runs from first icon centre to last icon centre */}
      <div className="absolute left-[19px] top-[18px] h-[calc(100%-36px)] w-0.5 bg-slate-100" aria-hidden />
      <ol className="space-y-0">
        {stages.map((s, idx) => {
          const isDone = s.status === 'done' || s.status === 'ai';
          const isActive = s.status === 'active';
          const isPending = s.status === 'pending';
          return (
            <motion.li
              key={s.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.07 }}
              className="relative flex gap-4 pb-5 last:pb-0"
            >
              {/* Icon bubble */}
              <div className={cn(
                'relative z-10 mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 transition-all',
                isDone ? 'border-indgreen-600 bg-indgreen-600 text-white' :
                isActive ? (app.clock === 'paused' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-brand-600 bg-brand-50 text-brand-700') :
                'border-slate-200 bg-white text-slate-400'
              )}>
                {isDone
                  ? (s.status === 'ai' ? <ScanText size={15} /> : <CheckCircle2 size={15} />)
                  : isActive
                    ? (s.icon ?? <Clock size={14} />)
                    : (s.icon ?? <CircleDashed size={14} />)
                }
                {isActive && <span className="absolute inset-0 animate-ping rounded-full bg-brand-400 opacity-25" />}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('font-semibold text-sm', isDone ? 'text-ink' : isActive ? 'text-brand-800' : 'text-ink-mute')}>
                    {s.label}
                  </span>
                  {isActive && (
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      app.clock === 'paused' ? 'bg-amber-100 text-amber-800' : 'bg-brand-100 text-brand-800'
                    )}>
                      {app.clock === 'paused' ? 'Waiting on you' : 'In progress'}
                    </span>
                  )}
                  {isDone && s.key !== 'submitted' && (
                    <span className="rounded-full bg-indgreen-50 px-2 py-0.5 text-[10px] font-semibold text-indgreen-700">
                      {s.status === 'ai' ? 'Verified' : 'Done'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-mute">{s.sublabel}</p>
                {s.date && (
                  <p className="mt-0.5 text-xs font-medium text-ink-soft">
                    {formatDate(s.date)}
                  </p>
                )}
                {!s.date && s.expectedDate && !isPending && (
                  <p className="mt-0.5 text-xs text-ink-mute">
                    Expected by {formatDate(s.expectedDate)}
                  </p>
                )}
                {isPending && s.expectedDate && (
                  <p className="mt-0.5 text-xs text-ink-mute">
                    Expected {formatDate(s.expectedDate)}
                  </p>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

export function Stepper({ app }: { app: Application }) {
  const path = pathFor(app);
  const cur = currentIndex(app, path);
  return (
    <ol className="flex w-full items-start overflow-x-auto pb-2 scroll-thin">
      {path.map((p, i) => {
        const done = i < cur || app.stage === 'decision';
        const active = i === cur && app.stage !== 'decision';
        return (
          <li key={p + i} className="relative flex min-w-[110px] flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span className="absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 bg-slate-200" aria-hidden>
                <motion.span className="block h-full bg-brand-600" initial={{ width: 0 }} animate={{ width: i <= cur ? '100%' : '0%' }} transition={{ duration: 0.5, delay: i * 0.12 }} />
              </span>
            )}
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.12 }}
              className={cn(
                'relative z-10 grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-bold',
                done ? 'border-brand-700 bg-brand-700 text-white' : active ? (app.clock === 'paused' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-brand-600 bg-white text-brand-700') : 'border-slate-300 bg-white text-slate-400',
              )}
            >
              {done ? <Check size={15} /> : i + 1}
              {active && <span className={cn('absolute inset-0 animate-ping rounded-full opacity-30', app.clock === 'paused' ? 'bg-amber-400' : 'bg-brand-400')} />}
            </motion.span>
            <span className={cn('mt-2 px-1 text-xs font-medium leading-tight', active ? 'text-ink' : done ? 'text-ink-soft' : 'text-ink-mute')}>{p}</span>
          </li>
        );
      })}
    </ol>
  );
}
