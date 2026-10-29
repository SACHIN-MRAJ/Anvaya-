import { useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, CheckCircle2, ImagePlus, MapPinOff, Navigation, TriangleAlert, XCircle } from 'lucide-react';
import { bearing, distanceKm, readExif, type PhotoMeta } from '../lib/geo';
import { Badge, Card, toast } from './ui';
import { ApiError, uploadVisitPhotos } from '../services/api';
import { cn } from '../lib/utils';

const FENCE_KM = 0.5;

type Verdict = 'ok' | 'far' | 'nogps' | 'time';
interface Checked {
  name: string;
  meta: PhotoMeta;
  km?: number;
  deg?: number;
  verdict: Verdict;
}

function judge(name: string, meta: PhotoMeta, lat: number, lng: number, visitDate: string): Checked {
  if (meta.lat === undefined || meta.lng === undefined) return { name, meta, verdict: 'nogps' };
  const km = distanceKm(lat, lng, meta.lat, meta.lng);
  const deg = bearing(lat, lng, meta.lat, meta.lng);
  if (km > FENCE_KM) return { name, meta, km, deg, verdict: 'far' };
  const day = meta.takenAt?.slice(0, 10).replace(/:/g, '-');
  if (day && day !== visitDate) return { name, meta, km, deg, verdict: 'time' };
  return { name, meta, km, deg, verdict: 'ok' };
}

const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString('en-IN', { maximumFractionDigits: 0 })} km`);
const fmtTime = (t?: string) => (t ? `${t.slice(8, 10)}/${t.slice(5, 7)} ${t.slice(11, 16)}` : 'no time');

/**
 * Checks expert-visit photos against the campus location and visit date (APH 1.9(f)).
 * Location and time come from each photo's own EXIF data; nothing is uploaded for the check.
 */
export function GeoEvidenceCheck({ lat, lng, visitDate, campus, appId }: { lat: number; lng: number; visitDate: string; campus: string; appId?: string }) {
  const [items, setItems] = useState<Checked[]>([]);
  const [drag, setDrag] = useState(false);

  const addFiles = async (files: FileList | File[]) => {
    const out: Checked[] = [];
    const list = Array.from(files).slice(0, 12);
    for (const f of list) out.push(judge(f.name, readExif(await f.arrayBuffer()), lat, lng, visitDate));
    setItems((x) => [...out, ...x]); // instant result from this browser
    if (!appId) return;
    try {
      // The server reads each photo itself; its verdict is the one recorded in the evidence log.
      const server = await uploadVisitPhotos(appId, list);
      if (!server) return;
      setItems((x) => x.map((it) => {
        const s = server.find((r) => r.name === it.name);
        return s ? { ...it, verdict: s.verdict } : it;
      }));
      const flagged = server.filter((r) => r.verdict !== 'ok').length;
      toast(`The server checked ${server.length} photo${server.length === 1 ? '' : 's'} and recorded the result in the evidence log${flagged ? ` (${flagged} flagged)` : ''}.`, flagged ? 'brand' : 'green');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'The server could not check these photos.', 'red');
    }
  };

  const samples = () => {
    const d = visitDate.replace(/-/g, ':');
    setItems([
      judge('main-building.jpg', { lat: lat + 0.0005, lng: lng + 0.0004, takenAt: `${d} 11:02:14` }, lat, lng, visitDate),
      judge('library.jpg', { lat: lat - 0.0008, lng: lng + 0.001, takenAt: `${d} 11:41:52` }, lat, lng, visitDate),
      judge('computer-lab.jpg', { lat: 28.6139, lng: 77.209, takenAt: `${d} 12:15:03` }, lat, lng, visitDate),
      judge('workshop.jpg', { lat: lat + 0.0003, lng: lng - 0.0006, takenAt: '2026:10:03 16:20:41' }, lat, lng, visitDate),
      judge('hostel.jpg', { takenAt: `${d} 13:05:10` }, lat, lng, visitDate),
    ]);
  };

  const count = (v: Verdict) => items.filter((i) => i.verdict === v).length;
  const R = 104;
  const pos = (it: Checked) => {
    const r = Math.min(R, ((it.km ?? 0) / FENCE_KM) * 52);
    const a = (((it.deg ?? 0) - 90) * Math.PI) / 180;
    return { x: 120 + r * Math.cos(a), y: 120 + r * Math.sin(a), clamped: r >= R };
  };

  return (
    <Card title="Visit evidence check" subtitle={`Photos must be taken on campus on the visit day (${visitDate.split('-').reverse().join('/')}). Location and time are read from each photo in your browser.`}>
      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <div>
          <svg viewBox="0 0 240 240" className="mx-auto w-full max-w-[240px]" role="img" aria-label={`Campus map with ${items.length} photos plotted`}>
            <circle cx="120" cy="120" r={R + 8} fill="#F8FAFC" stroke="#E2E8F0" />
            <circle cx="120" cy="120" r={52} fill="#EAF7EF" stroke="#3DB073" strokeDasharray="4 3" />
            <circle cx="120" cy="120" r={R} fill="none" stroke="#E2E8F0" strokeDasharray="2 4" />
            <text x="120" y="62" textAnchor="middle" fontSize="9" fill="#167340">500 m campus fence</text>
            <rect x="113" y="113" width="14" height="14" rx="3" fill="#0A1D42" />
            {items.map((it, i) => {
              if (it.km === undefined) return null;
              const p = pos(it);
              const color = it.verdict === 'ok' ? '#1E8C4E' : it.verdict === 'time' ? '#DB700A' : '#C0352B';
              return (
                <motion.g key={it.name + i} initial={{ scale: 0.6, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.08, duration: 0.3 }} style={{ transformOrigin: `${p.x}px ${p.y}px` }}>
                  <circle cx={p.x} cy={p.y} r={p.clamped ? 7 : 5.5} fill={color} stroke="#fff" strokeWidth="2" />
                  {p.clamped && (
                    <text x={p.x} y={p.y - 11} textAnchor="middle" fontSize="9" fontWeight="700" fill={color}>
                      {fmtKm(it.km)}
                    </text>
                  )}
                </motion.g>
              );
            })}
          </svg>
          <p className="mt-1 text-center text-[11px] text-ink-mute">{campus}</p>
        </div>

        <div className="min-w-0">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              addFiles(e.dataTransfer.files);
            }}
            className={cn('flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-5 text-center text-sm transition-colors', drag ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-brand-300')}
          >
            <ImagePlus size={22} className="text-brand-600" />
            <span className="font-semibold text-ink">Drop visit photos here, or choose files</span>
            <span className="text-xs text-ink-mute">JPEG photos straight from the phone camera keep their location</span>
            <input type="file" accept="image/jpeg" multiple className="sr-only" onChange={(e) => e.target.files && addFiles(e.target.files)} />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="btn-secondary btn-sm" onClick={samples}>
              <Camera size={14} /> Try sample visit photos
            </button>
            {items.length > 0 && (
              <>
                <Badge tone="green">{count('ok')} on campus</Badge>
                {count('far') > 0 && <Badge tone="red">{count('far')} far away</Badge>}
                {count('time') > 0 && <Badge tone="amber">{count('time')} wrong day</Badge>}
                {count('nogps') > 0 && <Badge tone="amber">{count('nogps')} no location</Badge>}
              </>
            )}
          </div>
          <ul className="mt-3 space-y-2">
            {items.map((it, i) => (
              <motion.li key={it.name + i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className={cn('flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm', it.verdict === 'ok' ? 'border-indgreen-100 bg-indgreen-50/50' : it.verdict === 'far' ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50')}>
                {it.verdict === 'ok' ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-indgreen-600" /> : it.verdict === 'far' ? <XCircle size={17} className="mt-0.5 shrink-0 text-red-600" /> : it.verdict === 'nogps' ? <MapPinOff size={17} className="mt-0.5 shrink-0 text-amber-600" /> : <TriangleAlert size={17} className="mt-0.5 shrink-0 text-amber-600" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{it.name}</p>
                  <p className="text-xs text-ink-mute">
                    {it.verdict === 'ok' && `On campus · ${fmtKm(it.km!)} from the campus centre · ${fmtTime(it.meta.takenAt)}`}
                    {it.verdict === 'far' && `Taken ${fmtKm(it.km!)} away. Flagged for the committee; ask the panel to explain.`}
                    {it.verdict === 'time' && `On campus, but taken on ${fmtTime(it.meta.takenAt)}, not on the visit day.`}
                    {it.verdict === 'nogps' && 'The photo has no location. Ask for a retake with location turned on.'}
                  </p>
                </div>
                {it.km !== undefined && <Navigation size={14} className="mt-1 shrink-0 text-ink-mute" style={{ transform: `rotate(${it.deg}deg)` }} aria-hidden />}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-ink-mute">
        Why this matters: a CAG audit of a national housing scheme found photos geo-tagged up to 915 km from the real site. Checking at upload stops this before a decision relies on it.
      </p>
    </Card>
  );
}
