import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, FlaskConical, GitCommitHorizontal, History, Loader2, RotateCcw, Send, XCircle } from 'lucide-react';
import { APPLICATION_TYPES, ESCALATION_LADDER, STAGE_TARGET_DAYS, STEP_LABEL, baselineTable, buildGoldenCases, evaluatePath, type StepTable } from '../../data/rules';
import { Badge, Callout, Card, Modal, PageHeader, Tabs, toast } from '../../components/ui';
import { Tour } from '../../components/live';
import { RULES_STUDIO_TOUR } from '../../data/tours';
import { useSession } from '../../lib/session';
import { useRuleVersions } from '../../lib/live-data';
import { celebrate } from '../../components/motion';
import { invalidate } from '../../lib/resource';
import { ApiError, proposeRules, publishRules, testRuleTable } from '../../services/api';
import { cn, formatDate } from '../../lib/utils';
import type { Need, StepKey } from '../../types';
import { APPLICATIONS } from '../../data/applications';

const KEYS: StepKey[] = ['selfDisclosure', 'scrutiny', 'evc', 'shc'];
const NEXT: Record<Need, Need> = { none: 'required', required: 'conditional', conditional: 'none' };
const NEED_LABEL: Record<Need, string> = { required: 'Required', conditional: 'If needed', none: '—' };

const VERSIONS = [
  { v: '2026.3', date: '2026-08-25', by: 'Rules administrator · approved by Regulation Bureau Admin', note: 'EVC and SAC constituted by the Council; EVC mode physical/online/hybrid (Dec 2025 corrigendum)' },
  { v: '2026.2', date: '2026-02-10', by: 'Rules administrator · approved by Regulation Bureau Admin', note: 'Re-scrutiny target reduced from 15 to 10 working days' },
  { v: '2026.1', date: '2025-11-28', by: 'Rules administrator · approved by Regulation Bureau Admin', note: 'Approval process 2026-27 baseline from APH 2024-27 Table 2.3' },
];

type Result = { id: string; label: string; expected: string[]; actual: string[]; pass: boolean };

export default function RulesStudio() {
  const { session } = useSession();
  // The real version history (with proposals awaiting approval) when connected; the published history otherwise.
  const { data: serverVersions } = useRuleVersions();
  const versions = serverVersions
    ? serverVersions.map((v) => ({
        v: v.version,
        date: v.effectiveFrom,
        by: `${v.author}${v.approver ? ` · approved by ${v.approver}` : ' · awaiting approval by a different Regulation Bureau Admin'}`,
        note: `${v.reason} (${v.testsPassed}/${v.testsTotal} golden tests)`,
        pending: v.status === 'proposed',
      }))
    : VERSIONS.map((v) => ({ ...v, pending: false }));
  const [serverCheck, setServerCheck] = useState<{ passed: number; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const approve = async (version: string) => {
    try {
      const done = await publishRules(version);
      if (done) celebrate();
      invalidate('rules:');
      toast(done ? `Rules v${version} published. New submissions follow it from ${formatDate(done.effectiveFrom)}.` : 'Published on this device.');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not publish. Please try again.', 'red');
    }
  };
  const [tab, setTab] = useState<'routing' | 'timelines' | 'ladder' | 'versions'>('routing');
  const [table, setTable] = useState<StepTable>(baselineTable);
  const [targets, setTargets] = useState<Record<string, number>>({ ...STAGE_TARGET_DAYS });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Result[] | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [effective, setEffective] = useState('2026-11-15');
  const [reason, setReason] = useState('');
  const base = useMemo(baselineTable, []);
  const golden = useMemo(buildGoldenCases, []);

  const changed = KEYS.flatMap((k) => APPLICATION_TYPES.filter((t) => table[t.id][k] !== base[t.id][k]).map((t) => `${t.id}.${k}`));

  // Impact preview (rules as code): run every open file through both rule sets and compare the paths.
  const impact = useMemo(() => {
    if (!changed.length) return [];
    return APPLICATIONS.filter((a) => a.stage !== 'decision')
      .map((a) => {
        const facts = { typeId: a.typeId, deficienciesFound: a.deficiencies > 0 || a.stage === 'rescrutiny', appeal: a.stage === 'appeal' };
        return { a, before: evaluatePath(base, facts), after: evaluatePath(table, facts) };
      })
      .filter((x) => x.before.join() !== x.after.join());
  }, [table, base, changed.length]);

  const cycle = (typeId: string, k: StepKey) => {
    setTable((tb) => ({ ...tb, [typeId]: { ...tb[typeId], [k]: NEXT[tb[typeId][k]] } }));
    setResults(null);
  };

  const runTests = async () => {
    setRunning(true);
    setResults(null);
    setProgress(0);
    const out: Result[] = [];
    for (let i = 0; i < golden.length; i++) {
      const g = golden[i];
      const actual = evaluatePath(table, g.facts);
      out.push({ id: g.id, label: g.label, expected: g.expected, actual, pass: actual.join('>') === g.expected.join('>') });
      if (i % 5 === 4) {
        setProgress((i + 1) / golden.length);
        await new Promise((r) => setTimeout(r, 70));
      }
    }
    setProgress(1);
    setResults(out);
    setRunning(false);
    // The server runs the same 50 cases independently; both must agree before anything is published.
    setServerCheck(await testRuleTable(table).catch(() => null));
  };

  const failed = results?.filter((r) => !r.pass) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Rules as code"
        title="Rules studio"
        description="The Approval Process Handbook as versioned decision tables. Officials change rules here without programmers; every change must pass the golden tests and a second officer's approval before it takes effect."
        tourId="rules-studio"
        actions={
          <>
            <Badge tone="brand" icon={<GitCommitHorizontal size={12} />}>
              Live: v2026.3
            </Badge>
            {changed.length > 0 && <Badge tone="amber">{changed.length} unpublished change{changed.length > 1 ? 's' : ''}</Badge>}
          </>
        }
      />
      <Tour id="rules-studio" steps={RULES_STUDIO_TOUR} />

      <Tabs
        data-tour="rule-table"
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'routing', label: 'Routing (Table 2.3)' },
          { value: 'timelines', label: 'Stage targets' },
          { value: 'ladder', label: 'Escalation ladder' },
          { value: 'versions', label: 'Versions', count: versions.length },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          {tab === 'routing' && (
            <Card pad={false} title="Which stages apply to each request type" subtitle="Click a cell to cycle: Required → If needed → Not applicable. Changed cells are highlighted.">
              <div className="max-h-[640px] overflow-auto scroll-thin">
                <table className="table-base">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th>Request type</th>
                      {KEYS.map((k) => (
                        <th key={k} className="text-center">
                          {STEP_LABEL[k]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {APPLICATION_TYPES.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <p className="font-medium text-ink">{t.name}</p>
                          <p className="text-xs text-ink-mute">{t.clause}</p>
                        </td>
                        {KEYS.map((k) => {
                          const v = table[t.id][k];
                          const dirty = v !== base[t.id][k];
                          return (
                            <td key={k} className="text-center">
                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                onClick={() => cycle(t.id, k)}
                                aria-label={`${t.name}, ${STEP_LABEL[k]}: ${NEED_LABEL[v]}. Click to change.`}
                                className={cn(
                                  'min-w-[92px] rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
                                  v === 'required' ? 'bg-brand-700 text-white' : v === 'conditional' ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-400',
                                  dirty && 'ring-2 ring-saffron-500 ring-offset-1',
                                )}
                              >
                                {NEED_LABEL[v]}
                              </motion.button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === 'timelines' && (
            <Card title="Stage targets (working days)" subtitle="Used by the fair clock. The clock pauses while a file waits on the institution.">
              <div className="grid gap-4 sm:grid-cols-3">
                {Object.entries(targets).map(([k, v]) => (
                  <div key={k}>
                    <label className="label capitalize" htmlFor={`t-${k}`}>
                      {k === 'rescrutiny' ? 'Re-scrutiny' : k === 'evc' ? 'Expert visit' : k === 'shc' ? 'Hearing (SHC)' : k === 'ec' ? 'Executive Committee' : k}
                    </label>
                    <input id={`t-${k}`} type="number" min={1} className="input" value={v} onChange={(e) => setTargets({ ...targets, [k]: Number(e.target.value) })} />
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-ink-mute">Illustrative targets. The appeal window (7 days) is fixed by APH 2.24 and cannot be edited here.</p>
            </Card>
          )}

          {tab === 'ladder' && (
            <Card title="Escalation ladder" subtitle="Applied identically to every file">
              <ol className="space-y-3">
                {ESCALATION_LADDER.map((l, i) => (
                  <motion.li key={l.level} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex items-center gap-4 rounded-lg border border-slate-200 p-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-saffron-50 text-sm font-bold text-saffron-700">{l.level}</span>
                    <div className="flex-1 text-sm">
                      <p className="font-medium">{l.who}</p>
                      <p className="text-ink-mute">
                        {l.when} · {l.channel}
                      </p>
                    </div>
                  </motion.li>
                ))}
              </ol>
            </Card>
          )}

          {tab === 'versions' && (
            <Card title="Version history" subtitle="Every published rule set, who approved it and why" pad={false}>
              <ol className="divide-y divide-slate-100">
                {versions.map((v) => (
                  <li key={v.v} className="flex gap-4 px-6 py-4">
                    <History size={18} className={v.pending ? 'mt-0.5 text-amber-600' : 'mt-0.5 text-brand-600'} />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-semibold">
                        v{v.v} <span className="font-normal text-ink-mute">· effective {formatDate(v.date)}</span> {v.pending && <Badge tone="amber">Awaiting approval</Badge>}
                      </p>
                      <p className="mt-0.5">{v.note}</p>
                      <p className="mt-0.5 text-xs text-ink-mute">{v.by}</p>
                    </div>
                    {v.pending && session?.officerRole === 'Regulation Bureau Admin' && (
                      <button className="btn-primary btn-sm self-center" onClick={() => approve(v.v)}>
                        Approve and publish
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card title="Golden tests" subtitle="50 hand-checked cases built from APH Table 2.3">
            <button className="btn-primary w-full" onClick={runTests} disabled={running}>
              {running ? <Loader2 size={16} className="animate-spin" /> : <FlaskConical size={16} />} Run 50 golden tests
            </button>
            {(running || results) && (
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <motion.div className={cn('h-full rounded-full', results && failed.length ? 'bg-red-600' : 'bg-indgreen-500')} animate={{ width: `${progress * 100}%` }} />
                </div>
                {results && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
                    <p className={cn('flex items-center gap-2 text-sm font-semibold', failed.length ? 'text-red-700' : 'text-indgreen-700')}>
                      {failed.length ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                      {results.length - failed.length} of {results.length} passed
                    </p>
                    {serverCheck && (
                      <p className={cn('mt-1 text-xs font-medium', serverCheck.passed === results.length - failed.length ? 'text-indgreen-700' : 'text-red-700')}>
                        Server check: {serverCheck.passed} of {serverCheck.total} pass{serverCheck.passed === results.length - failed.length ? ', the same result' : ', different from this browser'}
                      </p>
                    )}
                    <AnimatePresence>
                      {failed.length > 0 && (
                        <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 max-h-64 space-y-2 overflow-y-auto scroll-thin">
                          {failed.map((f) => (
                            <li key={f.id} className="rounded-lg border border-red-200 bg-red-50/60 p-3 text-xs">
                              <p className="font-semibold text-red-800">
                                {f.id} · {f.label}
                              </p>
                              <p className="mt-1 text-ink-mute">Expected: {f.expected.join(' → ')}</p>
                              <p className="text-red-700">Got: {f.actual.join(' → ')}</p>
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </div>
            )}
          </Card>

          <Card title="Publish">
            {changed.length === 0 ? (
              <p className="text-sm text-ink-mute">No changes. Click a cell in the routing table to try a change, then run the tests.</p>
            ) : (
              <>
                <p className="text-sm text-ink-soft">
                  {changed.length} cell{changed.length > 1 ? 's' : ''} changed. {results ? (failed.length ? `${failed.length} tests now behave differently: review them and update the expected paths with your reason.` : 'All tests pass.') : 'Run the golden tests first.'}
                </p>
                <div className="mt-3 rounded-xl border border-slate-200 p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Impact preview</p>
                  <p className="mt-1 text-sm text-ink">
                    <b className="tabular-nums">{impact.length}</b> open {impact.length === 1 ? 'file' : 'files'} would follow a different path, at <b className="tabular-nums">{new Set(impact.map((x) => x.a.institutionId)).size}</b> {new Set(impact.map((x) => x.a.institutionId)).size === 1 ? 'institution' : 'institutions'}.
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {impact.slice(0, 4).map(({ a, before, after }) => (
                      <li key={a.id} className="text-xs">
                        <span className="font-mono text-ink-soft">{a.id}</span>
                        <span className="mt-0.5 flex flex-wrap gap-1">
                          {Array.from(new Set([...before, ...after])).map((s) => (
                            <span key={s} className={cn('rounded px-1.5 py-0.5', !after.includes(s) ? 'bg-red-50 text-red-700 line-through' : !before.includes(s) ? 'bg-indgreen-50 text-indgreen-700' : 'bg-slate-100 text-ink-mute')}>
                              {s}
                            </span>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-ink-mute">Files already submitted keep the rules in force on their submission date. On publishing, institutions with similar requests are told what changes for them.</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="btn-primary flex-1" disabled={!results} onClick={() => setPublishOpen(true)}>
                    <Send size={16} /> Submit for approval
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setTable(baselineTable());
                      setResults(null);
                    }}
                    aria-label="Discard changes"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </>
            )}
          </Card>
          <Callout tone="brand">Old applications keep the rule version in force when they were submitted. New rules apply only from their effective date.</Callout>
        </aside>
      </div>

      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Submit rule change v2026.4"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setPublishOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={reason.trim().length < 10 || submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  const proposed = await proposeRules(table, reason.trim(), effective);
                  setPublishOpen(false);
                  invalidate('rules:versions');
                  toast(
                    proposed
                      ? `Proposed as v${proposed.version} (${proposed.testsPassed}/${proposed.testsTotal} golden tests pass). A different Regulation Bureau Admin must approve it.`
                      : session?.officerRole === 'Regulation Bureau Admin'
                        ? 'Maker-checker: a second Regulation Bureau Admin must approve. Request sent.'
                        : 'Sent to the Regulation Bureau Admin for approval.',
                  );
                } catch (e) {
                  toast(e instanceof ApiError ? e.message : 'Could not submit the change.', 'red');
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting ? 'Submitting…' : 'Submit for approval'}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-sm">
          <div>
            <label className="label" htmlFor="eff">
              Effective from
            </label>
            <input id="eff" type="date" className="input" value={effective} onChange={(e) => setEffective(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="rsn">
              Reason and legal basis (for the version history)
            </label>
            <textarea id="rsn" rows={3} className="input" placeholder="For example: Council resolution dated …, amending APH Table 2.3" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <p className="text-xs text-ink-mute">Maker-checker: the person who makes a change cannot approve it. Approval and publication are recorded in the evidence log.</p>
        </div>
      </Modal>
    </>
  );
}
