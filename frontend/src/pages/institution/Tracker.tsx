import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CalendarClock, CalendarPlus, CheckCircle2, Download, FileUp, Gavel, Loader2, UserRound } from 'lucide-react';
import { useAsync } from '../../lib/useAsync';
import { ApiError, getApplication, letterText, newIdempotencyKey, respondToDeficiency, uploadDocument } from '../../services/api';
import { preflight } from '../../lib/files';
import { typeById } from '../../data/rules';
import { STAGE_LABEL } from '../../data/applications';
import { Badge, Callout, Card, ClockBadge, EmptyState, LoadingRows, PageHeader, PublicStatusBadge, WhyChip, toast } from '../../components/ui';
import { Tour } from '../../components/live';
import { TRACKER_TOUR } from '../../data/tours';
import { ApplicationTimeline, DecisionEta, expectedDecision } from './shared';
import { getApplicationDocuments } from '../../services/records';
import { DocStatus } from '../../components/records-ui';
import { QrCode, verifyUrl } from '../../components/qr';
import { Term, WithTerms } from '../../components/term';
import { downloadIcs } from '../../lib/files';
import { addDays, cn, daysBetween, formatDate, formatDateTime, TODAY } from '../../lib/utils';

export default function Tracker() {
  const { id = '' } = useParams();
  const { data: app, loading } = useAsync(() => getApplication(id), [id]);
  const docs = useAsync(() => getApplicationDocuments(id), [id]);
  const [responded, setResponded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [plan, setPlan] = useState([true, false, false]);
  const replyKey = useRef(newIdempotencyKey()); // one key per reply, reused if the click is repeated
  const picker = useRef<HTMLInputElement>(null);

  if (loading) return <LoadingRows rows={6} />;
  if (!app) return <EmptyState title="Application not found" text={`No application ${id} for your institution.`} action={<Link to="/institution/applications" className="btn-secondary">Back to applications</Link>} />;

  const t = typeById(app.typeId);
  const daysLeft = daysBetween(TODAY, app.dueOn);
  const clock = responded ? 'running' : app.clock;

  /** Uploads the corrected NOC and sends it as the reply: the server restarts the clock and moves the file to re-scrutiny. */
  const respond = async (file: File) => {
    setUploading(true);
    try {
      const check = await preflight(file);
      if (check.errors.length) {
        toast(check.errors[0], 'red');
        return;
      }
      const doc = await uploadDocument(file, file.name, 'uni', app.id);
      await respondToDeficiency(app.id, `Corrected NOC: ${file.name}`, replyKey.current, doc ? [doc.id] : []);
      setResponded(true);
      setPlan([true, true, true]);
      toast('Corrected NOC uploaded. The clock has restarted and the file is back with AICTE.');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not send the reply. Please try again.', 'red');
    } finally {
      setUploading(false);
    }
  };

  const download = () => {
    const blob = new Blob([letterText(app)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decision-${app.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Link to="/institution/applications" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-mute hover:text-brand-700">
        <ArrowLeft size={15} /> All applications
      </Link>
      <PageHeader
        eyebrow={`${app.id} · cycle ${app.cycle}`}
        title={t.name}
        description={`Track your application stage by stage — see exactly where it is, what AICTE has checked, and what you need to do. Submitted ${formatDate(app.submittedOn)} · ${t.clause}`}
        actions={
          <>
            <PublicStatusBadge status={responded ? 'Ongoing' : app.publicStatus} />
            <ClockBadge state={clock} />
          </>
        }
        tourId="tracker"
      />
      <Tour id="tracker" steps={TRACKER_TOUR} />

      {/* Application timeline — the single source of truth for stage progress */}
      <Card
        data-tour="timeline"
        title="Application timeline"
        subtitle="Every stage with dates — green = done, pulsing = in progress, grey = ahead"
        className="mb-6"
        action={
          <span className="flex items-center gap-1.5 text-xs text-ink-mute">
            <WhyChip rule={`Path: ${t.name}`} clause={`${t.clause}; APH Table 2.3`} detail="Stages set automatically by the rules engine from the handbook." />
          </span>
        }
      >
        <ApplicationTimeline app={app} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {app.publicStatus === 'Action needed' && !responded && (
            <motion.div data-tour="action-panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card title="Action needed from you" subtitle="Deficiency recorded by the scrutiny committee (APH 1.8(f))" action={<Badge tone="amber">{plan.filter(Boolean).length} of 3 done</Badge>}>
                <Callout tone="amber" title="University NOC does not name the new course title">
                  Upload an <Term k="NOC" /> that names "B.Tech CSE (Data Science)". <Term k="Re-scrutiny" /> will check only this deficiency (APH 1.8(g)).
                </Callout>
                <p className="mt-5 text-xs font-bold uppercase tracking-wider text-ink-mute">Your plan</p>
                <ol className="mt-2 space-y-2">
                  {['Ask the university for an NOC that names the exact course title', 'Have the Trust Secretary sign the PDF with a DSC', 'Upload it here; the clock restarts automatically'].map((step, i) => (
                    <li key={step}>
                      <label className={cn('flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors', plan[i] ? 'border-indgreen-100 bg-indgreen-50/50' : 'border-slate-200 hover:border-brand-300')}>
                        <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={plan[i]} disabled={i === 2} onChange={(e) => setPlan((p) => p.map((v, j) => (j === i ? e.target.checked : v)))} />
                        <span className={cn('flex-1', plan[i] ? 'text-ink-mute line-through' : 'text-ink')}>{step}</span>
                      </label>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button className="btn-primary" onClick={() => picker.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />} {uploading ? 'Sending…' : 'Upload corrected NOC'}
                  </button>
                  <input ref={picker} type="file" accept="application/pdf" className="sr-only" onChange={(e) => e.target.files?.[0] && respond(e.target.files[0])} />
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => downloadIcs(`reply-${app.id}.ics`, [{ title: `Reply to AICTE on ${app.id}: corrected NOC`, date: addDays(TODAY, 7), description: 'Upload the corrected university NOC on ANUMATI.' }], 'ANUMATI reminders')}
                  >
                    <CalendarPlus size={14} /> Remind me in 7 days
                  </button>
                  <span className="w-full text-xs text-ink-mute">The clock is paused while AICTE waits for you and restarts when you upload.</span>
                </div>
              </Card>
            </motion.div>
          )}

          {app.outcome && (
            <Card title="Decision" subtitle={`Recorded ${formatDate(app.stageEnteredOn)} by the Executive Committee`}>
              <p className="text-lg font-semibold text-indgreen-700">{app.outcome === 'EoA' ? 'Extension of Approval granted' : app.outcome === 'LoA' ? 'Letter of Approval granted' : app.outcome === 'LoD' ? 'Letter of Deficiency issued' : 'Letter of Rejection issued'}</p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                <QrCode value={verifyUrl(app.id)} size={96} className="border border-slate-200" />
                <div className="flex flex-wrap gap-2">
                  <Link to={`/letter/${app.id}`} className="btn-primary">
                    Open letter
                  </Link>
                  <button className="btn-secondary" onClick={download}>
                    <Download size={16} /> Download text copy
                  </button>
                  <Link to={`/verify?ref=${app.id}`} className="btn-ghost">
                    Verify
                  </Link>
                </div>
              </div>
              {app.outcome === 'LoD' && (
                <div className="mt-4">
                  <Callout tone="amber" icon={<Gavel size={18} />} title="Appeal window: 7 days">
                    You can appeal once to the Standing Appellate Committee within 7 days of this decision (APH 2.24).
                  </Callout>
                </div>
              )}
            </Card>
          )}

          {docs.data && (
            <Card data-tour="doc-checklist" title="Document checklist" subtitle="Where each document is in AICTE's check" pad={false}>
              <ul className="divide-y divide-slate-100">
                {docs.data.documents.map((d) => {
                  const last = d.versions[d.versions.length - 1];
                  return (
                    <li key={d.kind} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{d.name}</span>
                        {last?.reviewNote && d.status === 'needs correction' && <span className="block text-xs text-amber-800">{last.reviewNote}</span>}
                        {last && <span className="block text-xs text-ink-mute">v{last.version} · {last.filename}</span>}
                      </span>
                      <DocStatus status={d.status} />
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card data-tour="history" title="History" subtitle="Every step is hash-chained in the evidence log — nothing can be changed quietly" pad={false}>
            <ol className="relative px-6 py-5">
              {[...app.history].reverse().map((h, i) => (
                <motion.li key={h.at + i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="relative pb-6 pl-7 last:pb-0">
                  <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-brand-600 bg-white" />
                  {i < app.history.length - 1 && <span className="absolute left-[5px] top-5 h-full w-0.5 bg-slate-200" />}
                  <p className="text-sm font-medium">{h.action}</p>
                  <p className="text-xs text-ink-mute">
                    {formatDateTime(h.at)} · {h.actor} ({h.role})
                  </p>
                  {h.note && <p className="mt-1 text-sm text-ink-mute">{h.note}</p>}
                  {h.ruleRef && (
                    <div className="mt-1.5">
                      <WhyChip rule={h.action} clause={h.ruleRef} />
                    </div>
                  )}
                </motion.li>
              ))}
            </ol>
          </Card>
        </div>

        <aside className="space-y-6">
          {app.stage !== 'decision' && (
            <Card>
              <DecisionEta
                app={app}
                onCalendar={() => {
                  const eta = expectedDecision(app);
                  if (eta) downloadIcs(`decision-${app.id}.ics`, [{ title: `${app.id}: decision expected`, date: eta.likely, description: `${t.name}. Most likely between ${formatDate(eta.early)} and ${formatDate(eta.late)}.` }]);
                }}
              />
            </Card>
          )}
          <Card title="Where it is now">
            <dl className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <UserRound size={18} className="mt-0.5 text-brand-600" />
                <div>
                  <dt className="text-ink-mute">With</dt>
                  <dd className="font-medium">{responded ? 'Dealing officer' : app.holder}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CalendarClock size={18} className="mt-0.5 text-brand-600" />
                <div>
                  <dt className="text-ink-mute">Stage target</dt>
                  <dd className="font-medium">
                    {app.stage === 'decision' ? 'Completed' : `${STAGE_LABEL[app.stage]} · ${formatDate(app.dueOn)}`}
                  </dd>
                  {app.stage !== 'decision' && <dd className="text-xs text-ink-mute">{clock === 'paused' ? 'Clock paused while waiting on you' : daysLeft >= 0 ? `${daysLeft} days left` : `${-daysLeft} days late; escalated to the regional officer`}</dd>}
                </div>
              </div>
            </dl>
          </Card>
          <Card title="Your rights">
            <ul className="space-y-2.5 text-sm text-ink-mute">
              {['Re-scrutiny checks only the deficiencies already raised (APH 1.8(g)).', 'You may show compliance before the SHC (APH 2.23.3).', 'One appeal to the SAC within 7 days of a decision (APH 2.24).', 'Every decision comes with written reasons (Speaking Order).'].map((r) => (
                <li key={r} className="flex gap-2">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-indgreen-600" />
                  <span>
                    <WithTerms text={r} />
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}
