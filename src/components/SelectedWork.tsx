import { ArrowUpRight, Check, GitBranch, PackageCheck, Server } from "lucide-react";
import mazonPreview from "@/assets/mazonhaosher-project.jpg";
import "./selected-work.css";

const releaseSteps = [
  { icon: GitBranch, title: "GitHub Actions", detail: "Test and build" },
  { icon: PackageCheck, title: "Linux", detail: "Deploy validated main" },
  { icon: Server, title: "Nginx", detail: "Serve and verify" },
];

const projects = [
  {
    index: "01",
    kind: "Personal portfolio · Infrastructure",
    title: "osher.cc",
    description: "osher.cc runs on Linux with Nginx behind Cloudflare Tunnel. My infrastructure also includes a separate Windows Server running IIS. GitHub Actions validates changes, and the Linux server automatically deploys the validated main branch. If the local health check fails, the server restores the previous release.",
    stack: ["React", "GitHub Actions", "Linux", "Nginx", "Cloudflare Tunnel"],
    website: "https://osher.cc/",
    repository: "https://github.com/shalev-os/oshercc",
  },
  {
    index: "02",
    kind: "Small business · Web catalogue",
    title: "Mazon HaOsher",
    description: "A Hebrew storefront for Almog’s handmade cookies, cakes, and desserts. Her photography anchors a browsable catalogue, with product details and a WhatsApp enquiry for each item.",
    stack: ["React", "TypeScript", "Hebrew RTL", "Linux", "Nginx"],
    website: "https://mazonhaosher.co.il/",
    repository: "https://github.com/shalev-os/mazonhaosher",
  },
];

export default function SelectedWork() {
  return (
    <section id="projects" className="selected-work" aria-labelledby="selected-work-title">
      <header className="selected-work__intro">
        <p className="selected-work__label">Selected work</p>
        <h2 id="selected-work-title">From idea to live site.</h2>
        <p>Two live websites and the deployment console that monitors them.</p>
      </header>

      <div className="selected-work__grid">
        {projects.map((project) => (
          <article className="selected-work__project" key={project.index}>
            {project.index === "01" ? (
              <div className="selected-work__visual selected-work__pipeline">
                <p className="selected-work__diagram-heading"><span aria-hidden="true" /> Release path</p>
                <ol className="selected-work__steps">
                  {releaseSteps.map(({ icon: Icon, title, detail }) => (
                    <li key={title}>
                      <Icon size={20} aria-hidden="true" />
                      <strong>{title}</strong>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ol>
                <p className="selected-work__diagram-note"><Check size={15} aria-hidden="true" /> Backup before release · Local health check</p>
              </div>
            ) : (
              <div className="selected-work__visual selected-work__preview">
                <div className="selected-work__browser">
                  <div className="selected-work__browser-bar" aria-hidden="true"><span /> mazonhaosher.co.il</div>
                  <img src={mazonPreview} alt="Mazon HaOsher’s Hebrew storefront with Almog’s cookie photography and a cream and burgundy layout" loading="lazy" decoding="async" width={1904} height={897} />
                </div>
              </div>
            )}
            <p className="selected-work__label selected-work__kind">{project.index} <span aria-hidden="true">/</span> {project.kind}</p>
            <h3>{project.title}</h3>
            <p className="selected-work__description">{project.description}</p>
            <ul className="selected-work__stack" aria-label={`${project.title} technologies`}>
              {project.stack.map((technology) => <li key={technology}>{technology}</li>)}
            </ul>
            <div className="selected-work__links">
              <a href={project.website} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${project.title} (opens in a new tab)`}>Live site <ArrowUpRight size={16} aria-hidden="true" /></a>
              <a href={project.repository} target="_blank" rel="noopener noreferrer" aria-label={`View ${project.title} source on GitHub (opens in a new tab)`}>GitHub <ArrowUpRight size={16} aria-hidden="true" /></a>
            </div>
          </article>
        ))}
        <article className="selected-work__project selected-work__feature">
          <div className="selected-work__visual selected-work__console-art" aria-hidden="true">
            <div className="selected-work__console-bar"><span>OSHER / DEPLOY</span><span>● DEMO</span></div>
            <p>Deployment Console<span>.</span></p>
            <div className="selected-work__console-metrics">
              <div><strong>2/2</strong><span>Sites online</span></div>
              <div><strong>2/2</strong><span>Fallback timers</span></div>
            </div>
            <div className="selected-work__console-log"><strong>SUCCESS</strong><span>Release 73da621 is serving traffic</span></div>
            <div className="selected-work__console-log"><strong>INFO</strong><span>Authenticated Actions signal received</span></div>
          </div>
          <div className="selected-work__feature-copy">
            <p className="selected-work__label selected-work__kind">Infrastructure · Observability</p>
            <h3>Deployment Console</h3>
            <p className="selected-work__description">A private dashboard for Linux deployments, with release health, searchable event logs, and file integrity checks. The interactive demo lets you follow a release, see a rollback, and inspect an integrity alert using sample data.</p>
            <ul className="selected-work__stack" aria-label="Deployment Console technologies">
              {["JavaScript", "Python", "systemd", "Cloudflare Access"].map((technology) => <li key={technology}>{technology}</li>)}
            </ul>
            <div className="selected-work__links">
              <a href="/deployment-console/">Interactive demo</a>
              <a href="https://github.com/shalev-os/oshercc/tree/main/public/deployment-console" target="_blank" rel="noopener noreferrer">GitHub source <ArrowUpRight size={16} aria-hidden="true" /></a>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
