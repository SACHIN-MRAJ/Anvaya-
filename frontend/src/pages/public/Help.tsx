import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Phone } from 'lucide-react';
import { Card, PageHeader } from '../../components/ui';

const FAQ = [
  { q: 'Can I change my application after final submission?', a: 'No. The handbook locks submitted data until processing ends (APH 2.3.3(c)); it can be reopened once with approval and a penalty (2.3.3(e)). That is why ANUMATI runs its AI self-check before you submit, not after.' },
  { q: 'Who must sign the documents?', a: 'Uploads are digitally signed by the Chairman or Secretary of the Trust, Society or Company (APH 1.4.6). Documents without a digital signature are not valid. ANUMATI checks every signature automatically.' },
  { q: 'Why is my application clock "paused"?', a: 'The deadline clock stops while a file is waiting on your institution, for example after a deficiency is recorded. It restarts when you respond. Officials are measured only on their own time.' },
  { q: 'How is the expert visit panel chosen?', a: 'A solver lists experts who are available, within their load limit and have no link to your institution. A public random value from the drand network, fixed in advance, then picks the panel. Anyone can re-check the draw.' },
  { q: 'Does AI decide my application?', a: 'Never. AI checks completeness, reads documents and estimates delays. Every decision is taken and recorded by the competent authority.' },
  { q: 'How do I appeal a decision?', a: 'You may appeal once, within 7 days of the decision being uploaded (APH 1.11, 2.24). ANUMATI shows a countdown and lets you file the appeal online.' },
];

function Accordion() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className="divide-y divide-slate-100">
      {FAQ.map((f, i) => (
        <li key={f.q}>
          <button className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left font-medium" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            {f.q}
            <motion.span animate={{ rotate: open === i ? 180 : 0 }}>
              <ChevronDown size={18} className="text-ink-mute" />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <p className="px-6 pb-5 text-sm leading-relaxed text-ink-mute">{f.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </li>
      ))}
    </ul>
  );
}

export default function Help() {
  return (
    <div className="container-page max-w-4xl py-10">
      <PageHeader eyebrow="Help and policies" title="Help desk" description="Answers to common questions, our accessibility commitment and the policies that apply to this portal." />
      <div className="space-y-6">
        <Card title="Frequently asked questions" pad={false}>
          <Accordion />
        </Card>
        <Card title="Contact">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <Phone size={16} className="text-brand-600" /> Call
            <a className="link" href="tel:+911100000000">
              011-0000-0000
            </a>
            <span className="text-ink-mute">Monday to Friday, 9:30 am to 6:00 pm IST</span>
          </p>
        </Card>
        <section id="accessibility" className="card card-pad scroll-mt-32">
          <h2 className="font-semibold">Accessibility statement</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-mute">
            This portal is built to the Guidelines for Indian Government Websites (GIGW 3.0) and WCAG 2.1 level AA. It supports keyboard navigation, screen readers, four text sizes, high contrast, a dark theme, reading comfort spacing, underlined links, reduced motion, a data saver for slow connections, read-aloud and Hindi. Abbreviations are explained where they appear and in the glossary. Signed-in users are warned before an idle session ends. Every link says where it goes; no link is labelled “Click here”. Text colours meet a contrast ratio of at least 4.5:1. Open “Accessibility” at the top of any page to change these settings.
          </p>
        </section>
        <section id="privacy" className="card card-pad scroll-mt-32">
          <h2 className="font-semibold">Privacy policy</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-mute">
            Only data needed for approvals is collected, used only for that purpose, and kept in India. Aadhaar is never required. Access to every record is logged. The design follows the Digital Personal Data Protection Act, 2023.
          </p>
        </section>
        <section id="terms" className="card card-pad scroll-mt-32">
          <h2 className="font-semibold">Terms of use</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-mute">Information on this portal is provided for approval and compliance purposes. Decisions are valid only as recorded by the competent authority and verifiable on the Verify page.</p>
        </section>
        <section id="hyperlinking" className="card card-pad scroll-mt-32">
          <h2 className="font-semibold">Hyperlinking and copyright</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-mute">You may link to any public page. Content on public pages may be reproduced with attribution, except where marked otherwise.</p>
        </section>
      </div>
    </div>
  );
}
