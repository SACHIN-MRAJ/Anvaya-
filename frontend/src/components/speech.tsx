import { useEffect, useState } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';
import { usePrefs } from '../lib/prefs';
import { cn } from '../lib/utils';

/** Read any text aloud with the browser's built-in speech (works offline, Hindi when a Hindi voice is installed). */
export function ReadAloud({ text, className, label = 'Listen' }: { text: string; className?: string; label?: string }) {
  const { lang } = usePrefs();
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  useEffect(() => () => (supported ? window.speechSynthesis.cancel() : undefined), [supported]);
  if (!supported) return null;
  const toggle = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    u.rate = 0.98;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={speaking} className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors', speaking ? 'bg-brand-700 text-white' : 'bg-brand-50 text-brand-700 hover:bg-brand-100', className)}>
      {speaking ? <Square size={11} /> : <Volume2 size={12} />}
      {speaking ? 'Stop' : label}
    </button>
  );
}

type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
};

/** Voice input (Chrome / Edge). Hidden automatically where the browser does not support it. */
export function VoiceInput({ onText, className }: { onText: (t: string) => void; className?: string }) {
  const { lang } = usePrefs();
  const [listening, setListening] = useState(false);
  const Ctor = typeof window !== 'undefined' ? ((window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition) : undefined;
  if (!Ctor) return null;
  const start = () => {
    const r = new Ctor();
    r.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    r.interimResults = false;
    r.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript ?? '';
      onText(t.replace(/\s+/g, ' ').trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  };
  return (
    <button type="button" onClick={start} aria-label="Search by voice" title="Search by voice" className={cn('relative grid h-9 w-9 place-items-center rounded-lg text-brand-700 transition-colors hover:bg-brand-50', className)}>
      {listening && <span className="absolute inset-0 animate-ring rounded-lg bg-saffron-400/40" />}
      <Mic size={17} className={listening ? 'text-saffron-600' : ''} />
    </button>
  );
}
