import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ClipboardList, MapPin, Smartphone, UserPlus } from 'lucide-react';
import { useAsync } from '../../lib/useAsync';
import { useSession } from '../../lib/session';
import { ApiError } from '../../services/api';
import { assignInspection, getInspections, getInspectors } from '../../services/records';
import { institutionById } from '../../data/institutions';
import { typeById } from '../../data/rules';
import { Badge, Card, EmptyState, Modal, PageHeader, ProgressBar, toast } from '../../components/ui';
import { Pending } from '../../components/records-ui';
import { formatDate, formatDateTime } from '../../lib/utils';

const ASSIGNERS = ['Regulation Bureau Admin', 'EVC Inspector'];
const TONE = { Assigned: 'slate', 'In progress': 'brand', Submitted: 'green' } as const;

export default function Field() {
  const { session } = useSession();
  const inspector = session?.officerRole === 'EVC Inspector';
  const canAssign = ASSIGNERS.includes(session?.officerRole ?? '');
  const { data, loading, reload } = useAsync(getInspections);
  const [assign, setAssign] = useState<{ appId: string; inspectorId: string; mode: string } | null>(null);
  const people = useAsync(() => (assign ? getInspectors(assign.appId) : Promise.resolve(null)), [assign?.appId]);

  if (!data) return <Pending loading={loading} what="Field inspections" />;

  const save = async () => {
    if (!assign) return;
    try {
      await assignInspection(assign.appId, assign.inspectorId, assign.mode);
      toast('Inspection assigned. The inspector sees it on their phone straight away.');
      setAssign(null);
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not assign.', 'red');
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={inspector ? 'Your visits' : 'Processing'}
        title="Field inspections"
        description={
          inspector
            ? 'The visits assigned to you. Open one on your phone at the campus: tick each line, take the GPS photos, add the recording, then sign. The report is fingerprinted into the file.'
            : 'On-site and online expert visits. The checklist follows APH 1.9, with expected figures worked out from each institution’s own record. A signed report cannot be changed.'
        }
      />

      {data.inspections.length === 0 ? (
        <EmptyState icon={<ClipboardList size={22} />} title={inspector ? 'No visits assigned to you' : 'No inspections yet'} text="Inspections appear here once an EVC coordinator assigns one." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.inspections.map((i, k) => (
            <motion.div key={i.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.05 }}>
              <Link to={`/aicte/field/${i.id}`} className="card-hover block h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-brand-700">{i.applicationId}</p>
                    <p className="mt-0.5 truncate font-semibold text-ink">{i.institution?.name}</p>
                    <p className="flex items-center gap-1 text-xs text-ink-mute">
                      <MapPin size={12} /> {i.institution?.city} · {i.mode}
                    </p>
                  </div>
                  <Badge tone={TONE[i.status]}>{i.status}</Badge>
                </div>
                <div className="mt-4">
                  <ProgressBar value={(i.progress.done / i.progress.total) * 100} tone={i.status === 'Submitted' ? 'green' : 'brand'} label={`${i.progress.done} of ${i.progress.total} lines`} />
                </div>
                <p className="mt-3 text-xs text-ink-mute">
                  {i.status === 'Submitted' && i.submittedAt
                    ? `Signed ${formatDateTime(i.submittedAt)} · ${i.progress.concerns} concern${i.progress.concerns === 1 ? '' : 's'}`
                    : `Assigned to ${i.inspectorName} by ${i.assignedBy}, ${formatDate(i.assignedAt)}`}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                  {inspector && i.status !== 'Submitted' ? (
                    <>
                      <Smartphone size={14} /> Open checklist
                    </>
                  ) : (
                    'Open report'
                  )}{' '}
                  <ArrowRight size={14} />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {!inspector && (
        <Card className="mt-6" title="Files at the expert-visit stage without an inspection" subtitle="Assign an inspector who has no link to the institution" pad={false}>
          {data.unassigned.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-ink-mute">Every file at the expert-visit stage has an inspection.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.unassigned.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-6 py-3.5 text-sm">
                  <Link to={`/aicte/applications/${a.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                    {a.id}
                  </Link>
                  <span className="min-w-0 flex-1 truncate">
                    {institutionById(a.institutionId)?.name ?? a.institutionId} · {typeById(a.typeId).name}
                  </span>
                  <span className="text-xs text-ink-mute">Due {formatDate(a.dueOn)}</span>
                  {canAssign && (
                    <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setAssign({ appId: a.id, inspectorId: '', mode: 'Physical' })}>
                      <UserPlus size={13} /> Assign
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Modal
        open={!!assign}
        onClose={() => setAssign(null)}
        title={assign ? `Assign an inspection for ${assign.appId}` : ''}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAssign(null)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={!assign?.inspectorId} onClick={save}>
              Assign
            </button>
          </>
        }
      >
        {assign && (
          <div className="space-y-4">
            <fieldset>
              <legend className="label">Inspector</legend>
              <div className="space-y-2">
                {(people.data ?? []).map((p) => (
                  <label key={p.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${p.conflict ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-brand-300'}`}>
                    <input type="radio" name="inspector" disabled={p.conflict} checked={assign.inspectorId === p.id} onChange={() => setAssign({ ...assign, inspectorId: p.id })} />
                    <span className="flex-1 font-medium">{p.name}</span>
                    <span className="text-xs text-ink-mute">{p.conflict ? 'Linked to this institution' : `${p.open} open`}</span>
                  </label>
                ))}
                {people.data?.length === 0 && <p className="text-sm text-ink-mute">No active inspector accounts.</p>}
              </div>
            </fieldset>
            <label className="block">
              <span className="label">Mode (APH 1.9)</span>
              <select className="input" value={assign.mode} onChange={(e) => setAssign({ ...assign, mode: e.target.value })}>
                <option>Physical</option>
                <option>Online</option>
                <option>Hybrid</option>
              </select>
            </label>
            <p className="text-xs text-ink-mute">Online and hybrid visits need a recording of at least 30 minutes; physical visits are recorded too.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
