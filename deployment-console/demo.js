import { renderStatus, startRefresh } from "./console.js";

const time = (minutes) => new Date(Date.now() + minutes * 60000).toISOString();
const demoStarted = Date.now();
const timerCycle = 300000;
const sampleTimer = (offset) => {
  const elapsed = (Date.now() - demoStarted + offset) % timerCycle;
  const last = Date.now() - elapsed;
  return { lastTimer: new Date(last).toISOString(), nextBuild: new Date(last + timerCycle).toISOString() };
};
const site = (domain, name, mark, release, minutes) => ({
  domain, name, mark, release, published: time(minutes), lastCheck: time(-2),
  signal: time(minutes - 1), online: true, deploying: false, failed: false, timer: true,
});
const event = (minutes, source, component, level, message, details) => ({
  time: time(minutes), site: source, component, level, message, details,
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
    { ...site(portfolio, "Studio Portfolio", "SP", "73da621", -36), ...sampleTimer(90000) },
    { ...site(catalog, "Workshop Catalogue", "WC", "84be103", -82), ...sampleTimer(165000) },
  ];
  const security = {
    auditActive: true, audit: { watches: 8, lost: 0 }, integrity: "clean", integrityTimer: true,
    lastScan: time(-210), nextScan: time(1230), fail2ban: true, ssh: { banned: 1, failed: 8 },
  };
  const mib = 1024 ** 2;
  const host = {
    uptime: 379200, load: [.24, .18, .15], cores: 2,
    memory: { used: 370 * mib, total: 1024 * mib },
    swap: { used: 92 * mib, total: 1024 * mib },
    disk: { used: 4200 * mib, total: 8192 * mib },
  };
  const entries = [
    event(-4, "console.example", "Visits", "info", "Page loaded", { page: "Console", httpStatus: 200, originResponseMs: 9, responseBytes: 9214, originProtocol: "HTTP/1.1" }),
    event(-5, portfolio, "Visits", "info", "Page loaded", { page: "Home page", httpStatus: 200, originResponseMs: 11, responseBytes: 4976, originProtocol: "HTTP/1.1" }),
    event(-7, catalog, "Visits", "info", "Page loaded", { page: "Home page", httpStatus: 200, originResponseMs: 8, responseBytes: 6544, originProtocol: "HTTP/1.1" }),
    event(-36, portfolio, "Deploy", "success", "Release 73da621 is serving traffic", { commit: "73da621", outcome: "published", healthCheck: "passed" }),
    event(-36, portfolio, "Build", "success", "Vite build completed", { tool: "Vite", durationSeconds: 8.4, outcome: "built" }),
    event(-37, portfolio, "Deploy", "info", "Deploy started", { phase: "started", trigger: "GitHub Actions" }),
    event(-37, portfolio, "GitHub Actions", "info", "Authenticated signal received", { trigger: "GitHub Actions", phase: "accepted" }),
    event(-82, catalog, "Deploy", "success", "Release 84be103 is serving traffic", { commit: "84be103", outcome: "published", healthCheck: "passed" }),
    event(-83, catalog, "Build", "success", "Vite build completed", { tool: "Vite", durationSeconds: 11.2, outcome: "built" }),
    event(-105, "server", "Fail2ban", "warning", "Fail2ban blocked an SSH source.", { jail: "sshd", action: "blocked", sourceIp: "198.51.100.24" }),
    event(-140, "server", "Auditd", "info", "Web server configuration changed", { auditEventId: "1024", rule: "demo_web_config", result: "success" }),
    event(-210, "server", "AIDE", "success", "Protected files match the integrity baseline", { baseline: "matched", outcome: "verified" }),
  ];
  if (mode === "deploying") {
    Object.assign(sites[0], { deploying: true, building: true, lastCheck: time(-1), signal: time(-1) });
    host.load[0] = 1.18;
    host.memory.used = 691 * mib;
    entries.unshift(event(-1, portfolio, "Build", "info", "Building validated commit 3a91fc8", { commit: "3a91fc8", ciStatus: "success", phase: "building" }));
  }
  if (mode === "rollback") {
    Object.assign(sites[1], { failed: true, lastCheck: time(-1), signal: time(-2) });
    entries.unshift(
      event(-1, catalog, "Deploy", "error", "Health check failed. Previous release restored.", { healthCheck: "failed", rollback: "restored" }),
      event(-2, catalog, "GitHub Actions", "info", "Authenticated signal received", { trigger: "GitHub Actions", phase: "accepted" }),
    );
  }
  if (mode === "integrity") {
    Object.assign(security, { integrity: "changes", lastScan: time(-1) });
    entries.unshift(event(-1, "server", "AIDE", "warning", "Integrity baseline differences detected", { baseline: "changed", entries: 2 }));
  }
  sites.push({ ...sites[0], domain: "console.example", name: "Deployment Console", mark: "DC", sharedTimer: true });
  return { sampled: time(0), sites, security, host, events: { entries, updated: time(0) } };
}

const controls = [...document.querySelectorAll("[data-scenario]")];
let mode = "healthy";
for (const button of controls) {
  button.addEventListener("click", () => {
    for (const control of controls) {
      control.setAttribute("aria-pressed", String(control === button));
    }
    mode = button.dataset.scenario;
    document.getElementById("scenario-description").textContent = scenarios[mode];
    renderStatus(scenarioData(mode));
  });
}
startRefresh(() => renderStatus(scenarioData(mode)));
