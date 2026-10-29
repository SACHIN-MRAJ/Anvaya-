import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BadgeCheck, MessageCircle, Mic, PhoneCall, Play, Smartphone } from 'lucide-react';
import { LogoMark } from './brand';
import { Reveal } from './ui';

type Msg = { from: 'user' | 'bot'; voice?: boolean; text: string; en?: string };

const CHAT: Msg[] = [
  { from: 'user', voice: true, text: 'मेरे कॉलेज का आवेदन अभी किस चरण में है?' },
  { from: 'bot', text: 'आवेदन ANU-2026-0412 अभी विशेषज्ञ दौरे (EVC) के चरण में है। संभावित निर्णय: नवंबर का तीसरा सप्ताह।', en: 'ANU-2026-0412 is at the expert visit stage. Expected decision: third week of November.' },
  { from: 'user', text: 'कोई दस्तावेज़ बाकी है?' },
  { from: 'bot', text: 'नहीं, सभी दस्तावेज़ पूरे हैं। अगली सूचना यहीं WhatsApp पर मिलेगी।', en: 'Nothing is pending. Your next update will arrive here on WhatsApp.' },
];

function Bubble({ m }: { m: Msg }) {
  const mine = m.from === 'user';
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 360, damping: 28 }} className={mine ? 'ml-auto max-w-[82%]' : 'max-w-[86%]'}>
      <div className={mine ? 'rounded-2xl rounded-tr-sm bg-[#D9FDD3] px-3 py-2 text-[13px] text-[#111B21] shadow-sm' : 'rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-[13px] text-[#111B21] shadow-sm'}>
        {m.voice ? (
          <span className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#00A884] text-white">
              <Mic size={14} />
            </span>
            <span className="flex h-5 items-end gap-[2px]" aria-hidden>
              {[6, 12, 9, 15, 7, 13, 10, 16, 8, 12, 6, 11, 14, 7].map((h, i) => (
                <span key={i} className="w-[3px] rounded-full bg-[#5E7B70]" style={{ height: h }} />
              ))}
            </span>
            <span className="text-[11px] text-[#667781]">0:06</span>
          </span>
        ) : (
          <span lang="hi">{m.text}</span>
        )}
        {!mine && (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#E7F8F2] px-2 py-0.5 text-[11px] font-semibold text-[#007A5E]">
            <Play size={10} /> <span lang="hi">सुनें</span>
          </span>
        )}
      </div>
      {m.voice && (
        <p lang="hi" className="mt-1 text-right text-[11px] italic text-[#54656F]">
          “{m.text}”
        </p>
      )}
      {m.en && <p className="mt-1 text-[11px] italic text-[#54656F]">{m.en}</p>}
    </motion.div>
  );
}

export function Phone() {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? CHAT.length : 0);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (reduce) return;
    let alive = true;
    const run = async () => {
      while (alive) {
        for (let i = 0; i < CHAT.length && alive; i++) {
          if (CHAT[i].from === 'bot') {
            setTyping(true);
            await new Promise((r) => setTimeout(r, 1100));
            setTyping(false);
          }
          setShown(i + 1);
          await new Promise((r) => setTimeout(r, 1500));
        }
        await new Promise((r) => setTimeout(r, 4500));
        if (alive) setShown(0);
        await new Promise((r) => setTimeout(r, 400));
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [reduce]);

  return (
    <div className="mx-auto w-[300px] rounded-[2.6rem] bg-brand-950 p-3 shadow-lift ring-1 ring-black/5" aria-label="Example WhatsApp conversation in Hindi with ANUMATI">
      <div className="overflow-hidden rounded-[2rem] bg-[#EFEAE2]">
        <div className="flex items-center gap-2.5 bg-[#008069] px-4 pb-3 pt-5 text-white">
          <LogoMark size={30} />
          <div className="min-w-0 leading-tight">
            <p className="flex items-center gap-1 text-sm font-semibold">
              ANUMATI · AICTE <BadgeCheck size={14} className="text-[#7CE0C3]" />
            </p>
            <p className="text-[11px] text-white/80">{typing ? 'typing…' : 'Official account'}</p>
          </div>
        </div>
        <div className="flex h-[400px] flex-col justify-end gap-2.5 overflow-hidden px-3 py-4">
          <AnimatePresence initial={false}>
            {CHAT.slice(0, shown).map((m, i) => (
              <Bubble key={i} m={m} />
            ))}
          </AnimatePresence>
          {typing && (
            <div className="flex w-14 items-center justify-center gap-1 rounded-2xl rounded-tl-sm bg-white px-3 py-2.5 shadow-sm" aria-hidden>
              {[0, 1, 2].map((d) => (
                <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-[#8696A0]" animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: d * 0.12 }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Channel({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <li className="flex gap-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indgreen-50 text-indgreen-700">{icon}</span>
      <span>
        <span className="block font-display font-bold text-ink">{title}</span>
        <span className="text-sm leading-relaxed text-ink-mute">{text}</span>
      </span>
    </li>
  );
}

/** Assisted channels: WhatsApp voice in 22 languages, SMS and missed call, for people who will never open a portal. */
export function ChannelsShowcase() {
  return (
    <section className="container-page grid items-center gap-14 py-24 lg:grid-cols-2">
      <Reveal className="order-2 lg:order-1">
        <Phone />
      </Reveal>
      <Reveal className="order-1 lg:order-2">
        <p className="eyebrow">
          <span className="h-1.5 w-1.5 rounded-full bg-saffron-500" />
          No app, no English needed
        </p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Ask on WhatsApp, in your own language</h2>
        <p className="mt-4 leading-relaxed text-ink-mute">
          Send a voice note in any of the 22 scheduled languages. ANUMATI understands it, finds the answer in the handbook or in your own file, and replies in the same language by text and voice. Speech and translation run on Bhashini, the Government of India’s language platform.
        </p>
        <ul className="mt-8 space-y-5">
          <Channel icon={<MessageCircle size={20} />} title="WhatsApp" text="Status, documents due and deadlines, by voice or text, from a verified AICTE account." />
          <Channel icon={<Smartphone size={20} />} title="SMS" text="Text ANU and your reference number to the AICTE short code for the current stage and next date." />
          <Channel icon={<PhoneCall size={20} />} title="Missed call" text="Give a missed call to the helpline and get a call back in your language, with the same answers." />
        </ul>
      </Reveal>
    </section>
  );
}
