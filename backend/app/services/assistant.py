"""Ask ANUMATI: answers from the handbook, the published rules, the calendar and, for a signed-in person, their own files.

How a question is answered, cheapest first:
1. Understand it. Spelling is corrected against the handbook's own words, and the question is checked for a file
   number, a request type, a glossary term or a date. A short follow-up ("and how long?") keeps the topic of the
   previous question.
2. Answer from records. A file's step and due date (only to people allowed to see that file), the documents, path
   and time of a request type, a meaning from the glossary, a date from the calendar, or counts from an officer's queue.
3. Otherwise find the best handbook passage (BM25 ranking over the curated answers, the glossary, notices and dates)
   and suggest related questions. A weak match says so instead of guessing.
4. Optional: with an AI API key, the LLM engine synthesizes the reply from the passages found above and cites them. If
   the AI engine is unavailable, slow or declines, the answer from steps 2-3 is used.

Rules decide; the assistant only explains. Visitors who are not signed in never see a file's status.
"""
import difflib
import logging
import math
import os
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import date

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings, today
from ..models import Application, ApplicationType, CalendarEvent, Deficiency, GlossaryTerm, Notice, Obligation, Region
from ..schemas import Principal
from ..security import can_see_application, region_scope

log = logging.getLogger("anumati.assistant")

STEP_LABEL = {"selfDisclosure": "Self-disclosure", "scrutiny": "Scrutiny", "evc": "Expert visit (EVC)", "shc": "Hearing (SHC)"}
STAGE_PLAIN = {
    "submitted": "submitted, waiting for scrutiny",
    "scrutiny": "at scrutiny (AICTE is checking the documents)",
    "rescrutiny": "at re-scrutiny (AICTE is checking your reply)",
    "evc": "at the expert visit (EVC) step",
    "shc": "at the hearing (SHC) step",
    "ec": "with the Executive Committee for a decision",
    "decision": "decided",
    "appeal": "under appeal with the Standing Appellate Committee",
}
OUTCOME = {"LoA": "Letter of Approval", "EoA": "Extension of Approval", "LoD": "Letter of Denial", "LoR": "Letter of Rejection"}

# Request types by the words people use for them (checked before the BM25 search).
TYPE_ALIASES = [
    (r"new (institution|college)|start (an? )?(new )?(institution|college)|establish|open (a|an) (new )?(college|institution)", "new"),
    (r"change (of|our|the) (site|location|campus)|(shift|move|relocate)\w* (the |our |my )?(campus|college|institution)|new (site|location|campus)|campus (move|shift)", "site"),
    (r"(increase|more|additional|extra)\w* .{0,25}(intake|seats?)|intake increase|additional course", "intake"),
    (r"\bnri\b", "nri"),
    (r"renew|extension of approval|\beoa\b|self.?disclosure", "eoa"),
    (r"new (programme|program|level)|start (a )?(new )?(programme|program|course)", "programme"),
    (r"course name|rename (a )?course|merge courses?|reduce (the )?intake", "coursename"),
    (r"institution name|rename (the )?(institution|college)|change (of )?(the )?(affiliating )?university", "name"),
    (r"close (the )?(institution|college)|closure of (the )?(institution|college)|shut (down )?(the )?(institution|college)", "closure"),
    (r"close (a )?(course|programme|program)|closure of (a )?(programme|program|course)", "closecourse"),
    (r"\bdual\b|integrated (degree|course)", "dual"),
    (r"merger|merge (two )?(institutions|colleges)", "merger"),
    (r"bank (details|account)|change (of|in) bank", "bankchange"),
    (r"foreign national|\boci\b|gulf|supernumerary", "supernumerary"),
    (r"twinning|collaboration", "collab"),
    (r"deemed", "deemed"),
    (r"\bodl\b|online learning|distance (learning|education)", "odl"),
    (r"women'?s? (institution|college)|co-?ed", "coed"),
    (r"diploma.{0,20}degree|degree.{0,20}diploma", "conversion"),
    (r"after a break|restoration", "break"),
    (r"\bfpm\b|fellow programme", "fpm"),
    (r"(trust|society|company) name", "trustname"),
]

# Curated answers: (id, ways people ask, answer, clauses, link, related ids, glossary terms it explains better).
FAQ: list[tuple] = [
    ("about", ["What is ANUMATI?", "What can you do?", "help me", "what is this portal", "how does this website work"],
     "ANUMATI is AICTE’s portal for approvals of technical institutions: applying, tracking each step with a fair clock, meeting conditions after approval, and verifying letters. I answer questions about the rules, documents, dates and appeals, with the handbook clause, and when you are signed in I can tell you about your own files.",
     [], ("/rules", "Explore the rules"), ["stages", "track", "documents_general"], []),
    ("appeal", ["How do I appeal?", "appeal against the decision", "my application was rejected what can I do", "can I challenge the decision", "denied approval"],
     "You can appeal once, within 7 days of the decision being uploaded. The Standing Appellate Committee (SAC) hears it, and the Council’s decision on the appeal is final. File it from the decided application’s page in My applications.",
     ["APH 1.11", "APH 2.24"], ("/institution/applications", "Open My applications"), ["decide", "letter", "stages"], ["SAC"]),
    ("clock", ["Why is my clock paused?", "deadline clock stopped", "what is the fair clock", "does waiting time count against AICTE", "paused application"],
     "The deadline clock stops whenever a file is waiting on your institution, for example after a deficiency is raised. It restarts the moment you reply, and the due date moves by exactly the days it was paused, so officials are measured only on their own time.",
     ["APH 1.8(f)"], None, ["deficiency", "escalation", "stages"], ["Fair clock"]),
    ("dsc", ["Who must sign the documents?", "digital signature DSC", "which signature is valid", "can the principal sign the documents", "unsigned document"],
     "Every uploaded document must carry the digital signature (DSC) of the Chairman or Secretary of the Trust, Society or Company that runs the institution, not of the principal or a head of department. Unsigned or wrongly signed documents are not valid; ANUMATI checks each signature as you upload.",
     ["APH 1.4.6"], ("/institution/documents", "Open the document vault"), ["file_rules", "self_check"], ["DSC"]),
    ("edit", ["Can I edit after submitting?", "change my application after final submission", "I made a mistake in the application", "reopen the application"],
     "After final submission the data is locked until processing ends. It can be reopened only once, with the competent authority’s approval and a late penalty. That is why the self-check runs before you submit.",
     ["APH 2.3.3(c)", "APH 2.3.3(e)"], ("/institution/apply", "Start an application"), ["self_check", "draft"], []),
    ("lease", ["What are the land lease rules?", "land requirement", "lease period", "lease runway", "how many years lease"],
     "Land must be owned or on a registered lease of at least 30 years. Extension of Approval stops from the year the remaining lease equals your longest course, so register a 30-year extension before then. The Compliance page shows your lease runway.",
     ["APH 2.1(e)", "APH 6.17"], ("/institution/compliance", "See your lease runway"), ["renewal", "compliance_evidence"], ["Lease runway"]),
    ("evc", ["What is an expert visit?", "how are experts chosen for the EVC", "inspection visit by experts", "expert committee visit"],
     "Where the rules require an expert visit (EVC), the panel is chosen automatically: experts with a conflict of interest are excluded, and a public random number fixed in advance picks the final panel, so anyone can repeat the draw. Visits can be physical, online or hybrid and are recorded with GPS-stamped photos.",
     ["APH 1.9"], None, ["drand", "photos", "stages"], ["EVC"]),
    ("ai", ["Does AI decide my application?", "is the decision automatic", "who takes the decision", "can a computer reject us"],
     "No. AI checks completeness before you submit, reads documents and estimates delays, always with its reasons. Every decision is taken and recorded by the competent authority: a Committee member or the Bureau head at the Executive Committee.",
     ["Human decision, APH 1.8"], None, ["decide", "self_check"], []),
    ("verify", ["How do I verify an approval letter?", "is this letter genuine", "check a letter is authentic", "fake approval letter"],
     "Every letter has a reference number, a QR code and a SHA-256 fingerprint recorded in a tamper-evident log, and is also issued as a signed digital credential. Enter the number or upload the letter on Verify a letter to check it.",
     ["ANUMATI evidence log"], ("/verify", "Verify a letter"), ["letter", "fake_college"], []),
    ("fees", ["What are the fees?", "processing fee", "how much does it cost to apply", "payment of charges"],
     "The processing charges depend on the request type and are listed in the handbook. Pay them through the portal before the last date; the receipt is kept with the application.",
     ["APH 1.4.2", "APH 2.3.2"], ("/rules", "Open the rules explorer"), ["dates_apply", "after_submit"], []),
    ("faculty", ["How many faculty do we need?", "student faculty ratio", "faculty cadre ratio", "teacher requirement", "how many professors"],
     "The norm is one faculty member for every 20 students (1:20). Across the cadre keep 1 Professor : 2 Associate Professors : 6 Assistant Professors. The faculty-norm calculator in New application works out the numbers for your intake.",
     ["APH Appendix 7"], ("/institution/apply", "Open the faculty calculator"), ["self_check", "integrity"], []),
    ("deficiency", ["How do I reply to a deficiency?", "my application was sent back", "AICTE asked for corrections", "what to do about a deficiency"],
     "Open the file in My applications, read each point AICTE raised, upload the corrected documents and send one reply. The clock is paused while AICTE waits for you and restarts when you reply. Answer everything at once: each round adds re-scrutiny time.",
     ["APH 1.8(f)"], ("/institution/applications", "Open My applications"), ["clock", "stages"], ["Deficiency"]),
    ("escalation", ["What happens if AICTE misses the deadline?", "late files escalation", "who is alerted when a file is late", "escalation ladder"],
     "The dealing officer is reminded 7 days before a file is due. Once it is late it escalates on its own: level 1 (Regional officer) at 1 to 2 days late, level 2 (Bureau head) at 3 to 6 days, level 3 (Member Secretary) at 7 days or more. Each step is logged with its reason.",
     ["APH 1.8", "ANUMATI escalation ladder"], None, ["clock", "stages"], []),
    ("stages", ["What are the stages of approval?", "target days for each stage", "approval process steps", "how long does each stage take", "how long does approval take"],
     "Each file goes through the steps its request type needs: scrutiny (target 15 days), re-scrutiny if documents need fixing (10), an expert visit (30) or hearing (15) when required, then the Executive Committee decision (10). An appeal is decided within 7 days. Time spent waiting on the institution is not counted.",
     ["APH Table 2.3"], ("/rules", "See the path for your request"), ["clock", "after_submit", "scrutiny"], []),
    ("scrutiny", ["What is scrutiny?", "what happens during scrutiny", "scrutiny stage meaning", "what is re-scrutiny"],
     "Scrutiny is the first check: an AICTE officer checks your documents and data against the handbook norms, with a target of 15 days. If something is missing a deficiency is raised and the clock pauses until you reply. The check of your reply is re-scrutiny, with a target of 10 days.",
     ["APH 1.8", "APH Table 2.3"], None, ["deficiency", "stages"], ["Scrutiny", "Re-scrutiny"]),
    ("after_submit", ["What happens after I submit?", "next steps after submission", "do I get a receipt after submitting"],
     "You get a time-stamped receipt with a SHA-256 fingerprint of exactly what you sent. The file then follows the path its request type needs: scrutiny, an expert visit or hearing if required, then the Executive Committee decision. You are alerted at every change.",
     ["APH 2.3.3", "APH Table 2.3"], ("/institution/applications", "Open My applications"), ["track", "stages"], []),
    ("track", ["How do I track my application?", "where can I see my application status", "check application status", "where is my file"],
     "Sign in to the institution portal and open My applications: each file shows its current step, the expected decision window and every action taken, and you can add its dates to your calendar. Visitors cannot see a file’s status.",
     [], ("/institution/applications", "Open My applications"), ["whatsapp", "notifications"], []),
    ("green", ["What is the green channel?", "fast track approval", "how can we get approval faster", "green lane"],
     "Files with a low delay risk and no deficiencies go through the green lane, so officers handle clean, complete applications first. Passing the self-check before you submit is the best way to qualify.",
     ["ANUMATI green channel"], ("/institution", "Open your dashboard"), ["self_check", "after_submit"], []),
    ("renewal", ["How do I renew approval?", "yearly extension of approval", "is renewal prefilled"],
     "Renewal is an Extension of Approval (EoA) by self-disclosure. ANUMATI pre-fills it from last year’s records, so you only confirm what changed. It is blocked if your remaining land lease is shorter than your longest course.",
     ["APH 2.1(e)"], ("/rules?type=eoa", "See the EoA rules"), ["lease", "dates_apply"], ["EoA", "Self-disclosure"]),
    ("fake_college", ["How do I know if a college is approved?", "fake college", "unapproved institutions list", "is this college genuine", "report a fake college"],
     "Search Approved institutions: it lists AICTE-approved colleges and warns about names on the unapproved list, including look-alike names. If something seems wrong, report it from the same page; reports go to AICTE.",
     [], ("/institutions", "Search approved institutions"), ["verify", "counselling"], []),
    ("counselling", ["approved list for counselling bodies", "API for state counselling", "download approved colleges list"],
     "State counselling bodies can read the approved list through ANUMATI’s approved-list API with a token, so seat matrices use only approved intakes. Anyone can search the same list on Approved institutions.",
     [], ("/institutions", "Approved institutions"), ["fake_college"], []),
    ("status_page", ["Is the portal down?", "service status", "website not working", "is the server slow"],
     "The Service status page shows the live health of every service, 90 days of uptime and when the submission rush is expected. You can subscribe there to maintenance and incident alerts by email or SMS.",
     [], ("/status", "Open service status"), ["dates_apply"], []),
    ("evidence_log", ["Can anyone change the records?", "is the data tamper proof", "what is the evidence log", "audit trail"],
     "Every action is written to an evidence log where each entry carries a SHA-256 fingerprint of the one before it, so changing any old entry breaks the chain. The database refuses edits to the log, and anyone can re-check a chain.",
     ["ANUMATI evidence log"], None, ["verify", "privacy"], ["Evidence log", "SHA-256"]),
    ("drand", ["How is the expert panel chosen fairly?", "random draw of experts", "what is drand"],
     "The draw uses a public random number from the drand beacon for a round fixed in advance. Nobody, AICTE included, can predict or bias it, and anyone can repeat the draw to check the result.",
     ["APH 1.9"], None, ["evc", "inspections"], ["drand"]),
    ("photos", ["How are visit photos checked?", "GPS photos of expert visit", "geotag check"],
     "Expert-visit photos are accepted only if their GPS position is within 500 metres of the campus and their date matches the visit, so photos cannot be reused from elsewhere.",
     ["APH 1.9"], None, ["evc"], []),
    ("undertaking", ["What is an undertaking?", "how do I track our promises to AICTE", "undertaking reader"],
     "An undertaking is a written promise to AICTE, for example to appoint faculty by a date. Paste or upload it in the Document vault: ANUMATI finds each promise and its due date, you confirm, and it is tracked in Compliance with reminders before each date.",
     ["APH 1.4"], ("/institution/documents", "Open the document vault"), ["compliance_evidence"], ["Undertaking"]),
    ("compliance_evidence", ["How do I upload proof for a condition?", "compliance evidence upload", "obligation due date", "conditions after approval"],
     "Open Compliance: every condition on your approval is listed with its due date. Choose Upload evidence on the item; AICTE checks it and marks it met. Missed dates escalate step by step.",
     ["APH 1.4"], ("/institution/compliance", "Open Compliance"), ["undertaking", "lease"], []),
    ("file_rules", ["What files can I upload?", "file size limit", "PDF upload size", "upload is failing"],
     "Upload PDFs only, up to 10 MB each. Each file is checked for viruses, password locks, page count and a valid digital signature before it is accepted, and every upload is kept as a new version with its fingerprint.",
     ["APH 1.4.6"], ("/institution/documents", "Open the document vault"), ["dsc"], []),
    ("signin", ["How do I sign in?", "login problem", "forgot password", "my session expired"],
     "Choose Sign in, then Institution or AICTE official. A session ends after 15 minutes without activity, with a warning first so you can stay signed in. Passwords and one-time codes are handled on the single sign-on page; your institution’s administrator can reset a password.",
     [], ("/login", "Sign in"), ["privacy"], []),
    ("accessibility", ["Can I make the text bigger?", "dark mode", "accessibility options", "screen reader support", "slow internet connection"],
     "Open Accessibility in the top bar: four text sizes, light, dark or device theme, high contrast, reading comfort, underlined links, reduced motion and a data saver for slow connections. My answers can also be read aloud.",
     ["GIGW 3.0", "WCAG 2.1 AA"], None, ["language"], []),
    ("language", ["Is this available in Hindi?", "other Indian languages", "translate the website"],
     "The interface is in English with Hindi labels, and answers can be read aloud. WhatsApp and SMS replies come in Hindi when you write in Hindi; full translation into Indian languages through Bhashini is planned.",
     [], None, ["whatsapp", "accessibility"], []),
    ("whatsapp", ["Can I check status on WhatsApp?", "SMS status updates", "updates on mobile"],
     "Yes. From the institution’s registered mobile number, send “ANU” and the last four digits of the file (for example “ANU 0412”) on WhatsApp or SMS to get its current step. You can ask rule questions there too.",
     [], None, ["notifications", "track"], []),
    ("notifications", ["How do I get alerts?", "email notifications", "change my alert settings"],
     "Alerts appear under the bell and on the Notifications page. Choose email, SMS or WhatsApp and your language there; every alert is also kept in the portal.",
     [], ("/institution/notifications", "Open Notifications"), ["whatsapp"], []),
    ("draft", ["Will I lose my application if the internet goes?", "save a draft", "does the form autosave"],
     "No. The application form saves a draft as you type, on the server and on your device, and a banner tells you when the connection drops. Continue from New application.",
     [], ("/institution/apply", "Continue your application"), ["edit", "self_check"], []),
    ("self_check", ["What is the AI self-check?", "check my application before submitting", "precheck"],
     "Before final submission ANUMATI checks your application against the rules for its type: missing documents, intake beyond the norms, unsigned files and similar problems, each with its clause. Fix them first, because the data locks after final submission.",
     ["APH 2.3.3(c)"], ("/institution/apply", "Start an application"), ["edit", "dsc"], []),
    ("privacy", ["Is my data safe?", "who can see our data", "privacy policy"],
     "Each institution sees only its own files and officers see files in their region; the database enforces the same rules. Faculty PAN numbers are stored only as a one-way hash, and visitors never see a file’s status.",
     [], ("/help", "Read the policies"), ["evidence_log"], []),
    ("calendar_ics", ["Add the dates to my calendar", "calendar file download", "reminders on my phone"],
     "Every date on the Academic calendar can be added to Google, Outlook or phone calendars as a file with a reminder 3 days before. Each application also offers its own deadlines file.",
     ["APH 1.10(c)"], ("/calendar", "Open the calendar"), ["dates_apply"], []),
    ("rules_version", ["Which rules apply to my application?", "the rules changed after I applied", "rule version"],
     "Each file keeps the rules version it was submitted under, even if the rules change later. A rule change is tested against 50 golden cases and must be approved by a Bureau head who did not write it.",
     ["APH Table 2.3"], ("/rules", "Open the rules explorer"), ["stages"], ["Golden tests"]),
    ("letter", ["Where is my approval letter?", "download the LoA", "approval certificate"],
     "When a decision is recorded, the letter (LoA, EoA and so on) appears on the file in My applications, with a QR code and fingerprint. It is also issued as a signed digital credential that anyone can verify.",
     [], ("/institution/applications", "Open My applications"), ["verify", "appeal"], []),
    ("decide", ["Who records the final decision?", "how is the decision recorded", "Executive Committee decision"],
     "Only a Committee member or the Bureau head can record the final decision, at the Executive Committee stage, with written reasons. The letter is then signed and can be verified by anyone.",
     ["APH 1.8"], None, ["appeal", "letter"], ["EC"]),
    ("queue", ["How do I use the work queue?", "bulk actions", "saved views in the queue", "focus mode"],
     "In the Work queue, filter by step, region and risk. Focus mode serves files in the order to work them; select several files for a bulk reminder or assignment, with 10 seconds to undo; and save your filters as views.",
     [], ("/aicte/queue", "Open the work queue"), ["escalation"], []),
    ("inspections", ["How are surprise inspections chosen?", "random inspection selection", "risk weighted inspection"],
     "Surprise inspections are drawn by a Bureau head or Regional officer: institutions with more risk have a higher chance, and the public drand number decides, so the draw can be checked by anyone.",
     ["ANUMATI inspection policy"], ("/aicte/compliance", "Open the compliance monitor"), ["drand"], []),
    ("integrity", ["duplicate faculty in two colleges", "same teacher listed twice", "faculty integrity check"],
     "Faculty integrity finds teachers listed full-time at more than one institution, matched on a one-way hash of the PAN. An officer can ask both institutions to explain.",
     [], ("/aicte/integrity", "Open faculty integrity"), ["faculty"], []),
    ("bottleneck", ["Where are files getting delayed?", "slowest stage", "bottleneck in the process"],
     "Bottleneck insights show how long files wait at each step and which regions are slowest. In the last cycle the slowest step was the expert visit, about 22 days on average, mostly waiting to be scheduled after the panel was drawn.",
     [], ("/aicte/insights", "Open bottleneck insights"), ["simulator"], []),
    ("simulator", ["What if we add more officers?", "what-if simulator", "staffing simulation"],
     "The What-if simulator models the queue: change officers per region, expected applications or a date shift and see how many files would finish within target.",
     [], ("/aicte/simulator", "Open the simulator"), ["bottleneck"], []),
    ("contact", ["How do I contact AICTE?", "helpdesk number", "make a complaint"],
     "Help lists the contacts and policies. For a question about your own file, reply on the file itself so it is recorded with the right officer.",
     [], ("/help", "Open Help"), ["track"], []),
    ("documents_general", ["What documents are needed?", "checklist of documents", "which papers to upload"],
     "The documents depend on the request type. Tell me which one, for example “documents for increase in intake”, or open the rules explorer to download its checklist.",
     ["APH Annexure-1/2"], ("/rules", "Open the rules explorer"), ["dsc", "file_rules"], []),
]
FAQ_BY_ID = {f[0]: f for f in FAQ}

_STOP_WORDS = (
    "a an the is are was were be been being am to of in on for and or with by at from as it its this that these those i we you "
    "my our your me us do does did can could should would will shall may might what which who whom whose when where why how "
    "please tell about there here have has had get got any some much many more most into than then them they he she his her if "
    "so just also want need know kindly sir madam hi hello let explain"
)
STOP = set(_STOP_WORDS.split())
SYNONYMS = {
    "college": "institution", "colleges": "institution", "institute": "institution", "seats": "intake", "seat": "intake",
    "docs": "document", "papers": "document", "paper": "document", "renewal": "eoa", "renew": "eoa", "extension": "eoa",
    "deadline": "due", "inspection": "visit", "experts": "expert", "sign": "signature", "signed": "signature", "dsc": "signature",
    "fee": "fees", "charges": "fees", "cost": "fees", "payment": "fees", "rejected": "reject", "refused": "reject",
    "denied": "reject", "login": "signin", "password": "signin", "teachers": "faculty", "teacher": "faculty", "staff": "faculty",  # nosec B105 (words, not secrets)
    "complaint": "contact", "fraud": "fake", "genuine": "verify", "authentic": "verify", "progress": "status", "stuck": "status",
    "delayed": "delay", "late": "delay", "condition": "obligation", "conditions": "obligation", "promise": "undertaking",
    "certificate": "letter", "approval": "approve", "approved": "approve", "lakh": "fees", "rupees": "fees",
}
DATE_WORDS = re.compile(r"\bwhen\b|\bdate\b|last day|deadline|\bby when\b|\btill\b|\buntil\b|schedule|calendar|open(s|ing)?\b|close(s|d)?\b|start(s)?\b")
DEFINE = re.compile(r"what (is|are|does|do)|meaning|means|mean\b|stand(s)? for|full form|define|definition|explain")
FOLLOW_UP = re.compile(r"^(and|also|what about|how about|then|so|ok(ay)?|it|that|this|those|them)\b|\b(it|that|this one|same)\b")
GREETING = re.compile(r"^\s*(hi|hello|hey|namaste|namaskar|good (morning|afternoon|evening))\b[\s!.?]*$")
THANKS = re.compile(r"^\s*(thanks?( you)?|thank u|thx|ok(ay)?|great|cool|got it|dhanyavad)\b[\s!.?]*$")
REF = re.compile(r"ANU[-\s]?(\d{4})[-\s]?(\d{4})", re.I)


@dataclass
class Answer:
    text: str
    bullets: list[str] = field(default_factory=list)
    cites: list[str] = field(default_factory=list)
    link: dict | None = None
    follow_ups: list[str] = field(default_factory=list)
    source: str = "handbook"  # handbook | records | ai
    confident: bool = True

    def out(self) -> dict:
        return {"text": self.text, "bullets": self.bullets, "cites": self.cites, "link": self.link, "followUps": self.follow_ups[:3], "source": self.source, "confident": self.confident}


@dataclass
class Passage:
    pid: str
    kind: str  # faq | glossary | calendar | notice | type
    title: str
    text: str
    cites: list[str]
    link: dict | None
    terms: Counter = field(default_factory=Counter)
    related: list[str] = field(default_factory=list)


def _link(to_label) -> dict | None:
    return {"to": to_label[0], "label": to_label[1]} if to_label else None


def _stem(w: str) -> str:
    for suf, rep in (("ations", "ate"), ("ation", "ate"), ("ings", ""), ("ing", ""), ("ies", "y"), ("ied", "y"), ("ed", ""), ("es", ""), ("s", "")):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            return w[: -len(suf)] + rep
    return w


def _tokens(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", text.lower().replace("’", "'"))
    return [_stem(SYNONYMS.get(w, w)) for w in words if w not in STOP and len(w) > 1]


def _fmt(d: date) -> str:
    return f"{d.day} {d.strftime('%b %Y')}"


def _days(d: date) -> str:
    n = (d - today()).days
    return "today" if n == 0 else f"in {n} day{'s' * (n != 1)}" if n > 0 else f"{-n} day{'s' * (n != -1)} ago"


class Index:
    """BM25 over the curated answers, the glossary, the calendar and notices; rebuilt when the data changes."""

    def __init__(self, passages: list[Passage]):
        self.passages = passages
        self.df: Counter = Counter()
        for p in passages:
            self.df.update(set(p.terms))
        self.avg = sum(sum(p.terms.values()) for p in passages) / max(1, len(passages))
        self.vocab = sorted(self.df)

    def correct(self, toks: list[str]) -> list[str]:
        fixed = []
        for t in toks:
            if t in self.df or len(t) < 4 or t.isdigit():
                fixed.append(t)
                continue
            near = difflib.get_close_matches(t, self.vocab, n=1, cutoff=0.8)
            fixed.append(near[0] if near else t)
        return fixed

    def search(self, toks: list[str], kinds: set[str] | None = None) -> list[tuple[float, Passage]]:
        n, k1, b = len(self.passages), 1.4, 0.7
        scored = []
        for p in self.passages:
            if kinds and p.kind not in kinds:
                continue
            length = sum(p.terms.values())
            s = 0.0
            for t in set(toks):
                f = p.terms.get(t, 0)
                if not f:
                    continue
                idf = math.log(1 + (n - self.df[t] + 0.5) / (self.df[t] + 0.5))
                s += idf * f * (k1 + 1) / (f + k1 * (1 - b + b * length / self.avg))
            if s > 0:
                scored.append((s, p))
        return sorted(scored, key=lambda x: -x[0])


_index: tuple[tuple, Index] | None = None


async def _load(session: AsyncSession) -> tuple[Index, list[ApplicationType], list[GlossaryTerm], list[CalendarEvent]]:
    global _index
    types = list((await session.execute(select(ApplicationType))).scalars())
    terms = list((await session.execute(select(GlossaryTerm))).scalars())
    events = list((await session.execute(select(CalendarEvent).order_by(CalendarEvent.date))).scalars())
    notices = list((await session.execute(select(Notice).order_by(Notice.date.desc()).limit(40))).scalars())
    key = (len(types), len(terms), tuple((e.id, e.date, e.end_date) for e in events), tuple(n.id for n in notices))
    if _index and _index[0] == key:
        return _index[1], types, terms, events
    passages = []
    for fid, asks, text, cites, link, related, _terms in FAQ:
        p = Passage(fid, "faq", asks[0], text, cites, _link(link), related=related)
        p.terms = Counter(_tokens((" ".join(asks) + " ") * 2 + text))
        passages.append(p)
    for g in terms:
        p = Passage(f"g:{g.key}", "glossary", f"What is {g.key}?", f"{g.key} ({g.full}): {g.meaning}", [g.clause] if g.clause else [], {"to": "/glossary", "label": "Open the glossary"})
        p.terms = Counter(_tokens(f"{g.key} {g.full} {' '.join(g.aliases or [])} " * 2 + g.meaning))
        passages.append(p)
    for e in events:
        when = _fmt(e.date) + (f" to {_fmt(e.end_date)}" if e.end_date else "")
        p = Passage(f"c:{e.id}", "calendar", e.label, f"{e.label}: {when}." + (f" Revised from {_fmt(e.revised_from)}: {e.revision_reason}" if e.revised_from else ""), [e.clause] if e.clause else [], {"to": "/calendar", "label": "Open the calendar"})
        p.terms = Counter(_tokens(f"{e.label} {e.label} date when"))
        passages.append(p)
    for nt in notices:
        p = Passage(f"n:{nt.id}", "notice", nt.title, f"{nt.title} ({_fmt(nt.date)}): {nt.summary}", [], {"to": "/notices", "label": "Open notices"})
        p.terms = Counter(_tokens(f"{nt.title} {nt.summary}"))
        passages.append(p)
    index = Index(passages)
    _index = (key, index)
    return index, types, terms, events


def _find_type(q: str, types: list[ApplicationType]) -> ApplicationType | None:
    hit = next((tid for pattern, tid in TYPE_ALIASES if re.search(pattern, q)), None)
    if hit:
        return next((t for t in types if t.id == hit), None)
    # Fall back to the closest type name, for wording the aliases do not cover.
    words = set(_tokens(q))
    best, score = None, 0.0
    for t in types:
        name = set(_tokens(t.name))
        overlap = len(words & name) / max(1, len(name))
        if overlap > score:
            best, score = t, overlap
    return best if score >= 0.6 else None


def _find_term(q: str, terms: list[GlossaryTerm]) -> GlossaryTerm | None:
    for g in sorted(terms, key=lambda g: -len(g.key)):
        names = [g.key, g.full, *(g.aliases or [])]
        if any(re.search(rf"(?<![a-z0-9]){re.escape(n.lower())}(?![a-z0-9])", q) for n in names if n):
            return g
    return None


def _path(t: ApplicationType) -> str:
    keys = [k for k in ("selfDisclosure", "scrutiny", "evc", "shc") if t.steps.get(k, "none") != "none"]
    return " → ".join([STEP_LABEL[k] + (" (if needed)" if t.steps[k] == "conditional" else "") for k in keys] + ["Executive Committee decision"])


def _type_answer(t: ApplicationType, q: str) -> Answer:
    link = {"to": f"/rules?type={t.id}", "label": "Open in the rules explorer"}
    asks = {
        "docs": f"What documents are needed for {t.name.lower()}?",
        "time": f"How long does {t.name.lower()} take?",
        "path": f"What are the steps for {t.name.lower()}?",
    }
    if re.search(r"document|paper|upload|need|require|checklist|submit|attach|what to (send|give)", q):
        return Answer(f"For “{t.name}” you will need these documents, each signed by the Trust’s Chairman or Secretary:", [f"{d['name']} ({d['clause']})" for d in t.documents], [t.clause, "APH Annexure-1/2"], {**link, "label": "Download the checklist"}, [asks["time"], asks["path"], "Who must sign the documents?"])
    if re.search(r"how long|time|days|duration|when will|how (fast|quick)|weeks|months", q):
        return Answer(f"“{t.name}” has a target of about {t.target_days} days. Its path: {_path(t)}. Days spent waiting on your institution, for example after a deficiency, are not counted.", [], [t.clause, "APH Table 2.3"], link, [asks["docs"], "Why is my clock paused?", "What happens if AICTE misses the deadline?"])
    return Answer(f"{t.summary} Its path: {_path(t)}, with a target of about {t.target_days} days.", [], [t.clause, "APH Table 2.3"], link, [asks["docs"], asks["time"], "Who must sign the documents?"])


def _calendar_answer(q: str, events: list[CalendarEvent]) -> Answer | None:
    hints = [
        (r"apply|application|submi|window|portal open|start", "Application window"),
        (r"decision|result|approv|outcome|letter", "Last date for approval decisions"),
        (r"appeal", "Appeals to SAC"),
        (r"expert|evc|visit|inspection", "Expert visits"),
        (r"hearing|shc", "Hearings"),
        (r"scrutiny", "Scrutiny"),
        (r"affiliat|universit", "Affiliation"),
        (r"notif", "notified"),
    ]
    for pattern, label in hints:
        if re.search(pattern, q):
            e = next((e for e in events if label.lower() in e.label.lower()), None)
            if e:
                if e.end_date:
                    span = f"from {_fmt(e.date)} to {_fmt(e.end_date)}"
                    tail = f"The last day is {_fmt(e.end_date)}, {_days(e.end_date)}." if e.end_date >= today() else f"It closed on {_fmt(e.end_date)}."
                    text = f"{e.label}: {span}. {tail}"
                else:
                    text = f"{e.label}: {_fmt(e.date)} ({_days(e.date)})."
                if e.revised_from:
                    text += f" This date was revised from {_fmt(e.revised_from)}: {e.revision_reason}"
                return Answer(text, [], [e.clause] if e.clause else ["AICTE academic calendar"], {"to": "/calendar", "label": "Open the calendar"}, ["Add the dates to my calendar", "How do I appeal?", "What are the stages of approval?"])
    return None


def _app_line(a: Application, types: dict[str, str]) -> str:
    name = types.get(a.type_id, a.type_id)
    if a.stage == "decision" or a.outcome:
        return f"{a.id} · {name}: decided ({OUTCOME.get(a.outcome or '', a.outcome or 'see the letter')})."
    if a.clock == "paused":
        return f"{a.id} · {name}: {STAGE_PLAIN.get(a.stage, a.stage)}; the clock is paused because AICTE is waiting for your reply."
    late = " It is past its due date, so it has been escalated." if a.clock == "breached" else ""
    return f"{a.id} · {name}: {STAGE_PLAIN.get(a.stage, a.stage)}, due {_fmt(a.due_on)} ({_days(a.due_on)}).{late}"


async def _institution_answer(session: AsyncSession, user: Principal, ref: str | None, types: list[ApplicationType]) -> Answer:
    names = {t.id: t.name for t in types}
    stmt = select(Application).where(Application.institution_id == user.institution_id).order_by(Application.submitted_on.desc())
    apps = list((await session.execute(stmt)).scalars())
    if ref:
        apps = [a for a in apps if a.id == ref]
        if not apps:
            return Answer(f"I can’t find {ref} among your institution’s files. Check the number, or open My applications.", [], [], {"to": "/institution/applications", "label": "Open My applications"}, ["How do I track my application?"], "records")
    if not apps:
        return Answer("Your institution has no applications yet. You can start one from New application; the form saves as you go.", [], [], {"to": "/institution/apply", "label": "Start an application"}, ["What documents are needed?", "What is the AI self-check?"], "records")
    bullets = [_app_line(a, names) for a in apps[:4]]
    open_defs = list((await session.execute(select(Deficiency).where(Deficiency.application_id.in_([a.id for a in apps]), Deficiency.status == "open"))).scalars())
    for d in open_defs[:3]:
        bullets.append(f"To fix on {d.application_id}: {d.text} ({d.clause})")
    nxt = (await session.execute(select(Obligation).where(Obligation.institution_id == user.institution_id, Obligation.status != "met").order_by(Obligation.due_on).limit(1))).scalar_one_or_none()
    if nxt and not ref:
        overdue = nxt.due_on < today()
        bullets.append(f"Next condition: {nxt.title}, {'overdue since' if overdue else 'due'} {_fmt(nxt.due_on)} ({_days(nxt.due_on)}). Upload proof in Compliance.")
    if ref:
        a = apps[0]
        last = a.history[-1] if a.history else None
        text = f"Here is where {a.id} stands." + (f" Last step: {last.action}, by {last.actor} on {last.at[:10]}." if last else "")
        link = {"to": f"/institution/applications/{a.id}", "label": f"Open {a.id}"}
    else:
        text = f"Your institution has {len(apps)} application{'s' * (len(apps) != 1)}. Here is where {'they stand' if len(apps) > 1 else 'it stands'}:"
        link = {"to": "/institution/applications", "label": "Open My applications"}
    ups = ["How do I reply to a deficiency?"] if open_defs else []
    return Answer(text, bullets, ["Your records in ANUMATI"], link, [*ups, "Why is my clock paused?", "What happens after I submit?"], "records")


async def _officer_answer(session: AsyncSession, user: Principal, q: str, ref: str | None, types: list[ApplicationType]) -> Answer:
    names = {t.id: t.name for t in types}
    if ref:
        a = await session.get(Application, ref)
        if not a or not can_see_application(user, a.institution_id, a.region):
            return Answer(f"{ref} is not a file you can see.", [], [], {"to": "/aicte/queue", "label": "Open the work queue"}, [], "records")
        bullets = [_app_line(a, names).replace("for your reply", "for the institution’s reply"), f"With {a.holder}; {a.deficiencies} deficienc{'y' if a.deficiencies == 1 else 'ies'} so far."]
        if a.risk >= 0.25 and a.risk_reasons:
            bullets.append(f"Delay risk {round(a.risk * 100)}%, mainly: " + "; ".join(str(r.get("factor", "")) if isinstance(r, dict) else str(r) for r in a.risk_reasons[:2]).lower())
        return Answer(f"{a.id} ({a.region}):", bullets, ["Evidence log"], {"to": f"/aicte/applications/{a.id}", "label": f"Open {a.id}"}, ["Who records the final decision?", "What happens if AICTE misses the deadline?"], "records")
    stmt = select(Application).where(Application.stage != "decision", Application.outcome.is_(None))
    scope = region_scope(user)
    if scope:
        stmt = stmt.where(Application.region == scope)
    else:
        regions = list((await session.execute(select(Region))).scalars())
        named = next((r for r in regions if re.search(rf"\b({re.escape(r.id.lower())}|{re.escape(r.office.lower())}|{re.escape(r.name.lower())})\b", q)), None)
        if named:
            stmt, scope = stmt.where(Application.region == named.id), named.id
    files = list((await session.execute(stmt)).scalars())
    late = sorted((a for a in files if a.clock == "breached"), key=lambda a: a.due_on)
    risky = [a for a in files if a.risk >= 0.5 and a.clock != "breached"]
    paused = [a for a in files if a.clock == "paused"]
    soon = [a for a in files if a.clock == "running" and 0 <= (a.due_on - today()).days <= 7]
    where = f" in {scope}" if scope else ""
    bullets = [
        f"{len(files)} open files{where}.",
        f"{len(late)} past their due date (escalated automatically); {len(soon)} due within 7 days.",
        f"{len(risky)} likely to miss their deadline (risk 50% or higher); {len(paused)} paused, waiting on the institution.",
    ]
    bullets += [f"Most overdue: {a.id} · {names.get(a.type_id, a.type_id)}, due {_fmt(a.due_on)} ({_days(a.due_on)}), with {a.holder}." for a in late[:3]]
    return Answer(f"Your queue{where} right now:", bullets, ["Live queue"], {"to": "/aicte/queue", "label": "Open the work queue"}, ["What happens if AICTE misses the deadline?", "Where are files getting delayed?", "How do I use the work queue?"], "records")


DEFAULT_UPS = ["What are the stages of approval?", "What documents are needed?", "How do I appeal?"]
FACET = re.compile(r"document|paper|need|require|checklist|how long|time|days|duration|step|path|process")


def _ups(hits: list[tuple[float, Passage]], skip: str = "") -> list[str]:
    """Related questions: well-matched curated answers, or the common starting points."""
    ups = [p.title for s, p in hits if p.kind == "faq" and s >= 2.0 and p.title != skip]
    return ups[:3] or DEFAULT_UPS


def _strong(hits: list[tuple[float, Passage]], toks: list[str]) -> bool:
    if not hits:
        return False
    score, best = hits[0]
    return score >= 2.2 and len(set(toks) & set(best.terms)) / max(1, len(set(toks))) >= 0.3


def _passage_answer(p: Passage, hits: list[tuple[float, Passage]], confident: bool = True) -> Answer:
    ups = [FAQ_BY_ID[r][1][0] for r in p.related if r in FAQ_BY_ID] if p.kind == "faq" else _ups(hits, p.title)
    return Answer(p.text, [], [c for c in p.cites if c], p.link, ups, "handbook", confident)


async def _local(session: AsyncSession, user: Principal | None, question: str, history: list[str]) -> tuple[Answer, list[Passage]]:
    index, types, terms, events = await _load(session)
    q = re.sub(r"\s+", " ", question.lower().replace("’", "'")).strip()
    q_type, q_term = _find_type(q, types), _find_term(q, terms)
    toks = index.correct(_tokens(q))
    hits = index.search(toks)
    strong = _strong(hits, toks)
    # A follow-up with no topic of its own keeps the previous question's topic ("and how long does it take?").
    follow_up = bool(history) and not q_type and not q_term and bool(FOLLOW_UP.search(q) or (len(q.split()) <= 3 and not strong))
    context = f"{history[-1].lower()} {q}" if follow_up else q
    if GREETING.match(q):
        who = "your institution’s files" if user and user.portal == "institution" else "the queue" if user else "approval rules"
        return Answer(f"Namaste! Ask me about {who}, documents, dates or appeals. I answer from the handbook, with its clause.", [], [], None, ["What are the stages of approval?", "What documents are needed?", "How do I appeal?"]), []
    if THANKS.match(q):
        return Answer("Glad to help. Ask me anything else about approvals.", [], [], None, ["What happens after I submit?", "How do I track my application?"]), []

    m = REF.search(question) or (REF.search(history[-1]) if follow_up else None)
    ref = f"ANU-{m.group(1)}-{m.group(2)}" if m else None
    mine = re.search(r"\b(my|our|we|us)\b", q) and re.search(r"applica|file|status|deficien|due|pending|stage|progress|obligation|condition|where|track|stuck|update|clock|paused", q)
    if user and user.portal == "institution" and (ref or mine):
        return await _institution_answer(session, user, ref, types), []
    if user and user.portal == "aicte" and (ref or re.search(r"how many|count|number of|which files|list (the )?files|show( me)?|pending|backlog|overdue|at risk|risky|my queue|queue (today|now)|due (this|next) week", q)) and not re.match(r"(what happens|why|how do|how does|how are)", q):
        return await _officer_answer(session, user, q, ref, types), []
    if ref:
        return Answer("I can’t share a file’s status here. Sign in to the institution portal, or send “ANU” and the last four digits on WhatsApp from the institution’s registered number.", [], [], {"to": "/login", "label": "Sign in"}, ["How do I track my application?", "Can I check status on WhatsApp?"]), []

    if follow_up and not strong:
        toks = index.correct(_tokens(context))
        hits = index.search(toks)
        strong = _strong(hits, toks)
    top = [p for _, p in hits[:6]]

    if DATE_WORDS.search(q) and not re.search(r"how long|how many days", q):
        cal = _calendar_answer(q, events)
        if cal:
            return cal, top
    if q_term and (DEFINE.search(q) or len(q.split()) <= 3):
        g = q_term
        # Abbreviations are spelt out first ("LoD means Letter of Deficiency."); plain words go straight to the meaning.
        meaning = f"{g.key} means {g.full}." if sum(c.isupper() for c in g.key) >= 2 else ""
        better = next((f for f in FAQ if g.key in f[6]), None)
        if better and not re.search(r"full form|stand(s)? for", q):
            a = _passage_answer(next(p for p in index.passages if p.pid == better[0]), hits)
            if meaning and g.full.lower() not in a.text.lower():
                a.text = f"{meaning} {a.text}"
            return a, top
        related = index.search(_tokens(f"{g.full} {g.meaning}"), kinds={"faq"})
        return Answer(f"{meaning} {g.meaning}".strip(), [], [g.clause] if g.clause else [], {"to": "/glossary", "label": "Open the glossary"}, _ups(related)), top
    # A request type named in this question; or, for a follow-up asking what/how long/which steps, the previous one.
    t = q_type or (_find_type(context, types) if follow_up and (FACET.search(q) or not strong) else None)
    if t and not re.search(r"appeal|sign|signature|dsc|lease|fee|edit|after submi", q):
        return _type_answer(t, q if q_type or FACET.search(q) else context), top
    if strong:
        return _passage_answer(hits[0][1], hits[1:]), top
    return Answer("I’m not sure I understood that, and I won’t guess about rules. Did you mean one of these? You can also ask about a request type, a term such as EoA, or a date.", [], [], {"to": "/glossary", "label": "Browse the glossary"}, _ups(hits), "handbook", False), top


# ---------------------------------------------------------------- optional: AI synthesis from verified sources

SYSTEM = """You are Ask ANUMATI, the help assistant on ANUMATI, the AICTE portal for approvals of technical institutions in India.
Answer the question using only the numbered sources given with it. Write plain, friendly English (or Hindi if the person wrote in Hindi), in at most about 120 words. Use short lines starting with "- " only for lists.
After each fact, cite its source number in square brackets, like [2].
If the sources do not answer the question, say so in one sentence and suggest a related question or page. Never guess rules, dates, fees, numbers or the status of a file.
Rules and officials decide; you only explain. Never promise an outcome."""
FALLBACK_MODELS = {"neural-assistant-v1", "neural-assistant-v2", "neural-assistant-fable", "neural-assistant-fast"}
_client: anthropic.AsyncAnthropic | None = None


def ai_enabled() -> bool:
    return bool(settings.ai_api_key or settings.anthropic_api_key or os.environ.get("ANUMATI_AI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY"))


def _ai() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        # api_key=None lets the SDK read ANTHROPIC_API_KEY from the environment.
        api_key = settings.ai_api_key or settings.anthropic_api_key or os.environ.get("ANUMATI_AI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY") or None
        _client = anthropic.AsyncAnthropic(api_key=api_key, timeout=settings.assistant_timeout_seconds, max_retries=1)
    return _client


async def _ai_synthesize(question: str, history: list[str], local: Answer, passages: list[Passage]) -> Answer | None:
    sources: list[tuple[str, list[str], dict | None]] = []
    if local.source == "records" or local.confident:
        sources.append((local.text + ("\n" + "\n".join(f"- {b}" for b in local.bullets) if local.bullets else ""), local.cites, local.link))
    for p in passages:
        if p.text not in (s[0] for s in sources):
            sources.append((f"{p.title}: {p.text}" if p.kind == "faq" else p.text, p.cites, p.link))
    sources = sources[:7]
    if not sources:
        return None
    listing = "\n".join(f"[{i}] {text}" + (f" (clauses: {', '.join(c)})" if c else "") for i, (text, c, _) in enumerate(sources, 1))
    earlier = "\n".join(f"- {h}" for h in history[-3:])
    prompt = f"Sources:\n{listing}\n\n" + (f"Earlier questions in this chat:\n{earlier}\n\n" if earlier else "") + f"Question: {question}"
    kwargs = {"model": settings.assistant_model, "max_tokens": 4000, "output_config": {"effort": "low"}, "system": SYSTEM, "messages": [{"role": "user", "content": prompt}]}
    try:
        if settings.assistant_model in FALLBACK_MODELS:
            resp = await _ai().beta.messages.create(**kwargs, betas=["server-side-fallback-2026-07-01"], fallbacks="default")
        else:
            resp = await _ai().beta.messages.create(**kwargs)
    except anthropic.AuthenticationError:
        log.warning("assistant: the AI API key was rejected; answering from the handbook")
        return None
    except anthropic.RateLimitError:
        log.warning("assistant: AI service rate limit reached; answering from the handbook")
        return None
    except anthropic.APITimeoutError:
        log.warning("assistant: AI engine took longer than %ss; answering from the handbook", settings.assistant_timeout_seconds)
        return None
    except anthropic.APIConnectionError as e:
        log.warning("assistant: could not reach AI service (%s); answering from the handbook", e)
        return None
    except anthropic.APIStatusError as e:
        log.warning("assistant: AI service returned %s; answering from the handbook", e.status_code)
        return None
    if resp.stop_reason == "refusal":
        return None
    reply = "".join(b.text for b in resp.content if b.type == "text").strip()
    if not reply:
        return None
    used = sorted({int(n) for n in re.findall(r"\[(\d+)\]", reply) if 0 < int(n) <= len(sources)})
    reply = re.sub(r"\s*\[\d+(?:,\s*\d+)*\]", "", reply)
    lines = [ln.strip() for ln in reply.splitlines() if ln.strip()]
    bullets = [ln[2:].strip() for ln in lines if ln.startswith(("- ", "• "))]
    text = " ".join(ln for ln in lines if not ln.startswith(("- ", "• ")))
    cites = list(dict.fromkeys(c for i in used for c in sources[i - 1][1] if c))
    link = next((sources[i - 1][2] for i in used if sources[i - 1][2]), local.link)
    return Answer(text or "Here is what I found:", bullets, cites, link, local.follow_ups, "ai", True)


async def respond(session: AsyncSession, user: Principal | None, question: str, history: list[str] | None = None) -> dict:
    history = [h for h in (history or []) if h.strip()][-4:]
    local, passages = await _local(session, user, question, history)
    if ai_enabled() and (passages or local.source == "records"):
        written = await _ai_synthesize(question, history, local, passages)
        if written:
            return written.out()
    return local.out()
