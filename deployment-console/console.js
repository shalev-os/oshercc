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
const refreshPreference = "osher-console-refresh";
const pageSize = 12;
let visibleCount = pageSize;
let eventEntries = [];
let matchingEvents = [];
let sampledTime = Date.now();
let clockOffset = 0;
let severity = "";
let selectedWindow = null;
let inspectedEvent = null;
let chartWindows = [];

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
  const schedule = select(".build-window");
  const timerState = select(".timer-state");
  timerState.textContent = site.timer ? "Timer running" : "Timer inactive";
  timerState.dataset.running = String(site.timer);
  const nextBuild = select(".next-build");
  if (site.timer && site.nextBuild) {
    schedule.dataset.next = site.nextBuild;
    schedule.dataset.last = site.lastTimer || "";
    nextBuild.dateTime = site.nextBuild;
    nextBuild.textContent = logTime.format(new Date(site.nextBuild));
  }
  select(".build-countdown").textContent = site.timer ? "Awaiting schedule" : "Paused";
  select(".last-timer").textContent = timestamp(site.lastTimer);
  select(".build-state").textContent = site.building ? "Building now" : site.deploying ? "Deploying" : "Idle";
  if (site.sharedTimer) {
    select(".build-window-note").textContent = "Shared release schedule with the portfolio.";
  }
  if (site.repo) {
    select(".workflow").href = "https://github.com/" + site.repo + "/actions";
  } else {
    select(".workflow").remove();
  }
  return card;
}

function updateBuildCountdowns() {
  const now = Date.now() + clockOffset;
  for (const schedule of document.querySelectorAll(".build-window[data-next]")) {
    const next = Date.parse(schedule.dataset.next);
    const last = Date.parse(schedule.dataset.last);
    const seconds = Math.max(0, Math.ceil((next - now) / 1000));
    const minutes = Math.floor(seconds / 60);
    schedule.querySelector(".build-countdown").textContent =
      seconds > 0 ? `${minutes}m ${String(seconds % 60).padStart(2, "0")}s` : "Check due";
    const meter = schedule.querySelector(".build-progress");
    meter.hidden = !(last < next);
    if (!meter.hidden) meter.value = Math.max(0, Math.min(100, 100 * (now - last) / (next - last)));
  }
}

function windowBounds(index) {
  return chartWindows[index] || [sampledTime - windowSize, sampledTime];
}

function updateChartSelection() {
  for (const button of byId("activity-chart").querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.index) === selectedWindow));
  }
}

function renderChart() {
  const chart = byId("activity-chart");
  const activeIndex = chart.contains(document.activeElement) ? document.activeElement.dataset.index : undefined;
  const range = Number(byId("event-range").value);
  const filtered = matchingEvents;
  const earliest = filtered.reduce((minimum, event) => Math.min(minimum, Date.parse(event.time)), sampledTime);
  const span = range ? range * hour : Math.max(windowSize, sampledTime - earliest);
  const startTime = sampledTime - span;
  chartWindows = Array.from({ length: windowCount }, (_, index) => {
    const start = startTime + span * index / windowCount;
    return [start, startTime + span * (index + 1) / windowCount];
  });
  const labelTime = span > 48 * hour
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric" })
    : chartTime;
  const windows = chartWindows.map(([start, end], index) => {
    const count = filtered.filter((event) => {
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
    label.textContent = labelTime.format(start);
    button.append(total, bar, label);
    button.addEventListener("click", () => {
      selectedWindow = selectedWindow === index ? null : index;
      updateChartSelection();
      resetEventRows();
    });
    return button;
  }));
  updateChartSelection();
  if (activeIndex !== undefined) chart.querySelectorAll("button")[Number(activeIndex)]?.focus({ preventScroll: true });
}

function filteredJson() {
  return JSON.stringify(matchingEvents, null, 2);
}

function filteredCsv() {
  const fields = ["time", "site", "component", "level", "message", "details"];
  const quote = (value) => {
    const text = value && typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
    const safe = /^[=+@\-\r\n\t]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  return "\uFEFF" + [fields.join(","), ...matchingEvents.map(event => fields.map(field => quote(event[field])).join(","))].join("\r\n");
}

function eventContext(event) {
  const context = document.createElement("dl");
  context.className = "event-context";
  for (const [key, value] of Object.entries(event.details || {})) {
    const group = document.createElement("div");
    const title = document.createElement("dt");
    title.textContent = key.replace(/([a-z])([A-Z])/g, "$1 $2");
    const description = document.createElement("dd");
    description.textContent = key === "commit" ? value.slice(0, 12) : String(value);
    group.append(title, description);
    context.append(group);
  }
  return context;
}

function downloadEvents(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const download = document.createElement("a");
  download.href = url;
  download.download = filename;
  download.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resetEventRows() {
  visibleCount = pageSize;
  renderEvents();
}

function renderEvents() {
  const phrase = byId("event-query").value.trim().toLowerCase();
  const site = byId("event-site").value;
  const category = byId("event-category").value;
  const range = Number(byId("event-range").value);
  for (const button of document.querySelectorAll("[data-range]")) {
    button.setAttribute("aria-pressed", String(button.dataset.range === byId("event-range").value));
  }
  const window = selectedWindow === null ? null : windowBounds(selectedWindow);
  const scopedEvents = eventEntries.filter((event) => {
    const time = Date.parse(event.time);
    const inWindow = !window || (time >= window[0] && (selectedWindow === windowCount - 1 ? time <= window[1] : time < window[1]));
    return inWindow && (!range || time >= sampledTime - range * hour) &&
      (!site || event.site === site) &&
      (!category || event.component === category) &&
      (!phrase || [event.message, event.site, event.component, JSON.stringify(event.details || {})]
        .some((value) => value.toLowerCase().includes(phrase)));
  });
  for (const button of document.querySelectorAll("[data-severity]")) {
    const level = button.dataset.severity;
    button.setAttribute("aria-pressed", String(level === severity));
    button.querySelector("strong").textContent = scopedEvents.filter((event) => event.level === level).length;
  }
  matchingEvents = scopedEvents.filter((event) => !severity || event.level === severity);
  renderChart();
  const rows = matchingEvents.slice(0, visibleCount);
  byId("event-count").textContent = matchingEvents.length
    ? `Showing ${rows.length} of ${matchingEvents.length} events`
    : "No matching events";
  byId("show-more").hidden = rows.length >= matchingEvents.length;
  byId("export-events").disabled = !matchingEvents.length;
  byId("export-csv").disabled = !matchingEvents.length;
  if (byId("json-panel").open) byId("event-json").textContent = filteredJson();
  const list = byId("events");
  const focused = list.contains(document.activeElement) ? document.activeElement.dataset.event : undefined;
  list.replaceChildren(...rows.map((event) => {
    const item = document.createElement("li");
    const badge = document.createElement("span");
    badge.className = "event-level";
    badge.dataset.level = event.level;
    badge.textContent = event.level;
    const detail = document.createElement("div");
    detail.className = "event-detail";
    const source = document.createElement("small");
    source.textContent = event.site + " · " + event.component;
    const key = JSON.stringify(event);
    const inspect = document.createElement("button");
    inspect.type = "button";
    inspect.className = "event-inspect";
    inspect.dataset.event = key;
    inspect.textContent = event.message;
    inspect.setAttribute("aria-expanded", String(inspectedEvent === key));
    inspect.addEventListener("click", () => {
      inspectedEvent = inspectedEvent === key ? null : key;
      renderEvents();
    });
    detail.append(inspect, source);
    if (event.details) detail.append(eventContext(event));
    const time = document.createElement("time");
    time.dateTime = event.time;
    time.textContent = logTime.format(new Date(event.time));
    item.append(badge, detail, time);
    if (inspectedEvent === key) {
      const json = document.createElement("pre");
      json.className = "event-json";
      json.tabIndex = 0;
      json.setAttribute("aria-label", "Event JSON");
      json.textContent = JSON.stringify(event, null, 2);
      item.append(json);
    }
    return item;
  }));
  if (focused) [...list.querySelectorAll(".event-inspect")].find(button => button.dataset.event === focused)?.focus({ preventScroll: true });
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
  const independentSites = sites.filter(site => !site.sharedTimer);
  byId("fallback").textContent = independentSites.filter((site) => site.timer).length + "/" + independentSites.length;
  byId("sites").replaceChildren(...sites.map(renderSite));
  byId("sample").textContent = "Updated " + timestamp(data.sampled);
  const audit = byId("audit-status");
  audit.textContent = security.auditActive ? "Active" : "Inactive";
  audit.dataset.tone = security.auditActive ? "ok" : "error";
  audit.hidden = false;
  byId("audit-watches").textContent = security.audit?.watches ?? "—";
  byId("audit-lost").textContent = security.audit?.lost ?? "—";
  const ssh = byId("ssh-status");
  ssh.textContent = security.fail2ban ? "Active" : "Inactive";
  ssh.dataset.tone = security.fail2ban ? "ok" : "error";
  ssh.hidden = false;
  byId("ssh-blocked").textContent = security.ssh?.banned ?? "—";
  byId("ssh-failures").textContent = security.ssh?.failed ?? "—";
  const [label, tone] = {
    clean: ["Baseline matches", "ok"],
    changes: ["Changes detected", "warn"],
    running: ["Scanning", "warn"],
    pending: ["Awaiting scan", "warn"],
    failed: ["Scan failed", "error"],
  }[security.integrity];
  byId("integrity-status").textContent = label;
  byId("integrity-status").dataset.tone = tone;
  byId("integrity-status").hidden = false;
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
  const categorySelect = byId("event-category");
  for (const category of [...new Set(eventEntries.map(event => event.component))].sort()) {
    if (![...categorySelect.options].some(option => option.value === category)) {
      categorySelect.add(new Option(category, category));
    }
  }
  sampledTime = Date.parse(data.sampled);
  clockOffset = sampledTime - Date.now();
  byId("event-update").textContent = data.events.updated
    ? "Collected " + timestamp(data.events.updated)
    : "Log snapshot unavailable";
  renderEvents();
  updateBuildCountdowns();
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

for (const id of ["event-query", "event-site", "event-category"]) {
  byId(id).addEventListener("input", resetEventRows);
}
byId("event-range").addEventListener("input", () => {
  selectedWindow = null;
  updateChartSelection();
  resetEventRows();
});
for (const button of document.querySelectorAll("[data-range]")) {
  button.addEventListener("click", () => {
    byId("event-range").value = button.dataset.range;
    selectedWindow = null;
    updateChartSelection();
    resetEventRows();
  });
}
for (const button of document.querySelectorAll("[data-severity]")) {
  button.addEventListener("click", () => {
    severity = severity === button.dataset.severity ? "" : button.dataset.severity;
    resetEventRows();
  });
}
byId("clear-filters").addEventListener("click", () => {
  for (const id of ["event-query", "event-site", "event-category", "event-range"]) byId(id).value = "";
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
  downloadEvents(filteredJson(), "application/json", "deployment-events.json");
});
byId("export-csv").addEventListener("click", () => {
  downloadEvents(filteredCsv(), "text/csv;charset=utf-8", "deployment-events.csv");
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
export function startRefresh(update) {
  const select = byId("refresh-rate");
  const button = byId("refresh");
  let timer;
  try {
    const saved = window.localStorage.getItem(refreshPreference);
    const preferred = saved === "ultra" ? "5" : saved;
    if ([...select.options].some(option => option.value === preferred)) select.value = preferred;
  } catch {
    // The current page still works when browser storage is unavailable.
  }
  const schedule = () => {
    clearInterval(timer);
    timer = setInterval(() => {
      if (!document.hidden) update();
    }, Number(select.value) * 1000);
  };
  select.addEventListener("change", () => {
    try {
      window.localStorage.setItem(refreshPreference, select.value);
    } catch {
      // Keep the user's selection for this page even without persistent storage.
    }
    schedule();
    update();
  });
  button.hidden = false;
  button.addEventListener("click", update);
  setInterval(updateBuildCountdowns, 1000);
  schedule();
  update();
}

export function startLive() {
  byId("live-controls").hidden = false;
  const views = {
    overview: {},
    builds: { category: "Build" },
    rollbacks: { query: "rollback" },
    integrity: { category: "AIDE", level: "warning" },
    visits: { category: "Visits" },
  };
  for (const button of byId("live-controls").querySelectorAll("button")) {
    button.addEventListener("click", () => {
      const { query = "", category = "", level = "" } = views[button.dataset.liveView];
      byId("event-query").value = query;
      byId("event-site").value = "";
      byId("event-range").value = "";
      const select = byId("event-category");
      if (![...select.options].some(option => option.value === category)) select.add(new Option(category, category));
      select.value = category;
      severity = level;
      selectedWindow = null;
      updateChartSelection();
      resetEventRows();
      byId("activity-heading").scrollIntoView?.({ block: "start" });
    });
  }
  startRefresh(refresh);
}
