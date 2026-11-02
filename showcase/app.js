/**
 * ANUMATI · Team Anvaya — SIH 2026 Solution Showcase
 * Exact replica logic of frontend/src/pages/public/Solution.tsx & frontend/src/data/novelties.ts
 * Cleaned to present strictly Problems & Solutions with fluid animations.
 */

const NOVELTIES = [
  {
    n: 1,
    title: 'The handbook as tested rules',
    short: 'APH Table 2.3 runs as a versioned rule table with clause numbers and 50 golden tests.',
    area: 'Workflow',
    problem: 'The Approval Process Handbook is hundreds of pages of PDF. Different officers read the same rule differently, and institutions cannot predict which steps their request will go through.',
    solution: 'Table 2.3 (which request goes through which steps, with which documents and deadlines) is stored as a decision table, cell by cell, with its clause number. The workflow reads the table, so every file follows exactly the published rules.',
    how: [
      'Each cell of Table 2.3 becomes data with its clause, for all 22 request types.',
      'A change must pass 50 “golden” test cases and be approved by a Bureau head who did not write it; its impact on open files is shown first.',
      'Each file keeps the rule version it was submitted under, so a later change never moves the goalposts.'
    ],
    isNew: 'Today the rules live in PDFs and in people’s heads. Here a rule change is tested and previewed before it affects anyone.',
    source: 'OECD “Rules as Code”; OpenFisca (France)',
    status: 'live'
  },
  {
    n: 2,
    title: 'Fair deadline clocks',
    short: 'Every step has a clock that pauses while the institution owes a reply and escalates late files on its own.',
    area: 'Workflow',
    problem: 'Delays are invisible. When a file is late nobody can say whether AICTE or the institution caused it, and late files can sit unnoticed.',
    solution: 'Every step has a deadline from the rules. The clock pauses while the institution owes a reply and restarts when it answers; late files escalate by themselves, level by level, with the reason recorded.',
    how: [
      'Each step gets its target from Table 2.3: scrutiny 15 days, re-scrutiny 10, expert visit 30, hearing 15, Executive Committee 10.',
      'Raising a deficiency pauses the clock; the reply restarts it and moves the due date by exactly the paused days.',
      'A check every minute reminds the officer 7 days before and escalates late files: Regional officer, Bureau head, Member Secretary.'
    ],
    isNew: 'Delay is measured fairly on both sides, and no file can stall silently.',
    source: 'The “clock-stop” of the European Medicines Agency; Telangana TS-iPASS time limits',
    status: 'live',
    statusNote: 'Clocks are stored as data, so a server restart loses nothing.'
  },
  {
    n: 3,
    title: 'A map of where files wait',
    short: 'Process mining turns the evidence log into a map of where time is really lost, step by step and region by region.',
    area: 'Insight',
    problem: 'Management sees counts of pending files, not where time is lost or why one region is twice as slow as another.',
    solution: 'Every step leaves a time-stamped event. Process mining turns those events into a map: how long files wait at each step against its target, which routes they take, and how regions compare.',
    how: [
      'Every action writes a time-stamped event to the evidence log.',
      'Events are grouped per application, expert visit and document, because one approval involves all three.',
      'The map shows average wait against target for each step, where files go next, and the slowest regions.'
    ],
    isNew: 'Staffing and process decisions are based on what actually happened, not on opinions.',
    source: 'Object-centric process mining (PM4Py, OCEL 2.0 standard)',
    status: 'simpler',
    statusNote: 'Last cycle’s map is built from the sample history; today’s file counts on it are live. Mining the live log directly is the next step.'
  },
  {
    n: 4,
    title: 'Delay risk, with reasons',
    short: 'Every open file gets a chance of missing its deadline, and the reasons behind it, so officers act early.',
    area: 'Insight',
    problem: 'Officers learn that a file is late only after the deadline has passed.',
    solution: 'Every open file gets a risk of missing its deadline, together with the reasons behind the number, so officers can act early. The score only advises; it never decides.',
    how: [
      'It looks at days already spent in the step, the region’s queue, whether an expert visit is still to be scheduled, and deficiencies so far.',
      'Each reason’s share of the score is shown, so the number can be checked.',
      'The command centre lists the riskiest files first.'
    ],
    isNew: 'A prediction that explains itself, used only to prioritise work.',
    source: 'Survival analysis with SHAP explanations',
    status: 'simpler',
    statusNote: 'Today it is a weighted model with honest reasons. A survival model (Random Survival Forest) needs a few cycles of real history to train.'
  },
  {
    n: 5,
    title: 'A “Why?” on every automated action',
    short: 'Each reminder, escalation and rule check shows the rule, the clause and the data it used.',
    area: 'Trust',
    problem: 'Automated systems feel like a black box, and people cannot challenge what they cannot see.',
    solution: 'Every automated action (a reminder, an escalation, a rule check) carries a “Why?” chip that shows the rule, the handbook clause and the data that triggered it.',
    how: [
      'Each automated action stores the rule and clause it applied.',
      'The chip shows that reason in plain words.',
      'The same reason is kept in the evidence log, so it can be audited later.'
    ],
    isNew: 'Transparency is the default, not a request someone has to file.',
    source: 'Algorithmic transparency standards (UK); the EU AI Act’s transparency duties',
    status: 'live'
  },
  {
    n: 6,
    title: 'A log nobody can quietly change',
    short: 'Every action is chained with SHA-256 fingerprints; changing any old entry breaks the chain.',
    area: 'Trust',
    problem: 'Records can be changed quietly, and disputes come down to whose copy is right.',
    solution: 'Every action is written to an evidence log where each entry contains the fingerprint of the one before it. Changing any old entry breaks every later link. The database refuses edits, and anyone can re-check a chain.',
    how: [
      'Each action is saved with the SHA-256 fingerprint of the previous entry.',
      'The application’s database account cannot update or delete log entries; a database trigger stops even the owner.',
      'One click re-computes the chain and shows exactly where it breaks.'
    ],
    isNew: 'Proof of what happened, without the cost of a blockchain.',
    source: 'Certificate Transparency (RFC 6962); Crosby and Wallach’s tamper-evident logging',
    status: 'live',
    statusNote: 'Daily time-stamps from a trusted authority (RFC 3161) are the production step.'
  },
  {
    n: 7,
    title: 'Lease runway radar',
    short: 'Shows years of land lease left against the longest course, and warns long before renewal is blocked.',
    area: 'Compliance',
    problem: 'An institution’s land lease can quietly become shorter than its longest course. Nobody notices until renewal is refused.',
    solution: 'The radar compares the years of lease left with the longest course and warns years ahead, so the institution can register an extension in time.',
    how: [
      'The lease end date and the longest course come from the institution’s records.',
      'Runway = years of lease left − length of the longest course.',
      'Alerts start well before the Extension of Approval would be blocked.'
    ],
    isNew: 'A deadline that is usually discovered too late becomes visible years ahead.',
    source: 'APH 2.1(e) and 6.17',
    status: 'live'
  },
  {
    n: 8,
    title: 'Approved list for students and counselling bodies',
    short: 'A fake-college shield for the public, and an API that gives counselling bodies the approved intakes.',
    area: 'Trust',
    problem: 'Students lose fees to unapproved colleges, and state counselling bodies copy approval lists by hand.',
    solution: 'Anyone can search approved institutions, with warnings for unapproved and look-alike names. State counselling bodies read approved intakes directly through an API, so seat matrices use only approved numbers.',
    how: [
      'The list comes straight from the institution records ANUMATI keeps.',
      'The search flags names on AICTE’s unapproved list and names that imitate approved ones.',
      'Counselling bodies get the same list through an API with a token.'
    ],
    isNew: 'One source of truth for students, parents and counselling bodies.',
    source: 'Open government data; API Setu',
    status: 'live'
  },
  {
    n: 9,
    title: 'A fair, checkable expert draw',
    short: 'A public random number, fixed in advance, picks the expert panel; anyone can repeat the draw.',
    area: 'Fairness',
    problem: 'Expert panels can be questioned as hand-picked.',
    solution: 'AICTE publishes the shortlist and commits to a future public random number before it exists. When that number appears, it picks the panel. Anyone can repeat the draw and get the same experts.',
    how: [
      'A conflict-free shortlist of experts is prepared.',
      'A commitment is published: the shortlist’s fingerprint and the number of a future drand round.',
      'The round’s random value picks the experts, and anyone can re-run the draw.'
    ],
    isNew: 'Nobody, not even AICTE, can influence who visits.',
    source: 'drand, the League of Entropy’s public randomness beacon; commit-reveal protocols',
    status: 'live',
    statusNote: 'The shortlist uses clear rules; an optimising scheduler (OR-Tools CP-SAT) is the production step.'
  },
  {
    n: 10,
    title: 'Conflict-of-interest check',
    short: 'Experts linked to an institution are excluded from its panel, with the reason shown.',
    area: 'Fairness',
    problem: 'An expert with ties to an institution can end up judging it.',
    solution: 'Before the draw, experts with a link to the institution are taken out of the shortlist, and the reason is shown next to each excluded name.',
    how: [
      'Each expert’s links to institutions are recorded in the expert pool.',
      'Anyone linked to the institution is excluded before the shortlist is published, as are experts who are unavailable or fully booked.',
      'The exclusion and its reason go into the evidence log.'
    ],
    isNew: 'Conflicts are removed by rule, visibly, before anyone is chosen.',
    source: 'Good practice in peer review and public procurement',
    status: 'simpler',
    statusNote: 'Direct links are excluded today; a relationship graph across past visits and employers is the next step.'
  },
  {
    n: 11,
    title: 'Undertaking reader',
    short: 'Finds each promise and due date in an undertaking and tracks it as a condition with reminders.',
    area: 'Compliance',
    problem: 'Promises in undertakings (“six faculty will be appointed by July”) are signed once and then forgotten.',
    solution: 'Paste or upload an undertaking: ANUMATI finds each promise, its due date and clause. The institution confirms, and each promise becomes a tracked condition with reminders before the date.',
    how: [
      'The text is read for promises and dates.',
      'A person confirms each promise; nothing is tracked without that confirmation.',
      'Each confirmed promise appears in Compliance with reminders and escalation.'
    ],
    isNew: 'Promises become deadlines that are actually followed up.',
    source: 'Document AI (Docling) with a person in the loop',
    status: 'simpler',
    statusNote: 'Today it reads promises and dates with rules. An AI document reader, still confirmed by a person, is the production step.'
  },
  {
    n: 12,
    title: 'What-if simulator',
    short: 'Try more officers, more applications or a shifted date, and see how many files would finish on time.',
    area: 'Insight',
    problem: 'Staffing for the application rush is guesswork, and court-ordered date changes ripple in ways nobody can foresee.',
    solution: 'A model of the approval queue lets officials change officers per region, expected applications or a date shift, and see how many files would finish within target before deciding.',
    how: [
      'The model uses the step targets and the regions’ current queues.',
      'Change officers, applications or dates.',
      'See the share of files finishing on time, region by region.'
    ],
    isNew: 'Decisions about staff are tried on a model before they are tried on people.',
    source: 'Discrete-event simulation (digital twins of processes)',
    status: 'live',
    statusNote: 'A simplified queue model.'
  },
  {
    n: 13,
    title: 'Signature and file check on upload',
    short: 'Each PDF’s digital signature, type, password lock and viruses are checked the moment it is uploaded.',
    area: 'Workflow',
    problem: 'Unsigned or wrongly signed documents are found only at scrutiny, weeks later, which costs a whole round.',
    solution: 'Every PDF is checked the moment it is uploaded: a valid digital signature (DSC), no password lock, the right type and size, and a virus scan. Problems are fixed before submission.',
    how: [
      'The signature inside the PDF is validated, not just detected.',
      'Type, size, pages and password lock are checked, and the file is scanned for viruses.',
      'The result is shown at once, with the clause that requires it.'
    ],
    isNew: 'A mistake costs minutes, not a deficiency round.',
    source: 'pyHanko signature validation; APH 1.4.6',
    status: 'live'
  },
  {
    n: 14,
    title: 'Documents fetched from the source',
    short: 'Certificates come straight from the issuer through DigiLocker / API Setu instead of scanned uploads.',
    area: 'Trust',
    problem: 'Scanned certificates (NOCs, land records, accreditation) can be forged, and checking them by hand takes time.',
    solution: 'Documents are fetched directly from the issuing body through DigiLocker or API Setu, so they are genuine by construction.',
    how: [
      'The institution consents to fetch a document.',
      'It arrives signed by the issuer.',
      'Scrutiny sees it marked “verified at source”.'
    ],
    isNew: 'Verification moves from people checking scans to systems checking the source.',
    source: 'DigiLocker; API Setu',
    status: 'designed',
    statusNote: 'Needs AICTE’s onboarding as a DigiLocker requester. The screens show where it plugs in.'
  },
  {
    n: 15,
    title: 'Visit photos checked by GPS and date',
    short: 'Expert-visit photos count only if taken within 500 m of the campus on the visit date.',
    area: 'Fairness',
    problem: 'Photos from an expert visit can be reused from another place or another day.',
    solution: 'The GPS position and the time stored inside each photo are read. A photo is accepted only if it was taken within 500 metres of the campus on the visit date.',
    how: [
      'The photo’s location and time are read from the file.',
      'They are compared with the campus location and the visit date.',
      'Photos that fail are flagged, with the distance and date shown.'
    ],
    isNew: 'Evidence from a visit proves the visit happened.',
    source: 'The CAG audit of geotagged housing photos (PMAY-G)',
    status: 'live'
  },
  {
    n: 16,
    title: 'Risk-weighted surprise inspections',
    short: 'Riskier institutions are likelier to be picked, and the public random number decides.',
    area: 'Compliance',
    problem: 'Inspections are either predictable or seen as targeting.',
    solution: 'Institutions with more risk have a higher chance of being picked, and the public random number decides, so the choice is both smart and impossible to rig.',
    how: [
      'Each institution gets a weight from overdue and soon-due conditions, a short lease and its approval status.',
      'The weights are recorded with the draw, and about one pick in five is purely random, so no institution is ever safe.',
      'The drand random value picks the institutions; anyone can check the result.'
    ],
    isNew: 'Inspection effort goes where risk is, without anyone choosing targets.',
    source: 'OECD best-practice principles for regulatory inspections',
    status: 'live'
  },
  {
    n: 17,
    title: 'Every channel, every language',
    short: 'Alerts by email, SMS and WhatsApp; status on WhatsApp from the registered number; Hindi replies and read-aloud.',
    area: 'Reach',
    problem: 'Email-only alerts miss many institutions, and English-only notices exclude many people.',
    solution: 'Alerts go by email, SMS and WhatsApp. An institution can ask for a file’s status on WhatsApp or SMS from its registered number and get a reply in Hindi. Notices and answers can be read aloud.',
    how: [
      'Each person chooses their channels and language.',
      'Every alert is saved with the result of every channel, so nothing is lost.',
      'WhatsApp and SMS questions are answered, with status only for the registered number.'
    ],
    isNew: 'People are reached where they are, in their language.',
    source: 'Jugalbandi on Bhashini; DLT-registered SMS',
    status: 'simpler',
    statusNote: 'Email is really sent and WhatsApp/SMS replies work. Sending SMS and WhatsApp needs provider accounts; translation into 22 languages needs Bhashini.'
  },
  {
    n: 18,
    title: 'Ready for any regulator',
    short: 'Steps, deadlines and documents are data, so another regulator could run its own rules on the same platform.',
    area: 'Workflow',
    problem: 'If higher-education regulators merge into one body, systems built around one regulator have to be rebuilt.',
    solution: 'Request types, steps, deadlines, documents and the escalation ladder are data, not code, so another regulator can load its own rule table on the same platform.',
    how: [
      'Rules, steps and targets live in versioned tables.',
      'Roles and regions come from the sign-in system, not from the code.',
      'A new regulator means a new rule table and configuration.'
    ],
    isNew: 'The platform outlives a change in who regulates.',
    source: 'The proposed single higher-education regulator',
    status: 'designed',
    statusNote: 'Rules, steps and deadlines are already data; names, roles and branding would still need configuration.'
  },
  {
    n: 19,
    title: 'AI document verification at upload',
    short: 'OCR, NLP, rule-based and ML checks run on each uploaded document the moment it arrives — before submission.',
    area: 'Workflow',
    problem: 'Wrong, expired or mismatched documents are found at scrutiny, weeks after submission, costing a whole deficiency round. Institutions have no way to know whether their documents will pass until an officer reads them.',
    solution: 'The moment a PDF is uploaded, ANUMATI runs a four-layer pipeline — OCR (pdfminer / Tesseract), NLP field extraction, AICTE-rule checks specific to that document type, and an ML anomaly scorer. The result is shown inline on that document row: "verified ✓" or a list of specific issues with the APH clause, before the form is ever submitted.',
    how: [
      'OCR: pdfminer extracts text from digital PDFs; Tesseract reads scanned pages; multi-modal Document AI handles complex layouts.',
      'NLP + Rules: regex and dateparser extract institution name, course title, signatory and validity dates; AICTE-specific checks run per document type (Fire NOC, University NOC, Land deed, Affidavit, State NOC, Building plan, Faculty list).',
      'ML: a RandomForestClassifier trained on 800 synthetic AICTE documents (400 good, 400 bad) flags structurally incomplete or incorrect documents before they reach scrutiny — with 100% cross-validation accuracy on the training set.'
    ],
    isNew: 'Document errors are found in seconds at upload, not weeks later at scrutiny. Each issue names the APH clause and which engine found it, so the institution knows exactly what to fix.',
    source: 'pdfminer.six · Tesseract OCR 5 · scikit-learn RandomForestClassifier · Multi-Modal Document AI · APH Annexures 1, 2, 3',
    status: 'live'
  }
];

const PROBLEMS = [
  {
    title: 'Files wait without anyone noticing',
    text: 'No deadline per step, no early warning, no automatic escalation.',
    solvedBy: [2, 4, 3]
  },
  {
    title: 'Rules are long PDFs, read differently',
    text: 'Institutions cannot predict their path; officers apply the same rule differently.',
    solvedBy: [1, 5, 13, 19]
  },
  {
    title: 'Conditions are forgotten after approval',
    text: 'Undertakings, leases and documents expire without follow-up.',
    solvedBy: [7, 11, 16]
  },
  {
    title: 'People cannot trust what they see',
    text: 'Records can be disputed; fake colleges and forged letters circulate.',
    solvedBy: [6, 8, 14]
  },
  {
    title: 'Expert visits can be questioned',
    text: 'Who visits, and whether the visit really happened, is hard to prove.',
    solvedBy: [9, 10, 15]
  },
  {
    title: 'Alerts miss people; planning is guesswork',
    text: 'Email-only alerts, no view of bottlenecks, no way to test staffing.',
    solvedBy: [17, 3, 12]
  }
];

const JOURNEY = [
  {
    step: 'Prepare',
    text: 'The rules explorer shows the exact path and documents for the request; the form checks faculty norms as you type.',
    novelties: [1]
  },
  {
    step: 'Upload and submit',
    text: 'Each PDF’s signature is checked on upload; the self-check runs before final submission; a time-stamped receipt with a fingerprint is issued.',
    novelties: [19, 13, 6]
  },
  {
    step: 'Scrutiny',
    text: 'The clock starts. Officers see the delay risk and its reasons; every automated reminder explains itself.',
    novelties: [2, 4, 5]
  },
  {
    step: 'Deficiency and reply',
    text: 'The clock pauses while the institution fixes the documents and restarts when it replies.',
    novelties: [2]
  },
  {
    step: 'Expert visit',
    text: 'A conflict-free shortlist, a public random draw, and photos checked by GPS and date.',
    novelties: [10, 9, 15]
  },
  {
    step: 'Decision',
    text: 'Only the Executive Committee decides. The letter is signed and logged, anyone can verify it, and the public can check the approved list.',
    novelties: [6, 8]
  },
  {
    step: 'After approval',
    text: 'Undertakings become tracked conditions; the lease runway is watched; surprise inspections are drawn by risk; alerts reach every channel.',
    novelties: [11, 7, 16, 17]
  },
  {
    step: 'Improve the system',
    text: 'Management sees where files wait, tests staffing on a model, and changes rules safely, for any regulator.',
    novelties: [3, 12, 1, 18]
  }
];

const STATUS_CONFIG = {
  live: {
    label: 'Working now',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`
  },
  simpler: {
    label: 'Working, simpler version',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`
  },
  designed: {
    label: 'Designed, needs onboarding',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 3"><circle cx="12" cy="12" r="10"/></svg>`
  }
};

const AREAS = ['All', 'Workflow', 'Compliance', 'Fairness', 'Trust', 'Insight', 'Reach'];

// State
let activeArea = 'All';
const openNovelties = new Set([1]); // Novelty 1 open by default, exactly as in Solution.tsx

function getNoveltyByN(n) {
  return NOVELTIES.find(x => x.n === n);
}

// Render Problems
function renderProblems() {
  const container = document.getElementById('problems-container');
  if (!container) return;

  container.innerHTML = PROBLEMS.map(p => `
    <div class="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-card hover:border-teal-200 transition-colors">
      <p class="font-display text-base font-bold text-slate-900">${p.title}</p>
      <p class="mt-1 text-sm text-slate-500 leading-relaxed">${p.text}</p>
      <p class="mt-4 text-[11px] font-bold uppercase tracking-wider text-emerald-700">Solved by</p>
      <div class="mt-2 flex flex-wrap gap-1.5">
        ${p.solvedBy.map(n => {
          const nov = getNoveltyByN(n);
          return `
            <button onclick="jumpToNovelty(${n})" class="chip" title="Click to view novelty #${n}">
              <strong class="font-bold text-slate-900">#${n}</strong> ${nov ? nov.title : ''}
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
}

// Render Journey
function renderJourney() {
  const container = document.getElementById('journey-container');
  if (!container) return;

  container.innerHTML = JOURNEY.map((j, i) => `
    <li class="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-card hover:border-teal-200 transition-colors">
      <span class="absolute -left-[2.15rem] top-4 grid h-7 w-7 place-items-center rounded-full bg-teal-800 text-xs font-bold text-white ring-4 ring-white shadow-sm">
        ${i + 1}
      </span>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-slate-900 text-sm sm:text-base">${j.step}</p>
          <p class="mt-0.5 text-sm text-slate-600 leading-relaxed">${j.text}</p>
          <div class="mt-2.5 flex flex-wrap gap-1.5">
            ${j.novelties.map(n => {
              const nov = getNoveltyByN(n);
              return `
                <button onclick="jumpToNovelty(${n})" class="chip" title="Jump to Novelty #${n}">
                  <svg class="w-3 h-3 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
                  <strong class="font-bold text-slate-900">#${n}</strong> ${nov ? nov.title : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </li>
  `).join('');
}

// Render Area Filter Tabs
function renderAreaTabs() {
  const container = document.getElementById('area-tabs-container');
  if (!container) return;

  container.innerHTML = AREAS.map(a => {
    const isSelected = activeArea === a;
    const count = a === 'All' ? NOVELTIES.length : NOVELTIES.filter(x => x.area === a).length;
    return `
      <button
        onclick="setAreaFilter('${a}')"
        role="tab"
        aria-selected="${isSelected}"
        class="rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
          isSelected
            ? 'bg-teal-800 text-white shadow-sm'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }"
      >
        ${a}
        <span class="ml-1.5 opacity-75 font-normal">(${count})</span>
      </button>
    `;
  }).join('');
}

// Render Novelties List
function renderNovelties() {
  const container = document.getElementById('novelties-container');
  if (!container) return;

  const filtered = NOVELTIES.filter(x => activeArea === 'All' || x.area === activeArea);

  container.innerHTML = filtered.map(x => {
    const isOpen = openNovelties.has(x.n);
    const cfg = STATUS_CONFIG[x.status];

    return `
      <article
        id="n-${x.n}"
        class="novelty-card ${isOpen ? 'open' : ''}"
      >
        <!-- Card Accordion Header (Entire bar clickable) -->
        <button
          onclick="toggleNovelty(${x.n})"
          aria-expanded="${isOpen}"
          class="flex w-full items-start gap-4 p-5 text-left bg-white hover:bg-slate-50/50 transition-colors"
        >
          <!-- Saffron Number Square Badge -->
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 font-display text-sm font-black text-slate-950 shadow-sm">
            ${x.n}
          </span>

          <span class="min-w-0 flex-1">
            <span class="flex flex-wrap items-center gap-2">
              <span class="font-display text-lg font-bold text-slate-900 tracking-tight">${x.title}</span>
              <!-- Status Badge -->
              <span class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold border ${cfg.badgeClass}">
                ${cfg.icon}
                ${cfg.label}
              </span>
              <!-- Area Badge -->
              <span class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                ${x.area}
              </span>
            </span>
            <span class="mt-1 block text-sm text-slate-600 leading-relaxed">${x.short}</span>
          </span>

          <!-- Animated Chevron Toggle -->
          <svg class="chevron-icon mt-1.5 shrink-0 text-slate-400 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        <!-- Accordion Expandable Content -->
        <div class="accordion-body">
          <div class="accordion-inner">
            <div class="grid gap-6 border-t border-slate-100 bg-white px-5 pb-6 pt-5 lg:grid-cols-[1.3fr_1fr]">
              
              <!-- Left Column: Problem, Answer, How it works -->
              <div class="space-y-4">
                <!-- Problem Statement -->
                <section>
                  <h4 class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-700">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                    The problem
                  </h4>
                  <p class="mt-1 text-sm leading-relaxed text-slate-600">${x.problem}</p>
                </section>

                <!-- Our Answer -->
                <section>
                  <h4 class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
                    Our answer
                  </h4>
                  <p class="mt-1 text-sm leading-relaxed text-slate-900 font-medium">${x.solution}</p>
                </section>

                <!-- How it works -->
                <section>
                  <h4 class="text-xs font-bold uppercase tracking-wider text-teal-800">How it works</h4>
                  <ol class="mt-2 space-y-2">
                    ${x.how.map((step, idx) => `
                      <li class="flex gap-3 text-sm text-slate-600 leading-relaxed">
                        <span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-50 text-xs font-bold text-teal-800 border border-teal-200">
                          ${idx + 1}
                        </span>
                        <span class="pt-0.5">${step}</span>
                      </li>
                    `).join('')}
                  </ol>
                </section>
              </div>

              <!-- Right Column: What is new, Where the idea comes from, Status -->
              <aside class="space-y-3">
                <!-- What is new (Saffron tinted box) -->
                <div class="rounded-2xl bg-amber-50/80 border border-amber-100 p-4">
                  <p class="text-xs font-bold uppercase tracking-wider text-amber-800">What is new</p>
                  <p class="mt-1 text-sm text-slate-900 leading-relaxed">${x.isNew}</p>
                </div>

                <!-- Where the idea comes from (Slate tinted box) -->
                <div class="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                  <p class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
                    Where the idea comes from
                  </p>
                  <p class="mt-1 text-sm text-slate-600 leading-relaxed">${x.source}</p>
                </div>

                <!-- Status Card (Indgreen / Amber / Slate) -->
                <div class="rounded-2xl p-4 border ${
                  x.status === 'live'
                    ? 'bg-emerald-50/80 border-emerald-200'
                    : x.status === 'simpler'
                    ? 'bg-amber-50/80 border-amber-200'
                    : 'bg-slate-50 border-slate-200'
                }">
                  <span class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${
                    x.status === 'live' ? 'text-emerald-800' : x.status === 'simpler' ? 'text-amber-800' : 'text-slate-700'
                  }">
                    ${cfg.icon}
                    ${cfg.label}
                  </span>
                  ${x.statusNote ? `<p class="mt-1.5 text-sm text-slate-600 leading-relaxed">${x.statusNote}</p>` : ''}
                </div>
              </aside>

            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// Interactive Toggle Functions
function toggleNovelty(n) {
  if (openNovelties.has(n)) {
    openNovelties.delete(n);
  } else {
    openNovelties.add(n);
  }
  renderNovelties();
}

function openAllNovelties() {
  const filtered = NOVELTIES.filter(x => activeArea === 'All' || x.area === activeArea);
  filtered.forEach(x => openNovelties.add(x.n));
  renderNovelties();
}

function closeAllNovelties() {
  openNovelties.clear();
  renderNovelties();
}

function setAreaFilter(area) {
  activeArea = area;
  renderAreaTabs();
  renderNovelties();
}

// Jump directly to a novelty from problem chips or journey chips
function jumpToNovelty(n) {
  activeArea = 'All';
  openNovelties.add(n);
  renderAreaTabs();
  renderNovelties();

  setTimeout(() => {
    const el = document.getElementById(`n-${n}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.remove('card-highlight-pulse');
      void el.offsetWidth; // trigger reflow
      el.classList.add('card-highlight-pulse');
    }
  }, 50);
}

// GIGW Font Size Scaling
function setFontSize(step) {
  const scale = step === -1 ? 0.92 : step === 1 ? 1.08 : 1.0;
  document.documentElement.style.setProperty('--font-scale', scale);
  document.querySelectorAll('[data-font-btn]').forEach(btn => {
    btn.classList.remove('bg-white', 'text-slate-900');
    btn.classList.add('text-slate-300');
  });
  const activeBtn = document.querySelector(`[data-font-btn="${step}"]`);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-300');
    activeBtn.classList.add('bg-white', 'text-slate-900');
  }
}

// Scroll To Top Button logic
function initScrollToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// Handle URL hash on load (e.g., #n-7)
function handleInitialHash() {
  const hash = window.location.hash;
  const match = /^#n-(\d+)$/.exec(hash);
  if (match) {
    jumpToNovelty(Number(match[1]));
  }
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  renderProblems();
  renderJourney();
  renderAreaTabs();
  renderNovelties();
  initScrollToTop();
  handleInitialHash();
});
