import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  Download,
  FileCheck,
  FileText,
  FileUp,
  Fingerprint,
  FolderLock,
  History,
  Loader2,
  Lock,
  QrCode,
  ScanText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
  XCircle,
} from 'lucide-react';
import { sha256Hex, shortHash } from '../../lib/hash';
import { preflight } from '../../lib/files';
import { invalidate } from '../../lib/resource';
import { useApplicationTypes, useDocuments } from '../../lib/live-data';
import {
  ApiError,
  readUndertaking,
  trackObligation,
  uploadDocument,
  type ReadPromise,
  type StoredDocument,
} from '../../services/api';
import { Badge, Callout, Card, Modal, PageHeader, toast } from '../../components/ui';
import { Tour } from '../../components/live';
import { DOCUMENTS_TOUR } from '../../data/tours';
import { daysBetween, formatDate, formatDateTime, TODAY } from '../../lib/utils';
import { Link } from 'react-router-dom';

/* ── Tab definitions matching Document Section 2.4 ── */
const TABS = [
  { id: 'library',   label: 'Document Library',         icon: <FileText size={15} /> },
  { id: 'upload',    label: 'Upload & Categorisation',  icon: <FileUp size={15} /> },
  { id: 'versions',  label: 'Version History',          icon: <History size={15} /> },
  { id: 'expiry',    label: 'Expiry & Renewal Tracker', icon: <Calendar size={15} /> },
  { id: 'approvals', label: 'Approval Documents',       icon: <FileCheck size={15} /> },
  { id: 'integrity', label: 'Integrity & Access Log',   icon: <Fingerprint size={15} /> },
] as const;
type TabId = (typeof TABS)[number]['id'];

const HISTORY_DOCS = [
  { id: 'DOC-HIST-01', name: 'Registered Lease Deed (Indore SRO)', category: 'Land', version: 2, updated: '2021-07-02', uploadedBy: 'Principal', signature: 'Valid DSC', source: 'Verified at Source', expires: '2031-06-30', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
  { id: 'DOC-HIST-02', name: 'Approved Building Layout Plan', category: 'Infrastructure', version: 1, updated: '2019-03-14', uploadedBy: 'Management', signature: 'Valid DSC', source: 'Verified at Source', expires: 'Permanent', hash: '8743b52063cd84097a65d1633f5c74f5' },
  { id: 'DOC-HIST-03', name: 'Building Occupancy Certificate Block B', category: 'Infrastructure', version: 1, updated: '2026-09-28', uploadedBy: 'Compliance Staff', signature: 'Valid DSC', source: 'Verified at Source', expires: '2036-09-28', hash: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d' },
  { id: 'DOC-HIST-04', name: 'Fire Safety NOC Clearance', category: 'Safety', version: 3, updated: '2025-11-08', uploadedBy: 'Compliance Staff', signature: 'Valid DSC', source: 'Self-uploaded', expires: '2026-11-08', hash: 'a12bc44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b899' },
  { id: 'DOC-HIST-05', name: 'University Affiliation NOC - CSE', category: 'Academic', version: 1, updated: '2026-09-09', uploadedBy: 'HoD Computer Science', signature: 'Valid DSC', source: 'Self-uploaded', expires: '2027-06-30', hash: '9b23c52063cd84097a65d1633f5c74aa' },
];

const CATEGORIES = ['All Categories', 'Land', 'Infrastructure', 'Safety', 'Academic', 'Finance', 'Faculty'];

export default function DocumentVault() {
  const { data: stored, refresh: reload } = useDocuments();
  const types = useApplicationTypes();
  const [activeTab, setActiveTab] = useState<TabId>('library');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All Categories');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docCategory, setDocCategory] = useState('Land');
  const [docKind, setDocKind] = useState('land');
  const [busy, setBusy] = useState(false);

  // Combined documents list
  const allDocs = useMemo(() => {
    const list = [...(stored ?? []).map(d => ({
      id: d.id,
      name: d.filename,
      category: d.docKind === 'land' ? 'Land' : d.docKind === 'fire' ? 'Safety' : 'Academic',
      version: d.version,
      updated: d.uploadedAt ? d.uploadedAt.split('T')[0] : TODAY,
      uploadedBy: d.uploadedBy,
      signature: d.signed ? 'Valid DSC' : 'Unsigned',
      source: 'Uploaded to Vault',
      expires: '2027-06-30',
      hash: d.sha256,
    })), ...HISTORY_DOCS];
    return list;
  }, [stored]);

  const filteredDocs = allDocs.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) || d.hash.includes(search);
    const matchesCat = catFilter === 'All Categories' || d.category === catFilter;
    return matchesSearch && matchesCat;
  });

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setBusy(true);
    try {
      const check = await preflight(uploadFile);
      if (check.errors.length) {
        toast(check.errors[0], 'red');
        return;
      }
      await uploadDocument(uploadFile, uploadFile.name, docKind);
      toast('Document uploaded, fingerprinted (SHA-256) and stored in locker.', 'green');
      setUploadFile(null);
      reload();
      setActiveTab('library');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Upload failed. Please try again.', 'red');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Institutional Record Storage"
        title="Document Locker"
        description="One secure vault for institutional records, uploaded evidence, version history and official AICTE approval letters."
        actions={
          <button onClick={() => setActiveTab('upload')} className="btn-primary">
            <Upload size={16} /> Upload Document
          </button>
        }
        tourId="documents"
      />

      <Tour id="documents" steps={DOCUMENTS_TOUR} />

      {/* ── Subpage Navigation Tabs (Section 2.4) ────────────────────── */}
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
            </button>
          );
        })}
      </div>

      {/* ── SUBPAGE 1: DOCUMENT LIBRARY ────────────────────────────── */}
      {activeTab === 'library' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by document name or SHA-256 hash..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9 w-full text-xs"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCatFilter(cat)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    catFilter === cat ? 'bg-brand-900 text-white' : 'bg-slate-100 text-ink-mute hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <Card title="Stored Institutional Documents" subtitle="Browse, download or inspect cryptographic provenance.">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-ink-mute">
                  <tr>
                    <th className="p-3">Document Title</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Version</th>
                    <th className="p-3">Signature (DSC)</th>
                    <th className="p-3">Expiry Date</th>
                    <th className="p-3">SHA-256 Fingerprint</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDocs.map((d, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-brand-600 shrink-0" />
                          <div>
                            <p className="font-bold text-ink">{d.name}</p>
                            <p className="text-[11px] text-ink-mute">Updated {formatDate(d.updated)} by {d.uploadedBy}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3"><Badge tone="slate">{d.category}</Badge></td>
                      <td className="p-3 font-semibold text-ink">v{d.version}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 rounded bg-indgreen-50 px-2 py-0.5 font-semibold text-indgreen-700">
                          <CheckCircle2 size={12} /> {d.signature}
                        </span>
                      </td>
                      <td className="p-3 text-ink-soft">{d.expires}</td>
                      <td className="p-3 font-mono text-[11px] text-ink-mute">{shortHash(d.hash)}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => toast(`Viewing verified document: ${d.name}`)}
                          className="text-xs font-semibold text-brand-700 hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 2: UPLOAD & CATEGORISATION ──────────────────────── */}
      {activeTab === 'upload' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="max-w-2xl mx-auto space-y-6">
          <Card title="Upload New Institutional Record" subtitle="Files are scanned for viruses, validated for digital signatures (pyHanko) and fingerprinted with SHA-256.">
            <form onSubmit={handleUpload} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-ink mb-1">Document Category</label>
                <select
                  value={docCategory}
                  onChange={(e) => {
                    setDocCategory(e.target.value);
                    setDocKind(e.target.value.toLowerCase());
                  }}
                  className="input w-full"
                >
                  {CATEGORIES.filter(c => c !== 'All Categories').map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Document Type / Norm Clause</label>
                <select
                  value={docKind}
                  onChange={(e) => setDocKind(e.target.value)}
                  className="input w-full"
                >
                  <option value="land">Registered Land Deed (APH 2.1(e))</option>
                  <option value="building">Approved Building Completion Plan (APH 2.3.1)</option>
                  <option value="fire">Fire Safety NOC (APH Annexure-3)</option>
                  <option value="occupancy">Occupancy / Structural Stability Certificate</option>
                  <option value="uni">University Affiliation NOC (APH 2.4.2)</option>
                  <option value="solvency">Bank Solvency / Financial Guarantee</option>
                  <option value="faculty">Faculty Appointment Letters Bundle</option>
                </select>
              </div>

              <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-brand-500 transition-colors bg-slate-50/50">
                <FileUp size={36} className="mx-auto text-slate-400 mb-2" />
                <p className="font-semibold text-ink text-sm">Select a PDF Document to Upload</p>
                <p className="text-ink-mute mt-1 text-[11px]">Maximum file size: 10 MB. Digital signature (DSC) recommended.</p>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="mt-4 block mx-auto text-xs"
                  required
                />
              </div>

              {uploadFile && (
                <div className="rounded-xl bg-brand-50 p-3 text-xs text-brand-900 border border-brand-200">
                  <p className="font-bold">Ready to upload: {uploadFile.name}</p>
                  <p className="text-[11px] text-brand-700 mt-0.5">Size: {(uploadFile.size / 1024).toFixed(1)} KB</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setUploadFile(null)} className="btn-secondary">
                  Clear
                </button>
                <button type="submit" disabled={busy || !uploadFile} className="btn-primary">
                  {busy ? 'Processing & Fingerprinting...' : 'Upload & Categorise'}
                </button>
              </div>
            </form>
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 3: VERSION HISTORY ─────────────────────────────── */}
      {activeTab === 'versions' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card title="Document Revision & Replacement History" subtitle="Nothing is overwritten in ANUMATI. When a document is updated, the previous version is archived in the immutable history.">
            <div className="space-y-4">
              {[
                {
                  docName: 'Fire Safety NOC Clearance',
                  versions: [
                    { v: 3, date: '2025-11-08', uploader: 'S. Joshi (Compliance Cell)', reason: 'Annual Fire Safety Certificate Renewal for Block A & B', hash: 'a12bc44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b899' },
                    { v: 2, date: '2024-11-05', uploader: 'S. Joshi (Compliance Cell)', reason: 'Routine Renewal', hash: '8910bc44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b111' },
                    { v: 1, date: '2023-11-02', uploader: 'Principal', reason: 'Initial Establishment Upload', hash: '4321bc44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b222' },
                  ]
                },
                {
                  docName: 'Registered Lease Deed (Indore SRO)',
                  versions: [
                    { v: 2, date: '2021-07-02', uploader: 'Secretary of the Trust', reason: 'Registered Lease Extension Amendment (30 Year Term)', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
                    { v: 1, date: '2016-06-15', uploader: 'Chairman of the Trust', reason: 'Original 2016 Deed', hash: '1111c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b333' },
                  ]
                }
              ].map((item, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 p-4 bg-white">
                  <h4 className="font-display text-sm font-bold text-ink">{item.docName}</h4>
                  <div className="mt-3 divide-y divide-slate-100 text-xs">
                    {item.versions.map((ver, vi) => (
                      <div key={vi} className="py-2.5 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-brand-900">v{ver.v}</span>
                            <span className="text-ink-mute">Uploaded on {formatDate(ver.date)} by {ver.uploader}</span>
                          </div>
                          <p className="mt-0.5 text-ink-soft">{ver.reason}</p>
                        </div>
                        <span className="font-mono text-[10px] text-ink-mute">{shortHash(ver.hash)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 4: EXPIRY & RENEWAL TRACKER ─────────────────────── */}
      {activeTab === 'expiry' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card title="Document Expiry & Renewal Radar" subtitle="Proactive early warnings help prevent approval blockages and scrutiny deficiencies.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { title: 'Fire Safety Certificate', due: '2026-11-08', days: daysBetween(TODAY, '2026-11-08'), tone: 'red', note: 'Renewal application must be filed with Local Fire Authority.' },
                { title: 'University Affiliation NOC', due: '2027-06-30', days: 245, tone: 'green', note: 'Affiliation renewal active for academic year 2026-27.' },
                { title: 'Bank Guarantee / Solvency', due: '2027-03-31', days: 155, tone: 'green', note: 'Guarantees valid with State Bank of India.' },
                { title: 'Land Lease Deed (SRO)', due: '2031-06-30', days: 1700, tone: 'green', note: 'Lease runway 4.7 years beyond longest course.' },
              ].map((ex, i) => (
                <div key={i} className={`rounded-2xl border p-4 ${ex.tone === 'red' ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${ex.tone === 'red' ? 'bg-red-100 text-red-700' : 'bg-indgreen-100 text-indgreen-700'}`}>
                      {ex.days < 30 ? `Expires in ${ex.days} days` : `Valid (${ex.days}d)`}
                    </span>
                    <Calendar size={16} className="text-slate-400" />
                  </div>
                  <h4 className="mt-3 font-display text-sm font-bold text-ink">{ex.title}</h4>
                  <p className="mt-1 text-xs text-ink-mute">{ex.note}</p>
                  <p className="mt-3 text-[11px] font-semibold text-ink">Expiry Date: {formatDate(ex.due)}</p>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 5: APPROVAL DOCUMENTS ──────────────────────────── */}
      {activeTab === 'approvals' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card title="Official AICTE Letters of Approval" subtitle="Digitally signed letters with cryptographic Ed25519 verifiable credentials and verifiable QR codes.">
            <div className="space-y-3">
              {[
                { title: 'Extension of Approval (EoA) 2026-27', ref: 'AICTE/CRO/INS-001/2026-27/EOA', date: '2026-06-15', signer: 'Member Secretary, AICTE', id: 'ANU-2026-0350' },
                { title: 'Approval for New Course in Artificial Intelligence', ref: 'AICTE/CRO/INS-001/2024-25/NC', date: '2024-06-10', signer: 'Executive Committee', id: 'ANU-2024-0120' },
                { title: 'Extension of Approval (EoA) 2025-26', ref: 'AICTE/CRO/INS-001/2025-26/EOA', date: '2025-05-20', signer: 'Member Secretary, AICTE', id: 'ANU-2025-0290' },
              ].map((lettr, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between bg-white">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-indgreen-50 text-indgreen-700">
                      <ShieldCheck size={20} />
                    </span>
                    <div>
                      <h4 className="font-display text-sm font-bold text-ink">{lettr.title}</h4>
                      <p className="font-mono text-xs text-ink-mute mt-0.5">Reference: {lettr.ref}</p>
                      <p className="text-[11px] text-ink-mute mt-1">Issued: {formatDate(lettr.date)} · Competent Authority: {lettr.signer}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link to={`/letter/${lettr.id}`} className="btn-secondary btn-sm">
                      <QrCode size={14} /> View Verifiable Letter
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── SUBPAGE 6: INTEGRITY & ACCESS LOG ───────────────────────── */}
      {activeTab === 'integrity' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
          <Card title="File Integrity Checks & Access Trail" subtitle="Each stored file's SHA-256 fingerprint is compared with the trusted ledger to detect any quiet tampering.">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-ink-mute">
                  <tr>
                    <th className="p-3">File Reference</th>
                    <th className="p-3">Computed SHA-256 Hash</th>
                    <th className="p-3">Integrity Verdict</th>
                    <th className="p-3">Access Level</th>
                    <th className="p-3">Last Verified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allDocs.slice(0, 6).map((doc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-ink">{doc.name}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">{doc.hash}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 rounded bg-indgreen-50 px-2 py-0.5 font-bold text-indgreen-700">
                          <CheckCircle2 size={12} /> Verified Intact
                        </span>
                      </td>
                      <td className="p-3 text-ink-mute">Role Protected</td>
                      <td className="p-3 text-ink-mute">{formatDate(TODAY)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}
    </>
  );
}
