import { ArrowUpRight, Download, Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import "./career.css";

const certificates = [
  { name: "Certified Hands-On Cyber Security Specialist", issuer: "Kernelios", code: "CHCSS 310", year: "April 2022", verifyUrl: null, image: "/certificates/optimized/kernelios-chcss.webp", mobileImage: "/certificates/mobile/kernelios-chcss.webp", pdf: "/certificates/kernelios-chcss.pdf" },
  { name: "Cyber Defense Practitioner Completion Certificate", issuer: "Ministry of Economy and Industry", code: "Certificate #1442431", year: "April 2022", verifyUrl: null, image: "/certificates/optimized/kernelios-gov.webp", mobileImage: "/certificates/mobile/kernelios-gov.webp", pdf: "/certificates/kernelios-gov.pdf" },
  { name: "Cyber Defense Practitioner Grade Transcript", issuer: "Ministry of Economy and Industry", code: "Kernelios Ltd.", year: "June 2022", verifyUrl: null, image: "/certificates/optimized/kernelios-grades.webp", mobileImage: "/certificates/mobile/kernelios-grades.webp", pdf: "/certificates/kernelios-grades.pdf" },
  { name: "MCSA: Windows Server 2016", issuer: "Microsoft", code: "Cert #1F7071-E04B87", year: "November 2020", verifyUrl: "https://learn.microsoft.com/en-us/users/shalevosher-6659/transcript/714gcwjmylnq9k7", image: "/certificates/optimized/mcsa.webp", mobileImage: "/certificates/mobile/mcsa.webp", pdf: "/certificates/mcsa.pdf" },
  { name: "Linux Essentials", issuer: "Linux Professional Institute (LPI)", code: "LPI000494064", year: "July 2021", verifyUrl: "https://cs.lpi.org/caf/Xamman/certification/verify/LPI000494064/rafgerhedt", image: "/certificates/optimized/linux-essentials.webp", mobileImage: "/certificates/mobile/linux-essentials.webp", pdf: "/certificates/linux-essentials.pdf" },
];

export default function Education() {
  return (
    <section id="education" className="career-section career-education" aria-labelledby="education-heading">
      <div className="career-inner">
        <header className="career-heading">
          <p className="career-eyebrow">Training & credentials</p>
          <h2 id="education-heading">Always learning.</h2>
          <p>Windows Server, Linux and hands-on cyber defense.</p>
        </header>
        <div className="career-training">
          <div>
            <p className="career-eyebrow">Kernelios</p>
            <h3>Cyber Defense Practitioner</h3>
          </div>
          <p>306 hours <span aria-hidden="true">·</span> July 2021 – April 2022</p>
        </div>
        <ul className="career-certificates" aria-label="Certificates and transcripts">
          {certificates.map((cert) => (
            <li key={cert.name} className="career-certificate">
              <Dialog>
                <DialogTrigger asChild>
                  <button className="career-certificate-preview" type="button" aria-label={`View certificate: ${cert.name}`}>
                    <picture>
                      <source media="(max-width: 640px)" srcSet={cert.mobileImage} />
                      <img src={cert.image} alt="" loading="lazy" decoding="async" />
                    </picture>
                    <span className="career-preview-icon"><Maximize2 size={16} aria-hidden="true" /></span>
                  </button>
                </DialogTrigger>
                <DialogContent className="career-certificate-dialog">
                  <DialogTitle>{cert.name}</DialogTitle>
                  <DialogDescription>{cert.issuer} · {cert.year}</DialogDescription>
                  <img src={cert.image} alt={cert.name} />
                  <a href={cert.pdf} target="_blank" rel="noopener noreferrer">Open PDF <ArrowUpRight size={16} aria-hidden="true" /></a>
                </DialogContent>
              </Dialog>
              <div className="career-certificate-body">
                <p className="career-eyebrow">{cert.year}</p>
                <h3>{cert.name}</h3>
                <p>{cert.issuer}</p>
                <div className="career-certificate-links">
                  <a href={cert.pdf} target="_blank" rel="noopener noreferrer" aria-label={`Open PDF: ${cert.name}`}><Download size={15} aria-hidden="true" /> PDF</a>
                  {cert.verifyUrl && <a href={cert.verifyUrl} target="_blank" rel="noopener noreferrer" aria-label={`Verify: ${cert.name}`}>Verify <ArrowUpRight size={15} aria-hidden="true" /></a>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
