/** Moves the soft spotlight on any `.spotlight` card to follow the pointer. One listener for the whole app. */
export function installSpotlight() {
  if (typeof window === 'undefined' || !window.matchMedia?.('(hover: hover)').matches) return;
  let frame = 0;
  window.addEventListener(
    'pointermove',
    (e) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = (e.target as Element | null)?.closest?.('.spotlight') as HTMLElement | null;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    },
    { passive: true },
  );
}
