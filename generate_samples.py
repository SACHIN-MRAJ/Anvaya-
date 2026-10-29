"""Generate two sample PDF documents for ANUMATI AI document verification testing."""
import os

def make_pdf(lines: list) -> bytes:
    ops = "BT\n/F1 11 Tf\n50 750 Td\n"
    for line in lines:
        safe = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        ops += f"({safe}) Tj\n0 -16 Td\n"
    ops += "ET"

    content_bytes = ops.encode("latin-1")
    content_len = len(content_bytes)

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 842] /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        (f"<< /Length {content_len} >>\nstream\n").encode() + content_bytes + b"\nendstream",
    ]

    body = b""
    offsets = []
    header = b"%PDF-1.4\n"
    pos = len(header)
    for i, obj in enumerate(objects, 1):
        offsets.append(pos)
        chunk = f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
        body += chunk
        pos += len(chunk)

    xref_offset = len(header) + len(body)
    xref = f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n"
    for off in offsets:
        xref += f"{off:010d} 00000 n \n"
    trailer = f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n"

    return header + body + xref.encode() + trailer.encode()


# ── PASSING document ─────────────────────────────────────────────────────────────
clean_lines = [
    "AICTE APPROVAL APPLICATION - LAND OWNERSHIP CERTIFICATE",
    "Institution: Sunrise Technical Institute",
    "AICTE Institution ID: INS-2024-0812",
    "Application Reference: ANU-2026-0450",
    "Document Type: Land Ownership Certificate",
    "",
    "This certifies that Sunrise Technical Institute (Trust Reg. No. TR-2018-MH-04521)",
    "is the owner of the land described below, free from all encumbrances.",
    "",
    "Land Area: 12.5 acres",
    "Survey Number: 147/2, 148/1, Pimpri Village, Pune District",
    "Registration Date: 15 March 2019",
    "Validity: Permanent ownership - no expiry",
    "",
    "Infrastructure Available:",
    "Academic Block: 8200 sq.m completed 2021",
    "Library: 1200 sq.m, 25000 volumes",
    "Computer Labs: 3 labs x 60 seats each",
    "Workshop and Labs: 4 discipline labs of 2400 sq.m",
    "",
    "Faculty Strength: 48 approved positions, 45 filled",
    "Faculty-Student Ratio: 1:15",
    "PhD Faculty: 14 out of 45 (31 percent)",
    "",
    "Affiliation: University of Pune, Affiliation No. UP-ENG-2019-0234",
    "Affiliation Letter Date: 12 June 2024",
    "Affiliation Validity: Academic Year 2024-2025 and 2025-2026",
    "",
    "Promoter Capital: Rs. 15.5 Crore confirmed by NBFC certificate",
    "Bank Solvency Certificate: State Bank of India Pune, 04 September 2026",
    "",
    "Fire Safety Certificate: Valid until 30 November 2027",
    "Building Completion Certificate: Issued 22 August 2021",
    "Environmental Clearance: Obtained 2018, Reference EC-2018-MH-0341",
    "Occupancy Certificate: Issued 15 September 2021",
    "",
    "Authorised Signatory: Dr. Ramesh Kulkarni, Chairman",
    "Seal: Sunrise Education Trust",
    "Date of Issue: 10 October 2026",
]

# ── FAILING document ─────────────────────────────────────────────────────────────
deficient_lines = [
    "LAND DOCUMENT",
    "Name: Some College",
    "",
    "land area about 2 acres maybe",
    "location: somewhere near the city limits",
    "",
    "we have some teachers working here",
    "many students are enrolled currently",
    "",
    "Bank Certificate: Issued 15 March 2021",
    "Affiliation Letter: January 2020 from some university",
    "",
    "Fire NOC: certificate expired last year",
    "Building certificate: still pending with authorities",
    "",
    "Capital amount: not specified yet",
    "",
    "Faculty ratio: unknown",
    "PhD holders: none currently",
    "",
    "Signature",
]

os.makedirs("frontend/public/samples", exist_ok=True)

with open("frontend/public/samples/sample_clean_document.pdf", "wb") as f:
    f.write(make_pdf(clean_lines))

with open("frontend/public/samples/sample_deficient_document.pdf", "wb") as f:
    f.write(make_pdf(deficient_lines))

print("Created: frontend/public/samples/sample_clean_document.pdf")
print("Created: frontend/public/samples/sample_deficient_document.pdf")
