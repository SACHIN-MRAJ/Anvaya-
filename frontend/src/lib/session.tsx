import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEMO_INSTITUTION } from '../data/institutions';
import { apiMe, apiSignIn, apiSignOut, getAuthMode, USE_API, type AuthMode, type Principal } from '../services/api';
import { resetAll } from './resource';

/**
 * Who is signed in. With development sign-in the person picks a sample account; with single sign-on the
 * server's session cookie is the source of truth and this context mirrors it (see the effect below).
 */
export type Portal = 'institution' | 'aicte';
export const OFFICER_ROLES = [
  'Regulation Bureau Admin',
  'Scrutiny Reviewer',
  'EVC Inspector',
  'SHC Compliance Reviewer',
  'Executive Committee Approver',
  'Council Decision Authority',
] as const;
export type OfficerRole = (typeof OFFICER_ROLES)[number];
export const INSTITUTION_ROLES = ['Institution Administrator', 'Institution Staff / Application Officer'] as const;
export type InstitutionRole = (typeof INSTITUTION_ROLES)[number];

/** Sample people behind each role (the same names the server's development sign-in uses). */
const OFFICER_NAME: Record<OfficerRole, string> = {
  'Regulation Bureau Admin': 'R. Verma',
  'Scrutiny Reviewer': 'A. Sharma',
  'EVC Inspector': 'Dr. R. Menon',
  'SHC Compliance Reviewer': 'L. Fernandes',
  'Executive Committee Approver': 'T. Singh',
  'Council Decision Authority': 'P. Nair',
};
const INSTITUTION_NAME: Record<InstitutionRole, string> = {
  'Institution Administrator': 'Principal, Narmada Valley Institute of Technology',
  'Institution Staff / Application Officer': 'K. Rao (Application Officer)',
};
export const officerSession = (role: OfficerRole): Session => ({ portal: 'aicte', name: OFFICER_NAME[role], role: 'AICTE Official', officerRole: role });
export const institutionSession = (role: InstitutionRole): Session => ({ portal: 'institution', name: INSTITUTION_NAME[role], role, institutionId: 'INS-001' });

/** What each institution role may do; the server enforces the same table (backend/app/security.py). */
export const INSTITUTION_PERMISSIONS: Record<string, InstitutionRole[]> = {
  submit: ['Institution Administrator'],
  upload: [...INSTITUTION_ROLES],
  review: ['Institution Administrator'],
  profile: ['Institution Administrator'],
  infrastructure: [...INSTITUTION_ROLES],
  academics: [...INSTITUTION_ROLES],
  team: ['Institution Administrator'],
  respond: [...INSTITUTION_ROLES],
};
export const may = (s: Session | null, permission: keyof typeof INSTITUTION_PERMISSIONS) => s?.portal === 'institution' && (INSTITUTION_PERMISSIONS[permission] as string[]).includes(s.role);

export interface Session {
  portal: Portal;
  name: string;
  role: string;
  officerRole?: OfficerRole;
  institutionId?: string;
  region?: string;
}

interface Ctx {
  session: Session | null;
  /** False until the server has been asked whether a session already exists (after a single sign-on redirect). */
  ready: boolean;
  authMode: AuthMode;
  signIn: (s: Session) => void;
  signOut: () => void;
  setOfficerRole: (r: OfficerRole) => void;
  setInstitutionRole: (r: InstitutionRole) => void;
}

const SessionContext = createContext<Ctx | null>(null);

const load = (): Session | null => {
  try {
    const v = sessionStorage.getItem('anumati.session');
    return v ? (JSON.parse(v) as Session) : null;
  } catch {
    return null;
  }
};
const save = (s: Session | null) => {
  try {
    if (s) sessionStorage.setItem('anumati.session', JSON.stringify(s));
    else sessionStorage.removeItem('anumati.session');
  } catch {
    /* ignore */
  }
};

/* ─ Maps the new UX role names → what the backend's dev-login endpoint accepts ─ */
const BACKEND_ROLE: Record<string, string> = {
  /* Institution */
  'Institution Administrator': 'Principal / Director',
  'Institution Staff / Application Officer': 'Institution staff',
  'Institution Staff':         'Institution staff',
  /* AICTE */
  'Regulation Bureau Admin':       'Bureau head',
  'Scrutiny Reviewer':             'Regional officer',
  'EVC Inspector':                 'EVC coordinator',
  'SHC Compliance Reviewer':       'Committee member',
  'Executive Committee Approver':  'Committee member',
  'Council Decision Authority':    'Bureau head',
};

/* Converts a backend role string back to the nearest frontend display name */
const DISPLAY_ROLE: Record<string, OfficerRole> = {
  'Bureau head':       'Regulation Bureau Admin',
  'Regional officer':  'Scrutiny Reviewer',
  'Dealing officer':   'Scrutiny Reviewer',
  'Inspector':         'EVC Inspector',
  'EVC coordinator':   'EVC Inspector',
  'Auditor':           'Scrutiny Reviewer',
  'Committee member':  'Executive Committee Approver',
  'Rules administrator': 'Regulation Bureau Admin',
  'System administrator': 'Regulation Bureau Admin',
};

const fromPrincipal = (p: Principal): Session => {
  if (p.portal === 'aicte') {
    return {
      portal: 'aicte',
      name: p.name,
      role: 'AICTE Official',
      officerRole: DISPLAY_ROLE[p.role] ?? (p.role as OfficerRole),
      region: p.region ?? undefined,
    };
  }
  const isStaff = p.role === 'Institution staff' || p.role.includes('staff') || p.role.includes('Officer');
  return {
    portal: 'institution',
    name: p.name,
    role: isStaff ? 'Institution Staff / Application Officer' : 'Institution Administrator',
    institutionId: p.institutionId ?? undefined,
  };
};

export const DEMO_SESSIONS: Record<Portal, Session> = {
  institution: { portal: 'institution', name: 'Principal, ' + DEMO_INSTITUTION.name.split(',')[0], role: 'Institution Administrator', institutionId: DEMO_INSTITUTION.id },
  aicte: { portal: 'aicte', name: 'R. Verma', role: 'AICTE Official', officerRole: 'Regulation Bureau Admin' },
};

/* Returns the role string the backend understands (the old name) */
const roleOf = (s: Session) => {
  const display = s.portal === 'aicte' ? (s.officerRole ?? s.role) : s.role;
  return BACKEND_ROLE[display] ?? display;
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(load);
  const [authMode, setAuthMode] = useState<AuthMode>('dev');
  const [ready, setReady] = useState(() => !USE_API || load() !== null);

  useEffect(() => {
    let live = true;
    void getAuthMode().then(async (mode) => {
      if (!live) return;
      setAuthMode(mode);
      // After a single sign-on redirect the browser holds the server's session cookie but this tab has no copy yet.
      if (mode === 'oidc' || !load()) {
        const me = await apiMe();
        if (!live) return;
        if (me) {
          const s = fromPrincipal(me);
          setSession(s);
          save(s);
        } else if (mode === 'oidc') {
          setSession(null);
          save(null);
        }
      }
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const value: Ctx = {
    session,
    ready,
    authMode,
    signIn: (s) => {
      setSession(s);
      save(s);
      void apiSignIn(s.portal, roleOf(s)).then(resetAll); // nothing cached from the previous person survives
    },
    signOut: () => {
      setSession(null);
      save(null);
      resetAll();
      void apiSignOut().then((ssoLogout) => {
        if (ssoLogout) window.location.assign(ssoLogout); // also ends the Keycloak session
      });
    },
    setOfficerRole: (r) => {
      if (authMode === 'oidc') return; // roles come from the person's account
      const next = officerSession(r);
      setSession(next);
      save(next);
      void apiSignIn('aicte', BACKEND_ROLE[r] ?? r).then(resetAll);
    },
    setInstitutionRole: (r) => {
      if (authMode === 'oidc') return;
      const next = institutionSession(r);
      setSession(next);
      save(next);
      void apiSignIn('institution', BACKEND_ROLE[r] ?? r).then(resetAll);
    },
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
