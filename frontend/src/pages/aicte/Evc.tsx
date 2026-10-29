import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Ban,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Dices,
  FileCheck,
  FileText,
  Fingerprint,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  Lock,
  MapPin,
  Plus,
  Scale,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Video,
  XCircle,
} from 'lucide-react';
import { useAsync } from '../../lib/useAsync';
import {
  ApiError,
  drawEvcPanel,
  drawFromShortlist,
  fetchDrand,
  getApplications,
  proposeEvcPanel,
  type DrandRound,
  type EvcProposal,
} from '../../services/api';
import { institutionById, INSTITUTIONS } from '../../data/institutions';
import { typeById } from '../../data/rules';
import {
  Badge,
  Callout,
  Card,
  LoadingRows,
  PageHeader,
  WhyChip,
  toast,
} from '../../components/ui';
import { cn, daysBetween, formatDate, TODAY, initials } from '../../lib/utils';
import { sha256Hex, shortHash } from '../../lib/hash';
import type { Expert } from '../../types';
import { GeoEvidenceCheck } from '../../components/geo-evidence';

/* ── Tab definitions matching Document Section 3.4 ── */
const TABS = [
  { id: 'dashboard',    label: 'EVC Dashboard & Inspection Queue',       icon: <LayoutDashboard size={15} /> },
  { id: 'scheduling',   label: 'Inspection Scheduling & Coordination',   icon: <Dices size={15} /> },
  { id: 'digital',      label: 'Digital Institution Inspection',         icon: <ClipboardCheck size={15} /> },
  { id: 'verification', label: 'Faculty & Infrastructure Verification',  icon: <GraduationCap size={15} /> },
  { id: 'evidence',     label: 'Evidence & Observation Centre',          icon: <MapPin size={15} /> },
  { id: 'report',       label: 'EVC Report & Submission',                icon: <FileCheck size={15} /> },
] as const;
type TabId = (typeof TABS)[number]['id'];

type Mode = 'Physical' | 'Online' | 'Hybrid';

/* Sample Checklist for Subpage 3 (Digital Institution Inspection) */
const INSPECTION_ITEMS = [
  { id: 'item-1', category: 'Classrooms', label: 'Instructional Area: Classrooms minimum 66 sqm with projector setup', clause: 'APH Annexure-3, 3.2.1', status: 'Compliant', notes: 'All 12 classrooms measured above 68 sqm, fully equipped.' },
  { id: 'item-2', category: 'Laboratories', label: 'Computer Centre: 150 sqm with 1:4 student-computer ratio & high speed internet', clause: 'APH 3.2.1', status: 'Compliant', notes: '180 workstations operational with 1 Gbps leased line.' },
  { id: 'item-3', category: 'Safety', label: 'Fire Safety Clearance & Extinguishers on all academic floors', clause: 'APH Annexure-3', status: 'Needs Follow-up', notes: 'Valid NOC inspected; extinguisher inspection tag overdue on Block C.' },
  { id: 'item-4', category: 'Library', label: 'Central Library: 450 sqm, 12,000+ volumes and digital subscription catalogue', clause: 'APH 3.3', status: 'Compliant', notes: 'Exceeds minimum volume requirements by 1,400 titles.' },
  { id: 'item-5', category: 'Amenities', label: 'Barrier-free environment: Ramps, lift access and disabled-friendly washrooms', clause: 'APH 3.4', status: 'Compliant', notes: 'Full wheelchair accessibility present in Block A and B.' },
];

export default function Evc() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const { data, loading } = useAsync(getApplications);
  const queue = useMemo(
    () =>
      (data ?? [])
        .filter((a) => a.stage === 'evc')
        .sort((a, b) => (a.id === 'ANU-2026-0412' ? -1 : b.id === 'ANU-2026-0412' ? 1 : a.dueOn.localeCompare(b.dueOn))),
    [data]
  );
  const [selId, setSelId] = useState('ANU-2026-0412');
  const app = queue.find((a) => a.id === selId) ?? queue[0];
  const [mode, setMode] = useState<Mode>('Physical');
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<EvcProposal | null>(null);
  const [round, setRound] = useState<DrandRound | null>(null);
  const [panel, setPanel] = useState<Expert[] | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [onServer, setOnServer] = useState(false);
  const [reportSigned, setReportSigned] = useState(false);

  const reset = () => {
    setProposal(null);
    setRound(null);
    setPanel(null);
    setVerified(null);
    setOnServer(false);
  };

  const propose = async () => {
    if (!app) return;
    reset();
    setBusy(true);
    try {
      const p = await proposeEvcPanel(app);
      setProposal(p);
      toast('Conflict-free shortlist formed; drand public commitment published.', 'green');
    } catch {
      toast('Could not create proposal.', 'red');
    } finally {
      setBusy(false);
    }
  };

  const reveal = async () => {
    if (!proposal || !app) return;
    setBusy(true);
    try {
      const drawn = await drawEvcPanel(app.id);
      if (drawn?.randomness && drawn.chosen) {
        setRound({ round: drawn.committedRound, randomness: drawn.randomness, source: 'live drand network' });
        setPanel(
          drawn.chosen
            .map((id) => proposal.shortlist.find((s) => s.id === id))
            .filter((e): e is EvcProposal['shortlist'][number] => Boolean(e))
        );
        setOnServer(true);
        toast('Panel chosen and verified from drand beacon!', 'green');
        return;
      }
      const r = await fetchDrand();
      setRound(r);
      setPanel(await drawFromShortlist(proposal.shortlist, r.randomness));
      toast('Simulated draw completed.', 'brand');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'The draw could not run.', 'red');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Expert Visit Committee"
        title="Expert Visit Committee (EVC) Portal"
        description="Coordinate institutional inspections where required, capture verifiable evidence and prepare the consolidated EVC report."
        tourId="evc"
      />

      {/* ── Subpage Navigation Tabs (Section 3.4) ────────────────────── */}
      <div className="mb-6 flex overflow-x-auto rounded-2xl bg-slate-100/80 p-1.5 shadow-inner">
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold transition-all sm:text-sm ${
                active
                  ? 'bg-white text-brand-900 shadow-card'
                  : 'text-ink-mute hover:bg-white/40 hover:text-ink'
              }`}
            >
              <span className={active ? 'text-brand-600' : 'text-slate-400'}>{t.icon}</span>
              {t.label}
              {t.id === 'dashboard' && queue.length > 0 && (
                <span className="grid h-4 w-4 place-items-center rounded-full bg-brand-600 text-[10px] text-white">
                  {queue.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── SUBPAGE 1: EVC DASHBOARD & INSPECTION QUEUE ─────────────── */}
      {activeTab === 'dashboard' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Assigned Inspections</p>
              <p className="text-2xl font-black text-brand-900 mt-1">{queue.length}</p>
              <p className="text-xs text-ink-mute mt-0.5">Pending visit coordination</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Panels Formed</p>
              <p className="text-2xl font-black text-indgreen-600 mt-1">1</p>
              <p className="text-xs text-ink-mute mt-0.5">Committed via drand</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Reports Pending</p>
              <p className="text-2xl font-black text-amber-600 mt-1">2</p>
              <p className="text-xs text-ink-mute mt-0.5">Awaiting committee signature</p>
            </Card>
          </div>

          <Card title="EVC Inspection Work Queue" subtitle="Institutions routed to Expert Visit Committee stage under APH Table 2.3 rules.">
            {loading ? (
              <LoadingRows rows={3} />
            ) : queue.length === 0 ? (
              <p className="p-8 text-center text-sm text-ink-mute">No cases currently awaiting EVC inspection.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {queue.map((q) => (
                  <div key={q.id} className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between first:pt-0 last:pb-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-brand-900">{q.id}</span>
                        <span className="font-bold text-ink text-sm">{institutionById(q.institutionId)?.name}</span>
                        <Badge tone="slate">{q.region}</Badge>
                      </div>
                      <p className="text-xs text-ink-mute mt-1">
                        Application: <strong>{typeById(q.typeId)?.name}</strong> · SLA Due: {formatDate(q.dueOn)} ({daysBetween(TODAY, q.dueOn)} days remaining)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelId(q.id);
                          setActiveTab('scheduling');
                        }}
                        className="btn-primary btn-sm"
                      >
                        Schedule Inspection &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 2: INSPECTION SCHEDULING & COORDINATION ──────────── */}
      {activeTab === 'scheduling' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card
            title={`Inspection Coordination for ${app?.id ?? 'Select File'}`}
            subtitle="Public randomness from drand selects the expert panel via commit-reveal, ensuring zero opportunity for bias or manipulation."
          >
            {app && (
              <div className="space-y-5">
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-ink text-sm">{institutionById(app.institutionId)?.name}</p>
                    <p className="text-ink-mute">AICTE ID: {institutionById(app.institutionId)?.aicteId} · Region: {app.region}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">Inspection Mode:</span>
                    {(['Physical', 'Online', 'Hybrid'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`rounded-lg px-3 py-1 font-bold ${mode === m ? 'bg-brand-900 text-white' : 'bg-white border text-ink-soft'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {!proposal ? (
                  <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                    <Dices size={36} className="mx-auto text-slate-400 mb-2" />
                    <h4 className="font-bold text-ink text-sm">Step 1: Commit Conflict-Free Expert Pool</h4>
                    <p className="text-xs text-ink-mute mt-1 max-w-md mx-auto">
                      Filters out any experts with affiliations to {institutionById(app.institutionId)?.name.split(',')[0]} and commits to a future drand round.
                    </p>
                    <button onClick={propose} disabled={busy} className="btn-primary mt-4">
                      {busy ? 'Preparing Shortlist...' : 'Form Shortlist & Publish Commitment'}
                    </button>
                  </div>
                ) : !panel ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4 text-xs">
                      <p className="font-bold text-brand-900">Drand Commitment Published</p>
                      <p className="text-brand-700 mt-1">
                        Shortlist Hash: <code className="font-mono bg-white px-1 py-0.5 rounded">{shortHash(proposal.commitment)}</code> · Target Round: <strong className="font-mono">{proposal.committedRound}</strong>
                      </p>
                    </div>
                    <div className="text-center pt-2">
                      <button onClick={reveal} disabled={busy} className="btn-primary">
                        {busy ? 'Fetching Beacon Randomness...' : 'Step 2: Reveal & Select Panel from Drand'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-indgreen-200 bg-indgreen-50/60 p-4 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indgreen-900 flex items-center gap-1.5">
                          <CheckCircle2 size={16} /> Verifiable Panel Selected
                        </span>
                        <span className="font-mono text-[11px] text-indgreen-800">Round {round?.round}</span>
                      </div>
                      <p className="text-indgreen-700 mt-1">Randomness Seed: <code className="font-mono text-[10px]">{round?.randomness}</code></p>
                    </div>

                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink-mute">Selected Committee Experts:</h4>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {panel.map((exp) => (
                        <div key={exp.id} className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs shadow-xs">
                          <div className="flex items-center gap-2">
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-brand-800 font-bold text-[11px]">
                              {initials(exp.name)}
                            </span>
                            <div>
                              <p className="font-bold text-ink">{exp.name}</p>
                              <p className="text-[10px] text-ink-mute">{exp.specialisation}</p>
                            </div>
                          </div>
                          <p className="mt-2 text-[11px] text-ink-soft">Location: {exp.city} ({exp.region})</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button onClick={() => setActiveTab('digital')} className="btn-primary">
                        Proceed to Digital Checklist &rarr;
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 3: DIGITAL INSTITUTION INSPECTION ────────────────── */}
      {activeTab === 'digital' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card
            title="Mobile-Friendly On-Site Digital Checklist"
            subtitle="Standardized parameters from APH Section 1.9 for facilities, classrooms, laboratories and safety measures."
            action={
              <button onClick={() => toast('Checklist saved to local cache for offline sync.', 'green')} className="btn-secondary btn-sm">
                Save Draft
              </button>
            }
          >
            <div className="space-y-4">
              {INSPECTION_ITEMS.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-4 bg-white">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone="slate">{item.category}</Badge>
                        <span className="text-[11px] text-ink-mute">{item.clause}</span>
                      </div>
                      <h4 className="font-display text-xs font-bold text-ink mt-1.5">{item.label}</h4>
                    </div>
                    <span className={`rounded-md px-2.5 py-1 text-xs font-bold self-start sm:self-center ${item.status === 'Compliant' ? 'bg-indgreen-50 text-indgreen-700 border border-indgreen-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-ink-soft">
                    <strong>Inspector Observation:</strong> {item.notes}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 4: FACULTY & INFRASTRUCTURE VERIFICATION ─────────── */}
      {activeTab === 'verification' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Faculty Cadre & Qualifications Check" subtitle="Comparison of self-disclosed roster with physically verified staff.">
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <span className="font-semibold text-ink">Total Sanctioned Faculty</span>
                  <span className="font-bold text-ink">48</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <span className="font-semibold text-ink">Physically Verified on Site</span>
                  <span className="font-bold text-indgreen-700">45 (94%)</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <span className="font-semibold text-ink">Cadre Ratio (Prof : Assoc : Asst)</span>
                  <span className="font-bold text-ink">1 : 2.1 : 6.2 (Compliant with 1:2:6)</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <span className="font-semibold text-ink">PhD Holders in Senior Cadre</span>
                  <span className="font-bold text-indgreen-700">14 / 14 (100% Compliant)</span>
                </div>
              </div>
            </Card>

            <Card title="Infrastructure & Space Norms Check" subtitle="Carpet areas verified with laser distance meter against APH Annexure-3.">
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <span className="font-semibold text-ink">Classrooms (66 sqm norm)</span>
                  <span className="font-bold text-indgreen-700">12 Verified (&ge; 66 sqm)</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <span className="font-semibold text-ink">Laboratories (66 sqm norm)</span>
                  <span className="font-bold text-indgreen-700">16 Verified</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <span className="font-semibold text-ink">Central Workshop (200 sqm norm)</span>
                  <span className="font-bold text-indgreen-700">220 sqm Verified</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <span className="font-semibold text-ink">Library & Reading Room (400 sqm)</span>
                  <span className="font-bold text-indgreen-700">460 sqm Verified</span>
                </div>
              </div>
            </Card>
          </div>
        </motion.div>
      )}

      {/* ── SUBPAGE 5: EVIDENCE & OBSERVATION CENTRE ─────────────────── */}
      {activeTab === 'evidence' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card
            title="GPS Geotagged Photographic Evidence"
            subtitle="Photos must be taken within 500 meters of the registered campus coordinates on the date of inspection."
          >
            <div className="mb-4">
              <GeoEvidenceCheck lat={18.627} lng={73.813} visitDate="2026-10-14" campus="Narmada Valley Campus" appId="ANU-2026-0412" />
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 6: EVC REPORT & SUBMISSION ───────────────────────── */}
      {activeTab === 'report' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="max-w-2xl mx-auto space-y-6">
          <Card title="Consolidated Inspection Report Draft" subtitle="Synthesized report prepared for digital signature and submission to Regulation Bureau.">
            <div className="space-y-4 text-xs">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <p className="font-bold text-ink">Institution: Narmada Valley Institute of Technology (INS-001)</p>
                <p className="text-ink-mute mt-0.5">Application: ANU-2026-0412 · Inspection Date: {formatDate(TODAY)}</p>
                <div className="mt-3 border-t border-slate-200 pt-2 text-ink">
                  <p><strong>Overall Recommendation:</strong> Recommended with Conditions</p>
                  <p className="mt-1 text-ink-mute">
                    Instructional facilities and faculty strengths meet AICTE prescribed norms. Fire safety extinguisher tags require routine re-certification within 30 days.
                  </p>
                </div>
              </div>

              {!reportSigned ? (
                <div className="rounded-xl border border-slate-200 p-4 bg-white">
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" id="dsc-dec" className="rounded" />
                    <label htmlFor="dsc-dec" className="font-semibold text-ink">
                      I declare that this report accurately reflects on-site verification conducted without conflict of interest.
                    </label>
                  </div>
                  <button
                    onClick={() => {
                      setReportSigned(true);
                      toast('EVC Report signed with inspector credentials and submitted.', 'green');
                    }}
                    className="btn-primary w-full mt-3"
                  >
                    <ShieldCheck size={16} /> Digitally Sign & Submit EVC Report
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-indgreen-200 bg-indgreen-50 p-4 text-center">
                  <CheckCircle2 size={32} className="mx-auto text-indgreen-600 mb-2" />
                  <h4 className="font-display text-sm font-bold text-indgreen-900">Report Successfully Submitted</h4>
                  <p className="text-xs text-indgreen-700 mt-1">
                    SHA-256 Report Fingerprint: <code className="font-mono bg-white px-1 py-0.5 rounded">e3b0c44298fc1c14...</code>
                  </p>
                  <p className="text-[11px] text-indgreen-800 mt-1">Routed to Regulation Bureau for Decision Preparation.</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      )}
    </>
  );
}
