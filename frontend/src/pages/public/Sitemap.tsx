import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Globe2, Landmark } from 'lucide-react';
import { PageHeader } from '../../components/ui';

const MAP = [
  {
    title: 'Public portal',
    icon: <Globe2 size={18} />,
    note: 'Open to everyone, no sign-in',
    links: [
      ['Home', '/', 'Start here: track, check or verify'],
      ['Rules explorer', '/rules', 'What any request needs, with clauses'],
      ['Approved institutions', '/institutions', 'Check a college before admission'],
      ['Verify a letter', '/verify', 'Confirm a decision letter is genuine'],
      ['Academic calendar', '/calendar', 'Windows and deadlines for the cycle'],
      ['Notices and circulars', '/notices', 'Filtered by audience, with read-aloud'],
      ['Glossary of terms', '/glossary', 'Every abbreviation in plain words'],
      ['Service status', '/status', 'Live health and the deadline-rush forecast'],
      ['Performance and open data', '/performance', 'How fast AICTE decides, by region'],
      ['Help desk and policies', '/help', 'FAQs, accessibility, privacy, terms'],
      ['Our solution', '/solution', 'The problem, and each of the 19 novelties explained'],
      ['About ANUMATI', '/about', 'How every requirement is met'],
      ['Sign in', '/login', 'Institution and AICTE portals'],
    ],
  },
  {
    title: 'Institution portal',
    icon: <Building2 size={18} />,
    note: 'For principals and trust officials',
    links: [
      ['Dashboard', '/institution', 'Health score, actions and deadlines'],
      ['New application', '/institution/apply', 'Prepare, self-check, sign and submit'],
      ['My applications', '/institution/applications', 'Live tracker for every file'],
      ['Institution profile', '/institution/profile', 'One record, signatories and change history'],
      ['Infrastructure locker', '/institution/infrastructure', 'Campuses, rooms against the norms, certificate expiry'],
      ['Courses and seats', '/institution/courses', 'Seat matrix and what a change needs'],
      ['Faculty', '/institution/faculty', 'Roster checked against the norms'],
      ['Team and access', '/institution/team', 'Who may prepare, review and submit'],
      ['Compliance', '/institution/compliance', 'Undertakings and lease runway'],
      ['Document vault', '/institution/documents', 'Signed, fingerprinted documents'],
      ['Notifications', '/institution/notifications', 'Alerts by email, SMS and WhatsApp'],
    ],
  },
  {
    title: 'AICTE officials',
    icon: <Landmark size={18} />,
    note: 'Role-based, region-limited access',
    links: [
      ['Command centre', '/aicte', 'Pendency, risk and live activity'],
      ['Work queue', '/aicte/queue', 'Files waiting for action'],
      ['Routing and handoffs', '/aicte/routing', 'Who holds each file and where it stalls'],
      ['EVC scheduling', '/aicte/evc', 'Conflict-free, verifiable expert draw'],
      ['Field inspections', '/aicte/field', 'Phone checklist, GPS photos, signed report'],
      ['Institutional verification', '/aicte/verification', "Check each institution's record once"],
      ['AI finding disputes', '/aicte/ai-disputes', 'Review and resolve institution disputes on AI document checks'],
      ['Compliance monitor', '/aicte/compliance', 'Conditions, due dates and surprise inspections'],
      ['Faculty integrity', '/aicte/integrity', 'Same teacher listed at two institutions'],
      ['Bottleneck insights', '/aicte/insights', 'Where files actually wait'],
      ['What-if simulator', '/aicte/simulator', 'Test staffing before the rush'],
      ['Reports', '/aicte/reports', 'Consolidated reports and exports'],
      ['Rules studio', '/aicte/rules', 'Handbook as tested code'],
      ['Academic calendar (admin)', '/aicte/calendar', 'Publish and revise dates'],
      ['Evidence log', '/aicte/evidence', 'Verify the tamper-evident record'],
      ['User access', '/aicte/admin', 'Switch accounts on or off'],
      ['Settings', '/aicte/settings', 'Alerts and escalation rules'],
    ],
  },
];

export default function Sitemap() {
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow="Find your way" title="Sitemap" description="Every page on ANUMATI in one place. Signed-in pages ask you to sign in first." />
      <div className="grid gap-6 lg:grid-cols-3">
        {MAP.map((s, i) => (
          <motion.section key={s.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="card overflow-hidden">
            <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">{s.icon}</span>
              <div>
                <h2 className="font-display text-base font-bold">{s.title}</h2>
                <p className="text-xs text-ink-mute">{s.note}</p>
              </div>
            </header>
            <ul className="divide-y divide-slate-100">
              {s.links.map(([label, to, hint]) => (
                <li key={to}>
                  <Link to={to} className="group flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <span>
                      <span className="block text-sm font-semibold text-ink group-hover:text-brand-700">{label}</span>
                      <span className="block text-xs text-ink-mute">{hint}</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">{to}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.section>
        ))}
      </div>
    </div>
  );
}
