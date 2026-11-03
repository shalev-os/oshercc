"""Generate the downloadable résumé and its matching website preview."""

from pathlib import Path

import pypdfium2 as pdfium
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen.canvas import Canvas


output = Path(__file__).resolve().parents[1] / "public" / "cv"
pdf_path = output / "shalev-osher-cv.pdf"
width, height = A4
ink = "#151820"
muted = "#485165"
blue = "#2449e8"
margin = 43
canvas = Canvas(str(pdf_path), pagesize=A4)
canvas.setTitle("Shalev Osher | Technical Support & Infrastructure")
canvas.setAuthor("Shalev Osher")


def write(text, x, y, size=10, color=ink, bold=False):
    canvas.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    canvas.setFillColor(HexColor(color))
    canvas.drawString(x, y, text)


def rule(y):
    canvas.setStrokeColor(HexColor("#DAD9D2"))
    canvas.line(margin, y, width - margin, y)


def role(title, period, lines, y):
    write(title, margin, y, 10.5, bold=True)
    canvas.setFillColor(HexColor(blue))
    canvas.setFont("Helvetica-Bold", 9.5)
    canvas.drawRightString(width - margin, y, period)
    for line in lines:
        y -= 15
        write(line, margin, y, 9.8, muted)
    return y - 25


canvas.setFillColor(HexColor("#F5F3ED"))
canvas.rect(0, 669, width, height - 669, fill=1, stroke=0)
canvas.setFillColor(HexColor(blue))
canvas.rect(margin, 796, 7, 7, fill=1, stroke=0)
write("TECHNICAL SUPPORT & INFRASTRUCTURE", margin + 16, 796, 9, blue, True)
write("Shalev Osher", margin, 748, 42, bold=True)
write("Tier 2 support  /  Cloud telephony  /  Systems", margin, 722, 13, muted)
contacts = [
    ("shalev@osher.cc", "mailto:shalev@osher.cc", margin),
    ("+972-50-722-3763", "tel:+972507223763", 146),
    ("osher.cc", "https://osher.cc/", 259),
    ("LinkedIn", "https://linkedin.com/in/shalev-osher/", 325),
]
for label, url, x in contacts:
    write(label, x, 695, 10, blue, True)
    end = x + canvas.stringWidth(label, "Helvetica-Bold", 10)
    canvas.linkURL(url, (x, 692, end, 706), relative=0, thickness=0)
write("Ashkelon, Israel", 397, 695, 10, muted)

write("PROFILE", margin, 645, 9.5, blue, True)
write("Technical support specialist with a QA background and experience investigating", margin, 626, 10.5)
write("incidents across VoIP, servers and cloud services. I turn troubleshooting findings", margin, 611, 10.5)
write("into actionable tickets, guides and tools that support teams can use.", margin, 596, 10.5)
rule(580)
write("EXPERIENCE", margin, 562, 9.5, blue, True)
y = role("Voicenter | Technical Support Specialist, Tier 2", "2023 - 2026", [
    "Investigated production issues using Kibana, PRTG and API diagnostics across",
    "networking and AWS services. Partnered with Development and DevOps via Jira.",
    "Supported VIP and standard clients, tested releases, and co-developed a",
    "troubleshooting tool with the Development team.",
], 540)
y = role("Voicenter | Technical Support, Strategic Customers", "2021 - 2023", [
    "Managed strategic customer accounts and investigated complex cloud telephony",
    "issues with Asterisk and SQL. Wrote guides and led training exercises.",
], y)
y = role("Voicenter | Technical Support Engineer, Tier 1", "2021", [
    "Troubleshot VoIP and network issues, triaged tickets, and escalated incidents.",
], y)
y = role("ILDC | Quality Assurance Tester", "2018 - 2021", [
    "Tested Altice (HOT) set-top boxes in the Sagemcom lab against specifications.",
], y)
y = role("IDF | Military Service", "2015 - 2018", [
    "Performed vehicle maintenance and used test equipment to verify functionality.",
], y)
rule(y + 5)
write("EDUCATION & CERTIFICATIONS", margin, y - 13, 9.5, blue, True)
write("Kernelios | Cyber Defense Practitioner, 2021 - 2022", margin, y - 31, 10, bold=True)
write("CHCSS 310  /  MCSA: Windows Server 2016  /  LPI Linux Essentials", margin, y - 47, 9.8, muted)
rule(y - 61)
write("TOOLS & LANGUAGES", margin, y - 79, 9.5, blue, True)
write("VoIP, Asterisk, SQL, Kibana, PRTG, Jira, AWS, Windows Server, Linux", margin, y - 97, 9.8)
write("Hebrew (native)  /  English (fluent)", margin, y - 113, 9.8, muted)
canvas.save()

with pdfium.PdfDocument(pdf_path) as document:
    page = document[0]
    extracted = page.get_textpage().get_text_range()
    assert len(document) == 1 and "2023 - 2026" in extracted and "Present" not in extracted
    page.render(scale=2).to_pil().save(output / "shalev-osher-cv-preview.webp", quality=92)
