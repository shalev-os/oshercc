import { renderStatus } from "./console.js";

const time = (minutes) => new Date(Date.now() + minutes * 60000).toISOString();
const site = (domain, name, mark, release, minutes) => ({
  domain, name, mark, release, published: time(minutes), lastCheck: time(-2),
  signal: time(minutes - 1), online: true, deploying: false, failed: false, timer: true,
});
const event = (minutes, source, component, level, message) => ({
  time: time(minutes), site: source, component, level, message,
});
const portfolio = "portfolio.example";
const catalog = "catalog.example";
const scenarios = {
  healthy: "Both sample sites are live and the latest file integrity check passed.",
  deploying: "A validated commit arrived. The existing release stays online while the server builds.",
  rollback: "The candidate failed its health check. The console shows the failure while the prior release serves traffic.",
  integrity: "AIDE flagged a baseline change for review. Both sample sites are still serving traffic.",
};

function scenarioData(mode) {
  const sites = [
    site(portfolio, "Studio Portfolio", "SP", "73da621", -36),
    site(catalog, "Workshop Catalogue", "WC", "84be103", -82),
  ];
  const security = { auditActive: true, integrity: "clean", integrityTimer: true, lastScan: time(-210), nextScan: time(1230) };
  const entries = [
    event(-36, portfolio, "Deploy", "success", "Release 73da621 is serving traffic"),
    event(-36, portfolio, "Build", "success", "Built in 8.4s"),
    event(-37, portfolio, "Deploy", "info", "Deploy started"),
    event(-37, portfolio, "GitHub Actions", "info", "Authenticated signal received"),
    event(-82, catalog, "Deploy", "success", "Release 84be103 is serving traffic"),
    event(-83, catalog, "Build", "success", "Built in 11.2s"),
    event(-210, "server", "AIDE", "success", "Protected files match the integrity baseline"),
  ];
  if (mode === "deploying") {
    Object.assign(sites[0], { deploying: true, lastCheck: time(-1), signal: time(-1) });
    entries.unshift(event(-1, portfolio, "Build", "info", "Building validated commit 3a91fc8"));
  }
  if (mode === "rollback") {
    Object.assign(sites[1], { failed: true, lastCheck: time(-1), signal: time(-2) });
    entries.unshift(
      event(-1, catalog, "Deploy", "error", "Health check failed. Previous release restored."),
      event(-2, catalog, "GitHub Actions", "info", "Authenticated signal received"),
    );
  }
  if (mode === "integrity") {
    Object.assign(security, { integrity: "changes", lastScan: time(-1) });
    entries.unshift(event(-1, "server", "AIDE", "warning", "Integrity baseline differences detected"));
  }
  return { sampled: time(0), sites, security, events: { entries, updated: time(0) } };
}

const controls = [...document.querySelectorAll("[data-scenario]")];
for (const button of controls) {
  button.addEventListener("click", () => {
    for (const control of controls) {
      control.setAttribute("aria-pressed", String(control === button));
    }
    const mode = button.dataset.scenario;
    document.getElementById("scenario-description").textContent = scenarios[mode];
    renderStatus(scenarioData(mode));
  });
}
renderStatus(scenarioData("healthy"));
