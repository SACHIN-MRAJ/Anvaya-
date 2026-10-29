import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Minus } from 'lucide-react';
import { Badge, Card, PageHeader, Tabs, Toggle, toast } from '../../components/ui';
import { cn } from '../../lib/utils';
import { useSession } from '../../lib/session';
import { useAlertSettings, useIntegrations } from '../../lib/live-data';
import { invalidate } from '../../lib/resource';
import { ApiError, runDeadlineCheck, saveAlertSettings } from '../../services/api';

const INTEGRATIONS = [
  { name: 'AICTE web portal', purpose: 'Application data and status (API, CSV until access)', status: 'Mock' },
  { name: 'National Single Window System', purpose: 'Entry point for new institutions', status: 'Mock' },
  { name: 'DigiLocker / API Setu', purpose: 'Verify documents at source', status: 'Planned' },
  { name: 'drand (League of Entropy)', purpose: 'Public randomness for EVC draws', status: 'Live' },
  { name: 'IndicTrans2', purpose: 'Notices in 22 scheduled languages', status: 'Planned' },
  { name: 'SMS gateway (TRAI DLT)', purpose: 'Registered reminder templates', status: 'Mock' },
  { name: 'WhatsApp Business API', purpose: 'Reminders and status updates', status: 'Mock' },
  { name: 'RFC 3161 time-stamping authority', purpose: 'Seal the daily root of the evidence log', status: 'Mock' },
];

const TEMPLATES = [
  { name: 'Deadline reminder (7 days)', channel: 'Email, SMS, WhatsApp', dlt: '1107169000000012345', langs: 22 },
  { name: 'Deficiency recorded, clock paused', channel: 'Email, SMS', dlt: '1107169000000012346', langs: 22 },
  { name: 'EVC panel assigned', channel: 'Email', dlt: '—', langs: 2 },
  { name: 'Escalation to regional officer', channel: 'Email, SMS', dlt: '1107169000000012348', langs: 2 },
  { name: 'Decision issued with verification link', channel: 'Email, SMS, WhatsApp', dlt: '1107169000000012349', langs: 22 },
];

const ROLES = ['Institution', 'Regulation Bureau Admin', 'Scrutiny Reviewer', 'EVC Inspector', 'SHC Compliance Reviewer', 'Executive Committee Approver', 'Council Decision Authority'];
const PERMS: [string, boolean[]][] = [
  ['Submit applications and evidence', [true, false, false, false, false, false]],
  ['See own region’s files', [false, true, true, true, false, false]],
  ['See all regions', [false, false, false, true, false, false]],
  ['Send back with reasons', [false, true, true, true, false, false]],
  ['Record committee recommendations', [false, false, false, false, true, false]],
  ['Edit rules (needs approval)', [false, false, false, false, false, true]],
  ['Approve rule versions', [false, false, false, true, false, false]],
];

export default function SettingsPage() {
  const [tab, setTab] = useState<'integrations' | 'alerts' | 'templates' | 'access' | 'regulator'>('integrations');
  const [regulator, setRegulator] = useState<'AICTE' | 'VBSA'>('AICTE');
  const { session } = useSession();
  // Live status of each connection, read from the running server's configuration.
  const { data: live, refresh } = useIntegrations();
  const integrations = live ?? INTEGRATIONS;
  const { data: alerts } = useAlertSettings();
  const [checking, setChecking] = useState(false);
  const canEdit = session?.officerRole === 'Regulation Bureau Admin';
  const toggleChannel = async (c: 'email' | 'sms' | 'whatsapp') => {
    if (!alerts) return;
    try {
      await saveAlertSettings({ channels: { ...alerts.channels, [c]: !alerts.channels[c] } });
      invalidate('settings:alerts');
      toast(`${c === 'sms' ? 'SMS' : c === 'whatsapp' ? 'WhatsApp' : 'Email'} alerts ${alerts.channels[c] ? 'switched off' : 'switched on'}. Recorded in the evidence log.`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not change the setting.', 'red');
    }
  };
  const runCheck = async () => {
    setChecking(true);
    try {
      const beat = await runDeadlineCheck();
      toast(beat ? `Deadline check done: ${beat.escalated} escalated, ${beat.reminded} reminded.` : 'Connect the server to run the deadline check.', beat ? 'green' : 'brand');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not run the check.', 'red');
    } finally {
      setChecking(false);
    }
  };
  return (
    <>
      <PageHeader eyebrow="Governance" title="Settings" description="Integrations, notification templates, who can do what, and the regulator profile. Changes here are versioned and logged like rules." />
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'integrations', label: 'Integrations' },
          { value: 'alerts', label: 'Alerts and deadlines' },
          { value: 'templates', label: 'Notification templates' },
          { value: 'access', label: 'Roles and access' },
          { value: 'regulator', label: 'Regulator profile' },
        ]}
      />
      {tab === 'integrations' && (
        <Card pad={false}>
          <ul className="divide-y divide-slate-100">
            {integrations.map((i, n) => (
              <motion.li key={i.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: n * 0.035 }} className="flex flex-wrap items-center gap-3 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{i.name}</p>
                  <p className="text-sm text-ink-mute">{i.purpose}</p>
                </div>
                <Badge tone={i.status.startsWith('Live') ? 'green' : i.status === 'Down' ? 'red' : i.status === 'Logged' || i.status === 'Development' || i.status === 'Mock' ? 'brand' : 'slate'}>
                  {i.status.startsWith('Live') && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-indgreen-500" aria-hidden />}
                  {i.status}
                </Badge>
              </motion.li>
            ))}
          </ul>
          <p className="border-t border-slate-100 px-6 py-3 text-xs text-ink-mute">
            {live ? (
              <>
                Read from the running server just now.{' '}
                <button className="font-semibold text-brand-700 hover:underline" onClick={() => void refresh()}>
                  Check again
                </button>
              </>
            ) : (
              'Server not connected: showing the planned status of each connection.'
            )}
          </p>
        </Card>
      )}
      {tab === 'alerts' && (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Card title="Escalation ladder" subtitle="Who is alerted as a file goes past its deadline">
            <ol className="space-y-3">
              {(alerts?.ladder ?? []).map((l, i) => (
                <motion.li key={l.level} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="flex items-start gap-3 rounded-xl border border-slate-100 px-4 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 font-display text-sm font-bold text-brand-700">{l.level}</span>
                  <span className="text-sm">
                    <span className="block font-semibold text-ink">{l.who}</span>
                    <span className="text-ink-mute">
                      {l.when} · {l.channel}
                    </span>
                  </span>
                </motion.li>
              ))}
              {!alerts && <p className="text-sm text-ink-mute">Connect the server to see and change the live escalation ladder.</p>}
            </ol>
          </Card>
          <div className="space-y-6">
            <Card title="Alert channels" subtitle={canEdit ? 'Changes apply to every new alert and are recorded' : 'Only a Regulation Bureau Admin or Regulation Bureau Admin can change these'}>
              <div className="space-y-4">
                {(['email', 'sms', 'whatsapp'] as const).map((c) => (
                  <div key={c} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{c === 'sms' ? 'SMS (TRAI DLT)' : c === 'whatsapp' ? 'WhatsApp Business' : 'Email'}</span>
                    <Toggle checked={Boolean(alerts?.channels[c])} onChange={() => canEdit && toggleChannel(c)} label="" srLabel={`${c} alerts`} />
                  </div>
                ))}
              </div>
              {alerts && <p className="mt-4 text-xs text-ink-mute">Reminders go out {alerts.remindDaysBefore.join(', ')} days before each date · quiet hours {alerts.quietHours}</p>}
            </Card>
            <Card title="Deadline check" subtitle="Runs every minute on the server; run it now to see escalations immediately">
              <button className="btn-secondary w-full" onClick={runCheck} disabled={checking || session?.officerRole !== 'Regulation Bureau Admin'}>
                {checking ? 'Checking…' : 'Run the deadline check now'}
              </button>
              {session?.officerRole !== 'Regulation Bureau Admin' && <p className="mt-2 text-xs text-ink-mute">Only a Regulation Bureau Admin can run it on demand.</p>}
            </Card>
          </div>
        </div>
      )}
      {tab === 'templates' && (
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Channels</th>
                  <th>DLT template ID</th>
                  <th className="text-right">Languages</th>
                </tr>
              </thead>
              <tbody>
                {TEMPLATES.map((t) => (
                  <tr key={t.name}>
                    <td className="font-medium text-ink">{t.name}</td>
                    <td>{t.channel}</td>
                    <td className="font-mono text-xs">{t.dlt}</td>
                    <td className="text-right">{t.langs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-6 py-3 text-xs text-ink-mute">DLT IDs are placeholders. Real IDs come from registering templates on the telecom DLT portal.</p>
        </Card>
      )}
      {tab === 'access' && (
        <Card pad={false} title="Role-based access" subtitle="Enforced by Keycloak roles and database row-level security">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Permission</th>
                  {ROLES.map((r) => (
                    <th key={r} className="text-center">
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMS.map(([p, allowed]) => (
                  <tr key={p}>
                    <td className="font-medium text-ink">{p}</td>
                    {allowed.map((a, i) => (
                      <td key={i} className="text-center">
                        {a ? <Check size={16} className="mx-auto text-indgreen-600" aria-label="Allowed" /> : <Minus size={16} className="mx-auto text-slate-300" aria-label="Not allowed" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {tab === 'regulator' && (
        <Card title="Regulator profile" subtitle="Rules, roles and letterheads are data, so the platform can follow a change of regulator">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { id: 'AICTE' as const, t: 'AICTE (current)', d: 'AICTE Act 1987 · APH 2024-27 · Regulation Bureau, 10 regional offices' },
              { id: 'VBSA' as const, t: 'Viksit Bharat Shiksha Adhishthan (proposed)', d: 'Bill introduced 15 Dec 2025 · Regulatory, Standards and Accreditation Councils' },
            ].map((r) => (
              <button key={r.id} onClick={() => setRegulator(r.id)} aria-pressed={regulator === r.id} className={cn('rounded-xl border p-4 text-left transition-all', regulator === r.id ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 hover:bg-slate-50')}>
                <p className="font-semibold">{r.t}</p>
                <p className="mt-1 text-sm text-ink-mute">{r.d}</p>
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-mute">{regulator === 'VBSA' ? 'Preview: role names map to the Regulatory Council; the rule tables would load from the new regulations once notified. Nothing in the software changes.' : 'Active profile. Rules v2026.3 from APH 2024-27.'}</p>
        </Card>
      )}
    </>
  );
}
