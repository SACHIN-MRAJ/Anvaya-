import type { Application } from '../../types';

const KEY = 'anumati.focus';

/** Most urgent first: missed deadlines, then highest delay risk, then nearest due date. Paused files wait on institutions. */
export function priorityOrder(apps: Application[]): Application[] {
  const rank = (a: Application) => (a.clock === 'breached' ? 0 : a.clock === 'running' ? 1 : 2);
  return [...apps].filter((a) => a.stage !== 'decision').sort((a, b) => rank(a) - rank(b) || b.risk - a.risk || a.dueOn.localeCompare(b.dueOn));
}

/** Starts focus mode over the given files and returns the first one to open. */
export function startFocus(apps: Application[]): string | undefined {
  const ids = priorityOrder(apps).map((a) => a.id);
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* focus mode then lasts for this page only */
  }
  return ids[0];
}

export function focusPosition(id: string): { index: number; total: number; next?: string; prev?: string } | null {
  try {
    const ids = JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as string[];
    const index = ids.indexOf(id);
    if (index < 0) return null;
    return { index, total: ids.length, next: ids[index + 1], prev: ids[index - 1] };
  } catch {
    return null;
  }
}

export function endFocus() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
