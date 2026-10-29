import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpenCheck, FolderSearch, MessageCircleQuestion, RotateCcw, SendHorizontal, Sparkles, X } from 'lucide-react';
import { APPLICATION_TYPES, STEP_LABEL, type StepTable } from '../data/rules';
import { ReadAloud } from './speech';
import { LogoMark } from './brand';
import { WithTerms } from './term';
import { cn } from '../lib/utils';
import { useSession } from '../lib/session';
import { askAssistant, type AssistantReply } from '../services/api';
import type { ApplicationType, StepKey } from '../types';

/**
 * “Ask ANUMATI”: answers from the handbook, the published rules and the calendar, and, when signed in, from the
 * person's own files or queue (backend/app/services/assistant.py). With an AI service key on the server, the LLM engine
 * synthesizes the reply from the same sources. Rules decide; the assistant only explains. The engine below is the offline fallback.
 */

interface Msg {
  from: 'user' | 'bot';
  text: string;
  bullets?: string[];
  cites?: string[];
  link?: { to: string; label: string } | null;
  followUps?: string[];
  source?: AssistantReply['source'];
}

const SOURCE = {
  handbook: { icon: BookOpenCheck, label: 'From the handbook' },
  records: { icon: FolderSearch, label: 'From your records' },
  ai: { icon: Sparkles, label: 'Verified AI Handbook Response' },
} as const;

const ALIASES: [RegExp, string][] = [
  [/new (institution|college)|start (an? )?(institution|college)|establish/, 'new'],
  [/(change of )?(site|location|campus move|shift campus)/, 'site'],
  [/(increase|more|additional).*(intake|seats?)|intake/, 'intake'],
  [/nri/, 'nri'],
  [/renew|extension of approval|eoa|self.?disclosure/, 'eoa'],
  [/new programme|new program|new level|start (a )?(programme|program|course)/, 'programme'],
  [/course name|rename (a )?course|merge course|reduce intake/, 'coursename'],
  [/institution name|rename (the )?institution|change.*university/, 'name'],
  [/close (the )?(institution|college)|closure of (the )?institution/, 'closure'],
  [/close (a )?(course|programme)|closure of (programme|course)/, 'closecourse'],
  [/dual|integrated/, 'dual'],
  [/merger|merge institution/, 'merger'],
  [/bank/, 'bankchange'],
  [/foreign|oci|gulf|supernumerary/, 'supernumerary'],
  [/twinning|collaboration/, 'collab'],
  [/deemed/, 'deemed'],
  [/odl|online learning|distance/, 'odl'],
  [/women|co-?ed/, 'coed'],
  [/diploma.*degree|degree.*diploma|conversion/, 'conversion'],
  [/break|restoration/, 'break'],
  [/fpm|fellow programme/, 'fpm'],
  [/trust name|society name/, 'trustname'],
];

function findType(q: string): ApplicationType | undefined {
  const hit = ALIASES.find(([re]) => re.test(q));
  return hit ? APPLICATION_TYPES.find((t) => t.id === hit[1]) : undefined;
}

function pathOf(t: ApplicationType): string {
  const keys = (['selfDisclosure', 'scrutiny', 'evc', 'shc'] as StepKey[]).filter((k) => t.steps[k] !== 'none');
  return [...keys.map((k) => STEP_LABEL[k] + (t.steps[k] === 'conditional' ? ' (if needed)' : '')), 'Executive Committee decision'].join(' → ');
}

export function answer(raw: string, _table?: StepTable): Msg {
  const q = raw.toLowerCase();
  const t = findType(q);
  if (/appeal/.test(q)) return { from: 'bot', text: 'You can appeal once, within 7 days of the decision being uploaded. The Standing Appellate Committee hears it and the Council’s decision is final.', cites: ['APH 1.11', 'APH 2.24'] };
  if (/pause|paused|clock|stopp?ed/.test(q)) return { from: 'bot', text: 'The deadline clock stops whenever a file is waiting on your institution, for example after a deficiency is recorded. It restarts the moment you respond, so officials are measured only on their own time.', cites: ['APH 1.8(f)', 'ANUMATI fair-clock policy v1.4'] };
  if (/sign|dsc|signature/.test(q)) return { from: 'bot', text: 'Every uploaded document must be digitally signed by the Chairman or Secretary of the Trust, Society or Company. Unsigned documents are not valid. ANUMATI checks each signature automatically.', cites: ['APH 1.4.6'] };
  if (/edit|reopen|after (final )?submi|mistake/.test(q)) return { from: 'bot', text: 'After final submission the data is locked until processing ends. It can be reopened only once, with the competent authority’s approval and a late penalty. That is why ANUMATI’s AI self-check runs before you submit.', cites: ['APH 2.3.3(c)', 'APH 2.3.3(e)'], link: { to: '/institution/apply', label: 'Start an application' } };
  if (/lease|land/.test(q)) return { from: 'bot', text: 'Land must be owned or on a registered lease of at least 30 years. Renewal (EoA) stops from the year the remaining lease equals your longest course. A 30-year extension restores it.', cites: ['APH 2.1(e)', 'APH 6.17'], link: { to: '/rules?type=site', label: 'Check your lease runway' } };
  if (/evc|inspection|expert|visit/.test(q) && !t) return { from: 'bot', text: 'Where Table 2.3 requires an expert visit, the panel is chosen automatically: conflicts of interest are excluded, and a public random value fixed in advance picks the final experts. Visits can be physical, online or hybrid and must be video-recorded with GPS coordinates.', cites: ['APH 1.9', 'AICTE corrigendum, Dec 2025'] };
  if (/\bai\b|artificial|decide|automat/.test(q)) return { from: 'bot', text: 'No. AI checks completeness, reads documents and estimates delays, and always shows its reasons. Every decision is taken and recorded by the competent authority.', cites: ['Human-in-the-loop safeguard'] };
  if (/verify|genuine|fake|authentic/.test(q)) return { from: 'bot', text: 'Every letter has a reference number, a QR code and a SHA-256 fingerprint recorded in a tamper-evident log. Enter the number or upload the letter to check it.', cites: ['ANUMATI evidence log'], link: { to: '/verify', label: 'Verify a letter' } };
  if (/last date|calendar|when (are|is) (the )?decision/.test(q)) return { from: 'bot', text: 'For cycle 2027-28, applications close on 30 Nov 2026 and approval decisions are due by 30 Apr 2027. Appeals run for 7 days after each decision. Revised dates always show the old date and the reason.', cites: ['APH 1.10(c)', 'APH 7.12'], link: { to: '/calendar', label: 'Open the calendar' } };
  if (/fee|charge|ter /.test(q)) return { from: 'bot', text: 'Technical Education Regulatory (TER) charges depend on the application type and are listed in the handbook. Pay them through the portal before the last date.', cites: ['APH 1.4.2', 'APH 2.3.2'] };
  if (t && /how long|time|days|duration/.test(q)) return { from: 'bot', text: `${t.name} usually takes about ${t.targetDays} days. Its path: ${pathOf(t)}. Paused time (while you owe a reply) is not counted.`, cites: [t.clause, 'APH Table 2.3'], link: { to: `/rules?type=${t.id}`, label: 'See full details' } };
  if (t && /document|paper|upload|need|require|checklist|submit/.test(q))
    return { from: 'bot', text: `For “${t.name}” you will need:`, bullets: t.documents.map((d) => `${d.name} (${d.clause})`), cites: [t.clause, 'APH Annexure-1/2'], link: { to: `/rules?type=${t.id}`, label: 'Download the checklist' } };
  if (t) return { from: 'bot', text: `“${t.name}” follows this path: ${pathOf(t)}. Target time is about ${t.targetDays} days.`, cites: [t.clause, 'APH Table 2.3'], link: { to: `/rules?type=${t.id}`, label: 'Open in rules explorer' } };
  return { from: 'bot', text: 'I answer questions about AICTE approval rules, deadlines, documents and appeals, always with the handbook clause. I could not find that in the rules. Try one of the suggestions below.', cites: [] };
}

const SUGGESTIONS = {
  public: ['When is the last date to apply?', 'Documents for change of site?', 'How long does increase in intake take?', 'What is EoA?', 'How do I appeal?', 'Is this college approved?'],
  institution: ['Where is my application?', 'Do we have any deficiency?', 'How do I reply to a deficiency?', 'When is the last date to apply?', 'Who must sign the documents?', 'How many faculty do we need?'],
  aicte: ['How many files are overdue?', 'Show files at risk in Mumbai', 'What happens if AICTE misses the deadline?', 'Who records the final decision?', 'How are surprise inspections chosen?'],
};
const GREETING = {
  public: 'Namaste! Ask me about approval rules, documents, dates or appeals. I answer from the Approval Process Handbook, with its clause.',
  institution: 'Namaste! Ask me where your applications stand, what is pending, or anything about the rules, documents and dates.',
  aicte: 'Namaste! Ask me about your queue (overdue files, risk, a file number) or about the rules, documents and dates.',
};

export function Assistant() {
  const { session } = useSession();
  const who = session?.portal ?? 'public';
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ from: 'bot', text: GREETING[who] }]);
  // A new person (sign-in, sign-out, role switch) starts a fresh chat: answers about one person's files never carry over.
  useEffect(() => {
    setMsgs([{ from: 'bot', text: GREETING[who] }]);
  }, [who, session?.officerRole, session?.institutionId]);
  const [q, setQ] = useState('');
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const last = msgs[msgs.length - 1];
  const lastUps = last?.from === 'bot' ? (last.followUps ?? []) : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, typing]);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('anumati:assistant', onOpen);
    return () => window.removeEventListener('anumati:assistant', onOpen);
  }, []);
  // The button shrinks to an icon while the page scrolls, so it never sits on top of content.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      setCompact(true);
      clearTimeout(timer);
      timer = setTimeout(() => setCompact(window.scrollY > 240), 900);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const ask = (text: string) => {
    if (!text.trim() || typing) return;
    const history = msgs.filter((m) => m.from === 'user').map((m) => m.text);
    setMsgs((m) => [...m, { from: 'user', text }]);
    setQ('');
    setTyping(true);
    // The server answers (and knows who is signed in); a simpler engine runs here only when it cannot be reached.
    const started = Date.now();
    void askAssistant(text, history)
      .then((r): Msg => (r ? { from: 'bot', text: r.text, cites: r.cites ?? [], bullets: r.bullets ?? [], link: r.link, followUps: r.followUps ?? [], source: r.source } : answer(text)))
      .catch(() => answer(text))
      .then((reply) => {
        setTimeout(() => {
          setTyping(false);
          setMsgs((m) => [...m, reply]);
        }, Math.max(0, 450 - (Date.now() - started)));
      });
  };

  return (
    <div className="no-print">
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ y: -2 }}
            onClick={() => setOpen(true)}
            layout
            className={cn('assistant-fab fixed bottom-5 right-5 z-[55] flex items-center gap-2 rounded-full bg-gradient-to-br from-brand-600 to-brand-900 py-2.5 pl-2.5 text-sm font-semibold text-white shadow-lift ring-4 ring-white/80', compact ? 'pr-2.5' : 'pr-2.5 md:pr-4')}
            aria-label="Ask ANUMATI"
            title="Ask ANUMATI"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15">
              <MessageCircleQuestion size={18} />
            </span>
            {!compact && <span className="hidden md:inline">Ask ANUMATI</span>}
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label="Ask ANUMATI"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="assistant-fab fixed bottom-5 right-5 z-[55] flex h-[min(600px,calc(100vh-110px))] w-[min(400px,calc(100vw-40px))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lift"
          >
            <header className="bg-navy-mesh flex items-center gap-3 px-5 py-4 text-white">
              <LogoMark size={36} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-bold">Ask ANUMATI</p>
                <p className="flex items-center gap-1 text-[11px] text-brand-200">
                  <BookOpenCheck size={11} /> {who === 'public' ? 'Answers from APH 2024-27 · rules v2026.3' : 'Handbook answers and your own records'}
                </p>
              </div>
              {msgs.length > 1 && (
                <button onClick={() => setMsgs([{ from: 'bot', text: GREETING[who] }])} className="rounded-lg p-1.5 text-brand-100 hover:bg-white/10" aria-label="Start a new chat" title="Start a new chat">
                  <RotateCcw size={16} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-brand-100 hover:bg-white/10" aria-label="Close assistant">
                <X size={18} />
              </button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto bg-canvas px-4 py-4 scroll-thin" aria-live="polite">
              {msgs.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('flex', m.from === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed', m.from === 'user' ? 'rounded-br-md bg-brand-700 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-ink-soft shadow-card')}>
                    <p>{m.from === 'bot' ? <WithTerms text={m.text} /> : m.text}</p>
                    {m.bullets && (
                      <ul className="mt-2 space-y-1">
                        {m.bullets.map((b) => (
                          <li key={b} className="flex gap-2 text-[13px]">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-saffron-500" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                    {m.from === 'bot' && (m.cites?.length || m.link) ? (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
                        {m.cites?.map((c) => (
                          <span key={c} className="rounded-full bg-saffron-50 px-2 py-0.5 text-[10px] font-semibold text-saffron-700">
                            {c}
                          </span>
                        ))}
                        {m.link && (
                          <Link to={m.link.to} onClick={() => setOpen(false)} className="text-[11px] font-semibold text-brand-700 hover:underline">
                            {m.link.label} →
                          </Link>
                        )}
                      </div>
                    ) : null}
                    {m.from === 'bot' && i > 0 && (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <ReadAloud text={[m.text, ...(m.bullets ?? [])].join('. ')} />
                        {m.source && (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-ink-mute">
                            {(() => {
                              const S = SOURCE[m.source];
                              return (
                                <>
                                  <S.icon size={11} /> {S.label}
                                </>
                              );
                            })()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {typing && (
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-card" style={{ width: 64 }} aria-label="Typing">
                  {[0, 1, 2].map((d) => (
                    <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-brand-400" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: d * 0.15 }} />
                  ))}
                </div>
              )}
              <div ref={endRef} />
            </div>
            <div className="border-t border-slate-100 bg-white p-3">
              {/* After an answer: what people usually ask next. Before the first question: starting points for this portal. */}
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-mute">{lastUps.length ? 'Ask next' : 'Try asking'}</p>
              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 scroll-thin">
                {(lastUps.length ? lastUps : SUGGESTIONS[who]).map((s) => (
                  <button key={s} onClick={() => ask(s)} disabled={typing} className="chip shrink-0 whitespace-nowrap hover:border-brand-300 hover:text-brand-700 disabled:opacity-50">
                    <Sparkles size={11} className="text-saffron-500" /> {s}
                  </button>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(q);
                }}
              >
                <label htmlFor="ask" className="sr-only">
                  Your question
                </label>
                <input id="ask" value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="Ask about rules, documents, deadlines…" />
                <button className="btn-primary px-3" aria-label="Send">
                  <SendHorizontal size={17} />
                </button>
              </form>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

export const openAssistant = () => window.dispatchEvent(new Event('anumati:assistant'));
