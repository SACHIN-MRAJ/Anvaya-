import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Fingerprint, Loader2, ShieldAlert, ShieldCheck, Stamp } from 'lucide-react';
import { APPLICATIONS } from '../../data/applications';
import { institutionById } from '../../data/institutions';
import { buildAuditChain, verifyChain } from '../../services/api';
import { sha256Hex, shortHash } from '../../lib/hash';
import { Badge, Callout, Card, PageHeader, Toggle } from '../../components/ui';
import { cn, formatDateTime } from '../../lib/utils';
import type { AuditEntry } from '../../types';

export default function Evidence() {
  const options = useMemo(() => APPLICATIONS.filter((a) => a.history.length >= 4).slice(0, 12), []);
  const [appId, setAppId] = useState('ANU-2026-0412');
  const [chain, setChain] = useState<AuditEntry[]>([]);
  const [tamper, setTamper] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; brokenAt?: number } | null>(null);
  const [root, setRoot] = useState('');

  useEffect(() => {
    const app = APPLICATIONS.find((a) => a.id === appId)!;
    buildAuditChain(app).then((c) => {
      setChain(c);
      setResult(null);
      setChecked(0);
      sha256Hex(c.map((e) => e.hash).join('')).then(setRoot);
    });
  }, [appId]);

  const view = useMemo(() => (tamper ? chain.map((e) => (e.seq === 3 ? { ...e, payload: e.payload.replace('"action":"', '"action":"[EDITED] '), action: `[EDITED] ${e.action}` } : e)) : chain), [chain, tamper]);

  const run = async () => {
    setChecking(true);
    setResult(null);
    setChecked(0);
    for (let i = 1; i <= view.length; i++) {
      await new Promise((r) => setTimeout(r, 180));
      setChecked(i);
    }
    setResult(await verifyChain(view));
    setChecking(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Governance · tamper-evident log"
        title="Evidence log"
        description="Every action is stored with the hash of the previous one, like links in a chain. Change any old record and every later link breaks. The fingerprints below are real SHA-256 values computed in your browser."
      />
      <Card className="mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="md:w-96">
            <label className="label" htmlFor="app">
              Application
            </label>
            <select id="app" className="input" value={appId} onChange={(e) => setAppId(e.target.value)}>
              {options.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} · {institutionById(a.institutionId)?.name.split(',')[0]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Toggle checked={tamper} onChange={(v) => (setTamper(v), setResult(null), setChecked(0))} label="Simulate someone editing record 3" />
            <button className="btn-primary" onClick={run} disabled={checking}>
              {checking ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Verify chain
            </button>
          </div>
        </div>
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
              {result.ok ? (
                <Callout tone="green" icon={<ShieldCheck size={18} />} title="Chain intact">
                  All {view.length} records match their fingerprints. Nothing has been altered.
                </Callout>
              ) : (
                <Callout tone="red" icon={<ShieldAlert size={18} />} title={`Tampering detected at record ${result.brokenAt}`}>
                  Record {result.brokenAt} no longer matches its fingerprint, so every record after it is untrusted. An alert goes to the Vigilance cell.
                </Callout>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>#</th>
                <th>Time</th>
                <th>Action</th>
                <th>Previous fingerprint</th>
                <th>Fingerprint</th>
                <th>Check</th>
              </tr>
            </thead>
            <tbody>
              {view.map((e) => {
                const done = checked >= e.seq;
                const broken = result && !result.ok && result.brokenAt !== undefined && e.seq >= result.brokenAt;
                return (
                  <tr key={e.seq} className={cn(broken && 'bg-red-50/70')}>
                    <td className="font-semibold">{e.seq}</td>
                    <td className="whitespace-nowrap text-xs">{formatDateTime(e.at)}</td>
                    <td className={cn('min-w-[240px]', e.action.startsWith('[EDITED]') && 'font-semibold text-red-700')}>
                      {e.action}
                      <p className="text-xs text-ink-mute">{e.actor}</p>
                    </td>
                    <td className="font-mono text-[11px]">{shortHash(e.prevHash, 12)}</td>
                    <td className="font-mono text-[11px]">{shortHash(e.hash, 12)}</td>
                    <td>
                      {done ? (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          {broken ? <ShieldAlert size={18} className="text-red-600" /> : <CheckCircle2 size={18} className="text-indgreen-600" />}
                        </motion.span>
                      ) : (
                        <span className="text-xs text-ink-mute">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card title="Daily root" subtitle="One fingerprint summarising every record of the day">
          <p className="flex items-center gap-2 break-all font-mono text-xs">
            <Fingerprint size={14} className="shrink-0 text-brand-600" /> {root}
          </p>
        </Card>
        <Card title="Trusted time-stamp" subtitle="RFC 3161 token from a licensed time-stamping authority">
          <p className="flex items-center gap-2 text-sm">
            <Stamp size={16} className="text-brand-600" /> Root sealed at 22 Oct 2026, 23:59:59 IST <Badge tone="green">Valid</Badge>
          </p>
          <p className="mt-2 text-xs text-ink-mute">Even an administrator with database access cannot back-date or rewrite the day’s records without breaking the seal.</p>
        </Card>
      </div>
    </>
  );
}
