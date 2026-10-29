import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { HomeLayout, PortalLayout, PublicLayout } from './components/layout';
import { useSession, type Portal } from './lib/session';
import { LoadingRows } from './components/ui';

/* Public portal */
const Home = lazy(() => import('./pages/public/Home'));
const RulesExplorer = lazy(() => import('./pages/public/RulesExplorer'));
const Institutions = lazy(() => import('./pages/public/Institutions'));
const Verify = lazy(() => import('./pages/public/Verify'));
const PublicCalendar = lazy(() => import('./pages/public/Calendar'));
const Notices = lazy(() => import('./pages/public/Notices'));
const Help = lazy(() => import('./pages/public/Help'));
const About = lazy(() => import('./pages/public/About'));
const Solution = lazy(() => import('./pages/public/Solution'));
const Login = lazy(() => import('./pages/public/Login'));
const Letter = lazy(() => import('./pages/public/Letter'));
const Glossary = lazy(() => import('./pages/public/Glossary'));
const Sitemap = lazy(() => import('./pages/public/Sitemap'));
const Status = lazy(() => import('./pages/public/Status'));
const NotFound = lazy(() => import('./pages/public/NotFound'));

/* Institution portal */
const InstDashboard = lazy(() => import('./pages/institution/Dashboard'));
const Apply = lazy(() => import('./pages/institution/Apply'));
const InstApplications = lazy(() => import('./pages/institution/Applications'));
const Tracker = lazy(() => import('./pages/institution/Tracker'));
const InstCompliance = lazy(() => import('./pages/institution/Compliance'));
const DocumentVault = lazy(() => import('./pages/institution/Documents'));
const InstNotifications = lazy(() => import('./pages/institution/Notifications'));
const InstProfile = lazy(() => import('./pages/institution/Profile'));
const Infrastructure = lazy(() => import('./pages/institution/Infrastructure'));
const Courses = lazy(() => import('./pages/institution/Courses'));
const FacultyRoster = lazy(() => import('./pages/institution/Faculty'));
const Team = lazy(() => import('./pages/institution/Team'));

/* AICTE portal — existing */
const Command = lazy(() => import('./pages/aicte/Command'));
const Queue = lazy(() => import('./pages/aicte/Queue'));
const Dossier = lazy(() => import('./pages/aicte/Dossier'));
const Evc = lazy(() => import('./pages/aicte/Evc'));
const AicteCompliance = lazy(() => import('./pages/aicte/Compliance'));
const Insights = lazy(() => import('./pages/aicte/Insights'));
const Simulator = lazy(() => import('./pages/aicte/Simulator'));
const Reports = lazy(() => import('./pages/aicte/Reports'));
const RulesStudio = lazy(() => import('./pages/aicte/RulesStudio'));
const CalendarAdmin = lazy(() => import('./pages/aicte/CalendarAdmin'));
const Evidence = lazy(() => import('./pages/aicte/Evidence'));
const SettingsPage = lazy(() => import('./pages/aicte/Settings'));
const Integrity = lazy(() => import('./pages/aicte/Integrity'));
const Routing = lazy(() => import('./pages/aicte/Routing'));
const Field = lazy(() => import('./pages/aicte/Field'));
const FieldInspection = lazy(() => import('./pages/aicte/FieldInspection'));
const Verification = lazy(() => import('./pages/aicte/Verification'));
const VerificationDetail = lazy(() => import('./pages/aicte/VerificationDetail'));
const AiDisputes = lazy(() => import('./pages/aicte/AiDisputes'));
const Admin = lazy(() => import('./pages/aicte/Admin'));
/* AICTE portal — new (spec document rebuild) */
const RegulationBureau   = lazy(() => import('./pages/aicte/RegulationBureau'));
const Scrutiny           = lazy(() => import('./pages/aicte/Scrutiny'));
const SHC                = lazy(() => import('./pages/aicte/SHC'));
const ExecutiveCommittee = lazy(() => import('./pages/aicte/ExecutiveCommittee'));
const Council            = lazy(() => import('./pages/aicte/Council'));
const AlertCentre        = lazy(() => import('./pages/aicte/AlertCentre'));
const Performance = lazy(() => import('./pages/public/Performance'));

function RequirePortal({ portal, children }: { portal: Portal; children: ReactNode }) {
  const { session, ready } = useSession();
  const loc = useLocation();
  if (!ready) return <Fallback />; // still asking the server whether a single sign-on session exists
  if (session?.portal !== portal) return <Navigate to={`/login?portal=${portal}&next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <>{children}</>;
}

const Fallback = () => (
  <div className="mx-auto max-w-5xl">
    <LoadingRows rows={6} />
  </div>
);

export default function App() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route element={<HomeLayout />}>
          <Route index element={<Home />} />
        </Route>
        <Route element={<PublicLayout />}>
          <Route path="rules" element={<RulesExplorer />} />
          <Route path="institutions" element={<Institutions />} />
          <Route path="verify" element={<Verify />} />
          <Route path="calendar" element={<PublicCalendar />} />
          <Route path="notices" element={<Notices />} />
          <Route path="help" element={<Help />} />
          <Route path="about" element={<About />} />
          <Route path="solution" element={<Solution />} />
          <Route path="login" element={<Login />} />
          <Route path="letter/:id" element={<Letter />} />
          <Route path="glossary" element={<Glossary />} />
          <Route path="sitemap" element={<Sitemap />} />
          <Route path="status" element={<Status />} />
          <Route path="performance" element={<Performance />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route
          path="institution"
          element={
            <RequirePortal portal="institution">
              <PortalLayout portal="institution" />
            </RequirePortal>
          }
        >
          <Route index element={<InstDashboard />} />
          <Route path="apply" element={<Apply />} />
          <Route path="applications" element={<InstApplications />} />
          <Route path="applications/:id" element={<Tracker />} />
          <Route path="compliance" element={<InstCompliance />} />
          <Route path="documents" element={<DocumentVault />} />
          <Route path="notifications" element={<InstNotifications />} />
          <Route path="profile" element={<InstProfile />} />
          <Route path="infrastructure" element={<Infrastructure />} />
          <Route path="courses" element={<Courses />} />
          <Route path="faculty" element={<FacultyRoster />} />
          <Route path="team" element={<Team />} />
        </Route>

        <Route
          path="aicte"
          element={
            <RequirePortal portal="aicte">
              <PortalLayout portal="aicte" />
            </RequirePortal>
          }
        >
          {/* Main dashboard */}
          <Route index element={<Command />} />
          {/* New spec-aligned portals */}
          <Route path="bureau"    element={<RegulationBureau />} />
          <Route path="scrutiny"  element={<Scrutiny />} />
          <Route path="evc"       element={<Evc />} />
          <Route path="shc"       element={<SHC />} />
          <Route path="executive" element={<ExecutiveCommittee />} />
          <Route path="council"   element={<Council />} />
          <Route path="alerts"    element={<AlertCentre />} />
          {/* Intelligence & administration */}
          <Route path="insights"  element={<Insights />} />
          <Route path="reports"   element={<Reports />} />
          <Route path="rules"     element={<RulesStudio />} />
          <Route path="calendar"  element={<CalendarAdmin />} />
          <Route path="settings"  element={<SettingsPage />} />
          <Route path="admin"     element={<Admin />} />
          {/* Legacy routes kept for backward compat */}
          <Route path="queue"                element={<Queue />} />
          <Route path="applications/:id"     element={<Dossier />} />
          <Route path="compliance"           element={<AicteCompliance />} />
          <Route path="simulator"            element={<Simulator />} />
          <Route path="evidence"             element={<Evidence />} />
          <Route path="integrity"            element={<Integrity />} />
          <Route path="routing"              element={<Routing />} />
          <Route path="field"                element={<Field />} />
          <Route path="field/:id"            element={<FieldInspection />} />
          <Route path="verification"         element={<Verification />} />
          <Route path="verification/:id"     element={<VerificationDetail />} />
          <Route path="ai-disputes"          element={<AiDisputes />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
