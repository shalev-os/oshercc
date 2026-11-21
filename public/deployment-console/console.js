const byId = (id) => document.getElementById(id);
const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium", timeStyle: "short",
});
const timestamp = (value) => value ? dateFormat.format(new Date(value)) : "—";
const logTime = new Intl.DateTimeFormat(undefined, {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit",
});
const pageSize = 12;
let visibleCount = pageSize;
let eventEntries = [];
let matchingEvents = [];

function renderSite(site) {
  const card = byId("site-card").content.cloneNode(true);
  const select = (className) => card.querySelector(className);
  const badge = select(".badge");
  badge.textContent = site.deploying ? "Deploying" : site.failed ? "Deploy failed" : site.online ? "Online" : "Offline";
  badge.dataset.tone = site.deploying ? "warn" : site.failed || !site.online ? "error" : "ok";
  select(".site-mark").textContent = site.mark;
  select("h3").textContent = site.name;
  const url = select(".site-url");
  if (site.repo) url.href = "https://" + site.domain;
  url.textContent = site.domain;
  const release = select(".release");
  if (site.release && site.repo) {
    const commit = document.createElement("a");
    commit.href = "https://github.com/" + site.repo + "/commit/" + site.release;
    commit.textContent = site.release.slice(0, 7);
    commit.target = "_blank";
    commit.rel = "noopener";
    release.append(commit);
  } else {
    release.textContent = site.release?.slice(0, 7) || "—";
  }
  select(".published").textContent = timestamp(site.published);
  select(".signal").textContent = timestamp(site.signal);
  select(".last-check").textContent = timestamp(site.lastCheck);
  select(".timer").textContent = site.timer ? "Active" : "Inactive";
  if (site.repo) {
    select(".workflow").href = "https://github.com/" + site.repo + "/actions";
  } else {
    select(".workflow").remove();
  }
  return card;
}

function renderEvents() {
  const phrase = byId("event-query").value.trim().toLowerCase();
  const site = byId("event-site").value;
  const level = byId("event-level").value;
  matchingEvents = eventEntries.filter((event) =>
    (!site || event.site === site) && (!level || event.level === level) &&
    (!phrase || [event.message, event.site, event.component].some((value) => value.toLowerCase().includes(phrase)))
  );
  const rows = matchingEvents.slice(0, visibleCount);
  byId("event-count").textContent = matchingEvents.length
    ? `Showing ${rows.length} of ${matchingEvents.length} events`
    : "No matching events";
  byId("show-more").hidden = rows.length >= matchingEvents.length;
  byId("export-events").disabled = !matchingEvents.length;
  byId("events").replaceChildren(...rows.map((event) => {
    const item = document.createElement("li");
    const badge = document.createElement("span");
    badge.className = "event-level";
    badge.dataset.level = event.level;
    badge.textContent = event.level;
    const detail = document.createElement("div");
    detail.className = "event-detail";
    const source = document.createElement("small");
    source.textContent = event.site + " · " + event.component;
    detail.append(event.message, source);
    const time = document.createElement("time");
    time.dateTime = event.time;
    time.textContent = logTime.format(new Date(event.time));
    item.append(badge, detail, time);
    return item;
  }));
}

export function renderStatus(data) {
  const { sites, security } = data;
  byId("live").textContent = sites.filter((site) => site.online).length + "/" + sites.length;
  byId("building").textContent = sites.filter((site) => site.deploying).length;
  byId("fallback").textContent = sites.filter((site) => site.timer).length + "/" + sites.length;
  byId("sites").replaceChildren(...sites.map(renderSite));
  byId("sample").textContent = "Updated " + timestamp(data.sampled);
  const audit = byId("audit-status");
  audit.textContent = security.auditActive ? "Active" : "Inactive";
  audit.dataset.tone = security.auditActive ? "ok" : "error";
  const [label, tone] = {
    clean: ["Baseline matches", "ok"],
    changes: ["Changes detected", "warn"],
    running: ["Scanning", "warn"],
    pending: ["Awaiting scan", "warn"],
    failed: ["Scan failed", "error"],
  }[security.integrity];
  byId("integrity-status").textContent = label;
  byId("integrity-status").dataset.tone = tone;
  byId("last-scan").textContent = timestamp(security.lastScan);
  byId("next-scan").textContent = security.integrityTimer ? timestamp(security.nextScan) : "Timer inactive";
  const sourceSelect = byId("event-site");
  for (const site of sites) {
    if (![...sourceSelect.options].some((option) => option.value === site.domain)) {
      sourceSelect.add(new Option(site.domain, site.domain));
    }
  }
  eventEntries = data.events.entries;
  byId("event-update").textContent = data.events.updated
    ? "Collected " + timestamp(data.events.updated)
    : "Log snapshot unavailable";
  renderEvents();
}

async function refresh() {
  const button = byId("refresh");
  if (button.disabled) return;
  button.disabled = true;
  try {
    const response = await fetch("api/status", { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Status unavailable");
    renderStatus(await response.json());
    byId("connection").textContent = "Live";
    byId("connection").dataset.stale = "false";
  } catch {
    byId("connection").textContent = "Live status unavailable";
    byId("connection").dataset.stale = "true";
  } finally {
    button.disabled = false;
  }
}

for (const id of ["event-query", "event-site", "event-level"]) {
  byId(id).addEventListener("input", () => {
    visibleCount = pageSize;
    renderEvents();
  });
}
byId("show-more").addEventListener("click", () => {
  visibleCount += pageSize;
  renderEvents();
});
byId("export-events").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(matchingEvents, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const download = document.createElement("a");
  download.href = url;
  download.download = "deployment-events.json";
  download.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
if (byId("refresh")) {
  byId("refresh").addEventListener("click", refresh);
  setInterval(refresh, 15000);
  refresh();
}
