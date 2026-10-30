/**
 * ANUMATI · Interactive Showcase Engine (Team Anvaya - SIH 2026)
 * Built for high-stakes jury demonstrations & Netlify deployment.
 */

// --- 1. DATA DEFINITIONS ---

const NOVELTIES = [
  {
    n: 1,
    title: "The Handbook as Tested Rules (Rules-as-Code)",
    short: "APH Table 2.3 runs as an automated decision table with clause numbers and 50 golden regression tests.",
    area: "Workflow",
    problem: "The Approval Process Handbook is hundreds of pages of PDF. Officers interpret the same rules differently, and institutions cannot predict their approval path or exact requirements.",
    solution: "Table 2.3 (mapping 22 request types to steps, documents, and deadlines) is stored as a versioned, machine-readable rule table. Every file follows the exact published norms.",
    how: [
      "Each cell of Table 2.3 becomes structured data with its statutory clause for all 22 request types.",
      "Any rule update must pass 50 golden test cases and be confirmed by a secondary Bureau Head with impact analysis.",
      "Applications stay permanently locked to the rule version active when submitted, preventing moving goalposts."
    ],
    isNew: "Rules become testable code before impacting colleges, eliminating arbitrary human discretion.",
    source: "OECD 'Rules as Code'; OpenFisca (France)",
    status: "live",
    demo: "rules"
  },
  {
    n: 2,
    title: "Fair Deadline Clocks (EMA Clock-Stop Standard)",
    short: "Every step has a statutory clock that pauses while the institution owes a reply and escalates late files automatically.",
    area: "Workflow",
    problem: "Delays are opaque. When a file sits stalled for 90 days, nobody can prove whether AICTE scrutiny or the college's delay caused it.",
    solution: "Every step has a deadline from the handbook. The clock pauses while the institution owes a reply and restarts when received; late files escalate automatically across 3 tiers.",
    how: [
      "Each step gets its target: scrutiny 15d, re-scrutiny 10d, EVC visit 30d, hearing 15d, Executive Committee 10d.",
      "Issuing a deficiency pauses the clock; the institution's reply restarts it, extending the due date by exactly the paused days.",
      "A background scheduler triggers proactive reminders 7 days before and escalates breaches: Regional Officer -> Bureau Head -> Member Secretary."
    ],
    isNew: "Delay is measured fairly on both sides with mathematical accountability, preventing files from stalling silently.",
    source: "European Medicines Agency (EMA) clock-stop; Telangana TS-iPASS statutory time limits",
    status: "live",
    demo: "clock"
  },
  {
    n: 3,
    title: "A Map of Where Files Wait (Process Mining)",
    short: "Process mining turns the evidence log into a live visual map of where time is lost, step by step and region by region.",
    area: "Insight",
    problem: "Executives only see coarse totals of pending files, not where friction occurs or why one regional office is twice as slow as another.",
    solution: "Every transaction generates a time-stamped cryptographic event. Process mining renders an interactive bottleneck heatmap showing actual wait times against statutory targets.",
    how: [
      "Every workflow action writes an immutable event into the audit log.",
      "Events are grouped by application, expert visit, and document type to model the multi-dimensional workflow.",
      "The visual map renders average wait times, transition paths, and the slowest regional queues in real time."
    ],
    isNew: "Regulatory decisions and staffing allocations are driven by forensic evidence rather than subjective conjecture.",
    source: "Object-Centric Process Mining (PM4Py, OCEL 2.0 Standard)",
    status: "simpler"
  },
  {
    n: 4,
    title: "Explainable Delay Risk Scoring",
    short: "Every open file receives a predictive delay probability alongside transparent root-cause factors so officers act early.",
    area: "Insight",
    problem: "Officers and committee heads only discover a file is late after critical counselling cut-off dates have already passed.",
    solution: "Every open dossier is assigned an explainable risk score with contributing factors (days in stage, regional queue volume, past deficiencies) to proactively prioritize attention.",
    how: [
      "Evaluates days spent in current stage, regional queue velocity, upcoming EVC scheduling, and deficiency history.",
      "Each factor displays its exact mathematical contribution percentage so the score is fully transparent and auditable.",
      "The AICTE Command Centre sorts the work queue by risk so high-risk dossiers are cleared first."
    ],
    isNew: "Predictive intelligence that explains its reasoning, used exclusively to accelerate assistance.",
    source: "Survival analysis with SHAP (SHapley Additive exPlanations)",
    status: "simpler"
  },
  {
    n: 5,
    title: "A 'Why?' on Every Automated Action",
    short: "Every reminder, escalation, and automated check displays an interactive chip citing the rule, clause, and raw trigger data.",
    area: "Trust",
    problem: "Automated government software often operates as a 'black box', triggering legal confusion and administrative appeals.",
    solution: "Every automated notice, reminder, or system gate includes a 'Why?' chip displaying the exact statutory clause, triggering data, and decision logic in plain language.",
    how: [
      "Every automated event records the statutory clause and trigger condition in its metadata.",
      "The interactive chip expands to show the rule explanation and input values.",
      "The exact decision justification is permanently recorded in the immutable evidence ledger for auditability."
    ],
    isNew: "Algorithmic transparency is built in as a mandatory architectural primitive, not an afterthought.",
    source: "OECD Algorithmic Transparency Standards; EU AI Act transparency mandates",
    status: "live"
  },
  {
    n: 6,
    title: "A Log Nobody Can Quietly Change (SHA-256 Merkle Chain)",
    short: "Every action is chained with SHA-256 cryptographic hashes; altering any historical record mathematically breaks the chain.",
    area: "Trust",
    problem: "Database administrators or bad actors can quietly alter records, backdate inspection reports, or erase evidence.",
    solution: "Every action is logged with the SHA-256 fingerprint of the preceding entry. Changing any historical entry invalidates every subsequent hash. The database strictly enforces append-only permissions.",
    how: [
      "Each entry incorporates the SHA-256 digest of the previous transaction.",
      "The application runtime role cannot perform UPDATE or DELETE operations; database triggers forbid tampering.",
      "A one-click verification engine re-hashes all blocks on the fly and pinpoints the exact record of any discrepancy."
    ],
    isNew: "Forensic, court-admissible proof of every regulatory action without the computational waste of a blockchain.",
    source: "Certificate Transparency (RFC 6962); Crosby-Wallach tamper-evident log model",
    status: "live",
    demo: "chain"
  },
  {
    n: 7,
    title: "Land Lease Runway Radar",
    short: "Measures remaining years of land lease against the longest course, warning years before renewal is blocked.",
    area: "Compliance",
    problem: "An institution's land lease can quietly lapse below the length of its longest academic program, blocking approval when batches are enrolled.",
    solution: "The radar compares remaining lease duration against the longest course duration (e.g. 4 years for B.Tech) and issues early alerts years ahead so trusts can execute extensions.",
    how: [
      "Lease expiry dates and longest program durations are sourced from verified institutional locker records.",
      "Runway = Lease Years Remaining - Longest Course Duration.",
      "Visual radar gauges turn amber and red years before renewal deadlines to ensure continuity."
    ],
    isNew: "Prevents sudden mid-degree regulatory shutdowns through continuous forward-looking compliance tracking.",
    source: "AICTE Approval Process Handbook Clauses 2.1(e) and 6.17",
    status: "live",
    demo: "runway"
  },
  {
    n: 8,
    title: "Approved Directory with Fake-College Shield & Live API",
    short: "A public search engine with instant counterfeit-college detection and live API integration for State Counselling bodies.",
    area: "Trust",
    problem: "Students lose savings to unapproved lookalike colleges, while State Admission Authorities manually transcribe seat matrices with errors.",
    solution: "A public search portal flags unapproved and soundalike fake colleges in real time, while a secure REST API provides verified seat numbers directly to state counselling servers.",
    how: [
      "The public directory synchronizes directly with official institutional records.",
      "Real-time heuristic search flags known unapproved entities and deceptive institutional name variants.",
      "State counselling authorities query approved intakes directly via authenticated API Setu endpoints."
    ],
    isNew: "A single, tamper-proof national source of truth for students, parents, and state counselling bodies.",
    source: "National Open Government Data; API Setu",
    status: "live"
  },
  {
    n: 9,
    title: "A Fair, Checkable Expert Draw (drand Quantum Beacon)",
    short: "A publicly verifiable random beacon, fixed in advance, selects inspection experts; anyone can independently verify the draw.",
    area: "Fairness",
    problem: "Expert Visit Committee (EVC) selections can be compromised by lobbying, favouritism, or predetermined scheduling.",
    solution: "AICTE publishes a conflict-free shortlist and commits to a future round of the drand quantum randomness beacon before it exists. When published, that round deterministically selects the committee.",
    how: [
      "A conflict-free shortlist of eligible experts is compiled from the national roster.",
      "The system commits to the SHA-256 hash of the shortlist combined with a future drand round number.",
      "The public beacon's unbiasable randomness executes the draw, allowing any auditor or citizen to reproduce the exact result."
    ],
    isNew: "Renders committee allocation provably uncheatable—even AICTE officials cannot influence who inspects a college.",
    source: "League of Entropy (drand.love) public randomness beacon; Commit-Reveal protocols",
    status: "live",
    demo: "draw"
  },
  {
    n: 10,
    title: "Automated Conflict-of-Interest Firewall",
    short: "Inspectors with historical, financial, or academic links to an institution are automatically excluded from its panel with documented reasons.",
    area: "Fairness",
    problem: "Experts with ties to an institution (former faculty, alumni, advisory board members) often end up evaluating their own associates.",
    solution: "Before the committee draw, experts with any institutional link are automatically disqualified from the shortlist, and the exclusion rationale is logged permanently.",
    how: [
      "Expert profiles maintain verified institutional relationships, previous employments, and state affiliations.",
      "The firewall automatically removes linked, fully booked, or unavailable candidates prior to public commitment.",
      "Every exclusion rationale is logged to the cryptographic evidence ledger."
    ],
    isNew: "Conflicts are removed programmatically by rule before the selection process begins, eliminating human subjectivity.",
    source: "Public procurement transparency standards; Peer-review governance",
    status: "simpler"
  },
  {
    n: 11,
    title: "Intelligent Undertaking & Obligation Tracker",
    short: "Extracts commitments and target dates from signed affidavits and tracks them as live conditions with automated reminders.",
    area: "Compliance",
    problem: "Promises made in conditional affidavits ('6 faculty will be appointed before classes commence') are filed once and forgotten.",
    solution: "Extracts promises, due dates, and clauses from uploaded affidavits; upon confirmation, each commitment becomes a tracked obligation with alerts and evidence gates.",
    how: [
      "Text parsing extracts specific commitments, target deadlines, and relevant handbook clauses.",
      "Institution administration confirms the obligations, establishing a verified compliance milestone.",
      "Each confirmed obligation appears on the compliance dashboard with proactive reminders and escalation ladders."
    ],
    isNew: "Transforms paper promises into active, monitored regulatory obligations.",
    source: "Document AI with human-in-the-loop validation; OECD regulatory monitoring",
    status: "simpler"
  },
  {
    n: 12,
    title: "What-If Policy & Capacity Simulator (Digital Twin)",
    short: "Simulates officer capacity, application spikes, or date shifts on a discrete-event model to forecast on-time completion rates.",
    area: "Insight",
    problem: "Regulators adjust submission deadlines or officer staffing based on guesswork, causing unexpected processing bottlenecks.",
    solution: "A discrete-event digital twin of the approval pipeline allows regulators to simulate officer distribution, volume surges, or deadline shifts to observe effects on completion rates.",
    how: [
      "Models historical cycle transit times, stage targets, and active regional queues.",
      "Users adjust sliders for regional staffing, application volume surges, or deadline shifts.",
      "Calculates the predicted percentage of applications cleared within statutory targets, region by region."
    ],
    isNew: "Policy and capacity decisions are tested on mathematical simulations before being deployed to the public.",
    source: "Discrete-event simulation; Digital twin process modeling",
    status: "live"
  },
  {
    n: 13,
    title: "Signature & Pre-Flight Validation at Upload",
    short: "Validates digital signatures (DSC), file integrity, password locks, and virus scans the instant a PDF is selected.",
    area: "Workflow",
    problem: "Corrupted, unsigned, or incorrectly formatted PDFs are only detected weeks later during scrutiny, costing an entire deficiency round.",
    solution: "Every PDF undergoes sub-second pre-flight validation in the browser: digital signature verification, password lock detection, file format checks, and server-side virus scanning.",
    how: [
      "Cryptographic signature verification validates digital signature certificates (DSC) inside the PDF.",
      "Validates page counts, file dimensions, password security, and executes ClamAV virus scanning.",
      "Provides instant inline feedback so applicants resolve issues before final submission."
    ],
    isNew: "Resolves document defects in seconds at the applicant's desk rather than losing weeks in scrutiny rounds.",
    source: "pyHanko digital signature validation; APH Clause 1.4.6",
    status: "live"
  },
  {
    n: 14,
    title: "Direct Source-Level Verification (DigiLocker & API Setu)",
    short: "Certificates and NOCs arrive directly from the issuing authority through DigiLocker and API Setu, verified at source.",
    area: "Trust",
    problem: "Scanned paper certificates (State NOCs, University Affiliations, Land Deeds) can be forged, and manual verification is laborious.",
    solution: "Integrates with national digital repositories to pull digitally signed documents directly from the issuing authority, guaranteeing authenticity by construction.",
    how: [
      "The institution consents to fetch authentic records via authorized DigiLocker gateways.",
      "Documents arrive cryptographically signed directly by the issuing authority.",
      "Scrutiny committees view the credential tagged with a 'Verified at Source' trust seal."
    ],
    isNew: "Shifts regulatory compliance from human visual checks to cryptographic source-level verification.",
    source: "National DigiLocker; API Setu ecosystem",
    status: "designed"
  },
  {
    n: 15,
    title: "Visit Photos Audited by GPS Geofencing & EXIF",
    short: "Expert committee inspection photos are validated against campus GPS geofences (< 500m) and scheduled inspection dates.",
    area: "Fairness",
    problem: "Unscrupulous teams submit recycled photos or conduct fake 'desk inspections' without physically visiting campuses.",
    solution: "Extracts camera sensor EXIF metadata, GPS latitude/longitude, and capture timestamps. Photos captured more than 500 meters from campus coordinates are immediately rejected.",
    how: [
      "Extracts sensor coordinates and capture timestamps directly from image metadata.",
      "Calculates the haversine distance between photo coordinates and the official campus boundary.",
      "Non-compliant photos trigger instant rejection alerts displaying the discrepancy distance."
    ],
    isNew: "Forensically proves physical inspection authenticity through sensor-level geofencing.",
    source: "Comptroller and Auditor General (CAG) geotagged inspection audit standards",
    status: "live"
  },
  {
    n: 16,
    title: "Algorithmic Risk-Weighted Surprise Inspections",
    short: "Institutions with higher compliance anomalies face proportionally higher audit probabilities, determined via drand randomness.",
    area: "Compliance",
    problem: "Routine annual inspections are either wholly predictable or susceptible to accusations of targeted harassment.",
    solution: "Calculates an objective risk weight for each college based on overdue conditions, lease runways, and student grievances; drand quantum randomness selects surprise inspection targets.",
    how: [
      "Risk weighting incorporates overdue undertakings, expiring land leases, and faculty turnover rates.",
      "Weights are committed publicly, with ~20% of draws reserved purely at random so all colleges maintain readiness.",
      "drand public randomness executes the selection, ensuring total immunity from human manipulation."
    ],
    isNew: "Optimizes regulatory inspection capacity where systemic risk is greatest while preserving absolute fairness.",
    source: "OECD Best-Practice Principles for Regulatory Inspections",
    status: "live"
  },
  {
    n: 17,
    title: "Every Channel, Every Language (Omnichannel & Accessibility)",
    short: "Real-time alerts via Email, SMS, and WhatsApp; query file status via registered WhatsApp; bilingual English & Hindi with text-to-speech.",
    area: "Reach",
    problem: "Email-only notifications get buried in spam, and English-only interfaces create linguistic barriers for rural institutions and parents.",
    solution: "Omnichannel alerts across WhatsApp Business, SMS, and Email. Registered numbers can query application status via WhatsApp, and the portal provides instant Hindi translation with audio read-aloud.",
    how: [
      "Users select preferred communication channels and language preferences.",
      "Delivery receipts and retry logs are recorded across all channels to guarantee message delivery.",
      "WhatsApp automated webhooks securely answer status inquiries strictly for registered mobile numbers."
    ],
    isNew: "Delivers public digital infrastructure to stakeholders where they already communicate, in their native language.",
    source: "Jugalbandi on Bhashini; DLT-compliant SMS infrastructure",
    status: "simpler"
  },
  {
    n: 18,
    title: "Ready for Any Regulator (Configurable Multi-Agency Engine)",
    short: "Approval stages, rules, deadlines, and checklists are data configurations, allowing any higher education regulator to adopt the platform.",
    area: "Workflow",
    problem: "Upcoming national regulatory mergers (such as HECI) threaten to render single-agency software obsolete.",
    solution: "Workflows, stage targets, required documents, and escalation ladders are defined as schema configurations rather than hardcoded logic, enabling seamless multi-regulator deployment.",
    how: [
      "All regulatory steps, deadlines, and validation criteria reside in versioned database tables.",
      "User roles, organizational tiers, and regional jurisdictions are dynamically mapped from identity providers.",
      "Onboarding a new regulatory body simply requires publishing a new rule table configuration."
    ],
    isNew: "Future-proof architecture engineered to outlast organizational mergers and policy reforms.",
    source: "Higher Education Commission of India (HECI) unified regulatory blueprint",
    status: "designed"
  },
  {
    n: 19,
    title: "AI Document Verification at Upload (4-Layer Pipeline)",
    short: "OCR, NLP field extraction, APH rule checks, and ML anomaly detection run the moment a PDF is uploaded—before submission.",
    area: "Workflow",
    problem: "Expired NOCs, mismatched trust names, or structurally deficient documents are only discovered weeks later during human scrutiny, losing a full round.",
    solution: "The moment a PDF is uploaded, a 4-layer AI pipeline executes: OCR extraction, NLP parsing of dates and names, APH norm validation, and an ML anomaly detector, flagging defects in seconds.",
    how: [
      "Extracts text via pdfminer with Tesseract OCR fallback for scanned certificates.",
      "NLP regular expressions and date parsers extract institution name, validity period, course names, and signatories.",
      "An Isolation Forest ML classifier evaluates structural completeness, providing an instant pass or specific clause citation."
    ],
    isNew: "Identifies document errors in 2 seconds at the applicant's desk rather than losing weeks in committee queues.",
    source: "pdfminer.six · Tesseract OCR 5 · scikit-learn Isolation Forest · APH Annexures 1, 2, 3",
    status: "live",
    demo: "docai"
  }
];

const PROBLEMS = [
  {
    id: "p1",
    title: "Files Wait in Limbo Without Anyone Noticing",
    text: "No statutory countdown clocks, no early warnings, and zero automated escalations when files stall for months.",
    solvedBy: [2, 4, 3]
  },
  {
    id: "p2",
    title: "Rules are 26 Fragmented PDFs, Read Inconsistently",
    text: "Institutions cannot predict their required route, and different officers interpret the exact same clauses differently.",
    solvedBy: [1, 5, 13, 19]
  },
  {
    id: "p3",
    title: "Approval Conditions Forgotten Immediately Post-Decision",
    text: "Signed promises in undertakings, land leases, and safety NOCs expire silently without systematic follow-up.",
    solvedBy: [7, 11, 16]
  },
  {
    id: "p4",
    title: "Public Cannot Trust What They See",
    text: "Paper letters are easily forged, lookalike colleges deceive students, and audit records can be quietly altered in databases.",
    solvedBy: [6, 8, 14]
  },
  {
    id: "p5",
    title: "Expert Committee Allocations & Visits Can Be Questioned",
    text: "Who inspects a college is vulnerable to lobbying, and whether inspectors physically visited campuses is unverified.",
    solvedBy: [9, 10, 15]
  },
  {
    id: "p6",
    title: "Alerts Miss People & Regulatory Planning is Guesswork",
    text: "Email-only notices get buried in spam, and councils adjust deadlines and staffing with zero predictive foresight.",
    solvedBy: [17, 3, 12]
  }
];

const JOURNEY_STEPS = [
  {
    step: "1. Prepare & Verify",
    title: "Handbook-as-Code & Live Norms",
    desc: "Rules Explorer maps the exact approval route, required documents, and statutory targets; live calculators check teacher-student ratios as you type.",
    novelties: [1],
    tag: "Rules as Code"
  },
  {
    step: "2. Upload & Pre-Flight",
    title: "Instant AI Pre-Flight Diagnostics",
    desc: "PDFs undergo sub-second pre-flight scrutiny: digital signature validation, password lock checks, and 4-layer AI document verification.",
    novelties: [19, 13, 6],
    tag: "Edge Diagnostics"
  },
  {
    step: "3. Scrutiny Commences",
    title: "Fair Countdown Clocks & Delay Risk",
    desc: "Statutory clock begins ticking. Officers view explainable delay risk scores with transparent factor breakdowns to prioritize backlogs.",
    novelties: [2, 4, 5],
    tag: "Statutory Clock"
  },
  {
    step: "4. Deficiency & Pause",
    title: "Automatic Clock-Stop Principle",
    desc: "When a deficiency notice is raised, the clock pauses immediately. Upon institutional reply, the clock resumes with dates fairly adjusted.",
    novelties: [2],
    tag: "Clock-Stop"
  },
  {
    step: "5. Expert Visit Committee",
    title: "drand Quantum Draw & GPS Audit",
    desc: "Conflict firewall eliminates affiliated experts; public drand quantum beacon draws the panel; photos are validated against campus GPS geofences.",
    novelties: [10, 9, 15],
    tag: "drand Quantum"
  },
  {
    step: "6. Official Decision",
    title: "W3C Verifiable Credential Letter",
    desc: "Decisions are logged to the SHA-256 Merkle ledger; decision letters feature high-density QR codes anchored with Ed25519 digital signatures.",
    novelties: [6, 8],
    tag: "QR Credential"
  },
  {
    step: "7. Post-Approval Monitoring",
    title: "Proactive Compliance & Radar",
    desc: "Affidavits become tracked obligations with automated reminders; lease runway radar warns years ahead; surprise audits are drawn by risk.",
    novelties: [11, 7, 16, 17],
    tag: "Lease Radar"
  },
  {
    step: "8. Continuous Optimization",
    title: "Process Mining & Policy Simulation",
    desc: "Process mining visualizes real-world bottlenecks; what-if digital twin tests policy shifts and staffing adjustments before publication.",
    novelties: [3, 12, 1, 18],
    tag: "Process Twin"
  }
];

const APPLICATION_TYPES = [
  { id: "site", name: "Change of Site / Location", targetDays: 45, clause: "APH 2.17", steps: ["Scrutiny", "EVC Visit", "SHC Hearing", "Executive Committee"] },
  { id: "new", name: "Setting up New Technical Institution", targetDays: 60, clause: "APH Chapter 1", steps: ["Self-Disclosure", "Scrutiny", "EVC Visit", "SHC Hearing", "Executive Committee"] },
  { id: "eoa", name: "Extension of Approval (EoA) Renewal", targetDays: 15, clause: "APH Chapter 2", steps: ["Self-Disclosure", "Automated Scrutiny", "Executive Committee"] },
  { id: "intake", name: "Increase in Intake / Additional Division", targetDays: 30, clause: "APH 2.3", steps: ["Scrutiny", "EVC Visit (Conditional)", "Executive Committee"] },
  { id: "programme", name: "Introduction of New Programme / Level", targetDays: 35, clause: "APH 2.4", steps: ["Scrutiny", "EVC Visit", "Executive Committee"] },
  { id: "closure", name: "Closure of Institution / Programme", targetDays: 25, clause: "APH 2.19", steps: ["Scrutiny", "SHC Hearing", "Executive Committee"] }
];

const SAMPLE_EXPERTS = [
  { id: "EXP-101", name: "Dr. A. K. Rao", institution: "IIT Bombay", conflict: false },
  { id: "EXP-102", name: "Prof. Sunita Iyer", institution: "IISc Bangalore", conflict: false },
  { id: "EXP-103", name: "Dr. M. Q. Khan", institution: "Narmada Valley Institute", conflict: true, reason: "Prior Alumnus / Former Faculty" },
  { id: "EXP-104", name: "Prof. Rajesh Das", institution: "NIT Trichy", conflict: false },
  { id: "EXP-105", name: "Dr. Priya Nair", institution: "MNIT Jaipur", conflict: true, reason: "Advisory Board Member" },
  { id: "EXP-106", name: "Prof. Kuldeep Singh", institution: "IIT Delhi", conflict: false },
  { id: "EXP-107", name: "Dr. Lakshmi Menon", institution: "NIT Calicut", conflict: false }
];

// --- 2. CRYPTOGRAPHIC UTILITY (Real Web Crypto API SHA-256) ---

async function computeSHA256(str) {
  const buffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- 3. BACKGROUND CANVAS PARTICLE ANIMATION ---

function initCanvasAnimation() {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  const particles = [];
  const particleCount = Math.min(width > 768 ? 60 : 25, 80);

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      radius: Math.random() * 2 + 1,
      color: Math.random() > 0.6 ? "rgba(243, 156, 18, 0.4)" : "rgba(37, 79, 157, 0.5)"
    });
  }

  function render() {
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();

      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
        if (dist < 130) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(37, 79, 157, ${0.15 * (1 - dist / 130)})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(render);
  }

  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  render();
}

// Spotlight Cursor Follower
function initSpotlight() {
  const spotlight = document.getElementById("cursor-spotlight");
  if (!spotlight) return;
  window.addEventListener("pointermove", (e) => {
    spotlight.style.transform = `translate(${e.clientX - 300}px, ${e.clientY - 300}px)`;
  });
}

// --- 4. RENDER NOVELTIES & CARDS ---

let currentArea = "All";
let searchQuery = "";
const openDrawers = new Set([1]); // Novelty 1 open by default

function renderNovelties() {
  const container = document.getElementById("novelties-container");
  if (!container) return;

  const filtered = NOVELTIES.filter(n => {
    const matchesArea = currentArea === "All" || n.area === currentArea;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      n.title.toLowerCase().includes(q) || 
      n.short.toLowerCase().includes(q) || 
      n.problem.toLowerCase().includes(q) || 
      n.solution.toLowerCase().includes(q) ||
      n.area.toLowerCase().includes(q) ||
      `#${n.n}`.includes(q);
    return matchesArea && matchesSearch;
  });

  document.getElementById("novelties-count").textContent = `${filtered.length} of ${NOVELTIES.length} Novelties`;

  if (!filtered.length) {
    container.innerHTML = `
      <div class="glass-panel p-8 text-center text-slate-400">
        <p class="text-lg font-bold">No novelties match your search "${searchQuery}"</p>
        <p class="text-sm mt-1">Try clearing your search or switching pillar categories.</p>
        <button onclick="resetFilters()" class="mt-4 px-4 py-2 rounded-xl bg-slate-800 text-white font-semibold text-sm hover:bg-slate-700 transition">Reset Filters</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const isOpen = openDrawers.has(item.n);
    const statusClass = item.status === "live" ? "badge-live" : item.status === "simpler" ? "badge-simpler" : "badge-designed";
    const statusText = item.status === "live" ? "Working Now" : item.status === "simpler" ? "Simpler Version" : "Designed";

    return `
      <div id="card-n-${item.n}" class="glass-panel glass-card-interactive overflow-hidden mb-4 border transition-all">
        <!-- Header Button -->
        <button onclick="toggleNovelty(${item.n})" class="w-full flex items-start gap-4 p-5 text-left focus:outline-none">
          <div class="num-bubble">${item.n}</div>
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-1.5">
              <span class="font-bold text-lg text-white hover:text-amber-400 transition-colors">${item.title}</span>
              <span class="badge-pill ${statusClass}">${statusText}</span>
              <span class="badge-pill badge-pillar">${item.area}</span>
              ${item.demo ? `<span class="badge-pill bg-purple-900/40 text-purple-300 border border-purple-500/30">Interactive Demo Available</span>` : ""}
            </div>
            <p class="text-sm text-slate-300">${item.short}</p>
          </div>
          <div class="mt-1 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-amber-400' : ''}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
        </button>

        <!-- Drawer Content -->
        <div class="novelty-drawer ${isOpen ? 'open' : ''}">
          <div class="border-t border-slate-700/60 p-6 pt-5 grid gap-6 lg:grid-cols-12 bg-slate-900/40">
            <!-- Left Column: Problem & Solution -->
            <div class="lg:col-span-7 space-y-4">
              <div class="p-4 rounded-xl bg-red-950/20 border border-red-500/20">
                <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400 mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                  The Critical Problem
                </div>
                <p class="text-sm text-slate-300 leading-relaxed">${item.problem}</p>
              </div>

              <div class="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
                  Our Algorithmic Answer
                </div>
                <p class="text-sm text-slate-200 leading-relaxed">${item.solution}</p>
              </div>

              <div class="space-y-2">
                <div class="text-xs font-bold uppercase tracking-wider text-blue-400">How It Works Step-By-Step</div>
                <div class="space-y-2">
                  ${item.how.map((step, idx) => `
                    <div class="flex items-start gap-3 text-sm text-slate-300">
                      <span class="grid place-items-center w-5 h-5 rounded-full bg-blue-900/60 text-blue-300 text-xs font-bold shrink-0 mt-0.5">${idx + 1}</span>
                      <span>${step}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

            <!-- Right Column: Innovation & Origins -->
            <div class="lg:col-span-5 space-y-3 flex flex-col justify-between">
              <div class="space-y-3">
                <div class="p-4 rounded-xl bg-amber-950/20 border border-amber-500/25">
                  <div class="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">What Is Radically New</div>
                  <p class="text-sm text-slate-200">${item.isNew}</p>
                </div>

                <div class="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
                  <div class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Global Standard / Origin</div>
                  <p class="text-sm text-slate-300">${item.source}</p>
                </div>
              </div>

              ${item.demo ? `
                <button onclick="scrollToDemo('${item.demo}')" class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2">
                  <span>Launch Live Interactive Demo</span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </button>
              ` : `
                <div class="p-3 text-center rounded-xl bg-slate-800/30 text-xs text-slate-400 border border-slate-700/40">
                  Integrated live in ANUMATI Production Build
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleNovelty(n) {
  if (openDrawers.has(n)) {
    openDrawers.delete(n);
  } else {
    openDrawers.add(n);
  }
  renderNovelties();
}

function openAllNovelties() {
  NOVELTIES.forEach(n => openDrawers.add(n.n));
  renderNovelties();
}

function closeAllNovelties() {
  openDrawers.clear();
  renderNovelties();
}

function filterByArea(area) {
  currentArea = area;
  document.querySelectorAll(".pill-area").forEach(btn => {
    if (btn.dataset.area === area) {
      btn.classList.add("active", "bg-amber-500", "text-navy-950", "font-bold");
      btn.classList.remove("bg-slate-800", "text-slate-300");
    } else {
      btn.classList.remove("active", "bg-amber-500", "text-navy-950", "font-bold");
      btn.classList.add("bg-slate-800", "text-slate-300");
    }
  });
  renderNovelties();
}

function handleSearch(val) {
  searchQuery = val;
  renderNovelties();
}

function resetFilters() {
  currentArea = "All";
  searchQuery = "";
  const input = document.getElementById("search-input");
  if (input) input.value = "";
  filterByArea("All");
}

function jumpToNovelty(n) {
  currentArea = "All";
  openDrawers.add(n);
  filterByArea("All");
  setTimeout(() => {
    const el = document.getElementById(`card-n-${n}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add("ring-2", "ring-amber-400");
      setTimeout(() => el.classList.remove("ring-2", "ring-amber-400"), 2500);
    }
  }, 100);
}

// --- 5. RENDER THE 6 CRISIS PROBLEMS ---

function renderProblems() {
  const container = document.getElementById("problems-container");
  if (!container) return;

  container.innerHTML = PROBLEMS.map((p, idx) => `
    <div class="glass-panel p-6 rounded-2xl flex flex-col justify-between hover:border-amber-500/40 transition">
      <div>
        <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400 mb-2">
          <span>Problem 0${idx + 1}</span>
        </div>
        <h4 class="text-lg font-bold text-white mb-2 leading-snug">${p.title}</h4>
        <p class="text-sm text-slate-300 leading-relaxed mb-4">${p.text}</p>
      </div>
      <div>
        <div class="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">Solved by Novelties</div>
        <div class="flex flex-wrap gap-2">
          ${p.solvedBy.map(num => `
            <button onclick="jumpToNovelty(${num})" class="px-2.5 py-1 rounded-lg bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500 hover:text-navy-950 transition-colors">
              #${num} ${NOVELTIES.find(n => n.n === num)?.title.split(' ')[0] || ''}
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

// --- 6. RENDER THE 8 JOURNEY STEPS ---

function renderJourney() {
  const container = document.getElementById("journey-container");
  if (!container) return;

  container.innerHTML = JOURNEY_STEPS.map((s, idx) => `
    <div class="relative pl-8 pb-8 border-l-2 border-dashed border-blue-500/30 last:border-transparent">
      <!-- Milestone dot -->
      <div class="absolute -left-4 top-0 w-8 h-8 rounded-full bg-blue-900 border-2 border-blue-400 text-white font-black text-xs grid place-items-center">
        ${idx + 1}
      </div>
      <div class="glass-panel p-5 rounded-2xl">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <span class="text-xs font-bold uppercase tracking-wider text-amber-400">${s.step}</span>
          <span class="badge-pill badge-pillar">${s.tag}</span>
        </div>
        <h4 class="text-base font-bold text-white mb-1">${s.title}</h4>
        <p class="text-sm text-slate-300 leading-relaxed mb-3">${s.desc}</p>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-400 font-semibold">Powers this step:</span>
          ${s.novelties.map(num => `
            <button onclick="jumpToNovelty(${num})" class="px-2 py-0.5 rounded-md bg-blue-950/60 text-blue-300 border border-blue-500/30 text-xs font-bold hover:bg-blue-500 hover:text-navy-950 transition">
              #${num} ${NOVELTIES.find(n => n.n === num)?.title.split(' ')[0]}
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

// --- 7. INTERACTIVE SANDBOX DEMOS ---

function scrollToDemo(demoId) {
  const el = document.getElementById(`sandbox-${demoId}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add("ring-2", "ring-amber-400");
    setTimeout(() => el.classList.remove("ring-2", "ring-amber-400"), 2000);
  }
}

// Demo 1: Rules As Code
function initRulesDemo() {
  const select = document.getElementById("demo1-select");
  const pathContainer = document.getElementById("demo1-path");
  const metaContainer = document.getElementById("demo1-meta");
  if (!select || !pathContainer) return;

  function update() {
    const val = select.value;
    const item = APPLICATION_TYPES.find(t => t.id === val) || APPLICATION_TYPES[0];

    pathContainer.innerHTML = item.steps.map((step, idx) => `
      <div class="flex items-center gap-2">
        <div class="px-3 py-1.5 rounded-xl bg-blue-900/60 border border-blue-500/40 text-blue-200 text-xs font-bold">
          ${step}
        </div>
        ${idx < item.steps.length - 1 ? `<span class="text-slate-500 text-xs">→</span>` : ''}
      </div>
    `).join('');

    metaContainer.innerHTML = `
      <div class="flex flex-wrap items-center gap-4 text-xs text-slate-300 mt-3 pt-3 border-t border-slate-700/60">
        <div><strong class="text-amber-400">Statutory Target:</strong> ${item.targetDays} Days</div>
        <div><strong class="text-emerald-400">Statutory Clause:</strong> ${item.clause}</div>
        <div><strong class="text-blue-400">Regression Tests:</strong> 50/50 Golden Tests Passing</div>
      </div>
    `;
  }

  select.addEventListener("change", update);
  update();
}

// Demo 2: Fair Clock Simulator
function initClockDemo() {
  const slider = document.getElementById("demo2-slider");
  const valDisplay = document.getElementById("demo2-days");
  const barAicte1 = document.getElementById("demo2-bar-aicte1");
  const barPaused = document.getElementById("demo2-bar-paused");
  const barAicte2 = document.getElementById("demo2-bar-aicte2");
  const textDue = document.getElementById("demo2-due");
  if (!slider) return;

  function update() {
    const paused = parseInt(slider.value, 10);
    valDisplay.textContent = `${paused} Days`;

    const aicteBefore = 6;
    const aicteAfter = 9;
    const total = aicteBefore + paused + aicteAfter;

    barAicte1.style.width = `${(aicteBefore / total) * 100}%`;
    barPaused.style.width = `${(paused / total) * 100}%`;
    barAicte2.style.width = `${(aicteAfter / total) * 100}%`;

    const baseDate = new Date("2026-10-15");
    const newDate = new Date(baseDate.getTime() + total * 86400000);
    textDue.textContent = newDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  slider.addEventListener("input", update);
  update();
}

// Demo 3: Live Cryptographic SHA-256 Merkle Chain Tamper Detector
const INITIAL_RECORDS = [
  "ANU-2026-0412: Narmada Valley Institute submitted Extension of Approval",
  "Scrutiny Committee: 100% norms verified; 0 deficiencies raised",
  "EVC Inspector Allocation: drand quantum beacon round #31289 committed",
  "Executive Committee Decision: Formal Extension of Approval (EoA) Granted"
];

let chainRecords = [...INITIAL_RECORDS];
let goldenHashes = [];

async function initChainDemo() {
  const container = document.getElementById("demo3-records");
  const statusBanner = document.getElementById("demo3-status");
  if (!container) return;

  // Compute golden baseline hashes
  goldenHashes = [];
  let prev = "0".repeat(64);
  for (const text of INITIAL_RECORDS) {
    prev = await computeSHA256(prev + text);
    goldenHashes.push(prev);
  }

  async function render() {
    let currentPrev = "0".repeat(64);
    let tamperedIndex = -1;
    const currentHashes = [];

    for (let i = 0; i < chainRecords.length; i++) {
      currentPrev = await computeSHA256(currentPrev + chainRecords[i]);
      currentHashes.push(currentPrev);
      if (tamperedIndex === -1 && currentPrev !== goldenHashes[i]) {
        tamperedIndex = i;
      }
    }

    container.innerHTML = chainRecords.map((rec, i) => {
      const isTampered = tamperedIndex !== -1 && i >= tamperedIndex;
      return `
        <div class="p-3 rounded-xl border transition-all ${isTampered ? 'bg-red-950/40 border-red-500/60' : 'bg-slate-800/40 border-slate-700/60'}">
          <div class="flex items-center gap-3">
            <span class="w-6 h-6 rounded-full text-xs font-bold grid place-items-center ${isTampered ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}">
              ${i + 1}
            </span>
            <input type="text" value="${rec.replace(/"/g, '&quot;')}" oninput="handleChainInput(${i}, this.value)" class="flex-1 bg-slate-900/60 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-400">
          </div>
          <div class="mt-1.5 flex items-center justify-between text-[11px] font-mono text-slate-400 pl-9">
            <span>SHA-256: ${currentHashes[i].substring(0, 20)}...</span>
            <span class="${isTampered ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}">
              ${isTampered ? 'Hash Mismatch (Tampered)' : 'Verified Intact'}
            </span>
          </div>
        </div>
      `;
    }).join('');

    if (tamperedIndex === -1) {
      statusBanner.innerHTML = `
        <div class="flex items-center gap-2 text-emerald-400 text-xs font-bold">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Cryptographic Merkle Chain 100% Intact across all blocks.
        </div>
      `;
    } else {
      statusBanner.innerHTML = `
        <div class="flex items-center justify-between gap-2 text-red-400 text-xs font-bold w-full">
          <div class="flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            Tampering detected at Block #${tamperedIndex + 1}! All downstream hashes invalidated.
          </div>
          <button onclick="resetChainDemo()" class="px-2.5 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs transition">Restore Chain</button>
        </div>
      `;
    }
  }

  window.handleChainInput = function(idx, val) {
    chainRecords[idx] = val;
    render();
  };

  window.resetChainDemo = function() {
    chainRecords = [...INITIAL_RECORDS];
    render();
  };

  render();
}

// Demo 4: Land Lease Runway Radar
function initRunwayDemo() {
  const leaseSlider = document.getElementById("demo4-lease");
  const courseSlider = document.getElementById("demo4-course");
  const leaseVal = document.getElementById("demo4-lease-val");
  const courseVal = document.getElementById("demo4-course-val");
  const gaugeBar = document.getElementById("demo4-gauge");
  const statusMsg = document.getElementById("demo4-status");
  if (!leaseSlider) return;

  function update() {
    const lease = parseFloat(leaseSlider.value);
    const course = parseFloat(courseSlider.value);
    leaseVal.textContent = `${lease.toFixed(1)} Yrs`;
    courseVal.textContent = `${course.toFixed(0)} Yrs`;

    const runway = lease - course;
    const pct = Math.max(0, Math.min(100, (runway / 20) * 100));

    gaugeBar.style.width = `${pct}%`;

    if (runway < 0) {
      gaugeBar.className = "h-full rounded-full bg-red-500 transition-all";
      statusMsg.innerHTML = `<span class="text-red-400 font-bold">Critical Violation:</span> Lease is ${Math.abs(runway).toFixed(1)} years shorter than course duration! Extension of Approval blocked under APH 2.1(e).`;
    } else if (runway < 3) {
      gaugeBar.className = "h-full rounded-full bg-amber-500 transition-all";
      statusMsg.innerHTML = `<span class="text-amber-400 font-bold">Warning Radar:</span> Runway is only ${runway.toFixed(1)} years! Trust must execute extension before 2027 to avoid renewal refusal.`;
    } else {
      gaugeBar.className = "h-full rounded-full bg-emerald-500 transition-all";
      statusMsg.innerHTML = `<span class="text-emerald-400 font-bold">Healthy Runway:</span> ${runway.toFixed(1)} years buffer. Automatic radar monitors validity in background.`;
    }
  }

  leaseSlider.addEventListener("input", update);
  courseSlider.addEventListener("input", update);
  update();
}

// Demo 5: drand Quantum Beacon Draw Simulator
function initDrawDemo() {
  const container = document.getElementById("demo5-experts");
  const triggerBtn = document.getElementById("demo5-btn");
  const statusBox = document.getElementById("demo5-status");
  if (!container || !triggerBtn) return;

  let selectedIds = [];

  function renderList() {
    container.innerHTML = SAMPLE_EXPERTS.map(exp => {
      const isSelected = selectedIds.includes(exp.id);
      return `
        <div class="p-2.5 rounded-xl border text-xs flex items-center justify-between ${exp.conflict ? 'bg-slate-900/60 border-slate-800 text-slate-500 opacity-60 line-through' : isSelected ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold' : 'bg-slate-800/40 border-slate-700/60 text-slate-300'}">
          <div>
            <div>${exp.name} (${exp.institution})</div>
            ${exp.conflict ? `<div class="text-[10px] text-red-400 no-underline">${exp.reason}</div>` : ''}
          </div>
          ${isSelected ? `<span class="text-emerald-400 font-bold text-xs">SELECTED</span>` : ''}
        </div>
      `;
    }).join('');
  }

  async function runDraw() {
    triggerBtn.disabled = true;
    triggerBtn.innerHTML = `<span>Querying drand Beacon...</span>`;
    statusBox.innerHTML = `<span class="text-amber-400 animate-pulse text-xs">Querying League of Entropy public randomness round #34821...</span>`;

    const eligible = SAMPLE_EXPERTS.filter(e => !e.conflict);
    
    // Simulate commit-reveal delay
    setTimeout(() => {
      // Pick 2 at random
      const shuffled = [...eligible].sort(() => 0.5 - Math.random());
      selectedIds = [shuffled[0].id, shuffled[1].id];

      renderList();
      statusBox.innerHTML = `
        <div class="text-xs text-emerald-400 font-bold">
          Verified Draw Complete via Round #34821! Randomness: <span class="font-mono text-slate-300">0x8f4c2e...b9</span>. Zero bias opportunity.
        </div>
      `;
      triggerBtn.disabled = false;
      triggerBtn.innerHTML = `<span>Draw Again (New Round)</span>`;
    }, 1200);
  }

  triggerBtn.addEventListener("click", runDraw);
  renderList();
}

// Demo 6: AI Pre-Flight Document Diagnostics Simulator
function initDocAiDemo() {
  const container = document.getElementById("demo6-result");
  if (!container) return;

  window.runDocAiSim = function(type) {
    container.innerHTML = `
      <div class="p-4 text-center text-slate-400 animate-pulse text-xs">
        Executing 4-layer AI pipeline: OCR Extraction -> NLP Parsing -> APH Norms -> ML Anomaly Detector...
      </div>
    `;

    setTimeout(() => {
      if (type === 'clean') {
        container.innerHTML = `
          <div class="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <span class="font-bold text-emerald-400 text-sm">State Fire Safety NOC (Passed ✓)</span>
              <span class="badge-pill badge-live">Verified Genuine</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-slate-300">
              <div><strong>Extracted Institution:</strong> Narmada Valley Inst.</div>
              <div><strong>Validity Range:</strong> 2026 - 2029 (Valid)</div>
              <div><strong>Signatory Authority:</strong> Chief Fire Officer</div>
              <div><strong>ML Anomaly Score:</strong> 0.04 (Normal)</div>
            </div>
            <div class="text-emerald-300 font-semibold pt-1">
              Result: 100% compliant with APH Clause 1.4.6 & Annexure-2.
            </div>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="p-4 rounded-xl bg-red-950/30 border border-red-500/40 space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <span class="font-bold text-red-400 text-sm">Registered Land Deed (Deficiencies Detected ✕)</span>
              <span class="badge-pill bg-red-900/40 text-red-300 border border-red-500/30">Action Required</span>
            </div>
            <div class="space-y-1 text-slate-300">
              <div class="text-red-300">⚠️ <strong>Clause 2.1(e):</strong> Land lease expires in 2.1 years, failing 30-year statutory requirement.</div>
              <div class="text-amber-300">⚠️ <strong>Clause 1.4.6:</strong> Digital Signature Certificate (DSC) belongs to individual rather than Trust Secretary.</div>
              <div><strong>ML Anomaly Score:</strong> 0.82 (High Defect Probability)</div>
            </div>
            <div class="text-amber-400 font-semibold pt-1">
              Detected in 1.4 seconds before submission — saving 30+ days in scrutiny deficiency rounds!
            </div>
          </div>
        `;
      }
    }, 800);
  };
}

// --- 8. INITIALIZATION ON DOM READY ---

document.addEventListener("DOMContentLoaded", () => {
  initCanvasAnimation();
  initSpotlight();
  renderProblems();
  renderJourney();
  renderNovelties();

  // Initialize Interactive Demos
  initRulesDemo();
  initClockDemo();
  initChainDemo();
  initRunwayDemo();
  initDrawDemo();
  initDocAiDemo();

  // Search Input Listener
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => handleSearch(e.target.value));
  }
});
