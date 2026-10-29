import { useMemo, useState } from 'react';
import { Search, ShieldCheck, UserMinus, UserPlus, Users } from 'lucide-react';
import { useAsync } from '../../lib/useAsync';
import { may, useSession } from '../../lib/session';
import { ApiError } from '../../services/api';
import { addFaculty, getFaculty, updateFaculty, type FacultyMember } from '../../services/records';
import { Badge, Card, Modal, PageHeader, Stat, toast } from '../../components/ui';
import { Tour } from '../../components/live';
import { FACULTY_TOUR } from '../../data/tours';
import { FindingList, Meter, Pending, ReadOnlyNote, VerificationBadge } from '../../components/records-ui';
import { formatDate, TODAY } from '../../lib/utils';

const DESIGNATIONS = ['Professor', 'Associate Professor', 'Assistant Professor'] as const;
const QUALIFICATIONS = ['PhD', 'M.Tech', 'M.E.', 'MBA', 'MCA', 'M.Sc', 'Other'];
const blank = { name: '', pan: '', designation: 'Assistant Professor', department: '', qualification: 'M.Tech', employment: 'Regular', joined: TODAY };

export default function Faculty() {
  const { session } = useSession();
  const canEdit = may(session, 'academics');
  const { data, loading, reload } = useAsync(getFaculty);
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('');
  const [showLeft, setShowLeft] = useState(false);
  const [form, setForm] = useState<typeof blank | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(
    () =>
      (data?.faculty ?? []).filter(
        (f) => (showLeft || f.status === 'Active') && (!dept || f.department === dept) && (!query || `${f.name} ${f.designation} ${f.qualification}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [data, query, dept, showLeft],
  );

  if (!data) return <Pending loading={loading} what="The faculty roster" />;
  const { norms } = data;
  const departments = norms.departments.map((d) => d.department);

  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      const r = await addFaculty({ ...form, pan: form.pan.trim() || undefined });
      toast(r?.warning ?? `${form.name} added. AICTE checks new faculty against PAN and the national list.`, r?.warning ? 'red' : 'green');
      setForm(null);
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not add. Please try again.', 'red');
    } finally {
      setBusy(false);
    }
  };

  const markLeft = async (f: FacultyMember) => {
    try {
      await updateFaculty(f.id, { status: 'Left' });
      toast(`${f.name} recorded as left. The norms update straight away.`, 'brand');
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not update.', 'red');
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Institutional record"
        title="Faculty"
        description="The faculty roster, checked against the APH norms: 1:20 for UG and Diploma and 1:15 for PG over all years, the 1:2:6 cadre, and a PhD for Professors and Associate Professors. Only a fingerprint of each PAN is kept."
        tourId="faculty"
        actions={
          canEdit && (
            <button className="btn-primary" onClick={() => setForm({ ...blank, department: departments[0] ?? '' })}>
              <UserPlus size={16} /> Add faculty
            </button>
          )
        }
      />
      <Tour id="faculty" steps={FACULTY_TOUR} />
      {!canEdit && <div className="mb-6"><ReadOnlyNote who="Principal, Academic administrator or Head of Department" what="The faculty roster" /></div>}

      <div data-tour="norms" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Faculty in post" value={norms.inPost} icon={<Users size={18} />} tone={norms.inPost >= norms.required ? 'green' : 'amber'} hint={`${norms.required} needed`} />
        <Stat label="Student–faculty ratio" value={norms.ratio} icon={<Users size={18} />} hint="On sanctioned students" />
        <Stat label="Awaiting AICTE check" value={norms.pendingVerification} icon={<ShieldCheck size={18} />} tone="slate" hint="New joiners and changed posts" />
        <Stat label="Findings" value={norms.findings.length} tone={norms.findings.some((f) => f.severity === 'blocker') ? 'red' : norms.findings.length ? 'amber' : 'green'} icon={<ShieldCheck size={18} />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="By department" subtitle="Needed from the approved courses">
          <ul className="space-y-4">
            {norms.departments.map((d) => (
              <li key={d.department}>
                <Meter label={d.department} have={d.have} need={d.need} />
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Cadre 1:2:6" subtitle="Professor : Associate : Assistant">
          <ul className="space-y-4">
            {norms.cadre.map((c) => (
              <li key={c.designation}>
                <Meter label={c.designation} have={c.have} need={c.need} />
              </li>
            ))}
          </ul>
        </Card>
        <Card title="What to fix" subtitle="Raised at scrutiny or the expert visit if left">
          <div className="max-h-72 overflow-y-auto pr-1">
            <FindingList items={norms.findings} empty="The roster meets every norm." />
          </div>
        </Card>
      </div>

      <Card data-tour="roster" className="mt-6" pad={false} title={`Roster (${rows.length})`}>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 pb-4">
          <label className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
            <input className="input pl-9" placeholder="Search by name, post or qualification" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search faculty" />
          </label>
          <select className="input w-auto" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={showLeft} onChange={(e) => setShowLeft(e.target.checked)} /> Show those who left
          </label>
        </div>
        <div className="max-h-[560px] overflow-auto">
          <table className="table-base">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th>Name</th>
                <th>Post</th>
                <th>Department</th>
                <th>Qualification</th>
                <th>Joined</th>
                <th>Check</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id} className={f.status === 'Left' ? 'opacity-50' : undefined}>
                  <td className="font-medium">
                    {f.name}
                    {f.employment !== 'Regular' && (
                      <Badge tone="slate" className="ml-2">
                        {f.employment}
                      </Badge>
                    )}
                  </td>
                  <td>{f.designation}</td>
                  <td className="max-w-[200px] truncate">{f.department}</td>
                  <td>
                    {f.qualification}
                    {f.designation !== 'Assistant Professor' && f.qualification !== 'PhD' && (
                      <Badge tone="amber" className="ml-2">
                        PhD needed
                      </Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap">{formatDate(f.joined)}</td>
                  <td>{f.status === 'Left' ? <Badge tone="slate">Left</Badge> : <VerificationBadge status={f.verification} />}</td>
                  {canEdit && (
                    <td>
                      {f.status === 'Active' && (
                        <button className="text-xs font-semibold text-ink-mute hover:text-red-600" onClick={() => void markLeft(f)} aria-label={`Record that ${f.name} left`}>
                          <UserMinus size={15} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title="Add faculty"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={busy || !form || form.name.trim().length < 3 || !form.department || (!!form.pan && !/^[A-Za-z]{5}\d{4}[A-Za-z]$/.test(form.pan))} onClick={save}>
              Add
            </button>
          </>
        }
      >
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label">Full name</span>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">PAN (only its fingerprint is stored)</span>
              <input className="input font-mono uppercase" maxLength={10} value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} placeholder="ABCDE1234F" />
            </label>
            <label className="block">
              <span className="label">Date of joining</span>
              <input className="input" type="date" value={form.joined} onChange={(e) => setForm({ ...form, joined: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">Post</span>
              <select className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}>
                {DESIGNATIONS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Highest qualification</span>
              <select className="input" value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })}>
                {QUALIFICATIONS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Department</span>
              <select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                {departments.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Employment</span>
              <select className="input" value={form.employment} onChange={(e) => setForm({ ...form, employment: e.target.value })}>
                <option>Regular</option>
                <option>Contract</option>
                <option>Visiting</option>
              </select>
            </label>
          </div>
        )}
      </Modal>
    </>
  );
}
