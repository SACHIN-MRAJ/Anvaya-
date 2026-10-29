import { useEffect, useState } from 'react';
import { DocumentChecklist } from '../../components/document-viewer';
import { ConditionsEditor, ReadinessList, Suggestion } from '../../components/decision-panel';
import { decideWithConditions, getReadiness, type Condition } from '../../services/records';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BadgeCheck, ChevronLeft, ChevronRight, FileText, Fingerprint, Forward, MessageSquarePlus, Send, ShieldCheck, Target, Undo2, UserCheck, X, Gavel } from 'lucide-react';
import { endFocus, focusPosition } from './focus';
import { CaseBrief } from '../../components/case-brief';
import { useAsync } from '../../lib/useAsync';
import { actOnApplication, ApiError, apiMode, buildAuditChain, getApplication, type Outcome } from '../../services/api';
import { useSession } from '../../lib/session';
import { celebrate } from '../../components/motion';
import { institutionById, regionName } from '../../data/institutions';
import { typeById, STAGE_TARGET_DAYS } from '../../data/rules';
import { STAGE_LABEL } from '../../data/applications';
import { Badge, Callout, Card, ClockBadge, EmptyState, LoadingRows, Modal, PageHeader, RiskMeter, Tabs, WhyChip, toast } from '../../components/ui';
import { Tour } from '../../components/live';
import { DOSSIER_TOUR } from '../../data/tours';
import { Stepper } from '../institution/shared';
import { cn, formatDate, formatDateTime, TODAY } from '../../lib/utils';
import { shortHash } from '../../lib/hash';
import type { AuditEntry, HistoryEvent } from '../../types';

type Tab = 'overview' | 'documents' | 'rules' | 'history';
type Action = 'forward' | 'sendback' | 'recommend' | 'note' | 'decide' | null;
const OUTCOMES: { id: Outcome; label: string }[] = [
  { id: 'EoA', label: 'Extension of Approval' },
  { id: 'LoA', label: 'Letter of Approval' },
  { id: 'LoD', label: 'Letter of Deficiency' },
  { id: 'LoR', label: 'Letter of Rejection' },
];

export default function Dossier() {
  const { id = '' } = useParams();
  const { data: app, loading, reload } = useAsync(() => getApplication(id), [id]);
  const { session } = useSession();
  const [outcome, setOutcome] = useState<Outcome>('EoA');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState('');
  const [extra, setExtra] = useState<HistoryEvent[]>([]);
  const [chain, setChain] = useState<AuditEntry[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const readiness = useAsync(() => (app?.stage === 'ec' ? getReadiness(id) : Promise.resolve(null)), [id, app?.stage, app?.history.length]);
  // Start the decision with the suggested outcome and conditions; the officer can change both.
  useEffect(() => {
    const r = readiness.data;
    if (!r) return;
    if (r.suggestion.outcome) setOutcome(r.suggestion.outcome);
    setConditions(r.conditions);
  }, [readiness.data]);

  useEffect(() => {
    if (app) buildAuditChain({ ...app, history: [...app.history, ...extra] }).then(setChain);
  }, [app, extra]);
  // Focus mode reuses this page for the next file: start each file clean.
  useEffect(() => {
    setExtra([]);
    setTab('overview');
  }, [id]);
  const nav = useNavigate();

  if (loading) return <LoadingRows rows={8} />;
  if (!app) return <EmptyState title="Application not found" action={<Link className="btn-secondary" to="/aicte/queue">Back to queue</Link>} />;

  const inst = institutionById(app.institutionId)!;
  const t = typeById(app.typeId);
  const leaseYears = inst.leaseEnd ? (new Date(inst.leaseEnd).getTime() - new Date(TODAY).getTime()) / (365.25 * 86_400_000) : null;
  const maxImpact = Math.max(0.01, ...app.riskReasons.map((r) => Math.abs(r.impact)));

  const canDecide = app.stage === 'ec' && (session?.officerRole === 'Executive Committee Approver' || session?.officerRole === 'Regulation Bureau Admin');
  const actsOnFiles = !['EVC Inspector', 'Auditor', 'System administrator'].includes(session?.officerRole ?? '');
  const live = apiMode() === 'on';

  /** Waits for the server; the history and evidence log then come from the server's own record. */
  const confirm = async () => {
    const labels: Record<Exclude<Action, null>, string> = {
      forward: 'Forwarded to the next stage',
      sendback: `Sent back to institution: ${reason || 'reason recorded'}`,
      recommend: 'Recommended to the committee with officer notes',
      note: `Note added: ${reason || 'observation'}`,
      decide: `Decision recorded: ${OUTCOMES.find((o) => o.id === outcome)?.label}`,
    };
    if (!action) return;
    setSending(true);
    try {
      const approving = outcome === 'EoA' || outcome === 'LoA';
      const kept = conditions.filter((c) => c.title.trim().length >= 5 && c.dueOn);
      const updated = action === 'decide' && live ? await decideWithConditions(app.id, outcome, reason, approving ? kept : []) : await actOnApplication(app.id, action, reason, action === 'decide' ? outcome : undefined);
      if (updated) {
        setExtra([]);
        reload();
      } else {
        setExtra((x) => [
          ...x,
          { at: new Date().toISOString().slice(0, 19), actor: session?.name ?? 'Officer', role: session?.officerRole ?? 'Officer', action: labels[action], note: action === 'sendback' ? 'Clock paused until the institution responds.' : undefined, ruleRef: action === 'sendback' ? 'APH 1.8(f)' : undefined },
        ]);
      }
      if (action === 'decide') celebrate();
      const next = focusPosition(app.id)?.next;
      const done = action === 'sendback' ? 'Sent back with reason. Clock paused; institution notified.' : action === 'decide' ? 'Decision recorded. The institution is notified and anyone can verify the letter.' : 'Action recorded in the evidence log.';
      toast(done, 'green', next ? { label: 'Next file', onClick: () => nav(`/aicte/applications/${next}`) } : undefined);
      setAction(null);
      setReason('');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'The server did not accept this action.', 'red');
    } finally {
      setSending(false);
    }
  };


  const focus = focusPosition(app.id);

  return (
    <>
      {focus ? (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-950 px-4 py-2.5 text-sm text-white shadow-lift">
          <span className="flex items-center gap-2 font-semibold">
            <Target size={16} className="text-saffron-400" /> Focus mode
          </span>
          <span className="text-brand-200">
            File {focus.index + 1} of {focus.total} · most urgent first
          </span>
          <span className="h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-white/10">
            <motion.span className="block h-full rounded-full bg-saffron-400" initial={{ width: 0 }} animate={{ width: `${((focus.index + 1) / focus.total) * 100}%` }} />
          </span>
          <span className="flex gap-1.5">
            {focus.prev && (
              <Link to={`/aicte/applications/${focus.prev}`} className="btn btn-sm bg-white/10 text-white hover:bg-white/20">
                <ChevronLeft size={14} /> Previous
              </Link>
            )}
            {focus.next ? (
              <Link to={`/aicte/applications/${focus.next}`} className="btn-accent btn-sm">
                Next file <ChevronRight size={14} />
              </Link>
            ) : (
              <Link to="/aicte/queue" onClick={endFocus} className="btn-accent btn-sm">
                Done: back to queue
              </Link>
            )}
            <Link to="/aicte/queue" onClick={endFocus} className="grid h-8 w-8 place-items-center rounded-lg text-brand-200 hover:bg-white/10" aria-label="Exit focus mode">
              <X size={15} />
            </Link>
          </span>
        </motion.div>
      ) : (
        <Link to="/aicte/queue" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-mute hover:text-brand-700">
          <ArrowLeft size={15} /> Work queue
        </Link>
      )}
      <div data-tour="dossier-header">
      <PageHeader
        eyebrow={`${app.id} · ${regionName(app.region)} · submitted ${formatDate(app.submittedOn)}`}
        title={inst.name}
        description={`${t.name} · ${t.clause}`}
        tourId="dossier"
        actions={
          <>
            <Badge tone="slate">{STAGE_LABEL[app.stage]}</Badge>
            <ClockBadge state={app.clock} />
          </>
        }
      />
      <Tour id="dossier" steps={DOSSIER_TOUR} />
      </div>

      <Card className="mb-6">
        <Stepper app={app} />
      </Card>

      <div className={cn('grid gap-6', tab !== 'documents' && 'xl:grid-cols-[1fr_340px]')}>
        <div className="min-w-0">
          <Tabs
            data-tour="dossier-tabs"
            className="mb-4"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'overview', label: 'Overview' },
              { value: 'documents', label: 'Documents' },
              { value: 'rules', label: 'Rules applied' },
              { value: 'history', label: 'History and evidence', count: app.history.length + extra.length },
            ]}
          />
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {tab === 'overview' && (
              <div className="space-y-6">
                <CaseBrief app={app} inst={inst} />
                <Card title="Institution">
                  <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-ink-mute">AICTE ID</dt>
                      <dd className="font-mono font-medium">{inst.aicteId}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-mute">Category</dt>
                      <dd className="font-medium">{inst.category}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-mute">Approved intake</dt>
                      <dd className="font-medium">{inst.intake}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-mute">Land</dt>
                      <dd className="font-medium">
                        {inst.land}
                        {leaseYears !== null && ` · ${leaseYears.toFixed(1)} yrs live`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-mute">Lease runway</dt>
                      <dd className={cn('font-medium', leaseYears !== null && leaseYears - inst.longestCourseYears < 2 ? 'text-amber-700' : 'text-indgreen-700')}>
                        {leaseYears === null ? 'Not applicable (owned)' : `${(leaseYears - inst.longestCourseYears).toFixed(1)} years`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-mute">Promoted by</dt>
                      <dd className="font-medium">{inst.trust}</dd>
                    </div>
                  </dl>
                </Card>
                <Card title="Why this file may be late" subtitle="Random Survival Forest estimate with SHAP contributions. Advisory only." action={<RiskMeter value={app.risk} />}>
                  {app.riskReasons.length === 0 ? (
                    <p className="text-sm text-ink-mute">No open risk: this file has a decision.</p>
                  ) : (
                    <ul className="space-y-3">
                      {app.riskReasons.map((r, i) => (
                        <li key={r.factor} className="grid grid-cols-[1fr_160px_56px] items-center gap-3 text-sm">
                          <span className="text-ink-soft">{r.factor}</span>
                          <span className="relative h-2.5 rounded-full bg-slate-100">
                            <motion.span
                              className={cn('absolute top-0 h-full rounded-full', r.impact >= 0 ? 'left-1/2 bg-saffron-500' : 'right-1/2 bg-indgreen-500')}
                              initial={{ width: 0 }}
                              animate={{ width: `${(Math.abs(r.impact) / maxImpact) * 50}%` }}
                              transition={{ delay: i * 0.08, duration: 0.6 }}
                            />
                            <span className="absolute left-1/2 top-[-3px] h-4 w-px bg-slate-300" />
                          </span>
                          <span className={cn('text-right text-xs font-semibold tabular-nums', r.impact >= 0 ? 'text-saffron-700' : 'text-indgreen-700')}>
                            {r.impact >= 0 ? '+' : ''}
                            {r.impact.toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-4 text-xs text-ink-mute">Orange pushes the risk up; green pulls it down. Values are log-odds contributions.</p>
                </Card>
              </div>
            )}

            {tab === 'documents' && (
              <div className="space-y-6">
                {live ? (
                  <DocumentChecklist appId={app.id} canReview={actsOnFiles && app.stage !== 'decision'} onChange={reload} />
                ) : (
                  <Card title="Submitted documents" subtitle="Connect the server to open each file, compare versions and record checks" pad={false}>
                    <ul className="divide-y divide-slate-100">
                      {t.documents.map((d) => (
                        <li key={d.id} className="flex flex-wrap items-center gap-3 px-6 py-3.5 text-sm">
                          <FileText size={16} className="text-brand-500" />
                          <span className="min-w-0 flex-1 font-medium">{d.name}</span>
                          <Badge tone="green" icon={<ShieldCheck size={12} />}>
                            Signed
                          </Badge>
                          {d.sourceVerifiable && (
                            <Badge tone="brand" icon={<BadgeCheck size={12} />}>
                              Verified at source
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            )}

            {tab === 'rules' && (
              <Card title="Rules applied to this file" subtitle="Every automated step names its rule version and clause" pad={false}>
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Decision</th>
                        <th>Rule</th>
                        <th>Inputs</th>
                        <th>Output</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="font-medium text-ink">Stage path</td>
                        <td>
                          Table 2.3 · v2026.3 <WhyChip rule="Routing decision table" clause={`${t.clause}; APH Table 2.3`} />
                        </td>
                        <td>type = {t.id}</td>
                        <td>
                          {(['selfDisclosure', 'scrutiny', 'evc', 'shc'] as const)
                            .filter((k) => t.steps[k] !== 'none')
                            .map((k) => k)
                            .join(' → ')}{' '}
                          → EC
                        </td>
                      </tr>
                      <tr>
                        <td className="font-medium text-ink">Stage target</td>
                        <td>Timeline table · v2026.2</td>
                        <td>stage = {app.stage}</td>
                        <td>{app.stage in STAGE_TARGET_DAYS ? `${STAGE_TARGET_DAYS[app.stage as keyof typeof STAGE_TARGET_DAYS]} working days` : '—'}</td>
                      </tr>
                      <tr>
                        <td className="font-medium text-ink">Clock state</td>
                        <td>Fair clock policy · v1.4</td>
                        <td>holder = {app.holder}</td>
                        <td>{app.clock}</td>
                      </tr>
                      <tr>
                        <td className="font-medium text-ink">Escalation</td>
                        <td>Escalation ladder · v3</td>
                        <td>due = {formatDate(app.dueOn)}</td>
                        <td>{app.clock === 'breached' ? 'Level 1: regional officer notified' : 'None yet'}</td>
                      </tr>
                      <tr>
                        <td className="font-medium text-ink">Lease runway</td>
                        <td>APH 2.1(e) check · v2026.1</td>
                        <td>live lease, longest course</td>
                        <td>{leaseYears === null ? 'Owned land: pass' : `${(leaseYears - inst.longestCourseYears).toFixed(1)} years`}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {tab === 'history' && (
              <Card title="History with evidence fingerprints" subtitle="SHA-256 chain computed live in your browser" pad={false} action={<Link to="/aicte/evidence" className="link text-sm">Verify chain</Link>}>
                <ol className="divide-y divide-slate-100">
                  {chain.map((e) => (
                    <li key={e.seq} className="flex gap-4 px-6 py-3.5 text-sm">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">{e.seq}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{e.action}</p>
                        <p className="text-xs text-ink-mute">
                          {formatDateTime(e.at)} · {e.actor}
                        </p>
                        <p className="mt-1 flex items-center gap-1 font-mono text-[11px] text-ink-mute">
                          <Fingerprint size={11} /> {shortHash(e.hash, 16)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            )}
          </motion.div>
        </div>

        <aside className="space-y-4">
          {readiness.data && (
            <div data-tour="readiness"><Card title="Ready for a decision?" subtitle="Worked out from the record">
              <ReadinessList data={readiness.data} compact />
              <div className="mt-3">
                <Suggestion data={readiness.data} />
              </div>
            </Card></div>
          )}
          {!actsOnFiles ? (
            <Callout tone="brand" title={`${session?.officerRole ?? 'Your role'}: read only`}>
              {session?.officerRole === 'EVC Inspector' ? 'EVC Inspectors record findings in their field inspection report.' : 'This role reads files and the evidence log but does not act on them.'}
            </Callout>
          ) : (
          <Card data-tour="decision-panel" title="Your decision" subtitle="Human-in-the-loop: the system routes and reminds; you decide.">
            <div className="grid gap-2">
              <button className="btn-primary justify-start" onClick={() => setAction('forward')}>
                <Forward size={16} /> Forward to next stage
              </button>
              <button className="btn-secondary justify-start" onClick={() => setAction('sendback')}>
                <Undo2 size={16} /> Send back to institution
              </button>
              <button className="btn-secondary justify-start" onClick={() => setAction('recommend')}>
                <UserCheck size={16} /> Recommend to committee
              </button>
              <button className="btn-ghost justify-start" onClick={() => setAction('note')}>
                <MessageSquarePlus size={16} /> Add an observation
              </button>
              {canDecide && (
                <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="btn-primary justify-start bg-indgreen-600 hover:bg-indgreen-700" onClick={() => setAction('decide')}>
                  <Gavel size={16} /> Record the decision
                </motion.button>
              )}
            </div>
            {app.stage === 'ec' && !canDecide && <p className="mt-3 text-xs text-ink-mute">Only an Executive Committee Approver or Regulation Bureau Admin records the decision.</p>}
          </Card>
          )}
          <Callout tone="brand" title="Safeguard">
            Alerts, predictions and AI findings support your judgement. They never replace scrutiny, inspection or the competent authority’s decision.
          </Callout>
        </aside>
      </div>

      <Modal
        open={!!action}
        onClose={() => setAction(null)}
        title={action === 'sendback' ? 'Send back to institution' : action === 'note' ? 'Add an observation' : action === 'forward' ? 'Forward to next stage' : action === 'decide' ? 'Record the decision' : 'Recommend to committee'}
        wide={action === 'decide'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAction(null)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={sending || ((action === 'sendback' || action === 'note' || action === 'decide') && reason.trim().length < 5)} onClick={confirm}>
              <Send size={16} /> {sending ? 'Recording…' : 'Confirm'}
            </button>
          </>
        }
      >
        {action === 'decide' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Outcome">
              {OUTCOMES.map((o) => (
                <button key={o.id} role="radio" aria-checked={outcome === o.id} onClick={() => setOutcome(o.id)} className={cn('rounded-xl border px-3 py-2.5 text-left text-sm transition-all', outcome === o.id ? 'border-brand-600 bg-brand-50 font-semibold text-brand-800 ring-2 ring-brand-200' : 'border-slate-200 hover:border-brand-300')}>
                  <span className="block font-mono text-xs text-ink-mute">{o.id}</span>
                  {o.label}
                </button>
              ))}
            </div>
            {readiness.data && (
              <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                <ReadinessList data={readiness.data} />
                <Suggestion data={readiness.data} />
              </div>
            )}
            {(outcome === 'EoA' || outcome === 'LoA') && live && <ConditionsEditor value={conditions} onChange={setConditions} suggested={readiness.data?.conditions ?? []} />}
            <div>
              <label htmlFor="reason" className="label">
                Reasons (the speaking order, shown to the institution)
              </label>
              <textarea id="reason" rows={4} className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: all conditions met; faculty and lease verified at the expert visit." />
            </div>
            <p className="text-xs text-ink-mute">The decision letter is fingerprinted and signed as a verifiable credential. A deficiency or rejection opens the 7-day appeal window.</p>
          </div>
        ) : action === 'sendback' || action === 'note' ? (
          <div className="space-y-3">
            <label htmlFor="reason" className="label">
              {action === 'sendback' ? 'Reason (required, shown to the institution)' : 'Observation'}
            </label>
            <textarea id="reason" rows={4} className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={action === 'sendback' ? 'For example: the university NOC does not name the new course title.' : 'Your observation'} />
            {action === 'sendback' && <p className="text-xs text-ink-mute">The clock pauses until the institution responds. Re-scrutiny will check only this deficiency (APH 1.8(g)).</p>}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">This action is recorded with your name, time and the rule version in the tamper-evident evidence log.</p>
        )}
      </Modal>
    </>
  );
}
