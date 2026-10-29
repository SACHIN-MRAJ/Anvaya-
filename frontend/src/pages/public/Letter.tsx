import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BadgeCheck, Fingerprint, FolderLock, Printer, ShieldCheck } from 'lucide-react';
import { downloadText } from '../../lib/files';
import { APPLICATIONS } from '../../data/applications';
import { institutionById } from '../../data/institutions';
import { typeById } from '../../data/rules';
import { getSignedCredential, letterText } from '../../services/api';
import { sha256Hex } from '../../lib/hash';
import { AicteLogo, LogoMark } from '../../components/brand';
import { QrCode, verifyUrl } from '../../components/qr';
import { CopyButton, EmptyState, toast } from '../../components/ui';
import { formatDate } from '../../lib/utils';

const OUTCOME: Record<string, string> = {
  EoA: 'Extension of Approval granted',
  LoA: 'Letter of Approval granted',
  LoD: 'Letter of Deficiency issued',
  LoR: 'Letter of Rejection issued',
};

export default function Letter() {
  const { id = '' } = useParams();
  const app = APPLICATIONS.find((a) => a.id === id && a.stage === 'decision');
  const [fp, setFp] = useState('');
  useEffect(() => {
    if (app) sha256Hex(letterText(app)).then(setFp);
  }, [app]);
  if (!app) return <EmptyState title="No issued letter with this reference" action={<Link to="/verify" className="btn-secondary">Verify a letter</Link>} />;
  const inst = institutionById(app.institutionId)!;

  /** W3C Verifiable Credential (data model 2.0). The server adds the signature when it issues the letter. */
  const credential = () => ({
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    id: `urn:anumati:letter:${app.id}`,
    type: ['VerifiableCredential', 'AicteApprovalCredential'],
    issuer: { id: 'did:web:aicte.gov.in', name: 'All India Council for Technical Education' },
    validFrom: `${app.stageEnteredOn}T17:30:12+05:30`,
    credentialSubject: {
      id: `urn:aicte:institution:${inst.aicteId}`,
      name: inst.name,
      decision: OUTCOME[app.outcome ?? ''] ?? app.outcome,
      request: typeById(app.typeId).name,
      academicYear: app.cycle,
      handbookClause: typeById(app.typeId).clause,
    },
    evidence: [{ type: 'DocumentFingerprint', algorithm: 'SHA-256', digest: fp }],
    credentialStatus: { type: 'AnumatiStatusCheck', statusUrl: verifyUrl(app.id) },
    proof: { type: 'DataIntegrityProof', cryptosuite: 'eddsa-rdfc-2022', verificationMethod: 'did:web:aicte.gov.in#letters-2026', proofPurpose: 'assertionMethod', proofValue: 'added by the AICTE signing service at issue time' },
  });

  return (
    <div className="container-page max-w-3xl py-10">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/verify?ref=${app.id}`} className="inline-flex items-center gap-1 text-sm text-ink-mute hover:text-brand-700">
          <ArrowLeft size={15} /> Back to verification
        </Link>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => toast('DigiLocker issuance starts once AICTE is onboarded as a DigiLocker issuer. The signed credential (next button) is exactly what will be pushed.', 'brand')}>
            <FolderLock size={16} /> Save to DigiLocker
          </button>
          <button
            className="btn-secondary"
            onClick={async () => {
              // Signed by the server with its published Ed25519 key when connected; an unsigned copy otherwise.
              const signed = await getSignedCredential(app.id).catch(() => null);
              downloadText(`credential-${app.id}.json`, JSON.stringify(signed ?? credential(), null, 2), 'application/json');
              toast(signed ? 'Signed credential downloaded. Anyone can check it against /.well-known/did.json.' : 'Credential downloaded (unsigned: the server is not connected).', signed ? 'green' : 'brand');
            }}
            title="W3C Verifiable Credential: lets any system check this approval automatically"
          >
            <BadgeCheck size={16} /> Verifiable credential
          </button>
          <button className="btn-primary" onClick={() => window.print()}>
            <Printer size={16} /> Print or save as PDF
          </button>
        </div>
      </div>
      <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card keep-light overflow-hidden">

        <h1 className="sr-only">Decision letter {app.id}</h1>
        <div className="tricolour" />
        <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-8 py-6">
          <AicteLogo className="h-11" />
          <div className="flex items-center gap-2 text-right">
            <div className="leading-tight">
              <p className="font-display text-sm font-extrabold tracking-[0.14em] text-brand-900">ANUMATI</p>
              <p className="text-[11px] text-ink-mute">Approvals and Norms Monitoring</p>
            </div>
            <LogoMark size={40} />
          </div>
        </header>
        <div className="space-y-6 px-8 py-8">
          <div className="flex flex-wrap items-start justify-between gap-4 text-sm">
            <div>
              <p className="text-ink-mute">Reference</p>
              <p className="font-mono font-semibold">{app.id}</p>
            </div>
            <div className="text-right">
              <p className="text-ink-mute">Date of decision</p>
              <p className="font-semibold">{formatDate(app.stageEnteredOn)}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-ink-mute">To</p>
            <p className="font-semibold">The Chairman / Secretary</p>
            <p>{inst.trust}</p>
            <p>{inst.name}</p>
            <p className="text-sm text-ink-mute">AICTE ID {inst.aicteId}</p>
          </div>
          <div className="rounded-2xl bg-indgreen-50 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-indgreen-700">Decision</p>
            <p className="mt-1 font-display text-xl font-bold text-indgreen-700">{OUTCOME[app.outcome ?? ''] ?? app.outcome}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {typeById(app.typeId).name} · academic year {app.cycle}
            </p>
          </div>
          <p className="text-sm leading-relaxed text-ink-soft">
            The Executive Committee, after considering the documents uploaded on the portal and the recommendations of the committees concerned, has decided as above under {typeById(app.typeId).clause} of the Approval Process Handbook 2024-27. The institution shall continue to comply with all norms, conditions and undertakings recorded against this approval.
          </p>
          <div className="grid items-center gap-6 rounded-2xl border border-slate-200 p-5 sm:grid-cols-[auto_1fr]">
            <QrCode value={verifyUrl(app.id)} size={120} />
            <div className="min-w-0 text-sm">
              <p className="flex items-center gap-1.5 font-semibold text-ink">
                <ShieldCheck size={16} className="text-indgreen-600" /> Verify this letter
              </p>
              <p className="mt-1 text-ink-mute">Scan the QR code or enter the reference on the Verify page. Any change to this letter changes its fingerprint.</p>
              <p className="mt-3 flex items-center gap-1 text-xs text-ink-mute">
                <Fingerprint size={12} /> SHA-256
              </p>
              <p className="break-all font-mono text-[11px] text-ink-soft">{fp}</p>
              <CopyButton value={fp} label="Copy fingerprint" className="no-print -ml-2 mt-1" />
            </div>
          </div>
        </div>
        <footer className="border-t border-slate-100 bg-slate-50 px-8 py-4 text-xs text-ink-mute">Issued electronically by the competent authority and sealed in the ANUMATI evidence log. No signature is required on the printed copy.</footer>
      </motion.article>
    </div>
  );
}
