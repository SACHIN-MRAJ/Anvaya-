import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Award, BookOpen, CheckCircle2, GraduationCap, Loader2, TriangleAlert, Users } from 'lucide-react';
import { useAsync } from '../../lib/useAsync';
import { may, useSession } from '../../lib/session';
import { ApiError } from '../../services/api';
import { getSeatMatrix, saveAccreditation, seatCheck, seatDraft, type Programme, type SeatChange, type SeatChangeIn, type SeatImpact } from '../../services/records';
import { Badge, Card, Modal, PageHeader, Stat, toast } from '../../components/ui';
import { Meter, Pending, ReadOnlyNote } from '../../components/records-ui';
import { cn, formatDate } from '../../lib/utils';

const CHANGES: { id: SeatChange; label: string; hint: string }[] = [
  { id: 'increase', label: 'Increase seats', hint: 'APH 2.6' },
  { id: 'reduce', label: 'Reduce seats', hint: 'APH 2.18' },
  { id: 'new', label: 'Add a course', hint: 'APH 2.6' },
  { id: 'rename', label: 'Rename a course', hint: 'APH 2.18' },
  { id: 'close', label: 'Close a course', hint: 'APH 2.18' },
];

export default function Courses() {
  const { session } = useSession();
  const canEdit = may(session, 'academics');
  const { data, loading, reload } = useAsync(getSeatMatrix);
  const nav = useNavigate();
  const [change, setChange] = useState<SeatChangeIn>({ change: 'increase' });
  const [impact, setImpact] = useState<SeatImpact | null>(null);
  const [checking, setChecking] = useState(false);
  const [acc, setAcc] = useState<{ p: Programme; body: string; number: string; validUntil: string } | null>(null);

  if (!data) return <Pending loading={loading} what="The course and seat matrix" />;
  const approved = data.programmes.filter((p) => p.status === 'Approved');
  const target = approved.find((p) => p.id === change.programmeId);

  const check = async (next: SeatChangeIn) => {
    setChange(next);
    setImpact(null);
    const complete = next.change === 'new' ? next.newName && next.department && next.newIntake : next.programmeId && (next.change === 'close' || next.change === 'rename' ? true : next.newIntake);
    if (!complete) return;
    setChecking(true);
    try {
      setImpact(await seatCheck(next));
    } catch (e) {
      if (e instanceof ApiError) toast(e.message, 'red');
    } finally {
      setChecking(false);
    }
  };

  const startApplication = async () => {
    try {
      const d = await seatDraft(change);
      if (!d) return;
      const p = new URLSearchParams({ type: d.typeId, programme: String(d.details.programme), current: String(d.details.current), requested: String(d.details.requested), reason: String(d.details.reason) });
      toast('Draft started from the seat check. Check the details and upload the documents.', 'brand');
      nav(`/institution/apply?${p.toString()}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not start the draft.', 'red');
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Institutional record"
        title="Courses and seats"
        description="Every approved course with its intake, the faculty each department needs, and accreditation. Try a change first: ANUMATI shows the extra faculty, rooms and computers it needs, then starts the right application for you."
      />
      {!canEdit && <div className="mb-6"><ReadOnlyNote who="Principal, Academic administrator or Head of Department" what="Courses and accreditation" /></div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Approved intake" value={data.totals.intake} icon={<GraduationCap size={18} />} hint={`${approved.length} courses`} />
        <Stat label="Sanctioned students, all years" value={data.totals.students.toLocaleString('en-IN')} icon={<BookOpen size={18} />} />
        <Stat label="Faculty needed" value={data.totals.facultyNeed} icon={<Users size={18} />} hint="UG 1:20, PG 1:15" />
        <Stat label="Faculty in post" value={data.totals.facultyHave} tone={data.totals.facultyHave >= data.totals.facultyNeed ? 'green' : 'amber'} icon={<Users size={18} />} hint={data.totals.facultyHave >= data.totals.facultyNeed ? 'Meets the norm' : `Short by ${data.totals.facultyNeed - data.totals.facultyHave}`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Card title="Seat matrix" subtitle="By department, from the approved courses" pad={false}>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Level</th>
                  <th className="text-right">Intake</th>
                  <th className="text-right">Students</th>
                  <th>Accreditation</th>
                </tr>
              </thead>
              <tbody>
                {data.departments.map((d) => (
                  <Fragment key={d.department}>
                    <tr className="bg-slate-50/70">
                      <td colSpan={5} className="py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-ink">{d.department}</span>
                          <span className={cn('text-xs', d.facultyHave >= d.facultyNeed ? 'text-ink-mute' : 'font-semibold text-amber-700')}>
                            Faculty {d.facultyHave} of {d.facultyNeed}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {data.programmes
                      .filter((p) => p.department === d.department)
                      .map((p) => (
                        <tr key={p.id} className={cn(p.status !== 'Approved' && 'opacity-60')}>
                          <td>
                            <span className="font-medium">{p.name}</span>
                            <span className="block text-xs text-ink-mute">
                              Since {p.since}
                              {p.xCategory ? ' · X-category' : ''}
                            </span>
                          </td>
                          <td>
                            {p.level} · {p.durationYears} yr
                          </td>
                          <td className="text-right tabular-nums">{p.approvedIntake}</td>
                          <td className="text-right tabular-nums">{p.sanctionedStudents}</td>
                          <td>
                            {p.accreditation ? (
                              <Badge tone={p.accreditationState === 'Valid' ? 'green' : p.accreditationState === 'Lapsed' ? 'red' : 'amber'} icon={<Award size={12} />}>
                                {p.accreditation.body} · {p.accreditationState} · {formatDate(p.accreditation.validUntil)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-ink-mute">None</span>
                            )}
                            {canEdit && (
                              <button className="ml-2 text-xs font-semibold text-brand-700 hover:underline" onClick={() => setAcc({ p, body: p.accreditation?.body ?? 'NBA', number: p.accreditation?.number ?? '', validUntil: p.accreditation?.validUntil ?? '' })}>
                                {p.accreditation ? 'Update' : 'Add'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Plan a change" subtitle="See what it needs before you apply">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kind of change">
            {CHANGES.map((c) => (
              <button
                key={c.id}
                role="radio"
                aria-checked={change.change === c.id}
                onClick={() => void check({ change: c.id, programmeId: change.programmeId })}
                className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors', change.change === c.id ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 text-ink-soft hover:border-brand-300')}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {change.change === 'new' ? (
              <>
                <label className="block sm:col-span-2">
                  <span className="label">New course name</span>
                  <input className="input" value={change.newName ?? ''} onChange={(e) => setChange({ ...change, newName: e.target.value })} onBlur={() => void check(change)} placeholder="B.Tech CSE (AI & ML)" />
                </label>
                <label className="block">
                  <span className="label">Department</span>
                  <select className="input" value={change.department ?? ''} onChange={(e) => void check({ ...change, department: e.target.value })}>
                    <option value="">Choose</option>
                    {data.departments.map((d) => (
                      <option key={d.department}>{d.department}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Intake</span>
                  <input className="input" type="number" min={30} step={30} value={change.newIntake ?? ''} onChange={(e) => setChange({ ...change, newIntake: Number(e.target.value) })} onBlur={() => void check(change)} />
                </label>
              </>
            ) : (
              <>
                <label className="block sm:col-span-2">
                  <span className="label">Course</span>
                  <select className="input" value={change.programmeId ?? ''} onChange={(e) => void check({ ...change, programmeId: e.target.value, newIntake: undefined })}>
                    <option value="">Choose a course</option>
                    {approved.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (intake {p.approvedIntake})
                      </option>
                    ))}
                  </select>
                </label>
                {(change.change === 'increase' || change.change === 'reduce') && (
                  <label className="block">
                    <span className="label">New intake{target ? ` (now ${target.approvedIntake})` : ''}</span>
                    <input className="input" type="number" min={0} step={30} value={change.newIntake ?? ''} onChange={(e) => setChange({ ...change, newIntake: Number(e.target.value) })} onBlur={() => void check(change)} />
                  </label>
                )}
                {change.change === 'rename' && (
                  <label className="block">
                    <span className="label">New name</span>
                    <input className="input" value={change.newName ?? ''} onChange={(e) => setChange({ ...change, newName: e.target.value })} onBlur={() => void check(change)} />
                  </label>
                )}
              </>
            )}
          </div>

          {checking && (
            <p className="mt-5 flex items-center gap-2 text-sm text-ink-mute">
              <Loader2 size={15} className="animate-spin" /> Working out what it needs…
            </p>
          )}
          {impact && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-4">
              <div className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', impact.ready ? 'border-indgreen-200 bg-indgreen-50/60' : 'border-amber-200 bg-amber-50/60')}>
                {impact.ready ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-indgreen-600" /> : <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />}
                <span>
                  <span className="block font-semibold">{impact.ready ? 'You already meet what this change needs.' : 'You can apply, but fix these before the expert visit.'}</span>
                  <span className="text-ink-mute">
                    Files as: {impact.typeName} ({impact.clause})
                  </span>
                </span>
              </div>
              <Meter label="Faculty after the change" have={impact.faculty.inPost} need={impact.faculty.after} hint={`Needed now ${impact.faculty.before}, after ${impact.faculty.after}.`} />
              {impact.rooms.map((r) => (
                <Meter key={r.kind} label={r.label} have={r.have} need={r.after} hint={`Needed now ${r.before}, after ${r.after}.`} />
              ))}
              <p className="text-xs text-ink-mute">
                Computers: {impact.computers.before} now, {impact.computers.after} after. Documents for this request: {impact.documents.join(', ')}.
              </p>
              {canEdit ? (
                <button className="btn-primary w-full" onClick={startApplication}>
                  Start this application <ArrowRight size={16} />
                </button>
              ) : (
                <p className="text-xs text-ink-mute">Your role can see the check; the Principal, Academic administrator or HoD starts the application.</p>
              )}
            </motion.div>
          )}
        </Card>
      </div>

      <Modal
        open={!!acc}
        onClose={() => setAcc(null)}
        title={acc ? `Accreditation for ${acc.p.name}` : ''}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAcc(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={!acc || acc.number.length < 3 || !acc.validUntil}
              onClick={async () => {
                if (!acc) return;
                try {
                  await saveAccreditation(acc.p.id, { body: acc.body, number: acc.number, validUntil: acc.validUntil });
                  toast('Accreditation saved.');
                  setAcc(null);
                  reload();
                } catch (e) {
                  toast(e instanceof ApiError ? e.message : 'Could not save.', 'red');
                }
              }}
            >
              Save
            </button>
          </>
        }
      >
        {acc && (
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="label">Body</span>
              <select className="input" value={acc.body} onChange={(e) => setAcc({ ...acc, body: e.target.value })}>
                <option>NBA</option>
                <option>NAAC</option>
                <option>Other</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Certificate number</span>
              <input className="input font-mono" value={acc.number} onChange={(e) => setAcc({ ...acc, number: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">Valid until</span>
              <input className="input" type="date" value={acc.validUntil} onChange={(e) => setAcc({ ...acc, validUntil: e.target.value })} />
            </label>
          </div>
        )}
      </Modal>
    </>
  );
}
