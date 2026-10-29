import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, Circle, CircleDot, Sparkles } from 'lucide-react';
import { Badge, Card, PageHeader, Reveal } from '../../components/ui';
import { AicteLogo, LogoMark } from '../../components/brand';
import { NOVELTIES, STATUS_LABEL } from '../../data/novelties';

const COVERAGE = [
  { module: 'A. Workflow automation', need: 'Route by Table 2.3, auto-advance, authorised send-back with reasons', where: [{ to: '/aicte/rules', l: 'Rules studio' }, { to: '/aicte/routing', l: 'Routing and handoffs' }, { to: '/aicte/applications/ANU-2026-0412', l: 'Application dossier' }] },
  { module: 'B. Dashboard and pendency', need: 'Live status by region, stage and officer; ageing; bottlenecks; role-based views', where: [{ to: '/aicte', l: 'Command centre' }, { to: '/aicte/insights', l: 'Bottleneck insights' }] },
  { module: 'C. EVC scheduling', need: 'Queue after preliminary checks, track timelines, remind and escalate', where: [{ to: '/aicte/evc', l: 'EVC scheduling' }, { to: '/aicte/field', l: 'Field inspections' }] },
  { module: 'D. Undertakings and compliance', need: 'Conditions, due dates, online evidence, verification, escalation', where: [{ to: '/aicte/compliance', l: 'Compliance monitor' }, { to: '/institution/compliance', l: 'Institution compliance' }, { to: '/aicte/verification', l: 'Institutional verification' }] },
  { module: 'E. Lease and document validity', need: 'Expiry tracking, early alerts, renewal verification, overdue escalation', where: [{ to: '/institution/infrastructure', l: 'Infrastructure locker' }, { to: '/institution/compliance', l: 'Lease runway' }] },
  { module: 'F. Notifications, escalation, reports', need: 'Configurable alerts, escalation by rule, consolidated reports, audit trail', where: [{ to: '/aicte/settings', l: 'Alert settings' }, { to: '/aicte/reports', l: 'Reports' }, { to: '/aicte/evidence', l: 'Evidence log' }] },
  { module: 'Safeguard', need: 'Automation supports, never replaces, the competent authority', where: [{ to: '/aicte/applications/ANU-2026-0412', l: 'Decision readiness' }, { to: '/institution/team', l: 'Team and access' }] },
];


const EXPERIENCE: [string, string][] = [
  ['Command palette: Ctrl + K to jump to any page, file, institution or rule', '/'],
  ['Ask ANUMATI: answers with handbook clauses (rules decide, AI explains)', '/'],
  ['Read aloud for notices and answers (Hindi and English voices)', '/notices'],
  ['Voice search for application numbers', '/'],
  ['QR-verified, printable decision letters', '/letter/ANU-2026-0117'],
  ['Live activity stream and ticking deadline countdown', '/aicte'],
  ['“Since your last visit” digest for officers', '/aicte'],
  ['Guided tour for first-time officers', '/aicte'],
  ['Compliance health score for institutions', '/institution'],
  ['Saved views in the work queue', '/aicte/queue'],
  ['Keyboard shortcuts (press ?) and a collapsible sidebar', '/aicte'],
  ['Reading-comfort mode, four text sizes and high contrast', '/'],
  ['“Was this page helpful?” feedback on every public page', '/'],
  ['Breadcrumbs and notifications drawer', '/aicte'],
  ['Single-row glass header with official AICTE identity', '/'],
  ['Accessibility panel: dark theme, data saver, underlined links, reduced motion', '/'],
  ['Jargon buster: every abbreviation explained on hover or tap, plus a glossary', '/glossary'],
  ['“I am a…” switcher that shows only the tasks for students, institutions, officials or everyone', '/'],
  ['Fake-college shield: unapproved and lookalike names flagged before anyone pays a fee', '/institutions?q=Narmada Valley Institute of Technology and Management'],
  ['Service status: live checks, 90-day uptime and a deadline-rush forecast', '/status'],
  ['Deadline protection: submissions time-stamped on receipt, with a downloadable receipt', '/institution/apply'],
  ['Draft autosave on the device and an offline banner for weak connections', '/institution/apply'],
  ['Upload pre-flight: PDF, size, password and digital-signature checks before upload', '/institution/apply'],
  ['“Check your answers” review before final submission', '/institution/apply'],
  ['Expected decision window, like parcel tracking, with add-to-calendar', '/institution/applications/ANU-2026-0412'],
  ['Deficiency action plan with a reminder in the institution’s own calendar', '/institution/applications/ANU-2026-0398'],
  ['Focus mode: “Start next file” opens the most urgent file, then the next', '/aicte/queue'],
  ['Bulk reminders and assignment with Undo', '/aicte/queue'],
  ['Resubmission diff: re-scrutiny sees only what changed', '/aicte/applications/ANU-2026-0398'],
  ['Idle-session warning with a countdown before sign-out', '/aicte'],
  ['Sitemap, page progress bar and a helpful 404 page with search', '/sitemap'],
  ['“See it in action”: tracking, WhatsApp and letter checks in one tabbed showcase', '/'],
  ['Thumb-reach tab bar in both portals on phones', '/aicte'],
  ['One-tap copy for reference numbers and fingerprints', '/letter/ANU-2026-0117'],
  ['Side-by-side document viewer: each file beside its earlier version, checked one by one', '/aicte/applications/ANU-2026-0398'],
  ['Field inspection checklist made for a phone: big buttons, camera, GPS check', '/aicte/field'],
  ['Live counts on the menu: files to act on, expiring certificates, drafts to review', '/institution'],
  ['Plan a seat change first, then start the application already filled in', '/institution/courses'],
];

/** Innovations adapted from leading digital governments and regulators. [what, where, inspired by] */
const INNOVATIONS: [string, string, string][] = [
  ['Proactive renewal: the Extension of Approval arrives pre-filled; only changes need checking', '/institution', 'Estonia’s proactive, once-only services'],
  ['Green channel: clean-record institutions self-certify and are checked later', '/institution', 'Telangana TS-iPASS self-certification; OECD risk-based regulation'],
  ['Norms worked out from the institution’s own record: rooms against Annexure-3, faculty 1:20 / 1:15 and cadre 1:2:6, land within 2 km', '/institution/infrastructure', 'APH 2024-27 Annexure-1 and Annexure-3'],
  ['Ask on WhatsApp and SMS, with voice and 22 languages once Bhashini is connected', '/', 'Jugalbandi on Bhashini'],
  ['Geotag check of visit photos, read from each photo in the browser', '/aicte/evc', 'CAG audit of geotagged housing photos'],
  ['Risk-weighted surprise inspections with a public, re-checkable draw', '/aicte/compliance', 'OECD inspection principles'],
  ['Faculty integrity graph: the same teacher at two institutions', '/aicte/integrity', 'Duplicate faculty reported to Parliament'],
  ['Case brief for officers, every line tied to its source', '/aicte/applications/ANU-2026-0412', 'UK government AI briefing tools'],
  ['Rule-change impact preview before publishing', '/aicte/rules', 'OECD Rules as Code; OpenFisca'],
  ['Public performance dashboard with open data', '/performance', 'GOV.UK service dashboards'],
  ['Decision letters as signed verifiable credentials (DigiLocker once onboarded)', '/letter/ANU-2026-0117', 'W3C Verifiable Credentials; DigiLocker issuers'],
];

const AUDIT = [
  { found: 'Approval links are white text on yellow buttons (contrast 1.75:1; WCAG needs 4.5:1)', fix: 'Navy, white and saffron palette; all text at least 4.5:1' },
  { found: '20 links on the home page say only “Click here”', fix: 'Every link names its destination' },
  { found: '15 of 24 home-page images have no alternative text; no main page heading', fix: 'Alt text on every image; exactly one H1 per page, checked on every route' },
  { found: 'Key approval links sit inside a rotating carousel, duplicated in the page code', fix: 'No carousels; one-click task cards and a rules explorer' },
  { found: 'Approval information is spread across 26 PDF links', fix: 'Rules explorer: stages, documents and clauses on one page' },
  { found: 'Date shown as 10-22-2026 (US order) beside “16 October, 2026”', fix: 'One Indian format everywhere: 22 Oct 2026' },
  { found: 'Student, expert and institution notices mixed in one list', fix: 'Notices filtered by audience, with read-aloud' },
  { found: 'Phone numbers are plain text; floating social and chat buttons cover content', fix: 'Tap-to-call links; one assistant button that never covers content' },
];

export default function About() {
  return (
    <div className="container-page py-12">
      <PageHeader
        eyebrow="About ANUMATI"
        title="How ANUMATI meets every AICTE requirement"
        description="ANUMATI (Approval and Norms Unified Monitoring, Alerts, Tracking and Intelligence) turns the Approval Process Handbook into tested rules, runs every application and condition on fair, durable deadlines, and proves every step. Officials keep every decision."
      />

      <Reveal>
        <div className="bg-navy-mesh mb-8 flex flex-col items-center gap-6 overflow-hidden rounded-3xl px-8 py-8 text-white md:flex-row">
          <LogoMark size={84} animated />
          <div className="flex-1 text-center md:text-left">
            <p className="font-display text-2xl font-extrabold tracking-[0.12em]">ANUMATI</p>
            <p className="mt-1 text-brand-200">
              <span lang="hi">अनुमति</span> means “permission”. The mark is an <b className="text-white">A</b> for approval whose crossbar is a check, with a green approved node at the apex and a tracking ring that is three-quarters complete.
            </p>
          </div>
          <div className="rounded-2xl bg-white/[0.06] px-4 py-3">
            <AicteLogo variant="light" className="h-10" />
          </div>
        </div>
      </Reveal>

      <Reveal>
        <Card title="Requirement coverage" subtitle="Each AICTE requirement (modules A–F) and where to see it working" pad={false}>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>What is required</th>
                  <th>See it here</th>
                </tr>
              </thead>
              <tbody>
                {COVERAGE.map((c) => (
                  <tr key={c.module}>
                    <td className="whitespace-nowrap font-semibold text-ink">{c.module}</td>
                    <td>{c.need}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {c.where.map((w) => (
                          <Link key={w.to + w.l} to={w.to} className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                            {w.l} <ArrowUpRight size={12} />
                          </Link>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>

      <div className="mt-6 grid gap-6">
        <Reveal>
          <Card
            title={`${NOVELTIES.length} platform novelties`}
            subtitle="Green = working now · amber = working, simpler version · outline = designed, needs onboarding"
            action={
              <Link to="/solution" className="btn-primary btn-sm">
                Each one explained <ArrowUpRight size={14} />
              </Link>
            }
          >
            <ul className="grid gap-x-8 gap-y-2.5 md:grid-cols-2">
              {NOVELTIES.map((x) => (
                <li key={x.n} className="flex items-start gap-3 text-sm">
                  {x.status === 'live' ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-indgreen-600" /> : x.status === 'simpler' ? <CircleDot size={17} className="mt-0.5 shrink-0 text-amber-600" /> : <Circle size={17} className="mt-0.5 shrink-0 text-slate-400" />}
                  <span className="flex-1">
                    <span className="mr-1 text-ink-mute">{x.n}.</span>
                    <Link to={`/solution#n-${x.n}`} className="text-ink hover:text-brand-700 hover:underline">
                      {x.title}
                    </Link>
                    <span className="block text-xs text-ink-mute">{STATUS_LABEL[x.status]}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
        <Reveal delay={0.06}>
          <Card title={`${EXPERIENCE.length} experience novelties`} subtitle="Interaction and accessibility features across the portals">
            <ul className="grid gap-x-8 gap-y-2.5 md:grid-cols-2">
              {EXPERIENCE.map(([t, to], i) => (
                <li key={t} className="flex items-start gap-3 text-sm">
                  <Sparkles size={16} className="mt-0.5 shrink-0 text-saffron-500" />
                  <span className="flex-1">
                    <span className="mr-1 text-ink-mute">{i + 1}.</span>
                    <Link to={to} className="text-ink hover:text-brand-700 hover:underline">
                      {t}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>

      <Reveal className="mt-6">
        <Card title={`${INNOVATIONS.length} innovations adapted from the best in the world`} subtitle="Each idea is proven elsewhere; ANUMATI applies it to AICTE approvals" pad={false}>
          <ul className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-y-0">
            {INNOVATIONS.map(([what, to, from], i) => (
              <li key={what} className="flex gap-3 border-slate-100 px-5 py-4 md:border-b">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-saffron-50 text-xs font-bold text-saffron-700">{i + 1}</span>
                <span className="min-w-0">
                  <Link to={to} className="text-sm font-semibold text-ink hover:text-brand-700 hover:underline">
                    {what}
                  </Link>
                  <span className="mt-0.5 block text-xs text-ink-mute">Inspired by {from}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </Reveal>

      <Reveal className="mt-6">
        <Card title="What we fixed from today’s AICTE website" subtitle="Measured on aicte.gov.in on 22 Oct 2026">
          <ul className="grid gap-5 md:grid-cols-2">
            {AUDIT.map((a) => (
              <li key={a.found} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-sm">
                <p className="text-ink-mute">
                  <Badge tone="red" className="mr-2">
                    Found
                  </Badge>
                  {a.found}
                </p>
                <p className="mt-2 text-ink">
                  <Badge tone="green" className="mr-2">
                    Fixed
                  </Badge>
                  {a.fix}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </Reveal>

      <Reveal className="mt-6">
        <Card title="Built with" subtitle="Open source, can be hosted in India, no licence lock-in">
          <p className="text-xs font-bold uppercase tracking-wider text-indgreen-700">Running today</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {['React 18', 'TypeScript', 'Vite', 'Tailwind CSS', 'Framer Motion', 'Recharts', 'React Flow', 'Web Crypto SHA-256', 'Web Speech API', 'QR codes', 'FastAPI', 'PostgreSQL with row-level security', 'Keycloak single sign-on', 'pyHanko', 'Ed25519 signed letters', 'drand', 'ClamAV', 'Valkey', 'Docker'].map((s) => (
              <Badge key={s} tone="brand">
                {s}
              </Badge>
            ))}
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-ink-mute">Production upgrade path</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {['Temporal (durable workflows)', 'PM4Py on the live log', 'scikit-survival + SHAP', 'OR-Tools CP-SAT scheduling', 'Docling document reader', 'Bhashini / IndicTrans2', 'DigiLocker / API Setu'].map((s) => (
              <Badge key={s} tone="slate">
                {s}
              </Badge>
            ))}
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
