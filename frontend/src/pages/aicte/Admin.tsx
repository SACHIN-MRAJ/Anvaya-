import { useMemo, useState } from 'react';
import { Search, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { useAsync } from '../../lib/useAsync';
import { useSession } from '../../lib/session';
import { ApiError } from '../../services/api';
import { getAccounts, updateAccount } from '../../services/records';
import { Badge, Callout, Card, PageHeader, Stat, Tabs, toast } from '../../components/ui';
import { NotAllowed, Pending } from '../../components/records-ui';
import { cn } from '../../lib/utils';

const VIEWERS = ['System administrator', 'Bureau head', 'Auditor'];

export default function Admin() {
  const { session } = useSession();
  const allowed = VIEWERS.includes(session?.officerRole ?? '');
  const { data, loading, reload } = useAsync(() => (allowed ? getAccounts() : Promise.resolve(null)), [allowed]);
  const [portal, setPortal] = useState<'aicte' | 'institution'>('aicte');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const rows = useMemo(() => (data?.users ?? []).filter((u) => u.portal === portal && (!query || `${u.name} ${u.email} ${u.role} ${u.institutionId ?? ''}`.toLowerCase().includes(query.toLowerCase()))), [data, portal, query]);

  if (!allowed) return <NotAllowed text="User access is managed by the System administrator. Bureau heads and auditors can view it." />;
  if (!data) return <Pending loading={loading} what="User access" />;

  const change = async (id: string, active: boolean, ok: string) => {
    setBusy(id);
    try {
      await updateAccount(id, active);
      toast(ok);
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not change access.', 'red');
    } finally {
      setBusy(null);
    }
  };

  const active = data.users.filter((u) => u.active).length;
  return (
    <>
      <PageHeader eyebrow="Governance" title="User access" description="Every account that can sign in, its role, and whether access is on. Changes take effect within 30 seconds and are written to the ACCESS evidence chain." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Accounts" value={data.users.length} icon={<ShieldCheck size={18} />} />
        <Stat label="Access on" value={active} tone="green" icon={<UserCheck size={18} />} />
        <Stat label="Access off" value={data.users.length - active} tone={data.users.length - active ? 'amber' : 'slate'} icon={<UserX size={18} />} />
      </div>
      <div className="mt-6">
        <Callout tone="brand" title={data.sso ? 'Single sign-on' : 'Development sign-in'}>
          {data.note}
          {!data.canEdit && ' You can view this page; only the System administrator changes access.'}
        </Callout>
      </div>
      <Card className="mt-6" pad={false}>
        <div className="flex flex-wrap items-center gap-3 px-4 pt-2">
          <Tabs
            value={portal}
            onChange={setPortal}
            tabs={[
              { value: 'aicte', label: 'AICTE staff', count: data.users.filter((u) => u.portal === 'aicte').length },
              { value: 'institution', label: 'Institution staff', count: data.users.filter((u) => u.portal === 'institution').length },
            ]}
          />
          <label className="relative ml-auto w-full max-w-xs pb-2 sm:w-auto">
            <Search size={15} className="absolute left-3 top-[18px] -translate-y-1/2 text-ink-mute" />
            <input className="input pl-9" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search accounts" />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>{portal === 'aicte' ? 'Region' : 'Institution'}</th>
                <th>Access</th>
                {data.canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className={cn(!u.active && 'opacity-60')}>
                  <td>
                    <span className="font-medium">{u.name}</span>
                    <span className="block font-mono text-[11px] text-ink-mute">{u.id}</span>
                  </td>
                  <td className="text-sm">{u.role}</td>
                  <td className="text-sm">{portal === 'aicte' ? u.region ?? 'All regions' : u.institutionId}</td>
                  <td>{u.active ? <Badge tone="green">On</Badge> : <Badge tone="slate">Off</Badge>}</td>
                  {data.canEdit && (
                    <td>
                      <button className="btn-secondary px-2.5 py-1.5 text-xs" disabled={busy === u.id || (u.name === session?.name && u.role === session?.officerRole)} onClick={() => void change(u.id, !u.active, u.active ? `Access switched off for ${u.name}.` : `Access switched on for ${u.name}.`)}>
                        {u.active ? 'Switch off' : 'Switch on'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
