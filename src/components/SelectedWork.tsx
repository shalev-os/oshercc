import { ArrowUpRight, Check, GitBranch, PackageCheck, Server } from "lucide-react";
import mazonPreview from "@/assets/mazonhaosher-project.jpg";
import "./selected-work.css";

const releaseSteps = [
  { icon: GitBranch, title: "GitHub", detail: "Review and build" },
  { icon: PackageCheck, title: "Release", detail: "Signed artifact" },
  { icon: Server, title: "IIS", detail: "Deploy and verify" },
];

const projects = [
  {
    index: "01",
    kind: "Personal portfolio · Infrastructure",
    title: "osher.cc",
    description: "My portfolio is also a live infrastructure project. Each release is built in GitHub Actions, signed, and checked on IIS. The deployment receiver keeps a backup so it can recover if the local health check fails.",
    stack: ["React", "GitHub Actions", "Windows Server", "Cloudflare"],
    website: "https://osher.cc/",
    repository: "https://github.com/shalev-os/oshercc",
  },
  {
    index: "02",
    kind: "Small business · Web catalogue",
    title: "Mazon HaOsher",
    description: "A Hebrew storefront for Almog’s handmade cookies, cakes, and desserts. Her photography anchors a browsable catalogue, with product details and a WhatsApp enquiry for each item.",
    stack: ["React", "TypeScript", "Hebrew RTL", "IIS"],
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
        <p>Two live websites that connect the work on screen with the systems behind it.</p>
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
      </div>
    </section>
  );
}
