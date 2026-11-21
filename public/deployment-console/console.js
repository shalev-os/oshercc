const byId = (id) => document.getElementById(id);
const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium", timeStyle: "short",
});
const timestamp = (value) => value ? dateFormat.format(new Date(value)) : "—";
const logTime = new Intl.DateTimeFormat(undefined, {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit",
});
const chartTime = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const hour = 3600000;
const windowSize = 4 * hour;
const windowCount = 6;
const pageSize = 12;
let visibleCount = pageSize;
let eventEntries = [];
let matchingEvents = [];
let sampledTime = Date.now();
let severity = "";
let selectedWindow = null;

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

function windowBounds(index) {
  const start = sampledTime - (windowCount - index) * windowSize;
  return [start, start + windowSize];
}

function updateChartSelection() {
  for (const button of byId("activity-chart").querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.index) === selectedWindow));
  }
}

function renderChart() {
  const chart = byId("activity-chart");
  const activeIndex = chart.contains(document.activeElement) ? document.activeElement.dataset.index : undefined;
  const windows = Array.from({ length: windowCount }, (_, index) => {
    const [start, end] = windowBounds(index);
    const count = eventEntries.filter((event) => {
      const time = Date.parse(event.time);
      return time >= start && (index === windowCount - 1 ? time <= end : time < end);
    }).length;
    return { start, end, count, index };
  });
  const maximum = Math.max(1, ...windows.map(({ count }) => count));
  chart.replaceChildren(...windows.map(({ start, end, count, index }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.index = index;
    button.setAttribute("aria-label", `${count} events from ${timestamp(start)} to ${timestamp(end)}`);
    const total = document.createElement("strong");
    total.textContent = count;
    const bar = document.createElement("meter");
    bar.max = maximum;
    bar.value = count;
    bar.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = chartTime.format(start);
    button.append(total, bar, label);
    button.addEventListener("click", () => {
      selectedWindow = selectedWindow === index ? null : index;
      byId("event-range").value = "";
      updateChartSelection();
      resetEventRows();
    });
    return button;
  }));
  updateChartSelection();
  if (activeIndex !== undefined) chart.querySelectorAll("button")[Number(activeIndex)]?.focus();
}

function filteredJson() {
  return JSON.stringify(matchingEvents, null, 2);
}

function resetEventRows() {
  visibleCount = pageSize;
  renderEvents();
}

function renderEvents() {
  const phrase = byId("event-query").value.trim().toLowerCase();
  const site = byId("event-site").value;
  const range = Number(byId("event-range").value);
  const window = selectedWindow === null ? null : windowBounds(selectedWindow);
  const scopedEvents = eventEntries.filter((event) => {
    const time = Date.parse(event.time);
    const inWindow = !window || (time >= window[0] && (selectedWindow === windowCount - 1 ? time <= window[1] : time < window[1]));
    return inWindow && (!range || time >= sampledTime - range * hour) &&
      (!site || event.site === site) &&
      (!phrase || [event.message, event.site, event.component].some((value) => value.toLowerCase().includes(phrase)));
  });
  for (const button of document.querySelectorAll("[data-severity]")) {
    const level = button.dataset.severity;
    button.setAttribute("aria-pressed", String(level === severity));
    button.querySelector("strong").textContent = scopedEvents.filter((event) => event.level === level).length;
  }
  matchingEvents = scopedEvents.filter((event) => !severity || event.level === severity);
  const rows = matchingEvents.slice(0, visibleCount);
  byId("event-count").textContent = matchingEvents.length
    ? `Showing ${rows.length} of ${matchingEvents.length} events`
    : "No matching events";
  byId("show-more").hidden = rows.length >= matchingEvents.length;
  byId("export-events").disabled = !matchingEvents.length;
  if (byId("json-panel").open) byId("event-json").textContent = filteredJson();
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

function formatBytes(bytes) {
  const gib = 1024 ** 3;
  return bytes >= gib ? (bytes / gib).toFixed(1) + " GiB" : Math.round(bytes / 1024 ** 2) + " MiB";
}

function renderHost(host) {
  if (!host) return;
  const hours = Math.floor(host.uptime / 3600);
  const days = Math.floor(hours / 24);
  byId("host-uptime").textContent = days ? `Uptime ${days}d ${hours % 24}h` : `Uptime ${hours}h ${Math.floor(host.uptime / 60) % 60}m`;
  byId("host-load").textContent = host.load[0].toFixed(2);
  byId("host-cores").textContent = `1-minute average · ${host.cores} CPU${host.cores === 1 ? "" : "s"}`;
  for (const resource of ["memory", "swap", "disk"]) {
    const { used, total } = host[resource];
    const meter = byId(resource + "-meter");
    meter.hidden = total === 0;
    meter.value = total ? Math.round(100 * used / total) : 0;
    meter.dataset.pressure = String(meter.value >= 85);
    byId(resource + "-amount").textContent = total ? formatBytes(used) + " / " + formatBytes(total) : "Unconfigured";
  }
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
  renderHost(data.host);
  const sourceSelect = byId("event-site");
  for (const site of sites) {
    if (![...sourceSelect.options].some((option) => option.value === site.domain)) {
      sourceSelect.add(new Option(site.domain, site.domain));
    }
  }
  eventEntries = data.events.entries;
  sampledTime = Date.parse(data.sampled);
  byId("event-update").textContent = data.events.updated
    ? "Collected " + timestamp(data.events.updated)
    : "Log snapshot unavailable";
  renderChart();
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

for (const id of ["event-query", "event-site"]) {
  byId(id).addEventListener("input", resetEventRows);
}
byId("event-range").addEventListener("input", () => {
  selectedWindow = null;
  updateChartSelection();
  resetEventRows();
});
for (const button of document.querySelectorAll("[data-severity]")) {
  button.addEventListener("click", () => {
    severity = severity === button.dataset.severity ? "" : button.dataset.severity;
    resetEventRows();
  });
}
byId("clear-filters").addEventListener("click", () => {
  for (const id of ["event-query", "event-site", "event-range"]) byId(id).value = "";
  severity = "";
  selectedWindow = null;
  updateChartSelection();
  resetEventRows();
});
byId("show-more").addEventListener("click", () => {
  visibleCount += pageSize;
  renderEvents();
});
byId("export-events").addEventListener("click", () => {
  const blob = new Blob([filteredJson()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const download = document.createElement("a");
  download.href = url;
  download.download = "deployment-events.json";
  download.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
byId("json-panel").addEventListener("toggle", () => {
  if (byId("json-panel").open) byId("event-json").textContent = filteredJson();
});
byId("copy-json").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(filteredJson());
    byId("copy-status").textContent = "Copied";
  } catch {
    byId("copy-status").textContent = "Clipboard unavailable. Select the JSON to copy it.";
  }
});
export function startLive() {
  byId("refresh").addEventListener("click", refresh);
  setInterval(refresh, 15000);
  refresh();
}
