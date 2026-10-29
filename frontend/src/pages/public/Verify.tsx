import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { QrCode, verifyUrl } from '../../components/qr';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, Download, FileUp, Fingerprint, Loader2, Search, ShieldAlert, ShieldX } from 'lucide-react';
import { letterText, verifyFile, verifyReference, type VerifyResult } from '../../services/api';
import { APPLICATIONS } from '../../data/applications';
import { institutionById } from '../../data/institutions';
import { typeById } from '../../data/rules';
import { Card, CopyButton, PageHeader } from '../../components/ui';
import { formatDate, formatDateTime } from '../../lib/utils';
import { shortHash } from '../../lib/hash';

export default function Verify() {
  const [params] = useSearchParams();
  const [ref, setRef] = useState(params.get('ref') ?? '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const runRef = async (r: string) => {
    if (!r.trim()) return;
    setBusy(true);
    setResult(null);
    setResult(await verifyReference(r));
    setBusy(false);
  };

  useEffect(() => {
    const r = params.get('ref');
    if (r) runRef(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFile = async (f: File) => {
    setBusy(true);
    setResult(null);
    setResult(await verifyFile(await f.arrayBuffer()));
    setBusy(false);
  };

  const sample = APPLICATIONS.find((a) => a.id === 'ANU-2026-0117')!;
  const downloadSample = () => {
    const blob = new Blob([letterText(sample)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-letter-ANU-2026-0117.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container-page max-w-4xl py-10">
      <PageHeader
        eyebrow="Public · for employers, students, banks and courts"
        title="Verify an approval letter"
        description="Every letter issued through ANUMATI has a reference number and a SHA-256 fingerprint recorded in the tamper-evident evidence log. Check either one here."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="By reference number">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runRef(ref);
            }}
          >
            <label htmlFor="ref" className="label">
              Reference number
            </label>
            <div className="flex gap-2">
              <input id="ref" className="input font-mono" placeholder="ANU-2026-0117" value={ref} onChange={(e) => setRef(e.target.value)} />
              <button className="btn-primary" disabled={busy}>
                <Search size={16} /> Verify
              </button>
            </div>
            <p className="mt-2 text-xs text-ink-mute">
              Try{' '}
              <button type="button" className="link" onClick={() => (setRef('ANU-2026-0117'), runRef('ANU-2026-0117'))}>
                ANU-2026-0117
              </button>
            </p>
          </form>
        </Card>
        <Card title="By uploading the letter">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) onFile(f);
            }}
            className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-center transition-colors hover:border-brand-400 hover:bg-brand-50"
          >
            <FileUp className="text-brand-600" />
            <span className="mt-2 text-sm font-medium">Drop the letter here or choose a file</span>
            <span className="text-xs text-ink-mute">The file is fingerprinted in your browser and never uploaded.</span>
          </button>
          <input ref={fileRef} type="file" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <button type="button" onClick={downloadSample} className="link mt-3 inline-flex items-center gap-1 text-xs">
            <Download size={13} /> Download a sample letter to test
          </button>
        </Card>
      </div>

      <div className="mt-6" aria-live="polite">
        <>
          {busy && (
            <motion.div key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card flex items-center gap-3 p-6 text-sm text-ink-mute">
              <Loader2 className="animate-spin text-brand-600" size={18} /> Checking the evidence log…
            </motion.div>
          )}
          {result?.status === 'authentic' && result.app && (
            <motion.div key="ok" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card overflow-hidden">
              <div className="flex items-center gap-4 bg-indgreen-50 px-6 py-5">
                <motion.span initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} className="grid h-12 w-12 place-items-center rounded-full bg-indgreen-600 text-white">
                  <BadgeCheck size={26} />
                </motion.span>
                <div>
                  <p className="text-lg font-semibold text-indgreen-700">Genuine and unaltered</p>
                  <p className="text-sm text-indgreen-700">This decision matches the evidence log entry exactly.</p>
                </div>
              </div>
              <dl className="grid gap-x-8 gap-y-4 p-6 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-mute">Reference</dt>
                  <dd className="font-mono font-medium">{result.app.id}</dd>
                </div>
                <div>
                  <dt className="text-ink-mute">Decision</dt>
                  <dd className="font-medium">{result.app.outcome} · {formatDate(result.app.stageEnteredOn)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-ink-mute">Institution</dt>
                  <dd className="font-medium">{institutionById(result.app.institutionId)?.name}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-ink-mute">Application</dt>
                  <dd className="font-medium">{typeById(result.app.typeId).name} · academic year {result.app.cycle}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="flex items-center gap-1 text-ink-mute">
                    <Fingerprint size={13} /> SHA-256 fingerprint
                  </dt>
                  <dd className="mt-0.5 break-all font-mono text-xs text-ink-soft">{result.fingerprint}</dd>
                  {result.fingerprint && <CopyButton value={result.fingerprint} label="Copy fingerprint" className="-ml-2 mt-1" />}
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-ink-mute">Trusted time-stamp (RFC 3161)</dt>
                  <dd className="font-medium">{result.timestamp && formatDateTime(result.timestamp)} IST · daily root {shortHash(result.fingerprint ?? '', 8)}</dd>
                </div>
              </dl>
              <div className="flex flex-col items-start gap-4 border-t border-slate-100 bg-slate-50/70 px-6 py-5 sm:flex-row sm:items-center">
                <QrCode value={verifyUrl(result.app.id)} size={92} />
                <div className="flex-1 text-sm">
                  <p className="font-semibold">Share or print with proof attached</p>
                  <p className="text-ink-mute">The QR code opens this verification for anyone who scans it.</p>
                </div>
                <Link to={`/letter/${result.app.id}`} className="btn-secondary">
                  Open printable letter
                </Link>
              </div>
            </motion.div>
          )}
          {result?.status === 'not-found' && (
            <motion.div key="nf" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card flex items-start gap-4 p-6">
              <ShieldAlert className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">No issued decision with this reference</p>
                <p className="mt-1 text-sm text-ink-mute">The application may still be in progress, or the number may be wrong. Institutions can see live progress after signing in.</p>
              </div>
            </motion.div>
          )}
          {result?.status === 'mismatch' && (
            <motion.div key="mm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card flex items-start gap-4 border-red-200 p-6">
              <ShieldX className="mt-0.5 shrink-0 text-red-600" />
              <div className="min-w-0">
                <p className="font-semibold text-red-700">This file does not match any issued letter</p>
                <p className="mt-1 text-sm text-ink-mute">Even a one-character change produces a different fingerprint. Treat this copy as unverified and contact the help desk.</p>
                <p className="mt-2 break-all font-mono text-xs text-ink-mute">{result.fingerprint}</p>
              </div>
            </motion.div>
          )}
        </>
      </div>
    </div>
  );
}
