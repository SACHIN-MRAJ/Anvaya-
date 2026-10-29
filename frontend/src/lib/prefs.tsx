import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { MotionConfig, MotionGlobalConfig } from 'framer-motion';
import { dict, type Lang, type DictKey } from './i18n';

export type FontStep = -1 | 0 | 1 | 2;
export type Theme = 'light' | 'dark' | 'system';
export type ColorPalette = 'amber' | 'ocean' | 'forest' | 'royal' | 'crimson' | 'teal' | 'rose' | 'indigo' | 'slate' | 'mono' | 'emerald';

interface Prefs {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey) => string;
  fontStep: FontStep;
  setFontStep: (s: FontStep) => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  comfort: boolean;
  setComfort: (v: boolean) => void;
  theme: Theme;
  setTheme: (v: Theme) => void;
  /** The theme actually shown once "system" is resolved. */
  isDark: boolean;
  dataSaver: boolean;
  setDataSaver: (v: boolean) => void;
  underlineLinks: boolean;
  setUnderlineLinks: (v: boolean) => void;
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;
  colorPalette: ColorPalette;
  setColorPalette: (v: ColorPalette) => void;
  reset: () => void;
}

const PrefsContext = createContext<Prefs | null>(null);

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be blocked; preferences then last for this visit only */
  }
}

const SCALE: Record<FontStep, number> = { [-1]: 0.9, 0: 1, 1: 1.1, 2: 1.2 };

/** A boolean preference saved as `anumati.<key>` that also toggles a class on <html>. */
function useFlag(key: string, htmlClass: string): [boolean, (v: boolean) => void] {
  const [v, setV] = useState<boolean>(() => read<boolean>(`anumati.${key}`, false));
  useEffect(() => {
    document.documentElement.classList.toggle(htmlClass, v);
  }, [v, htmlClass]);
  return [
    v,
    (next) => {
      setV(next);
      write(`anumati.${key}`, next);
    },
  ];
}

function useSystemDark() {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return dark;
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => read<Lang>('anumati.lang', 'en'));
  const [fontStep, setFontStepState] = useState<FontStep>(() => read<FontStep>('anumati.font', 0));
  const [theme, setThemeState] = useState<Theme>(() => read<Theme>('anumati.theme', 'light'));
  const [colorPalette, setColorPaletteState] = useState<ColorPalette>(() => read<ColorPalette>('anumati.palette', 'teal'));
  const [highContrast, setHighContrast] = useFlag('hc', 'hc');
  const [comfort, setComfort] = useFlag('comfort', 'comfort');
  const [dataSaver, setDataSaver] = useFlag('lite', 'lite');
  const [underlineLinks, setUnderlineLinks] = useFlag('underline', 'underline-links');
  const [reduceMotion, setReduceMotion] = useFlag('motion', 'reduce-motion');
  const systemDark = useSystemDark();
  const isDark = !highContrast && (theme === 'dark' || (theme === 'system' && systemDark));

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(SCALE[fontStep]));
  }, [fontStep]);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.classList.toggle('dark', isDark);
      root.style.colorScheme = isDark ? 'dark' : 'light';
    };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    const quiet = root.classList.contains('reduce-motion') || root.classList.contains('lite') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (doc.startViewTransition && !quiet && root.classList.contains('dark') !== isDark) doc.startViewTransition(apply);
    else apply();
    // Printed letters and reports always use the light theme.
    const before = () => root.classList.remove('dark');
    const after = () => root.classList.toggle('dark', isDark);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, [isDark]);
  useEffect(() => {
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
  }, [lang]);

  const ALL_PALETTES: ColorPalette[] = ['amber', 'ocean', 'forest', 'royal', 'crimson', 'teal', 'rose', 'indigo', 'slate', 'mono', 'emerald'];
  useEffect(() => {
    const root = document.documentElement;
    ALL_PALETTES.forEach((p) => root.classList.remove(`palette-${p}`));
    // teal is the CSS :root default — no class needed. All others get a class.
    if (colorPalette !== 'teal') root.classList.add(`palette-${colorPalette}`);
  }, [colorPalette]);

  const setFontStep = (s: FontStep) => {
    setFontStepState(s);
    write('anumati.font', s);
  };
  const setTheme = (v: Theme) => {
    setThemeState(v);
    write('anumati.theme', v);
  };
  const setColorPalette = (v: ColorPalette) => {
    setColorPaletteState(v);
    write('anumati.palette', v);
  };

  const value: Prefs = {
    lang,
    setLang: (l) => {
      setLangState(l);
      write('anumati.lang', l);
    },
    t: (key) => dict[lang][key] ?? dict.en[key] ?? key,
    fontStep,
    setFontStep,
    highContrast,
    setHighContrast,
    comfort,
    setComfort,
    theme,
    setTheme,
    isDark,
    dataSaver,
    setDataSaver,
    underlineLinks,
    setUnderlineLinks,
    reduceMotion,
    setReduceMotion,
    colorPalette,
    setColorPalette,
    reset: () => {
      setFontStep(0);
      setTheme('light');
      setHighContrast(false);
      setComfort(false);
      setDataSaver(false);
      setUnderlineLinks(false);
      setReduceMotion(false);
      setColorPalette('teal');
    },
  };
  // Reduce motion and Data saver make every animation finish instantly, fades included.
  MotionGlobalConfig.skipAnimations = reduceMotion || dataSaver;

  return (
    <PrefsContext.Provider value={value}>
      <MotionConfig reducedMotion={reduceMotion || dataSaver ? 'always' : 'user'}>{children}</MotionConfig>
    </PrefsContext.Provider>
  );
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used inside PrefsProvider');
  return ctx;
}
