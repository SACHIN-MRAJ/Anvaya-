import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FilePlus2,
  FileStack,
  Fingerprint,
  FolderLock,
  Gauge,
  GitBranch,
  HelpCircle,
  Home,
  Inbox,
  Keyboard,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Network,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
  Building2,
  ClipboardCheck,
  GraduationCap,
  IdCard,
  Route,
  UserCog,
  UsersRound,
  BadgeCheck,
  MessageSquareDot,
  Scale,
} from 'lucide-react';
import { usePrefs } from '../lib/prefs';
import { INSTITUTION_ROLES, OFFICER_ROLES, useSession, type InstitutionRole, type OfficerRole } from '../lib/session';
import { useResource } from '../lib/resource';
import { getBadges } from '../services/records';
import { cn, formatDate, formatDateTime, TODAY } from '../lib/utils';
import { useNotifications } from '../lib/live-data';
import { LoadingRows, Modal, Toaster } from './ui';
import { AicteLogo, Brand, LogoMark } from './brand';
import { CommandPalette, openPalette } from './palette';
import { Assistant } from './assistant';
import { PageFeedback } from './feedback';
import { DisplayPanelButton, ThemeSwitch } from './a11y';
import { NetworkBanner, RouteProgress, SessionGuard } from './system';
import { BackToTop, ConnectionBadge, ScrollProgress } from './motion';
import { NoveltyStrip } from './novelty-strip';
import type { DictKey } from '../lib/i18n';

/* ---------------- Government accessibility bar (GIGW) ---------------- */

export function GovBar() {
  const { t, fontStep, setFontStep, lang, setLang } = usePrefs();
  const btn = (active: boolean) => cn('grid h-6 min-w-[24px] place-items-center rounded-md px-1 text-[11px] font-bold transition-colors', active ? 'bg-white text-surface-900' : 'text-neutral-300 hover:bg-white/10');
  return (
    <div className="no-print">
      <div className="tricolour" aria-hidden />
      <div className="bg-dark-surface text-neutral-200">
        <div className="container-page flex h-10 items-center justify-between gap-3 text-xs">
          <div className="flex min-w-0 items-center gap-3">
            <AicteLogo variant="light" className="h-[28px]" />
            <span className="hidden h-4 w-px bg-white/15 lg:block" aria-hidden />
            <span className="hidden truncate text-neutral-400 lg:block">{t('tagline')}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2.5">
            <a href="#main" className="hidden rounded px-1 hover:text-white hover:underline md:inline">
              {t('skip')}
            </a>
            <Link to="/help#accessibility" className="hidden rounded px-1 hover:text-white hover:underline xl:inline">
              {t('screenReader')}
            </Link>
            <span className="hidden h-4 w-px bg-white/15 md:block" aria-hidden />
            <div className="flex items-center gap-0.5" role="group" aria-label={t('textSize')}>
              <button className={btn(fontStep === -1)} onClick={() => setFontStep(-1)} aria-label="Decrease text size">
                A-
              </button>
              <button className={btn(fontStep === 0)} onClick={() => setFontStep(0)} aria-label="Normal text size">
                A
              </button>
              <button className={btn(fontStep === 1)} onClick={() => setFontStep(1)} aria-label="Increase text size">
                A+
              </button>
            </div>
            <span className="hidden h-4 w-px bg-white/15 sm:block" aria-hidden />
            <ThemeSwitch />
            <DisplayPanelButton />
            <label className="sr-only" htmlFor="lang-select">
              Language
            </label>
            <select id="lang-select" value={lang} onChange={(e) => setLang(e.target.value as 'en' | 'hi')} className="h-6 cursor-pointer rounded-md border border-white/15 bg-transparent px-1.5 text-[11px] font-semibold text-neutral-200 focus:outline-none">
              <option value="en" className="text-ink">
                English
              </option>
              <option value="hi" className="text-ink">
                हिन्दी
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchTrigger({ className, compact }: { className?: string; compact?: boolean }) {
  const { t } = usePrefs();
  if (compact)
    return (
      <button onClick={openPalette} className={cn('grid h-10 w-10 place-items-center rounded-xl text-ink-soft hover:bg-slate-100', className)} aria-label={t('searchAnything')}>
        <Search size={19} />
      </button>
    );
  return (
    <button onClick={openPalette} className={cn('group flex h-10 items-center gap-2.5 rounded-xl border border-slate-200 bg-white/80 pl-3 pr-2 text-sm text-slate-400 shadow-card transition-colors hover:border-brand-300', className)}>
      <Search size={16} className="text-slate-400 group-hover:text-brand-600" />
      <span className="flex-1 text-left">{t('searchAnything')}</span>
      <span className="kbd">Ctrl K</span>
    </button>
  );
}

/* ---------------- Public header ---------------- */

const PUBLIC_NAV: { to: string; key: DictKey }[] = [
  { to: '/solution', key: 'solution' },
  { to: '/about', key: 'about' },
];

function PublicHeader() {
  const { t } = usePrefs();
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const portalHome = session ? (session.portal === 'aicte' ? '/aicte' : '/institution') : '/login';

  return (
    <header className={cn('glass sticky top-0 z-40 border-b transition-shadow duration-300', scrolled ? 'border-slate-200/80 shadow-[0_8px_30px_-18px_rgba(10,29,66,0.35)]' : 'border-transparent')}>
      <div className="container-page flex h-[72px] items-center justify-between gap-4">
        <Brand />
        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex items-center gap-1 rounded-2xl bg-slate-100/70 p-1">
            {PUBLIC_NAV.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} end={n.to === '/'} className={({ isActive }) => cn('relative block rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors', isActive ? 'text-brand-800' : 'text-ink-mute hover:text-brand-700')}>
                  {({ isActive }) => (
                    <>
                      {isActive && <motion.span layoutId="public-nav" className="absolute inset-0 rounded-xl bg-white shadow-card" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                      <span className="relative">{t(n.key)}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <SearchTrigger className="hidden w-56 lg:flex" />
          <SearchTrigger compact className="lg:hidden" />
          <Link to={portalHome} className="btn-primary hidden sm:inline-flex">
            {session ? (session.portal === 'aicte' ? t('aictePortal') : t('institutionPortal')) : t('signIn')}
            <ChevronRight size={15} />
          </Link>
          <button className="grid h-10 w-10 place-items-center rounded-xl text-ink-soft hover:bg-slate-100 xl:hidden" onClick={() => setOpen((o) => !o)} aria-label="Open menu" aria-expanded={open}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 bg-white xl:hidden" aria-label="Mobile">
            <ul className="container-page grid gap-1 py-3 sm:grid-cols-2">
              {PUBLIC_NAV.map((n) => (
                <li key={n.to}>
                  <NavLink to={n.to} end={n.to === '/'} className={({ isActive }) => cn('block rounded-xl px-3 py-2.5 text-sm font-semibold', isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:bg-slate-50')}>
                    {t(n.key)}
                  </NavLink>
                </li>
              ))}
              <li className="pt-2 sm:col-span-2">
                <Link to={portalHome} className="btn-primary w-full">
                  {t('signIn')}
                </Link>
              </li>
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ---------------- Footer ---------------- */

function Footer() {
  const { t } = usePrefs();
  const col = (title: string, links: [string, string][]) => (
    <div>
      <h2 className="text-sm font-bold text-white">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map(([l, to]) => (
          <li key={l}>
            <Link className="text-brand-200 transition-colors hover:text-white" to={to}>
              {l}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <footer className="bg-navy-mesh no-print mt-16 text-neutral-200">
      <div className="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Brand light />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-brand-200">Approval workflow, compliance monitoring and alerts for technical institutions: rules as code, fair deadlines and a tamper-evident record of every step.</p>
          <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <AicteLogo variant="light" className="h-9" />
          </div>
        </div>
        {col('Services', [
          ['Rules explorer', '/rules'],
          ['Approved institutions', '/institutions'],
          ['Verify a letter', '/verify'],
          ['Academic calendar', '/calendar'],
          ['Glossary of terms', '/glossary'],
          ['Performance and open data', '/performance'],
        ])}
        {col('Portals', [
          [t('institutionPortal'), '/login?portal=institution'],
          [t('aictePortal'), '/login?portal=aicte'],
          ['Notices', '/notices'],
          ['Our solution: 19 novelties', '/solution'],
          ['About ANUMATI', '/about'],
        ])}
        {col('Policies and help', [
          ['Accessibility statement', '/help#accessibility'],
          ['Privacy policy', '/help#privacy'],
          ['Terms of use', '/help#terms'],
          ['Help desk and FAQs', '/help'],
          ['Sitemap', '/sitemap'],
        ])}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-brand-300 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 ANUMATI · All India Council for Technical Education</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link to="/status" className="inline-flex items-center gap-1.5 text-brand-100 hover:text-white">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ring rounded-full bg-indgreen-400" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-indgreen-400" />
              </span>
              All services running
            </Link>
            <span>
              {t('lastUpdated')}: {formatDate(TODAY)} · GIGW 3.0 · WCAG 2.1 AA
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ---------------- Page transition ---------------- */

function PageTransition({ children }: { children: ReactNode }) {
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);
  return (
    <motion.div
      key={loc.pathname}
      initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
      // A leftover filter (even blur(0px)) would make this wrapper the frame for every "fixed" overlay inside the page
      // (tours, modals), shifting them by the sidebar and header; clear it once the entrance has finished.
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

const Loading = () => (
  <div className="container-page">
    <LoadingRows rows={6} />
  </div>
);

export function HomeLayout() {
  return (
    <>
      <RouteProgress />
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
      <Toaster />
      <CommandPalette />
    </>
  );
}

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <RouteProgress />
      <ScrollProgress />
      <BackToTop />
      <GovBar />
      <NetworkBanner />
      <PublicHeader />
      <main id="main" className="flex-1" tabIndex={-1}>
        <NoveltyStrip className="container-page mt-6" />
        <Suspense fallback={<Loading />}>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </Suspense>
        <PageFeedback />
      </main>
      <Footer />
      <Toaster />
      <CommandPalette />
      <Assistant />
    </div>
  );
}

/* ---------------- Portal shell (institution + AICTE) ---------------- */

interface NavItem {
  to: string;
  key: DictKey;
  icon: ReactNode;
  /** Which live count from /api/me/badges to show (nothing when it is zero or the server is not connected). */
  badge?: string;
  /** Only these officer roles see the item. */
  only?: OfficerRole[];
}

/* ── Institution Portal navigation (6 sections matching the spec document) ── */
const INSTITUTION_NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Overview',
    items: [{ to: '/institution', key: 'dashboard', icon: <LayoutDashboard size={18} /> }],
  },
  {
    section: 'Institution',
    items: [
      { to: '/institution/profile',   key: 'institutionalProfile', icon: <IdCard size={18} /> },
      { to: '/institution/documents', key: 'documentLocker',       icon: <FolderLock size={18} /> },
    ],
  },
  {
    section: 'Applications',
    items: [
      { to: '/institution/apply',        key: 'aiVerification',    icon: <FilePlus2 size={18} /> },
      { to: '/institution/applications', key: 'applicationTracking', icon: <FileStack size={18} />, badge: 'applications' },
    ],
  },
  {
    section: 'Compliance',
    items: [
      { to: '/institution/compliance', key: 'complianceNotifications', icon: <ListChecks size={18} />, badge: 'compliance' },
    ],
  },
];

/* ── AICTE Administrative Portal navigation (role-gated per the spec document) ── */
const AICTE_NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Overview',
    items: [
      { to: '/aicte',        key: 'dashboard',   icon: <LayoutDashboard size={18} /> },
      { to: '/aicte/alerts', key: 'alertCentre', icon: <Bell size={18} />, badge: 'notifications' },
    ],
  },
  {
    section: 'Work',
    items: [
      { to: '/aicte/bureau',    key: 'bureau',             icon: <Inbox size={18} />,      only: ['Regulation Bureau Admin'] },
      { to: '/aicte/scrutiny',  key: 'scrutiny',           icon: <Search size={18} />,     only: ['Scrutiny Reviewer'] },
      { to: '/aicte/evc',       key: 'evc',                icon: <Users size={18} />,      only: ['EVC Inspector'] },
      { to: '/aicte/shc',       key: 'shc',                icon: <Scale size={18} />,      only: ['SHC Compliance Reviewer'] },
      { to: '/aicte/executive', key: 'executiveCommittee', icon: <Network size={18} />,    only: ['Executive Committee Approver'] },
      { to: '/aicte/council',   key: 'council',            icon: <Gauge size={18} />,      only: ['Council Decision Authority'] },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      { to: '/aicte/insights', key: 'insights', icon: <BarChart3 size={18} /> },
      { to: '/aicte/reports',  key: 'reports',  icon: <ClipboardList size={18} /> },
    ],
  },
  {
    section: 'Administration',
    items: [
      { to: '/aicte/rules',     key: 'rulesStudio', icon: <GitBranch size={18} />,      only: ['Regulation Bureau Admin'] },
      { to: '/aicte/calendar',  key: 'calendarAdmin', icon: <CalendarDays size={18} /> },
      { to: '/aicte/settings',  key: 'settings',    icon: <Settings size={18} />,       only: ['Regulation Bureau Admin'] },
      { to: '/aicte/admin',     key: 'admin',       icon: <UserCog size={18} />,        only: ['Regulation Bureau Admin'] },
    ],
  },
];

const BOTTOM_TABS: Record<'institution' | 'aicte', { to: string; label: string; icon: ReactNode }[]> = {
  institution: [
    { to: '/institution',              label: 'Dashboard',    icon: <LayoutDashboard size={20} /> },
    { to: '/institution/apply',        label: 'Apply',        icon: <FilePlus2 size={20} /> },
    { to: '/institution/applications', label: 'Track',        icon: <FileStack size={20} /> },
    { to: '/institution/compliance',   label: 'Compliance',   icon: <ListChecks size={20} /> },
  ],
  aicte: [
    { to: '/aicte',        label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { to: '/aicte/alerts', label: 'Alerts',    icon: <Bell size={20} /> },
    { to: '/aicte/insights', label: 'Insights', icon: <BarChart3 size={20} /> },
    { to: '/aicte/calendar', label: 'Calendar', icon: <CalendarDays size={20} /> },
  ],
};

const CRUMB: Record<string, string> = {
  aicte: 'AICTE',
  institution: 'Institution',
  /* ── Institution portal ── */
  dashboard: 'Dashboard',
  profile: 'Institutional Profile',
  documents: 'Document Locker',
  apply: 'Application & AI Verification',
  applications: 'Application Tracking',
  compliance: 'Compliance & Notifications',
  notifications: 'Notifications',
  infrastructure: 'Infrastructure',
  courses: 'Courses',
  faculty: 'Faculty',
  team: 'Team',
  /* ── AICTE portal ── */
  alerts: 'Alert Centre',
  bureau: 'Regulation Bureau',
  scrutiny: 'Scrutiny & Re-Scrutiny',
  evc: 'EVC Portal',
  shc: 'SHC Portal',
  executive: 'Executive Committee',
  council: 'Council Decision Stage',
  insights: 'Reports & Analytics',
  reports: 'Reports',
  rules: 'Rules Studio',
  calendar: 'Schedule Management',
  evidence: 'Evidence Log',
  settings: 'Settings',
  admin: 'User Access',
  integrity: 'Faculty Integrity',
  queue: 'Work Queue',
  routing: 'Routing',
  field: 'Field Inspections',
  verification: 'Verification',
  'ai-disputes': 'AI Disputes',
  simulator: 'Simulator',
};

function Breadcrumbs() {
  const loc = useLocation();
  const parts = loc.pathname.split('/').filter(Boolean);
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
      {parts.map((p, i) => {
        const to = '/' + parts.slice(0, i + 1).join('/');
        const last = i === parts.length - 1;
        const label = i === 0 ? (p === 'aicte' ? 'Command centre' : 'Dashboard') : CRUMB[p] ?? p;
        return (
          <span key={to} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight size={14} className="shrink-0 text-slate-300" />}
            {last ? (
              <span className="truncate font-semibold text-ink">{label}</span>
            ) : (
              <Link to={to} className="truncate text-ink-mute hover:text-brand-700">
                {i === 0 ? (p === 'aicte' ? 'Command centre' : 'Dashboard') : label}
              </Link>
            )}
          </span>
        );
      })}
      {parts.length === 1 && <span className="ml-2 hidden whitespace-nowrap text-xs text-ink-mute 2xl:inline">· Cycle 2027-28 · {formatDate(TODAY)}</span>}
    </nav>
  );
}

const NOTIFS: Record<'aicte' | 'institution', { title: string; meta: string; tone: 'red' | 'amber' | 'brand' | 'green' }[]> = {
  aicte: [
    { title: 'Escalation level 3: security deposit proof overdue (Krishna Delta)', meta: '10 min ago · APH 2.25(f)', tone: 'red' },
    { title: '6 new applications submitted in Central region', meta: '42 min ago', tone: 'brand' },
    { title: 'EVC panel drawn for ANU-2026-0412 (drand round committed)', meta: '2 h ago', tone: 'green' },
    { title: 'Kanpur re-scrutiny queue crossed 25 days on average', meta: 'Today 09:00 · Insight', tone: 'amber' },
  ],
  institution: [
    { title: 'Fire safety certificate expires in 17 days', meta: 'Today 09:00', tone: 'amber' },
    { title: 'Action needed on ANU-2026-0398: corrected NOC', meta: '8 days ago', tone: 'red' },
    { title: 'Expert visit panel assigned for ANU-2026-0412', meta: '13 days ago', tone: 'green' },
  ],
};

function useGoShortcuts(portal: 'institution' | 'aicte', onHelp: () => void) {
  const nav = useNavigate();
  const pending = useRef(false);
  useEffect(() => {
    const map: Record<string, string> =
      portal === 'aicte'
        ? { d: '/aicte', b: '/aicte/bureau', e: '/aicte/evc', s: '/aicte/scrutiny', h: '/aicte/shc', x: '/aicte/executive', a: '/aicte/alerts', i: '/aicte/insights', r: '/aicte/rules' }
        : { d: '/institution', n: '/institution/apply', a: '/institution/applications', c: '/institution/compliance', v: '/institution/documents', p: '/institution/profile' };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '?') return onHelp();
      if (pending.current && map[e.key]) {
        nav(map[e.key]);
        pending.current = false;
        return;
      }
      pending.current = e.key === 'g';
      if (pending.current) setTimeout(() => (pending.current = false), 1200);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [portal, nav, onHelp]);
}

export function PortalLayout({ portal }: { portal: 'institution' | 'aicte' }) {
  const { t } = usePrefs();
  const { session, signOut, setOfficerRole, setInstitutionRole, authMode } = useSession();
  // Live counts behind the navigation badges, refreshed every 20 seconds while the portal is open.
  const { data: badges, refresh: refreshBadges } = useResource(`badges:${portal}:${session?.officerRole ?? session?.role ?? ''}`, getBadges, null, 20_000);
  useEffect(() => {
    const t = setInterval(() => void refreshBadges(), 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal, session?.officerRole, session?.role]);
  const nav = useNavigate();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('anumati.sidebar') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
    setBellOpen(false);
    void refreshBadges(); // counts change after most actions, which usually end on another page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname]);
  useGoShortcuts(portal, () => setHelpOpen(true));

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('anumati.sidebar', c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const officer = session?.officerRole;
  const groups =
    portal === 'institution'
      ? INSTITUTION_NAV
      : AICTE_NAV.map((g) => ({ ...g, items: g.items.filter((it) => !it.only || (officer && it.only.includes(officer))) })).filter((g) => g.items.length);
  const initials = (session?.name ?? '')
    .replace(/^(Dr|Prof|Shri|Smt)\.?\s+/i, '')
    .replace(/^Principal,\s*/, '')
    .split(/[\s,(]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const home = portal === 'aicte' ? '/aicte' : '/institution';
  const { data: liveNotifs } = useNotifications();
  // The signed-in person's real alerts when connected; sample alerts otherwise.
  const notifs = liveNotifs
    ? liveNotifs.slice(0, 8).map((n) => ({ title: n.title, meta: `${formatDateTime(n.createdAt)}${n.read ? '' : ' · new'}`, tone: n.tone === 'brand' ? ('brand' as const) : n.tone }))
    : NOTIFS[portal];
  const unreadCount = liveNotifs ? liveNotifs.filter((n) => !n.read).length : notifs.length;

  const sidebar = (isCollapsed: boolean) => (
    <nav aria-label={portal === 'aicte' ? t('aictePortal') : t('institutionPortal')} className="flex h-full flex-col">
      <div className={cn('flex h-[72px] items-center border-b border-white/10', isCollapsed ? 'justify-center' : 'px-5')}>{isCollapsed ? <LogoMark size={36} /> : <Brand compact light to={home} />}</div>
      {!isCollapsed && (
        <div className="px-5 pb-1 pt-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-400">{portal === 'aicte' ? t('aictePortal') : t('institutionPortal')}</p>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-3 pb-6 scroll-dark">
        {groups.map((g) => (
          <div key={g.section} className="mt-4">
            {!isCollapsed ? <p className="px-3 pb-1.5 text-[11px] font-semibold text-neutral-400">{g.section}</p> : <div className="mx-auto mb-2 h-px w-6 bg-white/10" />}
            <ul className="space-y-1">
              {g.items.map((it) => (
                <li key={it.to}>
                  <NavLink
                    to={it.to}
                    end={it.to === home}
                    title={isCollapsed ? t(it.key) : undefined}
                    className={({ isActive }) =>
                      cn('group relative flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors', isCollapsed ? 'justify-center px-0' : 'px-3', isActive ? 'bg-white/[0.12] text-white' : 'text-neutral-300 hover:bg-white/[0.06] hover:text-white')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <motion.span layoutId={`side-${portal}`} className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-brand-400" />}
                        <span className={cn('transition-transform group-hover:scale-110', isActive && 'text-brand-300')}>{it.icon}</span>
                        {!isCollapsed && <span className="flex-1 truncate">{t(it.key)}</span>}
                        {it.badge && badges?.[it.badge] ? (
                          isCollapsed ? (
                            <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-brand-400" />
                          ) : (
                            <motion.span key={badges[it.badge]} initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="rounded-full bg-brand-500 px-1.5 text-[10px] font-bold tabular-nums text-white">
                              {badges[it.badge] > 99 ? '99+' : badges[it.badge]}
                            </motion.span>
                          )
                        ) : null}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="space-y-1 border-t border-white/10 p-3">
        {!isCollapsed && (
          <div className="mb-2 rounded-xl bg-white/[0.06] px-3 py-2.5">
            <AicteLogo variant="light" className="h-7" />
          </div>
        )}
        <Link to="/" title={isCollapsed ? t('publicPortal') : undefined} className={cn('flex items-center gap-3 rounded-xl py-2 text-sm text-neutral-300 hover:bg-white/[0.06] hover:text-white', isCollapsed ? 'justify-center' : 'px-3')}>
          <Home size={18} /> {!isCollapsed && t('publicPortal')}
        </Link>
        <button onClick={toggleCollapsed} className={cn('hidden w-full items-center gap-3 rounded-xl py-2 text-sm text-neutral-300 hover:bg-white/[0.06] hover:text-white lg:flex', isCollapsed ? 'justify-center' : 'px-3')} aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {isCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />} {!isCollapsed && 'Collapse'}
        </button>
      </div>
    </nav>
  );

  const tabs =
    portal === 'aicte' && officer === 'EVC Inspector'
      ? [
          { to: '/aicte/evc',      label: 'EVC',      icon: <Users size={20} /> },
          { to: '/aicte/evidence', label: 'Evidence',  icon: <ShieldCheck size={20} /> },
        ]
      : BOTTOM_TABS[portal];

  return (
    <div className="has-bottom-nav min-h-screen bg-canvas">
      <RouteProgress />
      <ScrollProgress />
      <BackToTop />
      <GovBar />
      <NetworkBanner />
      <SessionGuard />
      <div className="flex">
        <motion.aside animate={{ width: collapsed ? 80 : 268 }} transition={{ type: 'spring', stiffness: 260, damping: 30 }} className="bg-navy-mesh no-print sticky top-0 hidden h-screen shrink-0 overflow-hidden lg:block">
          {sidebar(collapsed)}
        </motion.aside>
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div className="fixed inset-0 z-40 bg-black/60 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
              <motion.aside className="bg-navy-mesh fixed inset-y-0 left-0 z-50 w-72 lg:hidden" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'tween', duration: 0.22 }}>
                {sidebar(false)}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass no-print sticky top-0 z-30 flex h-[72px] items-center justify-between gap-3 border-b border-slate-200/80 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button className="grid h-10 w-10 place-items-center rounded-xl text-ink-soft hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
                <Menu size={20} />
              </button>
              <Breadcrumbs />
            </div>
            <div className="flex items-center gap-2">
              <SearchTrigger className="hidden w-60 xl:flex" />
              <SearchTrigger compact className="xl:hidden" />
              {session && authMode === 'dev' && (
                <div className="hidden items-center gap-2 lg:flex">
                  <label htmlFor="role" className="text-xs font-medium text-ink-mute">
                    View as
                  </label>
                  {portal === 'aicte' ? (
                    <select
                      id="role"
                      className="input h-10 w-auto py-1.5 text-xs font-semibold"
                      value={session.officerRole}
                      onChange={(e) => {
                        const r = e.target.value as OfficerRole;
                        setOfficerRole(r);
                        if (r === 'EVC Inspector') nav('/aicte/evc');
                      }}
                    >
                      {OFFICER_ROLES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <select id="role" className="input h-10 w-auto py-1.5 text-xs font-semibold" value={session.role} onChange={(e) => setInstitutionRole(e.target.value as InstitutionRole)}>
                      {INSTITUTION_ROLES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              <button onClick={() => setHelpOpen(true)} className="hidden h-10 w-10 place-items-center rounded-xl text-ink-soft hover:bg-slate-100 md:grid" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
                <Keyboard size={18} />
              </button>
              <ConnectionBadge className="hidden md:inline-flex" />
              <button onClick={() => setBellOpen(true)} className="relative grid h-10 w-10 place-items-center rounded-xl text-ink-soft hover:bg-slate-100" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}>
                <Bell size={19} className={unreadCount ? 'origin-top animate-[bell_2.4s_ease-in-out_1]' : ''} />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    <span className="absolute inset-0 animate-ring rounded-full bg-brand-400" aria-hidden />
                    <span className="relative tabular-nums">{unreadCount > 9 ? '9+' : unreadCount}</span>
                  </span>
                )}
              </button>
              <div className="relative">
                <button className="flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2 hover:bg-slate-100" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-haspopup="menu">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-xs font-bold text-white">{initials || (portal === 'aicte' ? 'AI' : 'IN')}</span>
                  <span className="hidden max-w-[190px] text-left leading-tight md:block">
                    <span className="block truncate text-xs font-bold text-ink">{portal === 'aicte' ? session?.name : session?.name.replace(/^Principal, /, '').replace(/ \(.*\)$/, '')}</span>
                    <span className="block truncate text-[11px] text-ink-mute">{portal === 'aicte' ? session?.officerRole : session?.role}</span>
                  </span>
                  <ChevronDown size={14} className="text-ink-mute" />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div role="menu" initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-lift z-50">
                      <div className="px-3 py-2 border-b border-slate-100 mb-1">
                        <p className="text-xs font-bold text-ink">{session?.name}</p>
                        <p className="text-[11px] text-ink-mute">{portal === 'aicte' ? session?.officerRole : session?.role}</p>
                      </div>
                      {authMode === 'dev' && (
                        <div className="px-2 py-1.5 border-b border-slate-100 mb-1 max-h-60 overflow-y-auto">
                          <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-ink-mute mb-1">Switch Role (Dev)</p>
                          {portal === 'aicte' ? (
                            <div className="space-y-0.5">
                              {OFFICER_ROLES.map((r) => (
                                <button
                                  key={r}
                                  onClick={() => {
                                    setOfficerRole(r);
                                    setMenuOpen(false);
                                  }}
                                  className={cn('w-full text-left px-2 py-1 rounded-lg text-xs font-medium transition-colors', session?.officerRole === r ? 'bg-brand-50 text-brand-700 font-bold' : 'text-ink-soft hover:bg-slate-50')}
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              {INSTITUTION_ROLES.map((r) => (
                                <button
                                  key={r}
                                  onClick={() => {
                                    setInstitutionRole(r);
                                    setMenuOpen(false);
                                  }}
                                  className={cn('w-full text-left px-2 py-1 rounded-lg text-xs font-medium transition-colors', session?.role === r ? 'bg-brand-50 text-brand-700 font-bold' : 'text-ink-soft hover:bg-slate-50')}
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <button
                        role="menuitem"
                        onClick={() => {
                          signOut();
                          nav('/');
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        <LogOut size={16} /> {t('signOut')}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="flex-1 px-4 pb-28 pt-8 sm:px-6 lg:px-10 lg:pb-8">
            <div className="mx-auto max-w-[1320px]">
              <NoveltyStrip />
              <Suspense fallback={<LoadingRows rows={6} />}>
                <PageTransition>
                  <Outlet />
                </PageTransition>
              </Suspense>
            </div>
          </main>
          <footer className="no-print flex flex-col gap-1 border-t border-slate-200/80 bg-white/60 px-6 py-3 text-xs text-ink-mute sm:flex-row sm:items-center sm:justify-between lg:px-10">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-indgreen-600" /> Every action is recorded in the tamper-evident evidence log.
            </span>
            <span>Advisory outputs never replace the competent authority's decision.</span>
          </footer>
        </div>
      </div>

      {/* Phone and tablet: thumb-reach tab bar instead of the hidden sidebar */}
      <nav aria-label="Quick navigation" className="glass no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {tabs.map((it) => (
            <li key={it.to}>
              <NavLink to={it.to} end={it.to === home} className={({ isActive }) => cn('relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors', isActive ? 'text-brand-800' : 'text-ink-mute')}>
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId={`tab-${portal}`} className="absolute inset-x-3 top-0 h-[3px] rounded-b-full bg-brand-500" />}
                    {it.icon}
                    <span>{it.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li>
            <button onClick={() => setMobileOpen(true)} className="flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-ink-mute">
              <Menu size={20} />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Notifications drawer */}
      <AnimatePresence>
        {bellOpen && (
          <>
            <motion.div className="fixed inset-0 z-[60] bg-brand-950/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBellOpen(false)} />
            <motion.aside role="dialog" aria-label="Notifications" className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-sm flex-col bg-white shadow-lift" initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="font-display font-bold">Notifications</h2>
                <button onClick={() => setBellOpen(false)} className="rounded-lg p-1.5 text-ink-mute hover:bg-slate-100" aria-label="Close">
                  <X size={18} />
                </button>
              </div>
              <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
                {notifs.map((n, i) => (
                  <motion.li key={n.title} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + i * 0.06 }} className="flex gap-3 px-5 py-4">
                    <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', n.tone === 'red' ? 'bg-red-500' : n.tone === 'amber' ? 'bg-amber-500' : n.tone === 'green' ? 'bg-indgreen-500' : 'bg-brand-500')} />
                    <div>
                      <p className="text-sm font-semibold text-ink">{n.title}</p>
                      <p className="mt-0.5 text-xs text-ink-mute">{n.meta}</p>
                    </div>
                  </motion.li>
                ))}
              </ul>
              <div className="border-t border-slate-100 p-4">
                <Link to={portal === 'aicte' ? '/aicte/alerts' : '/institution/compliance'} className="btn-secondary w-full">
                  See everything
                </Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Keyboard shortcuts">
        <ul className="space-y-3 text-sm">
          {[
            [['Ctrl', 'K'], 'Search or jump anywhere'],
            [['?'], 'Show this list'],
            [['g', 'd'], portal === 'aicte' ? 'Go to command centre' : 'Go to dashboard'],
            ...(portal === 'aicte'
              ? ([
                  [['g', 'q'], 'Go to work queue'],
                  [['g', 'e'], 'Go to EVC scheduling'],
                  [['g', 'i'], 'Go to bottleneck insights'],
                  [['g', 'r'], 'Go to rules studio'],
                  [['g', 'l'], 'Go to evidence log'],
                ] as [string[], string][])
              : ([
                  [['g', 'n'], 'Start a new application'],
                  [['g', 'a'], 'Go to my applications'],
                  [['g', 'c'], 'Go to compliance'],
                ] as [string[], string][])),
          ].map(([keys, label]) => (
            <li key={label as string} className="flex items-center justify-between">
              <span className="text-ink-soft">{label as string}</span>
              <span className="flex gap-1">
                {(keys as string[]).map((k) => (
                  <span key={k} className="kbd">
                    {k}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </Modal>

      <Toaster />
      <CommandPalette />
      <Assistant />
    </div>
  );
}

export { HelpCircle };
