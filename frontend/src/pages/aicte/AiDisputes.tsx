/**
 * AICTE officer view: review and resolve disputes raised by institutions
 * against specific AI document check findings.
 *
 * The officer can:
 *  - View the disputed document (side-by-side viewer)
 *  - Read the AI finding and the institution's explanation
 *  - Override (AI was wrong — allow the document to proceed)
 *  - Confirm  (AI was right — institution must fix the document)
 *
 * "AI does not independently reject an application solely because it flags
 * a potential issue." — ANUMATI workflow diagram.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  ShieldAlert,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-react';
import { useAsync } from '../../lib/useAsync';
import { getDisputes, resolveDispute, type AiDispute } from '../../services/api';
import { Badge, EmptyState, LoadingRows, PageHeader, Stat, toast } from '../../components/ui';
import { cn, formatDateTime } from '../../lib/utils';
import { Tour } from '../../components/live';
import { AI_DISPUTES_TOUR } from '../../data/tours';

const STATUS_COLOR: Record<string, string> = {
  pending:    'amber',
  overridden: 'green',
  confirmed:  'red',
};
const STATUS_LABEL: Record<string, string> = {
  pending:    'Pending review',
  overridden: 'Overridden — AI wrong',
  confirmed:  'Confirmed — AI correct',
};

function DisputeCard({ d, onResolved }: { d: AiDispute; onResolved: () => void }) {
  const [open, setOpen]         = useState(d.status === 'pending');
  const [decision, setDecision] = useState<'override' | 'confirm' | null>(null);
  const [note, setNote]         = useState('');
  const [saving, setSaving]     = useState(false);

  const submit = async () => {
    if (!decision || note.trim().length < 5) return;
    setSaving(true);
    try {
      await resolveDispute(d.id, decision, note.trim());
      toast(
        decision === 'override'
          ? 'Override recorded — institution notified, document can proceed.'
          : 'Confirmed — institution notified, document must be corrected.',
        decision === 'override' ? 'brand' : 'red',
      );
      onResolved();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save resolution.', 'red');
    } finally {
      setSaving(false);
    }
  };

  const isPending = d.status === 'pending';

  return (
    <motion.article
      layout
      className={cn(
        'overflow-hidden rounded-2xl border transition-shadow',
        isPending ? 'border-amber-200 shadow-card' : 'border-slate-100',
      )}
    >
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-4 p-5 text-left"
        aria-expanded={open}
      >
        <span className={cn(
          'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full',
          isPending ? 'bg-amber-100 text-amber-700' :
          d.status === 'overridden' ? 'bg-indgreen-100 text-indgreen-700' :
          'bg-red-100 text-red-700',
        )}>
          {isPending ? <AlertCircle size={18} /> : d.status === 'overridden' ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{d.findingTitle}</span>
            <Badge tone={STATUS_COLOR[d.status] as 'amber' | 'green' | 'red'}>{STATUS_LABEL[d.status]}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-ink-mute">
            <span className="font-medium">{d.institutionName ?? d.institutionId}</span>
            {' · '}{d.filename ?? d.documentId}
            {' · '}{d.findingClause}
          </p>
          <p className="mt-0.5 text-xs text-ink-mute">
            Raised {formatDateTime(d.createdAt)}
            {d.resolvedAt && ` · Resolved ${formatDateTime(d.resolvedAt)} by ${d.reviewedBy}`}
          </p>
        </div>
        <ChevronDown size={18} className={cn('mt-1 shrink-0 text-ink-mute transition-transform', open && 'rotate-180')} />
      </button>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="grid gap-6 border-t border-slate-100 px-5 pb-6 pt-5 lg:grid-cols-2">

              {/* Left: finding detail + institution's reason */}
              <div className="space-y-4">
                {/* AI finding */}
                <section>
                  <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-700">
                    <AlertCircle size={12} /> AI finding
                  </h4>
                  <div className="mt-2 rounded-xl border border-red-100 bg-red-50/60 p-3 text-sm">
                    <p className="font-semibold text-red-800">{d.findingTitle}</p>
                    {d.findingDetail && <p className="mt-1 text-red-700">{d.findingDetail}</p>}
                    <p className="mt-1 text-xs font-mono text-red-500">{d.findingClause}</p>
                  </div>
                </section>

                {/* Institution's explanation */}
                <section>
                  <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-700">
                    <User size={12} /> Institution's explanation
                  </h4>
                  <div className="mt-2 rounded-xl border border-brand-100 bg-brand-50/60 p-3 text-sm text-ink">
                    {d.reason}
                  </div>
                </section>

                {/* Document link */}
                <section>
                  <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-mute">
                    <FileText size={12} /> Document
                  </h4>
                  <div className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
                    <FileText size={14} className="shrink-0" />
                    <span className="font-mono">{d.filename ?? d.documentId}</span>
                  </div>
                  {d.applicationId && (
                    <p className="mt-1 text-xs text-ink-mute">Application: {d.applicationId}</p>
                  )}
                </section>
              </div>

              {/* Right: resolution form (only if pending) or resolved state */}
              <div>
                {isPending ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                    <p className="text-sm font-semibold text-ink">Your decision</p>
                    <p className="text-xs text-ink-mute">
                      Review the document and the institution's explanation, then record whether the AI finding is correct.
                      The institution will be notified immediately.
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setDecision('override')}
                        className={cn(
                          'rounded-xl border-2 p-3 text-left transition-all',
                          decision === 'override'
                            ? 'border-indgreen-500 bg-indgreen-50'
                            : 'border-slate-200 bg-white hover:border-indgreen-300',
                        )}
                      >
                        <CheckCircle2 size={18} className="text-indgreen-600" />
                        <p className="mt-1 text-sm font-semibold text-ink">Override</p>
                        <p className="text-xs text-ink-mute">AI was wrong — document is acceptable.</p>
                      </button>
                      <button
                        onClick={() => setDecision('confirm')}
                        className={cn(
                          'rounded-xl border-2 p-3 text-left transition-all',
                          decision === 'confirm'
                            ? 'border-red-400 bg-red-50'
                            : 'border-slate-200 bg-white hover:border-red-300',
                        )}
                      >
                        <XCircle size={18} className="text-red-600" />
                        <p className="mt-1 text-sm font-semibold text-ink">Confirm</p>
                        <p className="text-xs text-ink-mute">AI was right — institution must fix.</p>
                      </button>
                    </div>

                    <div>
                      <label className="label text-xs">Resolution note <span className="text-red-500">*</span></label>
                      <textarea
                        className="input text-sm"
                        rows={3}
                        placeholder={
                          decision === 'override'
                            ? 'e.g. Verified the original document — validity date is present on page 2 in DD/MM/YYYY format.'
                            : 'e.g. Fire NOC is indeed expired. Institution must upload a renewed certificate.'
                        }
                        value={note}
                        maxLength={500}
                        onChange={(e) => setNote(e.target.value)}
                      />
                      <p className="mt-1 text-xs text-ink-mute">{note.length}/500</p>
                    </div>

                    <button
                      className={cn('btn-primary w-full', decision === 'confirm' && 'bg-red-600 hover:bg-red-700 focus:ring-red-400')}
                      onClick={submit}
                      disabled={!decision || note.trim().length < 5 || saving}
                    >
                      {saving
                        ? 'Saving…'
                        : decision === 'override'
                          ? '✓ Record override — AI finding dismissed'
                          : decision === 'confirm'
                            ? '✗ Confirm AI finding — institution must correct'
                            : 'Select a decision above'}
                    </button>

                    <p className="text-[11px] text-center text-ink-mute">
                      AI assists verification; authorised officials make all regulatory decisions (ANUMATI principle).
                    </p>
                  </div>
                ) : (
                  <div className={cn(
                    'rounded-2xl border p-4 space-y-3',
                    d.status === 'overridden' ? 'border-indgreen-200 bg-indgreen-50' : 'border-red-100 bg-red-50',
                  )}>
                    <div className="flex items-center gap-2">
                      {d.status === 'overridden'
                        ? <CheckCircle2 size={18} className="text-indgreen-600" />
                        : <XCircle size={18} className="text-red-600" />}
                      <span className="font-semibold text-sm text-ink">
                        {d.status === 'overridden' ? 'AI finding overridden' : 'AI finding confirmed'}
                      </span>
                    </div>
                    {d.resolution && <p className="text-sm text-ink-soft">{d.resolution}</p>}
                    <p className="text-xs text-ink-mute">
                      Reviewed by {d.reviewedBy} · {d.resolvedAt ? formatDateTime(d.resolvedAt) : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

export default function AiDisputes() {
  const [filter, setFilter] = useState<'pending' | 'overridden' | 'confirmed' | 'all'>('pending');
  const apiStatus = filter === 'all' ? '' : filter;
  // Fetch filtered list (what the officer is working on) + all disputes for accurate stat counts
  const { data, loading, reload } = useAsync(() => getDisputes(apiStatus), [filter]);
  const { data: allData } = useAsync(() => getDisputes(''), []);   // for accurate stat tiles

  if (loading) return <LoadingRows rows={5} />;

  const disputes = data ?? [];
  const all = allData ?? disputes;
  const pending    = all.filter((d) => d.status === 'pending').length;
  const overridden = all.filter((d) => d.status === 'overridden').length;
  const confirmed  = all.filter((d) => d.status === 'confirmed').length;

  return (
    <>
      <PageHeader
        eyebrow="AI oversight"
        title="AI document finding disputes"
        description="When an institution thinks an AI document check is wrong, they raise a dispute here. Your job: review the document, read their explanation, then override (AI was wrong) or confirm (AI was right). The institution is notified automatically."
        tourId="ai-disputes"
      />
      <Tour id="ai-disputes" steps={AI_DISPUTES_TOUR} />

      {/* Stats */}
      <div data-tour="disputes-stats" className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Pending your review" value={pending} icon={<Clock size={18} />} tone={pending > 0 ? 'amber' : 'brand'} hint="Awaiting officer decision" />
        <Stat label="Overridden (AI was wrong)" value={overridden} icon={<ShieldCheck size={18} />} tone="green" />
        <Stat label="Confirmed (AI was right)" value={confirmed} icon={<ShieldAlert size={18} />} tone={confirmed > 0 ? 'red' : 'brand'} />
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-2">
        {(['pending', 'overridden', 'confirmed', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              filter === f
                ? 'bg-brand-700 text-white'
                : 'bg-slate-100 text-ink-mute hover:bg-slate-200',
            )}
          >
            {f === 'all' ? 'All' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {disputes.length === 0 ? (
        <EmptyState
          title={filter === 'pending' ? 'No disputes pending' : 'No disputes here'}
          text={filter === 'pending' ? 'Institutions have not raised any disputes yet, or all have been resolved.' : 'Nothing to show for this filter.'}
        />
      ) : (
        <div data-tour="dispute-card" className="space-y-3">
          {disputes.map((d) => (
            <DisputeCard key={d.id} d={d} onResolved={reload} />
          ))}
        </div>
      )}
    </>
  );
}
