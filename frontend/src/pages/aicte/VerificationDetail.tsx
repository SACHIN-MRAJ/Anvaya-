import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Gavel, ShieldCheck } from 'lucide-react';
import { useAsync } from '../../lib/useAsync';
import { useSession } from '../../lib/session';
import { ApiError } from '../../services/api';
import { getVerification, recordAction, recordCheck } from '../../services/records';
import { Badge, Callout, Card, Modal, PageHeader, Tabs, toast } from '../../components/ui';
import { ExpiryRadar, FindingList, KeyValue, Meter, Pending, VerificationBadge } from '../../components/records-ui';
import { formatDate, formatDateTime, TODAY } from '../../lib/utils';

type Tab = 'certificates' | 'land' | 'rooms' | 'courses' | 'faculty' | 'checks';
const CASE_ROLES = ['Dealing officer', 'Regional officer', 'Bureau head', 'Committee member', 'Rules administrator', 'EVC coordinator'];
const DECIDERS = ['Committee member', 'Bureau head'];
const KINDS = ['Warning', 'Show-cause notice', 'Reduction in intake', 'No admission for one year', 'Withdrawal of approval'];
const PENAL = KINDS.slice(2);

interface CheckDraft {
  subject: string;
  subjectId: string;
  label: string;
  outcome: 'Verified' | 'Discrepancy' | 'Follow-up';
  note: string;
  source: string;
}

export default function VerificationDetail() {
  const { id = '' } = useParams();
  const { session } = useSession();
  const canCheck = CASE_ROLES.includes(session?.officerRole ?? '');
  const canAct = DECIDERS.includes(session?.officerRole ?? '');
  const { data, loading, reload } = useAsync(() => getVerification(id), [id]);
  const [tab, setTab] = useState<Tab>('certificates');
  const [check, setCheck] = useState<CheckDraft | null>(null);
  const [action, setAction] = useState<{ kind: string; detail: string; reason: string; hearingNote: string; effectiveFrom: string } | null>(null);

  if (!data) return <Pending loading={loading} what="This institution's record" />;
  const inst = data.institution;
  const hasNotice = data.actions.some((a) => a.kind === 'Show-cause notice');

  const open = (subject: string, subjectId: string, label: string, outcome: CheckDraft['outcome'] = 'Verified') => setCheck({ subject, subjectId, label, outcome, note: '', source: 'Document' });
  const CheckButtons = ({ subject, subjectId, label }: { subject: string; subjectId: string | number; label: string }) =>
    canCheck ? (
      <span className="flex gap-1">
        <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => open(subject, String(subjectId), label)}>
          Verify
        </button>
        <button className="btn-secondary px-2.5 py-1 text-xs hover:border-red-300 hover:text-red-700" onClick={() => open(subject, String(subjectId), label, 'Discrepancy')}>
          Flag
        </button>
      </span>
    ) : null;

  const saveCheck = async () => {
    if (!check) return;
    try {
      await recordCheck(inst.id, { subject: check.subject, subjectId: check.subjectId, outcome: check.outcome, note: check.note, source: check.source });
      toast(check.outcome === 'Verified' ? `${check.label} verified.` : `${check.label}: ${check.outcome.toLowerCase()} recorded. The institution has been told.`);
      setCheck(null);
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not record the check.', 'red');
    }
  };
  const saveAction = async () => {
    if (!action) return;
    try {
      await recordAction(inst.id, { ...action, hearingNote: action.hearingNote || undefined });
      toast(`${action.kind} recorded and sent to the institution, with reasons.`);
      setAction(null);
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not record the action.', 'red');
    }
  };

  return (
    <>
      <Link to="/aicte/verification" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-mute hover:text-brand-700">
        <ArrowLeft size={15} /> All institutions
      </Link>
      <PageHeader
        eyebrow={`${inst.id} · AICTE ID ${inst.aicteId}`}
        title={inst.name}
        description={`${inst.trust} · ${inst.category} · established ${inst.established}. Each check is recorded in the institution's evidence chain; a flag is sent to the institution with your note.`}
        actions={
          canAct && (
            <button className="btn-secondary" onClick={() => setAction({ kind: hasNotice ? 'Reduction in intake' : 'Show-cause notice', detail: '', reason: '', hearingNote: '', effectiveFrom: TODAY })}>
              <Gavel size={16} /> Regulatory action
            </button>
          )
        }
      />

      {data.actions.length > 0 && (
        <div className="mb-6 space-y-2">
          {data.actions.map((a) => (
            <Callout key={a.id} tone={PENAL.includes(a.kind) ? 'red' : 'amber'} icon={<Gavel size={16} />} title={`${a.kind} · ${formatDate(a.decidedAt)} · ${a.decidedBy} (${a.role})`}>
              {a.detail} <span className="block whitespace-pre-line text-xs text-ink-mute">{a.reason}</span>
            </Callout>
          ))}
        </div>
      )}

      <Card title="Profile" subtitle="As the institution keeps it" action={<CheckButtons subject="Profile" subjectId="profile" label="Institution profile" />}>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KeyValue label="Address">{String(data.profile.address ?? '')}</KeyValue>
          <KeyValue label="Affiliating university">{String(data.profile.university ?? '')}</KeyValue>
          <KeyValue label="Registration">{String(data.profile.registrationNo ?? '')}</KeyValue>
          <KeyValue label="Signatories">
            {data.leaders
              .filter((l) => l.isSignatory && !l.until)
              .map((l) => `${l.name} (${l.position})`)
              .join(', ')}
          </KeyValue>
        </dl>
      </Card>

      <Card className="mt-6" pad={false}>
        <div className="px-4 pt-2">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'certificates', label: 'Certificates', count: data.certificates.filter((c) => c.verification === 'Pending').length || undefined },
              { value: 'land', label: 'Campuses and land' },
              { value: 'rooms', label: 'Rooms vs norms', count: data.norms.shortfalls || undefined },
              { value: 'courses', label: 'Courses', count: data.programmes.length },
              { value: 'faculty', label: 'Faculty', count: data.faculty.pending.length || undefined },
              { value: 'checks', label: 'Checks so far', count: data.checks.length },
            ]}
          />
        </div>
        {tab === 'certificates' && (
          <div className="p-6">
            <ExpiryRadar certificates={data.certificates} />
            <ul className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {data.certificates.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{c.kind}</span>
                    <span className="block text-xs text-ink-mute">
                      {c.number || 'no number'} · {c.issuedBy || 'issuer not given'} · {c.clause}
                    </span>
                  </span>
                  <Badge tone={c.tone}>{c.validUntil ? `${c.state} · ${formatDate(c.validUntil)}` : c.state}</Badge>
                  <VerificationBadge status={c.verification} />
                  <CheckButtons subject="Certificate" subjectId={c.id} label={c.kind} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {tab === 'land' && (
          <div className="grid gap-6 p-6 lg:grid-cols-2">
            <ul className="space-y-3">
              {data.campuses.map((c) => (
                <li key={c.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span>
                      <span className="block font-semibold">{c.name}</span>
                      <span className="text-xs text-ink-mute">
                        {c.landAcres} acres · {c.ownership} · deed {c.deedNo || '—'}
                        {c.leaseEnd ? ` · lease to ${formatDate(c.leaseEnd)}` : ''}
                        {c.distanceKm !== undefined ? ` · ${c.distanceKm} km from main` : ''}
                      </span>
                    </span>
                    <CheckButtons subject="Campus" subjectId={c.id} label={c.name} />
                  </div>
                </li>
              ))}
            </ul>
            <div>
              <p className="mb-3 text-sm font-bold">Land checks</p>
              <FindingList items={data.landChecks} empty="Plots and lease meet the norms." />
            </div>
          </div>
        )}
        {tab === 'rooms' && (
          <div className="grid gap-x-8 gap-y-4 p-6 md:grid-cols-2">
            {data.norms.rows.map((r) => (
              <Meter key={r.kind} label={r.label} have={r.have} need={r.rooms} hint={`${r.rule}; ${r.minArea} m² each`} />
            ))}
            {data.norms.areas.map((a) => (
              <Meter key={a.category} label={`${a.category} area`} have={a.have} need={a.min} unit=" m²" />
            ))}
            {data.norms.rows.length === 0 && <p className="text-sm text-ink-mute">No rooms on record yet.</p>}
          </div>
        )}
        {tab === 'courses' && (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Department</th>
                  <th className="text-right">Intake</th>
                  <th>Accreditation</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.programmes.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium">
                      {p.name}
                      <span className="block text-xs text-ink-mute">
                        {p.level}, {p.durationYears} years, since {p.since}
                      </span>
                    </td>
                    <td className="text-sm">{p.department}</td>
                    <td className="text-right tabular-nums">{p.approvedIntake}</td>
                    <td className="text-sm">{p.accreditation ? `${p.accreditation.body} to ${formatDate(p.accreditation.validUntil)} (${p.accreditationState})` : '—'}</td>
                    <td>
                      <CheckButtons subject="Programme" subjectId={p.id} label={p.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'faculty' && (
          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-4">
              <Meter label="Faculty in post" have={data.faculty.norms.inPost} need={data.faculty.norms.required} />
              {data.faculty.norms.cadre.map((c) => (
                <Meter key={c.designation} label={c.designation} have={c.have} need={c.need} />
              ))}
              <FindingList items={data.faculty.norms.findings} empty="Roster meets the norms." />
            </div>
            <div>
              <p className="mb-3 text-sm font-bold">Awaiting a check ({data.faculty.pending.length})</p>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {data.faculty.pending.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{f.name}</span>
                      <span className="text-xs text-ink-mute">
                        {f.designation} · {f.qualification} · joined {formatDate(f.joined)} {f.panOnFile ? '· PAN on file' : '· no PAN'}
                      </span>
                    </span>
                    <CheckButtons subject="Faculty" subjectId={f.id} label={f.name} />
                  </li>
                ))}
                {data.faculty.pending.length === 0 && <li className="px-4 py-3 text-sm text-ink-mute">Every faculty member has been checked.</li>}
              </ul>
            </div>
          </div>
        )}
        {tab === 'checks' && (
          <ul className="divide-y divide-slate-100">
            {data.checks.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start gap-3 px-6 py-3.5 text-sm">
                <ShieldCheck size={16} className={c.outcome === 'Verified' ? 'mt-0.5 text-indgreen-600' : 'mt-0.5 text-amber-600'} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {c.subjectLabel} · {c.outcome}
                  </span>
                  {c.note && <span className="block text-ink-soft">{c.note}</span>}
                  <span className="text-xs text-ink-mute">
                    {c.checkedBy} · {formatDateTime(c.checkedAt)} · from {c.source.toLowerCase()}
                  </span>
                </span>
              </li>
            ))}
            {data.checks.length === 0 && <li className="px-6 py-6 text-sm text-ink-mute">No checks recorded yet.</li>}
          </ul>
        )}
      </Card>

      <Modal
        open={!!check}
        onClose={() => setCheck(null)}
        title={check ? `Check: ${check.label}` : ''}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCheck(null)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={!check || (check.outcome !== 'Verified' && check.note.trim().length < 10)} onClick={saveCheck}>
              Record
            </button>
          </>
        }
      >
        {check && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Outcome</span>
              <select className="input" value={check.outcome} onChange={(e) => setCheck({ ...check, outcome: e.target.value as CheckDraft['outcome'] })}>
                <option>Verified</option>
                <option>Follow-up</option>
                <option>Discrepancy</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Checked against</span>
              <select className="input" value={check.source} onChange={(e) => setCheck({ ...check, source: e.target.value })}>
                <option>Document</option>
                <option>Registry</option>
                <option>Site visit</option>
                <option>Other</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="label">{check.outcome === 'Verified' ? 'Note (optional)' : 'What is wrong or still needed (the institution sees this)'}</span>
              <textarea className="input min-h-[90px]" value={check.note} onChange={(e) => setCheck({ ...check, note: e.target.value })} />
            </label>
          </div>
        )}
      </Modal>

      <Modal
        open={!!action}
        onClose={() => setAction(null)}
        wide
        title="Regulatory action"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAction(null)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={!action || action.detail.trim().length < 10 || action.reason.trim().length < 20 || (PENAL.includes(action.kind) && (!hasNotice || action.hearingNote.trim().length < 20))} onClick={saveAction}>
              Record and notify
            </button>
          </>
        }
      >
        {action && (
          <div className="space-y-4">
            <Callout tone="amber" title="Due process (APH Chapter VII)">
              A warning or show-cause notice comes first. A penal action needs an earlier show-cause notice and the Standing Hearing Committee’s note after hearing the institution. Reasons are sent to the institution.
            </Callout>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">Action</span>
                <select className="input" value={action.kind} onChange={(e) => setAction({ ...action, kind: e.target.value })}>
                  {KINDS.map((k) => (
                    <option key={k} disabled={PENAL.includes(k) && !hasNotice}>
                      {k}
                      {PENAL.includes(k) && !hasNotice ? ' (needs a show-cause notice first)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Effective from</span>
                <input className="input" type="date" value={action.effectiveFrom} onChange={(e) => setAction({ ...action, effectiveFrom: e.target.value })} />
              </label>
            </div>
            <label className="block">
              <span className="label">What it says</span>
              <input className="input" value={action.detail} onChange={(e) => setAction({ ...action, detail: e.target.value })} placeholder="Explain within 15 days why…" />
            </label>
            <label className="block">
              <span className="label">Reasons (facts and clauses)</span>
              <textarea className="input min-h-[90px]" value={action.reason} onChange={(e) => setAction({ ...action, reason: e.target.value })} />
            </label>
            {PENAL.includes(action.kind) && (
              <label className="block">
                <span className="label">Standing Hearing Committee: who was heard and what was concluded</span>
                <textarea className="input min-h-[90px]" value={action.hearingNote} onChange={(e) => setAction({ ...action, hearingNote: e.target.value })} />
              </label>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
