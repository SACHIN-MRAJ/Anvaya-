import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ClipboardCheck, Minus, ShieldCheck, UserPlus, UserX } from 'lucide-react';
import { useAsync } from '../../lib/useAsync';
import { may, useSession } from '../../lib/session';
import { ApiError } from '../../services/api';
import { addMember, getDrafts, getTeam, reviewDraft, updateMember, type DraftReview } from '../../services/records';
import { typeById } from '../../data/rules';
import { Badge, Callout, Card, Modal, PageHeader, toast } from '../../components/ui';
import { Pending } from '../../components/records-ui';
import { cn, formatDateTime } from '../../lib/utils';

const lower = (s = '') => s.charAt(0).toLowerCase() + s.slice(1); // keeps AICTE, DSC and other capitals

export default function Team() {
  const { session } = useSession();
  const canManage = may(session, 'team');
  const canReview = may(session, 'review');
  const team = useAsync(getTeam);
  const drafts = useAsync(getDrafts);
  const [form, setForm] = useState<{ name: string; email: string; role: string } | null>(null);
  const [review, setReview] = useState<{ d: DraftReview; decision: 'approved' | 'changes'; note: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!team.data) return <Pending loading={team.loading} what="Team and access" />;
  const { members, roles, permissions, me } = team.data;
  const waiting = (drafts.data ?? []).filter((d) => d.review?.status === 'awaiting review');

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      team.reload();
      drafts.reload();
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not save. Please try again.', 'red');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Institutional record"
        title="Team and access"
        description="Who works on your institution's records, and what each role may do. Anyone may prepare a draft; the Head of Department or Principal reviews it; only the Principal submits, signed with the DSC of the Chairman or Secretary of the Trust (APH 1.4.6)."
        actions={
          canManage && (
            <button className="btn-primary" onClick={() => setForm({ name: '', email: '', role: 'Institution staff' })}>
              <UserPlus size={16} /> Give access
            </button>
          )
        }
      />

      <Callout tone="brand" icon={<ShieldCheck size={16} />} title={`You are signed in as ${me.role}`}>
        You can: {me.can.map((c) => lower(permissions.find((p) => p.id === c)?.label)).join('; ')}.
      </Callout>

      {canReview && (
        <Card className="mt-6" title="Drafts waiting for your review" subtitle="Approve them for the Principal to submit, or ask for changes" pad={false}>
          {waiting.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-ink-mute">Nothing waiting. Drafts sent for review appear here and in your notifications.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {waiting.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 px-6 py-4 text-sm">
                  <ClipboardCheck size={18} className="text-brand-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{typeById(d.typeId)?.name ?? d.typeId}</span>
                    <span className="text-xs text-ink-mute">
                      Prepared by {d.review?.by ?? d.preparedBy} · sent {d.review?.at ? formatDateTime(d.review.at) : ''}
                    </span>
                  </span>
                  <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setReview({ d, decision: 'changes', note: '' })}>
                    Ask for changes
                  </button>
                  <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => setReview({ d, decision: 'approved', note: '' })}>
                    Approve for submission
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card title={`People (${members.filter((m) => m.active).length} active)`} pad={false}>
          <ul className="divide-y divide-slate-100">
            {members.map((m, i) => (
              <motion.li key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className={cn('flex flex-wrap items-center gap-3 px-6 py-3.5 text-sm', !m.active && 'opacity-55')}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-xs font-bold text-brand-700">
                  {m.name
                    .replace(/^(Dr|Prof|Shri|Smt)\.?\s+/i, '')
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{m.name}</span>
                  <span className="block truncate text-xs text-ink-mute">{m.email}</span>
                </span>
                {canManage && m.active ? (
                  <select className="input h-9 w-auto py-1 text-xs" value={m.role} disabled={busy} onChange={(e) => void act(() => updateMember(m.id, { role: e.target.value }), `${m.name} is now ${e.target.value}.`)} aria-label={`Role of ${m.name}`}>
                    {roles.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                ) : (
                  <Badge tone={m.active ? 'brand' : 'slate'}>{m.active ? m.role : 'Access off'}</Badge>
                )}
                {canManage && (
                  <button
                    className={cn('btn-secondary px-2.5 py-1.5 text-xs', m.active && 'hover:border-red-300 hover:text-red-700')}
                    disabled={busy}
                    onClick={() => void act(() => updateMember(m.id, { active: !m.active }), m.active ? `Access switched off for ${m.name}. It ends within 30 seconds.` : `Access switched on for ${m.name}.`)}
                  >
                    {m.active ? (
                      <>
                        <UserX size={13} /> Switch off
                      </>
                    ) : (
                      'Switch on'
                    )}
                  </button>
                )}
              </motion.li>
            ))}
          </ul>
        </Card>

        <Card title="What each role may do" subtitle="The server enforces this table on every request" pad={false}>
          <div className="overflow-x-auto">
            <table className="table-base text-xs">
              <thead>
                <tr>
                  <th>Permission</th>
                  {roles.map((r) => (
                    <th key={r} className="text-center">
                      {r.replace(' / Director', '').replace('Academic administrator', 'Academic').replace('Institution staff', 'Staff').replace('Head of Department', 'HoD').replace('Compliance staff', 'Compliance')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.label}</td>
                    {roles.map((r) => (
                      <td key={r} className="text-center">
                        {p.roles.includes(r) ? <Check size={15} className="mx-auto text-indgreen-600" aria-label="Allowed" /> : <Minus size={15} className="mx-auto text-slate-300" aria-label="Not allowed" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title="Give access"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={busy || !form || form.name.trim().length < 3 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)}
              onClick={async () => form && (await act(() => addMember(form), `${form.name} added as ${form.role}. They sign in with their registered email.`)) && setForm(null)}
            >
              Give access
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
              <span className="label">Official email</span>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">Role</span>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <p className="text-xs text-ink-mute sm:col-span-2">
              They can: {permissions.filter((p) => p.roles.includes(form.role)).map((p) => lower(p.label)).join('; ')}.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={!!review}
        onClose={() => setReview(null)}
        title={review?.decision === 'approved' ? 'Approve for submission' : 'Ask for changes'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setReview(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={busy || !review || (review.decision === 'changes' && review.note.trim().length < 5)}
              onClick={async () =>
                review && (await act(() => reviewDraft(review.d.id, review.decision, review.note), review.decision === 'approved' ? 'Approved. The Principal can now submit it.' : 'Changes asked. The person who prepared it has been told.')) && setReview(null)
              }
            >
              {review?.decision === 'approved' ? 'Approve' : 'Send back'}
            </button>
          </>
        }
      >
        {review && (
          <label className="block">
            <span className="label">{review.decision === 'approved' ? 'Note for the Principal (optional)' : 'What should change'}</span>
            <textarea className="input min-h-[110px]" value={review.note} onChange={(e) => setReview({ ...review, note: e.target.value })} />
          </label>
        )}
      </Modal>
    </>
  );
}
