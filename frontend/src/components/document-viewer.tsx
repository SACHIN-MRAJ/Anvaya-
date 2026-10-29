import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BadgeCheck, Columns2, ExternalLink, FileText, Loader2, PenLine, ShieldCheck } from 'lucide-react';
import { useAsync } from '../lib/useAsync';
import { ApiError, type StoredDocument } from '../services/api';
import { documentBlobUrl, getApplicationDocuments, reviewDocument, type RequiredDocument } from '../services/records';
import { Badge, Card, toast } from './ui';
import { DocStatus } from './records-ui';
import { cn, formatDateTime } from '../lib/utils';
import { shortHash } from '../lib/hash';

/** Fetches a stored file once and shows it from a blob URL (the API never lets its own responses be framed). */
function PdfFrame({ doc, title }: { doc: StoredDocument; title: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    let made: string | null = null;
    setUrl(null);
    setFailed(false);
    void documentBlobUrl(doc.id).then((u) => {
      made = u;
      if (live) (u ? setUrl(u) : setFailed(true));
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [doc.id]);
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-ink">
          <FileText size={14} className="text-brand-600" /> {title} · v{doc.version}
        </span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-ink-mute" title={doc.sha256}>
            {shortHash(doc.sha256, 8)}
          </span>
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
              <ExternalLink size={12} /> Open in a new tab
            </a>
          )}
        </span>
      </div>
      <div className="h-[460px]">
        {url ? (
          <iframe src={url} title={`${title}, version ${doc.version}`} className="h-full w-full" />
        ) : failed ? (
          <p className="grid h-full place-items-center px-6 text-center text-sm text-ink-mute">The file could not be loaded from storage.</p>
        ) : (
          <p className="grid h-full place-items-center text-sm text-ink-mute">
            <Loader2 size={18} className="animate-spin" />
          </p>
        )}
      </div>
      <div className="space-y-0.5 border-t border-slate-200 bg-white px-3 py-2 text-[11px] text-ink-mute">
        <p>
          {doc.filename} · {doc.pages ?? '?'} page{doc.pages === 1 ? '' : 's'} · uploaded {doc.uploadedAt ? formatDateTime(doc.uploadedAt) : ''}
          {doc.uploadedBy ? ` by ${doc.uploadedBy}` : ''}
        </p>
        <p className="flex items-center gap-1">
          <ShieldCheck size={11} className={doc.signed ? 'text-indgreen-600' : 'text-amber-600'} />
          {doc.signed ? `Signed${doc.preflight?.signer ? ` by ${doc.preflight.signer}` : ''}` : 'No digital signature'}
        </p>
      </div>
    </div>
  );
}

/** Each required document with its checklist status, the file itself, the previous version beside it, and the officer's verdict. */
export function DocumentChecklist({ appId, canReview, onChange }: { appId: string; canReview: boolean; onChange?: () => void }) {
  const { data, loading, reload } = useAsync(() => getApplicationDocuments(appId), [appId]);
  const [kind, setKind] = useState<string | null>(null);
  const [compare, setCompare] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = data?.documents ?? [];
  const current: RequiredDocument | undefined = rows.find((r) => r.kind === kind) ?? rows.find((r) => r.status === 'needs correction' || r.status === 'awaiting verification') ?? rows[0];
  useEffect(() => setNote(''), [current?.kind]);

  if (!data) {
    if (loading)
      return (
        <Card title="Documents">
          <Loader2 size={18} className="animate-spin text-ink-mute" />
        </Card>
      );
    return null; // built-in data: the page shows its own static list
  }
  const latest = current?.versions[current.versions.length - 1];
  const previous = current && current.versions.length > 1 ? current.versions[current.versions.length - 2] : undefined;

  const review = async (status: 'verified' | 'needs correction') => {
    if (!latest) return;
    setBusy(true);
    try {
      await reviewDocument(latest.id, status, note);
      toast(status === 'verified' ? `${current?.name} verified.` : `${current?.name} marked for correction. Send the file back to tell the institution.`, status === 'verified' ? 'green' : 'brand');
      reload();
      onChange?.();
      const next = rows.find((r) => r.kind !== current?.kind && (r.status === 'awaiting verification' || r.status === 'uploaded'));
      if (status === 'verified' && next) setKind(next.kind);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not record the check.', 'red');
    } finally {
      setBusy(false);
    }
  };

  const counts = data.counts;
  return (
    <Card
      title="Documents"
      subtitle="Open a document to read it beside the earlier version and record your check"
      action={
        <span className="flex flex-wrap gap-1.5">
          {(['verified', 'awaiting verification', 'needs correction', 'missing'] as const).map((s) => (counts[s] ? <DocStatus key={s} status={s} /> : null))}
        </span>
      }
      pad={false}
    >
      <div className="grid gap-0 lg:grid-cols-[260px_1fr]">
        <ul className="max-h-[640px] divide-y divide-slate-100 overflow-y-auto border-b border-slate-100 lg:border-b-0 lg:border-r">
          {rows.map((r) => (
            <li key={r.kind}>
              <button onClick={() => setKind(r.kind)} className={cn('flex w-full flex-col items-start gap-1 px-4 py-3 text-left text-sm transition-colors', current?.kind === r.kind ? 'bg-brand-50/70' : 'hover:bg-slate-50')} aria-current={current?.kind === r.kind}>
                <span className="font-medium text-ink">{r.name}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <DocStatus status={r.status} />
                  {r.versions.length > 1 && <Badge tone="slate">v{r.versions.length}</Badge>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="min-w-0 p-4">
          {!current || !latest ? (
            <p className="py-16 text-center text-sm text-ink-mute">{current ? `${current.name} has not been uploaded.` : 'No documents on this file.'}</p>
          ) : (
            <motion.div key={current.kind} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{current.name}</p>
                  <p className="text-xs text-ink-mute">
                    {current.clause}
                    {current.signedBy ? ` · to be signed by ${current.signedBy}` : ''}
                  </p>
                </div>
                {previous && (
                  <button className={cn('btn-secondary px-3 py-1.5 text-xs', compare && 'border-brand-300 text-brand-800')} onClick={() => setCompare((c) => !c)} aria-pressed={compare}>
                    <Columns2 size={14} /> {compare ? 'Showing both versions' : 'Compare with earlier version'}
                  </button>
                )}
              </div>
              {latest.reviewNote && (
                <p className={cn('rounded-lg px-3 py-2 text-sm', latest.reviewStatus === 'needs correction' ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-ink-soft')}>
                  <span className="font-semibold">{latest.reviewedBy ?? 'Officer'}:</span> {latest.reviewNote}
                </p>
              )}
              {previous?.reviewNote && compare && (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-soft">
                  Earlier version was sent back: {previous.reviewNote}
                </p>
              )}
              <div className="flex flex-col gap-3 lg:flex-row">
                {previous && compare && <PdfFrame doc={previous} title="Earlier" />}
                <PdfFrame doc={latest} title={previous ? 'Latest' : 'Submitted'} />
              </div>
              {canReview ? (
                <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <label className="block">
                    <span className="sr-only">Note</span>
                    <textarea className="input min-h-[44px]" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (needed when asking for a correction; the institution sees it)" />
                  </label>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button className="btn-secondary" disabled={busy || note.trim().length < 5} onClick={() => void review('needs correction')}>
                      <PenLine size={15} /> Needs correction
                    </button>
                    <button className="btn-primary" disabled={busy || latest.reviewStatus === 'verified'} onClick={() => void review('verified')}>
                      <BadgeCheck size={15} /> {latest.reviewStatus === 'verified' ? 'Verified' : 'Verify'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-ink-mute">Your role can read documents; checks are recorded by officers handling the file.</p>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </Card>
  );
}
