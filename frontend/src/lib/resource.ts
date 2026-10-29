import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { apiMode } from '../services/api';

/**
 * Live data with an instant first paint (stale-while-revalidate).
 *
 * A screen renders its built-in data straight away, the server's answer replaces it as soon as it arrives, and
 * every screen reading the same key shares one copy. After a change (a calendar revision, a published rule…)
 * `invalidate('calendar')` makes every open screen fetch again. If the server cannot be reached the built-in
 * data simply stays, so the site never goes blank.
 */
export type Source = 'built-in' | 'server';
interface Entry {
  data: unknown;
  source: Source;
  fetchedAt: number;
  inflight?: Promise<void>;
  stale?: boolean;
}

const store = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const fetchers = new Map<string, () => Promise<unknown>>();
const fallbacks = new Map<string, unknown>();
let generation = 0; // bumped when the signed-in person changes; late answers for the previous person are dropped

const emit = (key: string) => listeners.get(key)?.forEach((l) => l());

function load(key: string): Promise<void> {
  const entry = store.get(key);
  const fetcher = fetchers.get(key);
  if (!entry || !fetcher) return Promise.resolve();
  if (entry.inflight) return entry.inflight;
  const gen = generation;
  const inflight = fetcher()
    .then(
      (data) => void (gen === generation && store.set(key, { data, source: apiMode() === 'on' ? 'server' : 'built-in', fetchedAt: Date.now() })),
      () => void (gen === generation && store.set(key, { ...(store.get(key) as Entry), inflight: undefined, stale: false, fetchedAt: Date.now() })),
    )
    .finally(() => emit(key));
  store.set(key, { ...entry, inflight }); // a new object, so screens re-render and can show "refreshing"
  emit(key);
  return inflight;
}

/** Marks every key that starts with `prefix` as out of date and refetches the ones on screen. */
export function invalidate(prefix: string): void {
  store.forEach((entry, key) => {
    if (!key.startsWith(prefix)) return;
    entry.stale = true;
    if (listeners.get(key)?.size) void load(key);
  });
}

/** Forgets every server answer (a different person signed in): screens show built-in data until they refetch. */
export function resetAll(): void {
  generation += 1;
  store.forEach((_, key) => {
    store.set(key, { data: fallbacks.get(key), source: 'built-in', fetchedAt: 0, stale: true });
    emit(key);
    if (listeners.get(key)?.size) void load(key);
  });
}

/** Puts a known answer in place (for example the server's reply to a change) without another round trip. */
export function prime<T>(key: string, data: T): void {
  store.set(key, { data, source: apiMode() === 'on' ? 'server' : 'built-in', fetchedAt: Date.now() });
  emit(key);
}

export function useResource<T>(key: string, fetcher: () => Promise<T>, fallback: T, maxAgeMs = 30_000) {
  fetchers.set(key, fetcher as () => Promise<unknown>);
  fallbacks.set(key, fallback);
  if (!store.has(key)) store.set(key, { data: fallback, source: 'built-in', fetchedAt: 0, stale: true });

  const subscribe = useCallback(
    (cb: () => void) => {
      const set = listeners.get(key) ?? new Set();
      set.add(cb);
      listeners.set(key, set);
      return () => set.delete(cb);
    },
    [key],
  );
  const entry = useSyncExternalStore(subscribe, () => store.get(key) as Entry);

  useEffect(() => {
    const e = store.get(key);
    if (e && (e.stale || Date.now() - e.fetchedAt > maxAgeMs) && !e.inflight) void load(key);
  }, [key, maxAgeMs]);

  return {
    data: entry.data as T,
    source: entry.source,
    loading: Boolean(entry.inflight),
    refresh: () => load(key),
  };
}
