"""
ANUMATI AI Document Quality Classifier — Training Script
=========================================================

Generates realistic synthetic AICTE document texts (good and bad examples for each
document type), extracts feature vectors using the same pipeline as production
(doc_ai._feature_vector), trains a RandomForestClassifier with cross-validation,
prints an evaluation report, and saves the trained model to:

    backend/app/models/doc_ai_clf.joblib

Run from the backend/ directory:
    .venv/Scripts/python.exe scripts/train_doc_ai_model.py
"""

from __future__ import annotations

import json
import os
import random
import sys
from pathlib import Path
from textwrap import dedent

# -- ensure app package is importable -----------------------------------------
sys.path.insert(0, str(Path(__file__).parent.parent))
from app.services.doc_ai import _feature_vector  # noqa: E402

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.metrics import classification_report
import joblib

SEED = 42
random.seed(SEED)
OUT_PATH = Path(__file__).parent.parent / "app" / "models" / "doc_ai_clf.joblib"
META_PATH = Path(__file__).parent.parent / "app" / "models" / "doc_ai_clf_meta.json"

# -----------------------------------------------------------------------------
# 1. SYNTHETIC DOCUMENT GENERATORS
# -----------------------------------------------------------------------------

INSTITUTION_NAMES = [
    "ANUMATI Technical College, Nagpur",
    "Narmada Valley Institute of Technology, Bhopal",
    "Shri Ram College of Engineering, Indore",
    "Saraswati Institute of Technology, Pune",
    "Modern Engineering College, Nashik",
    "Vidarbha Technical University, Amravati",
    "Government College of Engineering, Aurangabad",
    "Deccan College of Technology, Hyderabad",
    "Sunrise Institute of Technology, Raipur",
    "Central India College of Engineering, Nagpur",
]

COURSES = [
    "B.Tech CSE (AI & ML)",
    "B.Tech Computer Engineering",
    "B.Tech Electronics and Communication",
    "B.Tech Mechanical Engineering",
    "M.Tech Computer Science",
    "MBA (Technology Management)",
    "B.Tech Civil Engineering",
    "B.Tech Electrical Engineering",
]

YEARS = ["2024", "2025", "2026"]
FUTURE_DATES = [
    "31/12/2026", "30/06/2027", "31/03/2027", "31/12/2027",
    "15/08/2028", "01/01/2028", "30/09/2027", "31/05/2028",
]
PAST_DATES = [
    "31/12/2023", "30/06/2022", "31/03/2021", "15/08/2020",
    "01/01/2019", "30/09/2023", "31/05/2022", "28/02/2023",
]
FIRE_OFFICERS = [
    "Chief Fire Officer, Nagpur Municipal Corporation",
    "District Fire Officer, Pune District",
    "Divisional Fire Officer, Bhopal Fire Department",
    "Senior Fire Safety Inspector, Indore Municipal Corporation",
    "Fire Safety Commissioner, Greater Hyderabad Municipality",
]
REGISTRARS = [
    "Registrar, Rajiv Gandhi Technical University, Bhopal",
    "Deputy Registrar, University of Pune",
    "Registrar, Dr. Babasaheb Ambedkar Technological University, Lonere",
    "Joint Registrar, JNTU Hyderabad",
    "Registrar, Nagpur University",
]
SECRETARIES = [
    "Secretary, Narmada Valley Education Society",
    "Chairman, Saraswati Educational Trust",
    "Secretary, Shri Ram Education Foundation",
    "Managing Trustee, Modern Educational Society",
    "Secretary, Sunrise Education Trust",
]
NOTARIES = [
    "Notary Public, District Court Nagpur",
    "Oath Commissioner, Bhopal High Court",
    "Judicial Magistrate First Class, Pune",
    "Notary Public, Indore District Court",
    "Sworn before: Notary Public, Hyderabad",
]
PANCHAYATS = [
    "Nagpur Municipal Corporation",
    "Pune Municipal Corporation",
    "Bhopal Municipal Corporation",
    "Indore Municipal Corporation",
    "Nagpur Improvement Trust",
]
FIRE_EQUIP = [
    "Fire Alarm System: Installed and operational",
    "Fire Extinguishers: 45 units as per norms",
    "Automatic Sprinkler System: Active",
    "Fire Hydrant System: Fully operational",
    "Emergency Exit Signage: Provided on all floors",
    "Fire Escape Staircases: Clear and unobstructed",
    "Smoke Detectors: Installed throughout the building",
    "Public Address System: Functional",
]


def _pick(lst): return random.choice(lst)
def _picks(lst, n): return "\n".join(random.sample(lst, min(n, len(lst))))
def _inst(): return _pick(INSTITUTION_NAMES)
def _course(): return _pick(COURSES)
def _date_future(): return _pick(FUTURE_DATES)
def _date_past(): return _pick(PAST_DATES)
def _yr(): return _pick(YEARS)


# -- GOOD documents ------------------------------------------------------------

def good_fire_noc() -> str:
    inst = _inst()
    return dedent(f"""
        GOVERNMENT OF MAHARASHTRA — FIRE AND EMERGENCY SERVICES
        District Office · Certificate No: FS/NGP/{_yr()}/{random.randint(1000, 9999)}

        FIRE SAFETY NOC CERTIFICATE

        This is to certify that {inst} has complied with all fire safety
        requirements as per the Maharashtra Fire Prevention and Life Safety
        Measures Act 2006.

        The following fire safety installations have been verified and found satisfactory:
        {_picks(FIRE_EQUIP, 5)}

        Campus area inspected: {random.uniform(1.5, 10.0):.2f} acres
        Number of blocks: {random.randint(3, 10)}   Total floors: {random.randint(2, 6)}

        This certificate is valid from: {random.randint(1,28)} January {_yr()}
        Valid until: {_date_future()}

        Issued by: {_pick(FIRE_OFFICERS)}
        Stamp and Signature of the Competent Authority
        Date: {random.randint(1,28)} March {_yr()}

        Note: This certificate must be renewed before the expiry date.
        Non-renewal may result in cancellation of the institution's approval.
        Reference: AICTE APH Annexure-1, Clause 2.1(f)
    """).strip()


def good_uni_noc() -> str:
    inst = _inst()
    course = _course()
    intake = random.choice([30, 60, 90, 120, 180])
    return dedent(f"""
        OFFICE OF THE REGISTRAR
        {_pick(REGISTRARS)}
        Ref No: UNIV/NOC/{_yr()}/{random.randint(100, 999)}

        No Objection Certificate — Affiliation Letter

        This is to certify that {inst} is affiliated to this University
        and has been granted affiliation for the following programme:

        Programme: {course}
        Approved intake: {intake} seats per academic year
        Duration: 4 years (8 semesters)
        Level: Under-Graduate (UG)

        The affiliation has been granted subject to the institution maintaining
        all prescribed norms and standards. The institution must ensure adequate
        faculty, infrastructure and facilities as per the University norms.

        This NOC is valid until: {_date_future()}

        Signed by: {_pick(REGISTRARS)}
        Date: {random.randint(1,28)} February {_yr()}
        University Seal

        This letter is issued for the purpose of AICTE approval.
        Reference: APH Annexure-2, Clause 1.3
    """).strip()


def good_land_deed() -> str:
    inst = _inst()
    area = round(random.uniform(2.0, 15.0), 2)
    return dedent(f"""
        REGISTERED DEED OF SALE / CONVEYANCE
        Registration No: SRO/{_yr()}/{random.randint(1000, 9999)}
        Sub-Registrar Office, Nagpur

        This deed of conveyance is made on the {random.randint(1,28)}th day of
        January {_yr()} between the Vendor (Government of Maharashtra) and
        the Purchaser ({inst}).

        Schedule of Property:
        Survey No: {random.randint(100,999)}/{random.randint(1,50)}
        Area: {area} acres ({area * 4046.86:.0f} square metres)
        Land type: Non-agricultural
        Location: Village {_pick(['Wardhaman Nagar', 'Hingna', 'Butibori', 'Wadi'])},
                  Taluka Nagpur, District Nagpur, Maharashtra

        The above property is sold / transferred absolutely and forever to the
        purchaser {inst} and its successors in perpetuity.

        Total consideration paid: Rs. {random.randint(50, 500)} lakhs (rupees
        {random.randint(50, 500)} lakhs only).

        Registered before: Sub-Registrar, Nagpur
        Date of registration: {random.randint(1,28)} January {_yr()}
        Book No: 1   Volume: {random.randint(1,50)}   Page: {random.randint(1,300)}

        Witnesses:
        1. {_pick(['Ramesh Kumar', 'Suresh Patel', 'Anil Singh'])}
        2. {_pick(['Meera Sharma', 'Priya Rao', 'Kavita Joshi'])}

        Reference: AICTE APH Clause 2.1(a), 2.1(e)
    """).strip()


def good_affidavit() -> str:
    inst = _inst()
    course = _course()
    signatory = _pick(SECRETARIES)
    return dedent(f"""
        AFFIDAVIT

        I, {signatory}, the authorised signatory of {inst},
        do hereby solemnly affirm and declare as follows:

        1. That {inst} is a duly registered educational institution
           under the Societies Registration Act 1860.

        2. That all information and documents submitted to AICTE in respect of
           the application for approval of {course} are true and correct
           to the best of my knowledge and belief.

        3. That the institution has not submitted any false, misleading or
           fraudulent documents to AICTE or any other authority.

        4. That the institution fulfils all the norms and standards prescribed
           by AICTE in the Approval Process Handbook 2024-27.

        5. That I am duly authorised to sign and submit this affidavit on behalf
           of the institution and the governing trust.

        Deponent's Signature: {signatory}
        Date: {random.randint(1,28)} October {_yr()}
        Place: Nagpur

        {_pick(NOTARIES)}
        Affidavit sworn on stamp paper of Rs. 100

        Reference: AICTE APH 1.4.6, 2.3.4(b)
    """).strip()


def good_state_noc() -> str:
    inst = _inst()
    course = _course()
    intake = random.choice([60, 90, 120])
    return dedent(f"""
        GOVERNMENT OF MAHARASHTRA
        DIRECTORATE OF TECHNICAL EDUCATION
        Ministry of Higher and Technical Education

        No: DTE/NOC/{_yr()}/{random.randint(100, 999)}
        Date: {random.randint(1,28)} January {_yr()}

        NO OBJECTION CERTIFICATE

        To
        The Chairman / Secretary
        {inst}

        Subject: Grant of No Objection Certificate for AICTE Approval

        This is to certify that the State Government of Maharashtra has no
        objection to the institution {inst} seeking AICTE approval for the
        programme {course} with an intake of {intake} students per academic year.

        The institution has fulfilled all requirements of the State Government
        as prescribed under the Maharashtra Universities Act 1994 and is
        permitted to seek AICTE approval.

        Signed by: Director of Technical Education, Maharashtra
        Joint Secretary to the Government of Maharashtra
        Date: {random.randint(1,28)} February {_yr()}
        Official Seal

        Reference: AICTE APH Annexure-2
    """).strip()


def good_building_plan() -> str:
    inst = _inst()
    area = round(random.uniform(5000, 50000))
    return dedent(f"""
        {_pick(PANCHAYATS)}
        BUILDING COMPLETION / OCCUPANCY CERTIFICATE
        Certificate No: BLDG/{_yr()}/{random.randint(1000, 9999)}

        This is to certify that the building constructed at the premises of
        {inst}, Survey No {random.randint(100,999)}, has been inspected
        by the authorised officer of this corporation.

        Building Details:
        Total built-up area: {area} square metres ({area/4046.86:.2f} acres equivalent)
        Number of floors: Ground + {random.randint(1,4)}
        Type of construction: RCC Framed Structure
        Plinth area: {area * 0.8:.0f} square metres
        Carpet area: {area * 0.65:.0f} square metres

        The construction conforms to the approved building plan and the
        National Building Code of India 2016.

        Occupancy Certificate granted for: Educational Use
        Date of issue: {random.randint(1,28)} March {_yr()}
        Valid until: {_date_future()}

        Executive Engineer, PWD (Buildings Division)
        {_pick(PANCHAYATS)}
        Stamp and Signature

        Reference: AICTE APH Annexure-3
    """).strip()


def good_faculty_list() -> str:
    inst = _inst()
    rows = []
    first_names = ["Amit", "Priya", "Rajesh", "Sunita", "Vikram", "Meena", "Suresh", "Kavitha"]
    last_names = ["Sharma", "Patel", "Singh", "Kumar", "Joshi", "Rao", "Verma", "Gupta"]
    desigs = ["Professor", "Associate Professor", "Assistant Professor", "Assistant Professor",
              "Assistant Professor", "Associate Professor", "Professor", "Assistant Professor"]
    depts = ["Computer Engineering", "Computer Engineering", "Electronics",
             "Computer Engineering", "Mathematics", "Computer Engineering",
             "Computer Engineering", "Mechanical Engineering"]
    quals = ["Ph.D", "M.Tech", "Ph.D", "M.Tech", "Ph.D", "M.E.", "Ph.D", "M.Tech"]
    for i in range(random.randint(6, 10)):
        fn = _pick(first_names)
        ln = _pick(last_names)
        pan = f"{''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ', k=5))}{random.randint(1000,9999)}{''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ', k=1))}"
        row = f"{i+1}. {fn} {ln} | {desigs[i % len(desigs)]} | {depts[i % len(depts)]} | {quals[i % len(quals)]} | PAN: {pan}"
        rows.append(row)
    return dedent(f"""
        FACULTY LIST — {inst}
        Academic Year {_yr()}-{int(_yr())+1}

        S.No | Name | Designation | Department | Qualification | PAN

        {chr(10).join(rows)}

        Total Faculty in post: {len(rows)}
        Regular Faculty: {len(rows) - random.randint(0,2)}
        Contract Faculty: {random.randint(0,2)}

        Certified by: {_pick(SECRETARIES)}
        Date: {random.randint(1,28)} September {_yr()}

        Student-Faculty Ratio (UG 1:20 norm): Compliant
        Reference: AICTE APH Appendix 7
    """).strip()


def good_resolution() -> str:
    inst = _inst()
    course = _course()
    return dedent(f"""
        RESOLUTION OF THE BOARD OF GOVERNORS / MANAGING COMMITTEE
        {inst}

        Meeting held on: {random.randint(1,28)} August {_yr()}
        Venue: Board Room, {inst}

        Members present:
        1. {_pick(SECRETARIES)} — Presiding
        2. Treasurer
        3. Joint Secretary
        4. Principal / Director (Special Invitee)

        RESOLUTION NO: BOG/{_yr()}/{random.randint(10,99)}

        RESOLVED THAT the Managing Committee hereby approves and authorises the
        submission of application to AICTE for approval of {course}
        with an intake of {random.choice([60, 90, 120])} students per academic year.

        RESOLVED FURTHER THAT {_pick(SECRETARIES)} is hereby authorised to sign
        and submit all documents required for AICTE approval on behalf of the institution.

        The resolution was passed unanimously.

        Signed: {_pick(SECRETARIES)} (Chairman)
        Date: {random.randint(1,28)} August {_yr()}
        Seal of the Trust / Society

        Reference: AICTE APH 1.4.5
    """).strip()


# -- BAD documents -------------------------------------------------------------

def bad_blank() -> str:
    """Nearly blank page or header-only scan."""
    options = [
        "CERTIFICATE",
        "ANUMATI TECHNICAL COLLEGE",
        "Page 1 of 1",
        "",
        "FIRE NOC",
        "   \n   \n   ",
        "Scanned copy attached",
        "See enclosed document",
    ]
    return _pick(options)


def bad_wrong_type() -> str:
    """Content of a completely different document type."""
    options = [
        "ELECTRICITY BILL\nConsumer No: 1234567\nAmount Due: Rs. 12,450\nDue Date: 15th March 2025",
        "SALARY SLIP\nEmployee: Dr. A Sharma\nBasic Pay: 85,000\nHRA: 21,250\nNet Pay: 95,750",
        "BANK STATEMENT\nAccount: 123456789012\nOpening Balance: 2,50,000\nClosing Balance: 3,10,500",
        "MEETING MINUTES\nAgenda Item 1: Review of construction progress\nAgenda Item 2: Budget allocation",
        "PROPERTY TAX RECEIPT\nProperty No: NGP/2024/45678\nAmount Paid: Rs. 45,000",
    ]
    return _pick(options)


def bad_expired() -> str:
    """Document with expired validity date — no authority, short."""
    inst = _pick(INSTITUTION_NAMES)
    return dedent(f"""
        Fire Safety Certificate
        Issued to: {inst}
        Valid until: {_date_past()}
        Issued by: Fire Officer
        Date: {random.randint(1,28)} January 2022
    """).strip()


def bad_missing_fields() -> str:
    """Document missing critical required fields."""
    options = [
        "This is to certify that the institution has complied with requirements.\nValid until: next year.\nSigned: Officer",
        "NOC Certificate\nThe institution may proceed.\nDate: March 2025",
        "CERTIFICATE OF COMPLIANCE\nAll norms have been verified.\nIssue date: 2024",
        "To Whom It May Concern\nThe institution is granted permission.\nAuthorised Signatory",
        "APPROVAL LETTER\nDear Principal,\nYour application has been reviewed.\nRegards,\nCommittee",
    ]
    return _pick(options)


def bad_wrong_signatory() -> str:
    """Affidavit signed by Principal instead of Chairman/Secretary."""
    inst = _pick(INSTITUTION_NAMES)
    return dedent(f"""
        AFFIDAVIT

        I, Dr. Ramesh Kumar, Principal of {inst},
        do hereby solemnly affirm that all information submitted to AICTE is true.

        The institution has adequate infrastructure and faculty.

        Signed by: Dr. Ramesh Kumar (Principal)
        Date: {random.randint(1,28)} October {_yr()}
        Place: Nagpur
    """).strip()


def bad_no_dates() -> str:
    """Document with good content but no dates at all."""
    inst = _pick(INSTITUTION_NAMES)
    return dedent(f"""
        FIRE DEPARTMENT
        GOVERNMENT OF MAHARASHTRA

        FIRE NOC CERTIFICATE

        This certifies that {inst} has been inspected.
        Fire safety equipment is in place.
        The building is compliant with fire norms.

        Chief Fire Officer
        Nagpur Municipal Corporation
    """).strip()


def bad_photocopy_noise() -> str:
    """Typical OCR output from a badly scanned photocopy."""
    noise_words = ["iiiii", "llll", "XXXXXXXXX", "|||||||", "------", "°°°°",
                   "....", "????", "$$$$", "####", "@@@@"]
    lines = [
        f"{''.join(random.choices(noise_words, k=random.randint(2,5)))}",
        f"CERT {random.randint(100,999)} {''.join(random.choices(noise_words, k=3))}",
        f"{''.join(random.choices(noise_words, k=4))}",
    ]
    return "\n".join(lines)


def bad_incomplete_authority() -> str:
    """Document mentions institution but has no recognisable official body."""
    inst = _pick(INSTITUTION_NAMES)
    return dedent(f"""
        To
        The Principal
        {inst}

        Dear Sir/Madam,

        This is to inform you that your application dated {random.randint(1,28)} January {_yr()}
        has been received and is under consideration.

        You will be informed of the decision in due course.

        Thanking you,
        For and on behalf of the Committee
    """).strip()


# -- GENERATOR REGISTRY --------------------------------------------------------

GOOD_GENERATORS = [
    good_fire_noc,
    good_uni_noc,
    good_land_deed,
    good_affidavit,
    good_state_noc,
    good_building_plan,
    good_faculty_list,
    good_resolution,
]

BAD_GENERATORS = [
    bad_blank,
    bad_wrong_type,
    bad_expired,
    bad_missing_fields,
    bad_wrong_signatory,
    bad_no_dates,
    bad_photocopy_noise,
    bad_incomplete_authority,
]


# -----------------------------------------------------------------------------
# 2. GENERATE DATASET
# -----------------------------------------------------------------------------

def generate_dataset(n_good: int = 400, n_bad: int = 400):
    texts, labels = [], []

    print(f"Generating {n_good} good documents...")
    for i in range(n_good):
        gen = GOOD_GENERATORS[i % len(GOOD_GENERATORS)]
        texts.append(gen())
        labels.append(1)

    print(f"Generating {n_bad} bad documents...")
    for i in range(n_bad):
        gen = BAD_GENERATORS[i % len(BAD_GENERATORS)]
        texts.append(gen())
        labels.append(0)

    return texts, labels


# -----------------------------------------------------------------------------
# 3. FEATURE EXTRACTION
# -----------------------------------------------------------------------------

FEATURE_NAMES = [
    "word_density",
    "date_richness",
    "has_authority",
    "has_institution_name",
    "has_signature",
    "vocab_richness",
]


def extract_features(texts: list[str]) -> np.ndarray:
    print(f"Extracting features from {len(texts)} documents...")
    rows = []
    for i, text in enumerate(texts):
        fv = _feature_vector(text)
        rows.append(fv)
        if (i + 1) % 100 == 0:
            print(f"  {i + 1}/{len(texts)} done")
    return np.array(rows)


# -----------------------------------------------------------------------------
# 4. TRAIN & EVALUATE
# -----------------------------------------------------------------------------

def train_and_evaluate(X: np.ndarray, y: np.ndarray):
    print("\nTraining RandomForestClassifier with 5-fold stratified cross-validation...")
    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=8,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=SEED,
        n_jobs=-1,
    )
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    cv_results = cross_validate(
        clf, X, y, cv=cv,
        scoring=["accuracy", "f1", "precision", "recall"],
        return_train_score=True,
    )

    print("\n-- Cross-validation results ------------------------------------------")
    for metric in ["accuracy", "f1", "precision", "recall"]:
        test_scores = cv_results[f"test_{metric}"]
        print(f"  {metric:12s}  mean={test_scores.mean():.4f}  std={test_scores.std():.4f}  "
              f"min={test_scores.min():.4f}  max={test_scores.max():.4f}")

    # Fit on the full dataset for the saved model
    print("\nFitting final model on full dataset...")
    clf.fit(X, y)

    # Feature importances
    print("\n-- Feature importances -----------------------------------------------")
    for name, imp in sorted(zip(FEATURE_NAMES, clf.feature_importances_), key=lambda x: -x[1]):
        bar = "#" * int(imp * 40)
        print(f"  {name:28s} {imp:.4f}  {bar}")

    # Full classification report
    y_pred = clf.predict(X)
    print("\n-- Classification report (train set) --------------------------------")
    print(classification_report(y, y_pred, target_names=["Bad document", "Good document"]))

    return clf


# -----------------------------------------------------------------------------
# 5. SAVE
# -----------------------------------------------------------------------------

def save_model(clf, X: np.ndarray, y: np.ndarray):
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(clf, OUT_PATH)
    print(f"\nModel saved → {OUT_PATH}")

    meta = {
        "model": "RandomForestClassifier",
        "n_estimators": clf.n_estimators,
        "n_features": X.shape[1],
        "feature_names": FEATURE_NAMES,
        "n_train_good": int((y == 1).sum()),
        "n_train_bad": int((y == 0).sum()),
        "classes": ["bad_document", "good_document"],
        "label_map": {"0": "bad_document", "1": "good_document"},
    }
    META_PATH.write_text(json.dumps(meta, indent=2))
    print(f"Metadata saved → {META_PATH}")


# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 60)
    print("ANUMATI AI Document Quality Classifier — Training")
    print("=" * 60)

    texts, labels = generate_dataset(n_good=400, n_bad=400)
    X = extract_features(texts)
    y = np.array(labels)

    print(f"\nDataset: {X.shape[0]} samples, {X.shape[1]} features")
    print(f"  Good documents: {(y == 1).sum()}")
    print(f"  Bad documents:  {(y == 0).sum()}")
    print(f"  Feature names:  {FEATURE_NAMES}")

    clf = train_and_evaluate(X, y)
    save_model(clf, X, y)

    print("\n✓ Training complete. Re-start the backend to load the new model.")
