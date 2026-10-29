import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, CheckCircle2, Download, Fingerprint, Loader2, MapPin, PenLine, Video } from 'lucide-react';
import { useAsync } from '../../lib/useAsync';
import { ApiError } from '../../services/api';
import { answerItem, getInspection, getInspectionReport, saveVideo, submitInspection, uploadInspectionPhoto, type Evidence, type InspectionDetail, type InspectionItem } from '../../services/records';
import { Badge, Callout, Card, Modal, PageHeader, ProgressBar, toast } from '../../components/ui';
import { Pending } from '../../components/records-ui';
import { cn, formatDateTime } from '../../lib/utils';

const RESULTS: { id: NonNullable<InspectionItem['result']>; short: string; tone: string }[] = [
  { id: 'Meets', short: 'Meets', tone: 'border-indgreen-500 bg-indgreen-50 text-indgreen-800' },
  { id: 'Partly meets', short: 'Partly', tone: 'border-amber-500 bg-amber-50 text-amber-800' },
  { id: 'Does not meet', short: 'Does not meet', tone: 'border-red-500 bg-red-50 text-red-800' },
  { id: 'Not applicable', short: 'N/A', tone: 'border-slate-400 bg-slate-100 text-ink-soft' },
];
const VERDICT: Record<Evidence['verdict'], { tone: 'green' | 'red' | 'amber' | 'slate'; text: string }> = {
  ok: { tone: 'green', text: 'On campus, visit day' },
  far: { tone: 'red', text: 'Outside the 500 m fence' },
  time: { tone: 'amber', text: 'Not taken today' },
  nogps: { tone: 'slate', text: 'No location' },
};

/** The device's location, for photos whose camera did not record GPS. */
const here = () =>
  new Promise<{ lat: number; lng: number; takenAt: string } | undefined>((resolve) => {
    if (!('geolocation' in navigator)) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, takenAt: new Date().toISOString().slice(0, 19).replace('T', ' ').replace(/-/g, ':') }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });

export default function FieldInspection() {
  const { id = '' } = useParams();
  const { data, loading } = useAsync(() => getInspection(id), [id]);
  const [fi, setFi] = useState<InspectionDetail | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [sign, setSign] = useState<{ name: string; ok: boolean } | null>(null);
  const [video, setVideo] = useState('');
  useEffect(() => {
    if (data) {
      setFi(data);
      setVideo(data.videoUrl);
    }
  }, [data]);

  const sections = useMemo(() => {
    const m = new Map<string, InspectionItem[]>();
    (fi?.items ?? []).forEach((i) => m.set(i.section, [...(m.get(i.section) ?? []), i]));
    return [...m.entries()];
  }, [fi]);

  if (!fi) return <Pending loading={loading} what="This inspection" />;
  const done = fi.items.filter((i) => i.result).length;
  const editable = fi.canEdit;

  const patch = (item: InspectionItem, progress?: InspectionDetail['progress'], status?: string) =>
    setFi((f) => (f ? { ...f, items: f.items.map((i) => (i.id === item.id ? item : i)), progress: progress ?? f.progress, status: (status as InspectionDetail['status']) ?? f.status } : f));

  const answer = async (item: InspectionItem, result: InspectionItem['result'], note = item.note) => {
    if (!result) return;
    patch({ ...item, result, note });
    setSaving(item.id);
    try {
      const r = await answerItem(fi.id, item.id, result, note);
      if (r) patch(r.item, r.progress, r.status);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Not saved. Check the connection and try again.', 'red');
    } finally {
      setSaving(null);
    }
  };

  const photo = async (item: InspectionItem, file: File) => {
    setSaving(item.id);
    try {
      let r = await uploadInspectionPhoto(fi.id, item.id, file, file.name);
      if (r && r.photo.verdict === 'nogps') {
        // The camera kept no location: use the phone's position now, which the server checks the same way.
        const where = await here();
        if (where) r = await uploadInspectionPhoto(fi.id, item.id, file, file.name, where);
      }
      if (r) {
        patch(r.item);
        toast(r.photo.verdict === 'ok' ? 'Photo checked: on campus, today.' : `Photo stored, but flagged: ${VERDICT[r.photo.verdict].text.toLowerCase()}.`, r.photo.verdict === 'ok' ? 'green' : 'red');
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Upload failed. Try again.', 'red');
    } finally {
      setSaving(null);
    }
  };

  const submit = async () => {
    if (!sign) return;
    try {
      const r = await submitInspection(fi.id, sign.name, sign.ok, video);
      if (r) {
        setFi({ ...fi, ...r, canEdit: false });
        toast('Report signed. Its fingerprint is now in the file’s evidence log.');
        setSign(null);
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not submit.', 'red');
    }
  };

  const download = async () => {
    const text = await getInspectionReport(fi.id);
    if (!text) return;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fi.id}-report.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <Link to="/aicte/field" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-mute hover:text-brand-700">
        <ArrowLeft size={15} /> All inspections
      </Link>
      <PageHeader
        eyebrow={`${fi.applicationId} · ${fi.mode} visit`}
        title={fi.institution?.name ?? fi.id}
        description={`Inspector ${fi.inspectorName}. Assigned by ${fi.assignedBy} on ${formatDateTime(fi.assignedAt)}. Expected figures come from the institution’s own record and the APH norms.`}
        actions={
          fi.status === 'Submitted' ? (
            <button className="btn-secondary" onClick={download}>
              <Download size={16} /> Report
            </button>
          ) : (
            editable && (
              <button className="btn-primary" onClick={() => setSign({ name: fi.inspectorName, ok: false })}>
                <PenLine size={16} /> Sign and submit
              </button>
            )
          )
        }
      />

      <div className="sticky top-[72px] z-20 -mx-4 mb-6 border-b border-slate-200 bg-canvas/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={fi.status === 'Submitted' ? 'green' : fi.status === 'In progress' ? 'brand' : 'slate'}>{fi.status}</Badge>
          <div className="min-w-[200px] flex-1">
            <ProgressBar value={(done / fi.items.length) * 100} tone={fi.status === 'Submitted' ? 'green' : 'brand'} label={`${done} of ${fi.items.length} lines · ${fi.progress.concerns} concern${fi.progress.concerns === 1 ? '' : 's'}`} />
          </div>
          {saving && (
            <span className="flex items-center gap-1 text-xs text-ink-mute">
              <Loader2 size={13} className="animate-spin" /> Saving
            </span>
          )}
        </div>
      </div>

      {fi.status === 'Submitted' && fi.signature && (
        <Callout tone="green" icon={<Fingerprint size={16} />} title={`Signed by ${fi.signature.name} on ${formatDateTime(fi.signature.at)}`}>
          Report fingerprint (SHA-256) <span className="break-all font-mono text-xs">{fi.reportSha256}</span>. It is recorded in the file’s evidence log, so any later change would show.
        </Callout>
      )}
      {!editable && fi.status !== 'Submitted' && (
        <Callout tone="brand" title="Read only">
          Only the assigned inspector fills in this checklist. You see their answers as they save.
        </Callout>
      )}

      <div className="mt-6 space-y-6">
        {sections.map(([section, items]) => (
          <Card key={section} title={section} pad={false}>
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <ItemRow key={item.id} item={item} editable={editable} busy={saving === item.id} onAnswer={answer} onPhoto={photo} />
              ))}
            </ul>
          </Card>
        ))}
        <Card title="Recording" subtitle="APH 1.9(f): online visits need at least 30 minutes; physical visits are recorded too">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <Video size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
              <input className="input pl-9" disabled={!editable} value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://… link to the recording" aria-label="Link to the recording" />
            </label>
            {editable && (
              <button
                className="btn-secondary"
                onClick={async () => {
                  try {
                    await saveVideo(fi.id, video);
                    toast('Recording link saved.');
                  } catch (e) {
                    toast(e instanceof ApiError ? e.message : 'Not saved.', 'red');
                  }
                }}
              >
                Save link
              </button>
            )}
          </div>
        </Card>
      </div>

      <Modal
        open={!!sign}
        onClose={() => setSign(null)}
        title="Sign and submit the report"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setSign(null)}>
              Not yet
            </button>
            <button className="btn-primary" disabled={!sign?.ok || (sign?.name.trim().length ?? 0) < 3} onClick={submit}>
              Sign and submit
            </button>
          </>
        }
      >
        {sign && (
          <div className="space-y-4">
            <p className="text-sm text-ink-mute">After signing, the report cannot be changed. ANUMATI checks that every line is answered, each GPS photo passed the location check, and every concern has a note.</p>
            <label className="block">
              <span className="label">Your full name</span>
              <input className="input" value={sign.name} onChange={(e) => setSign({ ...sign, name: e.target.value })} />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={sign.ok} onChange={(e) => setSign({ ...sign, ok: e.target.checked })} />I visited and checked each line myself, I have no link to this institution, and the report is true to what I saw.
            </label>
          </div>
        )}
      </Modal>
    </>
  );
}

function ItemRow({ item, editable, busy, onAnswer, onPhoto }: { item: InspectionItem; editable: boolean; busy: boolean; onAnswer: (i: InspectionItem, r: InspectionItem['result'], note?: string) => void; onPhoto: (i: InspectionItem, f: File) => void }) {
  const [note, setNote] = useState(item.note);
  const file = useRef<HTMLInputElement>(null);
  const concern = item.result === 'Partly meets' || item.result === 'Does not meet';
  useEffect(() => setNote(item.note), [item.note]);
  return (
    <li className="px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium text-ink">
            {item.result && <CheckCircle2 size={15} className={concern ? 'text-amber-600' : 'text-indgreen-600'} />}
            {item.label}
          </p>
          <p className="text-sm text-ink-mute">Expected: {item.expect}</p>
          <p className="text-[11px] font-semibold text-ink-mute">{item.clause}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="radiogroup" aria-label={`Finding for ${item.label}`}>
        {RESULTS.map((r) => (
          <button
            key={r.id}
            role="radio"
            aria-checked={item.result === r.id}
            disabled={!editable || busy}
            onClick={() => onAnswer(item, r.id, note)}
            className={cn('min-h-[44px] rounded-xl border px-3 text-sm font-semibold transition-colors disabled:cursor-default', item.result === r.id ? r.tone : 'border-slate-200 text-ink-soft hover:border-brand-300', !editable && item.result !== r.id && 'opacity-50')}
          >
            {r.short}
          </button>
        ))}
      </div>
      {(concern || note || (editable && item.result)) && (
        <textarea
          className="input mt-3 min-h-[70px]"
          disabled={!editable}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== item.note && item.result && onAnswer(item, item.result, note)}
          placeholder={concern ? 'What did you find? (needed for a concern)' : 'Note (optional)'}
          aria-label={`Note for ${item.label}`}
        />
      )}
      {item.photo && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            {item.evidence.map((e) => (
              <motion.span key={e.sha256} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
                <MapPin size={12} className="text-ink-mute" />
                <span className="max-w-[140px] truncate">{e.name}</span>
                <Badge tone={VERDICT[e.verdict].tone}>{VERDICT[e.verdict].text}{e.distanceM !== null ? ` · ${e.distanceM} m` : ''}</Badge>
              </motion.span>
            ))}
          </div>
          {editable && (
            <>
              <input
                ref={file}
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPhoto(item, f);
                  e.target.value = '';
                }}
              />
              <button className="btn-secondary mt-2 min-h-[44px]" disabled={busy} onClick={() => file.current?.click()}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} Take photo
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}
