import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Download, Github, Linkedin, Menu, X } from "lucide-react";
import portrait from "@/assets/profile-photo.jpeg";
import SelectedWork from "@/components/SelectedWork";
import Experience from "@/components/Experience";
import Education from "@/components/Education";
import CommandPalette from "@/components/CommandPalette";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import "./portfolio.css";

const nav = [["projects", "Work"], ["experience", "Experience"], ["education", "Credentials"], ["contact", "Contact"]];
const cv = "/cv/shalev-osher-cv.pdf";
const capabilities = [
  ["01", "Investigate", "Follow the evidence through logs, tickets and API responses.", "Kibana · SQL · APIs"],
  ["02", "Support", "Work across the layers that keep voice and cloud services running.", "VoIP · Asterisk · AWS"],
  ["03", "Build", "Turn recurring problems into clearer workflows and repeatable releases.", "Windows Server · Linux · CI/CD"],
];

function Resume() {
  return <Dialog><DialogTrigger asChild><button className="so-secondary" type="button">View résumé <ArrowUpRight size={16} /></button></DialogTrigger>
    <DialogContent className="so-resume">
      <DialogTitle>Shalev Osher — résumé</DialogTitle>
      <DialogDescription>Preview the résumé or download the PDF.</DialogDescription>
      <a className="so-button" href={cv} download><Download size={16} /> Download PDF</a>
      <div className="so-resume-document"><img src="/cv/shalev-osher-cv-preview.webp" alt="Résumé preview. Download the PDF for the full document." /></div>
    </DialogContent>
  </Dialog>;
}

function ContactPanel() {
  const [prepared, setPrepared] = useState(false);
  function draft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const subject = encodeURIComponent(`Portfolio enquiry from ${data.get("name")}`);
    const body = encodeURIComponent(`${data.get("message")}\n\nFrom: ${data.get("name")} <${data.get("email")}>`);
    setPrepared(true);
    window.location.href = `mailto:shalev@osher.cc?subject=${subject}&body=${body}`;
  }
  return <section id="contact" className="so-contact">
    <div className="so-wrap so-contact-grid">
      <div><p className="so-label">Get in touch</p><h2>Let’s talk<br />systems.</h2><p>Have a role or project in technical support, infrastructure or DevOps? I’d like to hear what you’re working on.</p>
        <a className="so-email" href="mailto:shalev@osher.cc">shalev@osher.cc <ArrowUpRight size={21} /></a>
        <p className="so-phone"><a href="tel:+972507223763">+972-50-722-3763</a> · Ashkelon, Israel</p>
      </div>
      <form className="so-form" onSubmit={draft} onInput={() => setPrepared(false)}>
        <label>Your name<input name="name" autoComplete="name" required maxLength={100} /></label>
        <label>Your email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label>What’s on your mind?<textarea name="message" required maxLength={2000} rows={4} /></label>
        <button className="so-button" type="submit">Open email draft <ArrowUpRight size={17} /></button>
        <p role="status">{prepared ? "Finish sending in your email app. This site has not sent or saved your message." : "Opens your email app so you can review and send the draft."}</p>
      </form>
    </div>
  </section>;
}

export default function Index() {
  const [menu, setMenu] = useState(false);
  return <div className="so-site" onKeyDown={event => { if (event.key === "Escape" && menu) { setMenu(false); document.getElementById("so-menu-toggle")?.focus(); } }}>
    <a className="so-skip" href="#main-content">Skip to content</a>
    <header className="so-header"><div className="so-wrap so-header-inner">
      <a className="so-brand" href="#hero" aria-label="Shalev Osher, home"><span>SO<span className="so-brand-dot">.</span></span><span>OSHER.CC</span></a>
      <button id="so-menu-toggle" type="button" className="so-menu-toggle" aria-label={menu ? "Close navigation" : "Open navigation"} aria-expanded={menu} aria-controls="so-navigation" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
      <nav id="so-navigation" className={menu ? "so-nav is-open" : "so-nav"} aria-label="Main navigation">
        {nav.map(([id, label]) => <a key={id} href={`#${id}`} onClick={() => setMenu(false)}>{label}</a>)}
      </nav>
      <a className="so-header-github" href="https://github.com/shalev-os" aria-label="Shalev on GitHub"><Github size={18} /> <ArrowUpRight size={13} /></a>
    </div></header>
    <main id="main-content" tabIndex={-1}>
      <section className="so-hero so-wrap" id="hero" aria-labelledby="so-title">
        <div className="so-hero-copy">
          <p className="so-label"><span className="so-dot" /> Shalev Osher · Technical support & infrastructure</p>
          <h1 id="so-title">I make complex<br className="so-desktop-break" /> systems easier<br className="so-desktop-break" /> <em>to support.</em></h1>
          <p className="so-intro">From a failed call to a production release, I trace what happened, make it understandable, and help get things working again.</p>
          <div className="so-actions"><a className="so-button" href="#projects">Explore my work <ArrowDown size={17} /></a><Resume /></div>
        </div>
        <figure className="so-portrait">
          <div className="so-portrait-top"><span>OSHER / FIELD NOTES</span><span>01</span></div>
          <img src={portrait} width={864} height={864} alt="Shalev Osher" fetchPriority="high" />
          <figcaption><span><strong>Shalev Osher</strong><small>Technical support · Systems · Cloud</small></span><ArrowUpRight size={21} aria-hidden="true" /></figcaption>
        </figure>
        <div className="so-hero-rail"><span>01 / THE PORTFOLIO</span><span>QA → TIER 2 → INFRASTRUCTURE</span><a href="#projects">Scroll to explore <ArrowDown size={14} /></a></div>
      </section>
      <SelectedWork />
      <section id="about" className="so-about"><div className="so-wrap so-about-grid">
        <div><p className="so-label">Behind the work</p><h2>Follow the evidence.<br /><em>Make it useful.</em></h2></div>
        <div><p>I started in QA, learning to reproduce issues and describe them clearly. In VoIP support, that habit became a way to investigate incidents across servers, networks and cloud services.</p><p>What I enjoy most is turning a difficult investigation into something the next person can use: a clearer ticket, a troubleshooting guide, or a tool that makes the next incident easier to handle.</p><a className="so-text-link" href="#experience">See my career path <ArrowRight size={16} /></a></div>
      </div>
      <div id="skills" className="so-wrap so-capabilities">{capabilities.map(([number, title, description, tools]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p><small>{tools}</small></article>)}</div></section>
      <Experience />
      <Education />
      <ContactPanel />
    </main>
    <footer className="so-footer"><div className="so-wrap"><a className="so-brand" href="#hero">SO.</a><span>Shalev Osher · osher.cc</span><div><a href="https://github.com/shalev-os"><Github size={17} /> GitHub</a><a href="https://linkedin.com/in/shalev-osher/"><Linkedin size={17} /> LinkedIn</a></div></div></footer>
    <CommandPalette />
  </div>;
}
