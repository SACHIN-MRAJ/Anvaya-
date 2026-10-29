import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, CalendarClock, FilePlus2, Landmark, MapPin, PenLine, Plus, RefreshCw, Ruler, Trash2 } from 'lucide-react';
import { useAsync } from '../../lib/useAsync';
import { may, useSession } from '../../lib/session';
import { ApiError } from '../../services/api';
import { addCampus, addCertificate, addSpaces, deleteSpace, getInfrastructure, renewCertificate, updateCampus, type CampusIn, type Certificate, type CertificateIn, type Space, type SpaceIn } from '../../services/records';
import { Badge, Card, Modal, PageHeader, Stat, Tabs, toast } from '../../components/ui';
import { ExpiryRadar, FindingList, Meter, Pending, ReadOnlyNote, VerificationBadge } from '../../components/records-ui';
import { cn, formatDate } from '../../lib/utils';

type Tab = 'norms' | 'certificates' | 'rooms' | 'campuses';
const CATEGORIES: Space['category'][] = ['Instructional', 'Administrative', 'Amenities'];

export default function Infrastructure() {
  const { session } = useSession();
  const canEdit = may(session, 'infrastructure');
  const { data, loading, reload } = useAsync(getInfrastructure);
  const [tab, setTab] = useState<Tab>('norms');
  const [room, setRoom] = useState<SpaceIn | null>(null);
  const [cert, setCert] = useState<{ id?: string; body: CertificateIn } | null>(null);
  const [campus, setCampus] = useState<{ id?: string; body: CampusIn } | null>(null);
  const [busy, setBusy] = useState(false);

  const byKind = useMemo(() => {
    const m = new Map<string, Space[]>();
    (data?.spaces ?? []).forEach((s) => m.set(s.kind, [...(m.get(s.kind) ?? []), s]));
    return [...m.entries()];
  }, [data]);

  if (!data) return <Pending loading={loading} what="The infrastructure locker" />;
  const { norms } = data;
  const expiring = data.certificates.filter((c) => c.days !== null && c.days <= 30);
  const main = data.campuses.find((c) => c.isMain);
  const campusName = (id: string | null) => data.campuses.find((c) => c.id === id)?.name ?? 'All campuses';

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      reload();
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not save. Please try again.', 'red');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const newRoom = (kind = 'Classroom'): SpaceIn => ({ campusId: main?.id ?? data.campuses[0]?.id ?? '', category: 'Instructional', kind, name: kind, building: '', areaSqm: 66, count: 1 });
  const newCert = (kind = data.certificateKinds[0]): CertificateIn => ({ kind, number: '', issuedBy: '', issuedOn: null, validUntil: null, campusId: main?.id ?? null });

  return (
    <>
      <PageHeader
        eyebrow="Institutional record"
        title="Infrastructure locker"
        description="Campuses, rooms and safety certificates kept once and reused in every application. Rooms are checked against APH Annexure-3 for your approved courses, and certificates are watched for expiry."
        actions={
          canEdit && (
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={() => setRoom(newRoom())}>
                <Plus size={16} /> Add rooms
              </button>
              <button className="btn-primary" onClick={() => setCert({ body: newCert() })}>
                <FilePlus2 size={16} /> Add certificate
              </button>
            </div>
          )
        }
      />
      {!canEdit && <div className="mb-6"><ReadOnlyNote who="Principal or Compliance staff" what="Campuses, rooms and certificates" /></div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Shortfalls against the norms" value={norms.shortfalls} tone={norms.shortfalls ? 'amber' : 'green'} icon={<Ruler size={18} />} hint="Rooms or areas below Annexure-3" />
        <Stat label="Certificates expiring in 30 days" value={expiring.length} tone={expiring.length ? 'red' : 'green'} icon={<CalendarClock size={18} />} hint={expiring[0] ? `${expiring[0].kind}: ${expiring[0].days} days` : 'None'} />
        <Stat label="Instructional area" value={`${norms.instructionalArea.toLocaleString('en-IN')} m²`} icon={<Building2 size={18} />} hint={`Built-up about ${norms.builtUpEstimate.toLocaleString('en-IN')} m² with circulation`} />
        <Stat label="Campuses and plots" value={data.campuses.length} icon={<MapPin size={18} />} tone={data.landChecks.some((x) => x.severity === 'blocker') ? 'red' : 'brand'} hint="At most 3, all within 2 km" />
      </div>

      <Card className="mt-6" pad={false}>
        <div className="px-4 pt-2">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'norms', label: 'Norms check', count: norms.shortfalls || undefined },
              { value: 'certificates', label: 'Certificates', count: expiring.length || undefined },
              { value: 'rooms', label: 'Rooms', count: data.spaces.length },
              { value: 'campuses', label: 'Campuses and land' },
            ]}
          />
        </div>

        {tab === 'norms' && (
          <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h3 className="text-sm font-bold text-ink">Instructional area (APH Annexure-3, 3.2.1)</h3>
              <p className="mt-1 text-xs text-ink-mute">Worked out from your approved courses. A room counts only if it meets the minimum carpet area.</p>
              <ul className="mt-4 space-y-4">
                {norms.rows.map((r) => (
                  <li key={r.kind}>
                    <Meter
                      label={r.label}
                      have={r.have}
                      need={r.rooms}
                      hint={
                        <>
                          {r.rule}; at least {r.minArea} m² each.
                          {r.undersized.length > 0 && <span className="text-amber-700"> Too small to count: {r.undersized.map((u) => `${u.name} (${u.areaSqm} m²)`).join(', ')}.</span>}
                        </>
                      }
                    />
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-ink">Administrative and amenities area</h3>
                <ul className="mt-4 space-y-4">
                  {norms.areas.map((a) => (
                    <li key={a.category}>
                      <Meter label={a.category} have={a.have} need={a.min} unit=" m²" hint={`${a.clause}: at least 750 m² (administrative) and 500 m² (amenities) up to an intake of 300, more in proportion above it.`} />
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm">
                <p className="font-semibold text-ink">Computers, software and internet</p>
                <p className="mt-1 text-ink-mute">
                  At least <span className="font-semibold text-ink">{norms.computersNeeded}</span> computers for your sanctioned students (Annexure-4: 1 for 10 UG students, 1 for 4 PG students). The expert visit checks this on site.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">Land</h3>
                <div className="mt-3">
                  <FindingList items={data.landChecks} empty="Plots and lease meet the norms." />
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'certificates' && (
          <div className="p-6">
            <ExpiryRadar certificates={data.certificates} />
            <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {data.certificates.map((c) => (
                <CertificateRow key={c.id} c={c} campus={campusName(c.campusId)} canEdit={canEdit} onRenew={() => setCert({ id: c.id, body: { kind: c.kind, number: c.number, issuedBy: c.issuedBy, issuedOn: null, validUntil: null, campusId: c.campusId } })} />
              ))}
            </ul>
          </div>
        )}

        {tab === 'rooms' && (
          <div className="p-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {byKind.map(([kind, rooms]) => (
                <div key={kind} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-ink">{kind}</p>
                    <Badge tone="slate">{rooms.length}</Badge>
                  </div>
                  <p className="text-xs text-ink-mute">
                    {rooms[0].category} · {Math.round(rooms.reduce((s, r) => s + r.areaSqm, 0)).toLocaleString('en-IN')} m² in all
                  </p>
                  <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm">
                    {rooms.map((r) => (
                      <li key={r.id} className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-slate-50">
                        <span className="min-w-0 truncate">
                          {r.name} <span className="text-xs text-ink-mute">· {r.building || campusName(r.campusId)}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 tabular-nums text-ink-soft">
                          {r.areaSqm} m²
                          {canEdit && (
                            <button
                              className="text-ink-mute opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                              aria-label={`Remove ${r.name}`}
                              onClick={() => void run(() => deleteSpace(r.id), `${r.name} removed.`)}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {canEdit && (
                    <button className="mt-3 text-xs font-semibold text-brand-700 hover:underline" onClick={() => setRoom({ ...newRoom(kind), category: rooms[0].category, building: rooms[0].building, areaSqm: rooms[0].areaSqm })}>
                      + Add another {kind.toLowerCase()}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'campuses' && (
          <div className="grid gap-4 p-6 md:grid-cols-2">
            {canEdit && data.campuses.length < 3 && (
              <button
                className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 text-sm font-semibold text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-50/40 md:order-last"
                onClick={() => setCampus({ body: { name: '', address: '', city: main?.city ?? '', state: main?.state ?? '', pincode: '', lat: null, lng: null, landAcres: 0, ownership: 'Owned', deedNo: '', leaseStart: null, leaseEnd: null, isMain: false } })}
              >
                <Plus size={18} /> Add a campus or plot
                <span className="text-xs font-normal text-ink-mute">At most three, all within 2 km of the main campus</span>
              </button>
            )}
            {data.campuses.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-ink">
                      <Landmark size={16} className="text-brand-600" /> {c.name}
                    </p>
                    <p className="text-sm text-ink-mute">
                      {c.address}
                      {c.pincode ? `, ${c.pincode}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {canEdit && (
                      <button
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                        onClick={() => setCampus({ id: c.id, body: { name: c.name, address: c.address, city: c.city, state: c.state, pincode: c.pincode, lat: c.lat, lng: c.lng, landAcres: c.landAcres, ownership: c.ownership, deedNo: c.deedNo, leaseStart: c.leaseStart, leaseEnd: c.leaseEnd, isMain: c.isMain } })}
                      >
                        <PenLine size={12} /> Edit
                      </button>
                    )}
                    {c.isMain && <Badge tone="brand">Main campus</Badge>}
                    {c.distanceKm !== undefined && <Badge tone={c.distanceKm <= 2 ? 'green' : 'red'}>{c.distanceKm} km from main</Badge>}
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-ink-mute">Land</dt>
                    <dd className="font-medium">
                      {c.landAcres} acres, {c.ownership.toLowerCase()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-mute">Deed</dt>
                    <dd className="truncate font-mono text-xs">{c.deedNo || '—'}</dd>
                  </div>
                  {c.ownership === 'Leased' && (
                    <>
                      <div>
                        <dt className="text-xs text-ink-mute">Lease</dt>
                        <dd className="font-medium">
                          {c.leaseStart ? formatDate(c.leaseStart) : '—'} to {c.leaseEnd ? formatDate(c.leaseEnd) : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink-mute">Rooms on record</dt>
                        <dd className="font-medium">{data.spaces.filter((s) => s.campusId === c.id).length}</dd>
                      </div>
                    </>
                  )}
                </dl>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={!!campus}
        onClose={() => setCampus(null)}
        title={campus?.id ? 'Edit campus' : 'Add a campus or plot'}
        wide
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCampus(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={busy || !campus || campus.body.name.trim().length < 2 || campus.body.city.trim().length < 2 || (campus.body.ownership === 'Leased' && !(campus.body.leaseStart && campus.body.leaseEnd))}
              onClick={async () => {
                if (!campus) return;
                const ok = await run(() => (campus.id ? updateCampus(campus.id, campus.body) : addCampus(campus.body)), campus.id ? 'Campus updated. AICTE will check the change.' : 'Campus added. The 2 km and lease checks have been run.');
                if (ok) setCampus(null);
              }}
            >
              Save
            </button>
          </>
        }
      >
        {campus && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Name</span>
              <input className="input" value={campus.body.name} onChange={(e) => setCampus({ ...campus, body: { ...campus.body, name: e.target.value } })} />
            </label>
            <label className="block">
              <span className="label">Land (acres)</span>
              <input className="input" type="number" min={0} step={0.1} value={campus.body.landAcres} onChange={(e) => setCampus({ ...campus, body: { ...campus.body, landAcres: Number(e.target.value) } })} />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">Address</span>
              <input className="input" value={campus.body.address} onChange={(e) => setCampus({ ...campus, body: { ...campus.body, address: e.target.value } })} />
            </label>
            <label className="block">
              <span className="label">City</span>
              <input className="input" value={campus.body.city} onChange={(e) => setCampus({ ...campus, body: { ...campus.body, city: e.target.value } })} />
            </label>
            <label className="block">
              <span className="label">State</span>
              <input className="input" value={campus.body.state} onChange={(e) => setCampus({ ...campus, body: { ...campus.body, state: e.target.value } })} />
            </label>
            <label className="block">
              <span className="label">PIN code</span>
              <input className="input" inputMode="numeric" maxLength={6} value={campus.body.pincode} onChange={(e) => setCampus({ ...campus, body: { ...campus.body, pincode: e.target.value.replace(/\D/g, '') } })} />
            </label>
            <label className="block">
              <span className="label">Deed or lease number</span>
              <input className="input font-mono" value={campus.body.deedNo} onChange={(e) => setCampus({ ...campus, body: { ...campus.body, deedNo: e.target.value } })} />
            </label>
            <label className="block">
              <span className="label">Latitude (for the 2 km check)</span>
              <input className="input" type="number" step={0.0001} value={campus.body.lat ?? ''} onChange={(e) => setCampus({ ...campus, body: { ...campus.body, lat: e.target.value === '' ? null : Number(e.target.value) } })} />
            </label>
            <label className="block">
              <span className="label">Longitude</span>
              <input className="input" type="number" step={0.0001} value={campus.body.lng ?? ''} onChange={(e) => setCampus({ ...campus, body: { ...campus.body, lng: e.target.value === '' ? null : Number(e.target.value) } })} />
            </label>
            <label className="block">
              <span className="label">Ownership</span>
              <select className="input" value={campus.body.ownership} onChange={(e) => setCampus({ ...campus, body: { ...campus.body, ownership: e.target.value as CampusIn['ownership'] } })}>
                <option>Owned</option>
                <option>Leased</option>
              </select>
            </label>
            {campus.body.ownership === 'Leased' && (
              <>
                <label className="block">
                  <span className="label">Lease from</span>
                  <input className="input" type="date" value={campus.body.leaseStart ?? ''} onChange={(e) => setCampus({ ...campus, body: { ...campus.body, leaseStart: e.target.value || null } })} />
                </label>
                <label className="block">
                  <span className="label">Lease to (30 years or more, APH 6.17(a))</span>
                  <input className="input" type="date" value={campus.body.leaseEnd ?? ''} onChange={(e) => setCampus({ ...campus, body: { ...campus.body, leaseEnd: e.target.value || null } })} />
                </label>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!room}
        onClose={() => setRoom(null)}
        title="Add rooms"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRoom(null)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={busy || !room || room.areaSqm <= 0 || room.name.trim().length < 2} onClick={async () => room && (await run(() => addSpaces(room), `${room.count ?? 1} room(s) added.`)) && setRoom(null)}>
              Save
            </button>
          </>
        }
      >
        {room && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Kind of room</span>
              <input className="input" list="kinds" value={room.kind} onChange={(e) => setRoom({ ...room, kind: e.target.value, name: e.target.value })} />
              <datalist id="kinds">
                {[...data.spaceKinds, 'Office', 'Amenities', 'Cafeteria'].map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="label">Area category</span>
              <select className="input" value={room.category} onChange={(e) => setRoom({ ...room, category: e.target.value as Space['category'] })}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Name</span>
              <input className="input" value={room.name} onChange={(e) => setRoom({ ...room, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">Building</span>
              <input className="input" value={room.building} onChange={(e) => setRoom({ ...room, building: e.target.value })} placeholder="Academic block A" />
            </label>
            <label className="block">
              <span className="label">Carpet area of each (m²)</span>
              <input className="input" type="number" min={1} value={room.areaSqm} onChange={(e) => setRoom({ ...room, areaSqm: Number(e.target.value) })} />
            </label>
            <label className="block">
              <span className="label">How many</span>
              <input className="input" type="number" min={1} max={60} value={room.count ?? 1} onChange={(e) => setRoom({ ...room, count: Number(e.target.value) })} />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">Campus</span>
              <select className="input" value={room.campusId} onChange={(e) => setRoom({ ...room, campusId: e.target.value })}>
                {data.campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </Modal>

      <Modal
        open={!!cert}
        onClose={() => setCert(null)}
        title={cert?.id ? 'Renew certificate' : 'Add certificate'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCert(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={busy || !cert || cert.body.kind.length < 3}
              onClick={async () => {
                if (!cert) return;
                const ok = await run(() => (cert.id ? renewCertificate(cert.id, cert.body) : addCertificate(cert.body)), cert.id ? 'Certificate renewed. AICTE will check the new one; reminders restart.' : 'Certificate added. AICTE will check it.');
                if (ok) setCert(null);
              }}
            >
              Save
            </button>
          </>
        }
      >
        {cert && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label">Certificate</span>
              <select className="input" value={cert.body.kind} disabled={!!cert.id} onChange={(e) => setCert({ ...cert, body: { ...cert.body, kind: e.target.value } })}>
                {data.certificateKinds.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Certificate number</span>
              <input className="input font-mono" value={cert.body.number} onChange={(e) => setCert({ ...cert, body: { ...cert.body, number: e.target.value } })} />
            </label>
            <label className="block">
              <span className="label">Issued by</span>
              <input className="input" value={cert.body.issuedBy} onChange={(e) => setCert({ ...cert, body: { ...cert.body, issuedBy: e.target.value } })} />
            </label>
            <label className="block">
              <span className="label">Issued on</span>
              <input className="input" type="date" value={cert.body.issuedOn ?? ''} onChange={(e) => setCert({ ...cert, body: { ...cert.body, issuedOn: e.target.value || null } })} />
            </label>
            <label className="block">
              <span className="label">Valid until (leave empty if it does not expire)</span>
              <input className="input" type="date" value={cert.body.validUntil ?? ''} onChange={(e) => setCert({ ...cert, body: { ...cert.body, validUntil: e.target.value || null } })} />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">Campus</span>
              <select className="input" value={cert.body.campusId ?? ''} onChange={(e) => setCert({ ...cert, body: { ...cert.body, campusId: e.target.value || null } })}>
                {data.campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </Modal>
    </>
  );
}

function CertificateRow({ c, campus, canEdit, onRenew }: { c: Certificate; campus: string; canEdit: boolean; onRenew: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3.5 text-sm">
      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', c.tone === 'red' ? 'bg-red-500' : c.tone === 'amber' ? 'bg-amber-500' : 'bg-indgreen-500')} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-ink">{c.kind}</span>
        <span className="block text-xs text-ink-mute">
          {campus} · {c.number || 'no number'} · {c.issuedBy || 'issuer not given'}
          {c.clause ? ` · ${c.clause}` : ''}
        </span>
        {c.note && <span className="block text-xs text-ink-mute">{c.note}</span>}
      </span>
      <Badge tone={c.tone}>{c.validUntil ? `${c.state}${c.days !== null && c.days >= 0 && c.days <= 90 ? ` · ${c.days} days` : ''} · ${formatDate(c.validUntil)}` : c.state}</Badge>
      <VerificationBadge status={c.verification} />
      {canEdit && c.expires && (
        <button className="btn-secondary px-3 py-1.5 text-xs" onClick={onRenew}>
          <RefreshCw size={13} /> Renew
        </button>
      )}
    </li>
  );
}
