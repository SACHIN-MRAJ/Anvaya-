import type { Application } from '../types';
import { typeById } from '../data/rules';
import { daysBetween } from './utils';

export const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/** Headline performance numbers. Home and the public performance page both use this, so they always agree. */
export function summarise(apps: Application[]) {
  const decided = apps.filter((a) => a.stage === 'decision');
  const open = apps.filter((a) => a.stage !== 'decision');
  const days = decided.map((a) => daysBetween(a.submittedOn, a.stageEnteredOn));
  const onTime = decided.filter((a) => daysBetween(a.submittedOn, a.stageEnteredOn) <= typeById(a.typeId).targetDays).length;
  return {
    total: apps.length,
    decided: decided.length,
    open: open.length,
    missed: open.filter((a) => a.clock === 'breached').length,
    medianDays: median(days),
    onTimePct: decided.length ? Math.round((onTime / decided.length) * 100) : 0,
  };
}
