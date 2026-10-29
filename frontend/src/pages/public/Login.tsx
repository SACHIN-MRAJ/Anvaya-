import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight, BadgeCheck, Building2, ClipboardCheck, Inbox, KeyRound,
  Landmark, Loader2, Lock, Scale, Search, ShieldCheck, TriangleAlert, Users,
} from 'lucide-react';
import {
  INSTITUTION_ROLES, institutionSession, OFFICER_ROLES, officerSession,
  useSession, type InstitutionRole, type OfficerRole, type Portal,
} from '../../lib/session';
import { DEMO_INSTITUTION } from '../../data/institutions';
import { AicteLogo, LogoMark } from '../../components/brand';
import { cn } from '../../lib/utils';
import { ssoLoginUrl } from '../../services/api';

/* ─── Role metadata ─────────────────────────────────────────────────────── */
const AICTE_ROLES: {
  role: OfficerRole;
  icon: React.ReactNode;
  title: string;
  sub: string;
  portal: string;
}[] = [
  {
    role: 'Regulation Bureau Admin',
    icon: <Inbox size={18} />,
    title: 'Regulation Bureau',
    sub: 'Application queue, scheduling, what-if simulator',
    portal: '/aicte/bureau',
  },
  {
    role: 'Scrutiny Reviewer',
    icon: <Search size={18} />,
    title: 'Scrutiny Reviewer',
    sub: 'Document review, deficiency management, reports',
    portal: '/aicte/scrutiny',
  },
  {
    role: 'EVC Inspector',
    icon: <ClipboardCheck size={18} />,
    title: 'EVC Inspector',
    sub: 'Site inspections, panel scheduling, evidence log',
    portal: '/aicte/evc',
  },
  {
    role: 'SHC Compliance Reviewer',
    icon: <Scale size={18} />,
    title: 'SHC Reviewer',
    sub: 'Compliance cases, show-cause, hearing records',
    portal: '/aicte/shc',
  },
  {
    role: 'Executive Committee Approver',
    icon: <Users size={18} />,
    title: 'Executive Committee',
    sub: 'Decision queue, case review, record decisions',
    portal: '/aicte/executive',
  },
  {
    role: 'Council Decision Authority',
    icon: <Landmark size={18} />,
    title: 'Council Authority',
    sub: 'Ratification, appeal decisions, Council queue',
    portal: '/aicte/council',
  },
];

const INSTITUTION_ROLE_META: {
  role: InstitutionRole;
  title: string;
  sub: string;
}[] = [
  {
    role: 'Institution Administrator',
    title: 'Institution Administrator',
    sub: 'Submit applications, manage profile and team, sign with DSC',
  },
  {
    role: 'Institution Staff / Application Officer',
    title: 'Institution Staff / Application Officer',
    sub: 'Prepare applications, upload documents and track progress',
  },
];

/* ═══════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════ */
export default function Login() {
  const [params] = useSearchParams();
  const [portal, setPortal] = useState<Portal>((params.get('portal') as Portal) ?? 'institution');
  const [role, setRole] = useState<OfficerRole>('Regulation Bureau Admin');
  const [instRole, setInstRole] = useState<InstitutionRole>('Institution Administrator');
  const [busy, setBusy] = useState(false);
  const { signIn, authMode } = useSession();
  const nav = useNavigate();
  const sso = authMode === 'oidc';

  const go = () => {
    setBusy(true);
    if (sso) {
      const next = params.get('next');
      window.location.assign(ssoLoginUrl(next && next.startsWith(`/${portal}`) ? next : portal === 'aicte' ? '/aicte' : '/institution'));
      return;
    }
    setTimeout(() => {
      signIn(portal === 'aicte' ? officerSession(role) : institutionSession(instRole));
      const next = params.get('next');
      nav(next && next.startsWith(`/${portal}`) ? next : portal === 'aicte' ? '/aicte' : '/institution');
    }, 550);
  };

  return (
    <div className="container-page py-10 lg:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-lift lg:grid-cols-[1fr_1.15fr]">

        {/* ── Left panel: dark branding ─────────────────────── */}
        <div className="bg-navy-mesh relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-brand-500/15 blur-3xl" aria-hidden />
          <div className="relative">
            <LogoMark size={60} animated />
            <p className="mt-7 font-display text-[1.75rem] font-extrabold leading-snug text-white">
              Welcome to<br />
              <span className="text-brand-300">ANUMATI</span>
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/70">
              The AICTE approval platform — transparent, auditable, end-to-end.
            </p>
          </div>

          <ul className="relative mt-8 space-y-4 text-sm">
            {[
              { icon: <ShieldCheck size={16} />, t: 'Role-based access', d: 'Each role sees only the screens it needs.' },
              { icon: <Lock size={16} />,        t: 'Every action logged', d: 'Immutable audit trail from submission to decision.' },
              { icon: <KeyRound size={16} />,    t: 'AI document check', d: 'OCR + NLP + rules engine before you submit.' },
              { icon: <BadgeCheck size={16} />,  t: 'Tamper-evident letters', d: 'Ed25519 signed + QR-verifiable approval letters.' },
            ].map((f, i) => (
              <motion.li
                key={f.t}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.08, duration: 0.4 }}
                className="flex gap-3"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-brand-300">
                  {f.icon}
                </span>
                <span>
                  <span className="block font-semibold text-white">{f.t}</span>
                  <span className="text-[12px] text-white/55 leading-tight">{f.d}</span>
                </span>
              </motion.li>
            ))}
          </ul>

          <div className="relative mt-8 rounded-2xl bg-white/[0.06] px-4 py-3">
            <AicteLogo variant="light" className="h-8" />
          </div>
        </div>

        {/* ── Right panel: form ─────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="p-6 sm:p-8">
          <div className="lg:hidden mb-5"><LogoMark size={44} /></div>

          <h1 className="font-display text-2xl font-extrabold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-ink-mute">Select your portal and role to continue.</p>

          {/* ── Alerts ── */}
          {params.get('reason') === 'sso' && (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
              <TriangleAlert size={15} className="mt-0.5 shrink-0" />
              {params.get('message') || 'Single sign-on did not complete. Please try again.'}
            </p>
          )}
          {params.get('reason') === 'timeout' && (
            <p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <Lock size={15} className="mt-0.5 shrink-0" />
              You were signed out after 15 minutes of inactivity.
            </p>
          )}

          {/* ── Portal tab switcher ── */}
          <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-neutral-100 p-1.5" role="tablist">
            {(['institution', 'aicte'] as Portal[]).map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={portal === p}
                onClick={() => setPortal(p)}
                className={cn('relative flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors', portal === p ? 'text-brand-800' : 'text-ink-mute hover:text-ink')}
              >
                {portal === p && (
                  <motion.span
                    layoutId="login-tab"
                    className="absolute inset-0 rounded-xl bg-white shadow-card"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  {p === 'institution' ? <Building2 size={15} /> : <Landmark size={15} />}
                  {p === 'institution' ? 'Institution' : 'AICTE official'}
                </span>
              </button>
            ))}
          </div>

          {/* ── Form ── */}
          <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); go(); }}>
            <AnimatePresence mode="wait">
              {sso ? (
                <motion.div key="sso" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-4 text-sm text-brand-900">
                  <p className="flex items-center gap-2 font-semibold"><ShieldCheck size={16} /> AICTE single sign-on</p>
                  <p className="mt-1.5 text-brand-800 text-[13px]">
                    {portal === 'institution'
                      ? 'Sign in with the account registered for your institution.'
                      : 'Sign in with your official AICTE account. A one-time code may be required.'}
                  </p>
                </motion.div>
              ) : portal === 'institution' ? (
                <motion.div key="inst" initial={{ opacity:0, x:8 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-8 }} transition={{ duration:0.22 }} className="space-y-4">
                  {/* Credentials */}
                  <div>
                    <label className="label" htmlFor="aid">AICTE institution ID</label>
                    <input id="aid" className="input font-mono text-sm" defaultValue={DEMO_INSTITUTION.aicteId} />
                  </div>
                  <div>
                    <label className="label" htmlFor="pw">Password</label>
                    <input id="pw" type="password" className="input" defaultValue="anumati-demo" autoComplete="current-password" />
                  </div>
                  {/* Role selection — radio cards */}
                  <div>
                    <p className="label mb-2">Your role at the institution</p>
                    <div className="grid grid-cols-2 gap-2">
                      {INSTITUTION_ROLE_META.map(({ role: r, title, sub }) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setInstRole(r)}
                          className={cn(
                            'rounded-xl border px-3 py-3 text-left transition-all duration-150',
                            instRole === r
                              ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-400'
                              : 'border-neutral-200 hover:border-brand-300 hover:bg-neutral-50'
                          )}
                        >
                          <p className={cn('text-xs font-bold leading-tight', instRole === r ? 'text-brand-800' : 'text-ink')}>{title}</p>
                          <p className="text-[11px] text-ink-mute mt-0.5 leading-tight">{sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="rounded-xl bg-neutral-50 border border-neutral-200 px-3 py-2 text-xs text-ink-mute">
                    Demo: <span className="font-semibold text-ink">{DEMO_INSTITUTION.name}</span>
                  </p>
                </motion.div>
              ) : (
                <motion.div key="aicte" initial={{ opacity:0, x:8 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-8 }} transition={{ duration:0.22 }} className="space-y-4">
                  {/* Credentials */}
                  <div>
                    <label className="label" htmlFor="email">Official email</label>
                    <input id="email" className="input text-sm" defaultValue="r.verma@aicte.example" autoComplete="username" />
                  </div>
                  {/* Role cards — 2-column grid */}
                  <div>
                    <p className="label mb-2">Select your role</p>
                    <div className="grid grid-cols-2 gap-2">
                      {AICTE_ROLES.map(({ role: r, icon, title, sub }) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={cn(
                            'group flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all duration-150',
                            role === r
                              ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-400'
                              : 'border-neutral-200 hover:border-brand-300 hover:bg-neutral-50'
                          )}
                        >
                          <span className={cn(
                            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
                            role === r ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-500 group-hover:bg-brand-100 group-hover:text-brand-700'
                          )}>
                            {icon}
                          </span>
                          <span>
                            <span className={cn('block text-[12px] font-bold leading-tight', role === r ? 'text-brand-800' : 'text-ink')}>
                              {title}
                            </span>
                            <span className="block text-[10px] text-ink-mute mt-0.5 leading-tight">{sub}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-ink-mute">
                    In demo mode, credentials are not verified — select a role and sign in directly.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              className="btn-primary w-full py-3 text-sm"
              disabled={busy}
              style={{ boxShadow: '0 6px 20px rgba(5,150,105,0.25)' }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {busy ? 'Signing in…' : sso ? 'Continue with single sign-on' : 'Sign in'}
              {!busy && <ArrowRight size={15} />}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
