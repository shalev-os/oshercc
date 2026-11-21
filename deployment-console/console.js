const byId = (id) => document.getElementById(id);
const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium", timeStyle: "short",
});
const timestamp = (value) => value ? dateFormat.format(new Date(value)) : "—";
const logTimeOptions = {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit",
};
const logTime = new Intl.DateTimeFormat(undefined, logTimeOptions);
const logTimeUtc = new Intl.DateTimeFormat(undefined, {
  ...logTimeOptions, timeZone: "UTC", timeZoneName: "short",
});
const chartTime = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const hour = 3600000;
const windowSize = 4 * hour;
const windowCount = 6;
const refreshPreference = "osher-console-refresh";
const eventPageSize = byId("event-page-size");
const pageSize = () => Number(eventPageSize.value);
let visibleCount = pageSize();
let eventEntries = [];
let eventsUpdated = null;
let matchingEvents = [];
let sampledTime = Date.now();
let clockOffset = 0;
const severities = new Set();
let hidePageLoads = false;
let relatedFilter = null;
let investigation = null;
let pinnedOnly = false;
const pinnedEvents = new Map();
const ipFields = ["clientIp", "sourceIp"];
const hostCategories = new Map([["Systemd", "host-systemd-count"], ["Host services", "host-service-count"], ["Kernel", "host-kernel-count"]]);
const hostErrors = "Host errors";
let selectedWindow = null;
let inspectedEvent = null;
let chartWindows = [];
let liveMode = false;
const manualDeployments = new Map();

function updateDeployControl(control) {
  const request = manualDeployments.get(control.dataset.deployTarget);
  control.querySelector("button").disabled = Boolean(request?.pending || control.dataset.busy === "true");
  control.querySelector("[role=status]").textContent = request?.message || "";
}

function updateDeployControls(target) {
  for (const control of document.querySelectorAll(".manual-deployment[data-deploy-target]")) {
    if (control.dataset.deployTarget === target) updateDeployControl(control);
  }
}

async function deploySite(target) {
  if (manualDeployments.get(target)?.pending) return;
  const request = { pending: true, message: "Requesting deployment…" };
  manualDeployments.set(target, request);
  updateDeployControls(target);
  try {
    const response = await fetch(`api/deploy/${encodeURIComponent(target)}`, {
      method: "POST",
      headers: { "X-Osher-Deploy": "1" },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status !== 202) throw new Error("Deployment request failed");
    request.message = "Deployment check queued.";
    setTimeout(() => {
      if (manualDeployments.get(target) !== request) return;
      manualDeployments.delete(target);
      updateDeployControls(target);
    }, 4000);
  } catch {
    request.message = "Could not confirm the deployment request.";
  } finally {
    request.pending = false;
    updateDeployControls(target);
    refresh();
  }
}

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
  timerState.textContent = site.manualDeploy ? "No timer" : site.timer ? "Timer running" : "Timer inactive";
  timerState.dataset.running = String(site.timer);
  if (site.manualDeploy) {
    select(".last-timer").parentElement.hidden = true;
    select(".build-window-head span:first-child").textContent = "Deployment schedule";
    select(".build-window-note").textContent = liveMode
      ? "Deploy now checks for a validated release."
      : "Deploy now starts a simulated deployment.";
  }
  const nextBuild = select(".next-build");
  if (site.timer && site.nextBuild) {
    schedule.dataset.next = site.nextBuild;
    schedule.dataset.last = site.lastTimer || "";
    nextBuild.dateTime = site.nextBuild;
    nextBuild.textContent = logTime.format(new Date(site.nextBuild));
  }
  select(".build-countdown").textContent = site.manualDeploy ? "On demand" : site.timer ? "Awaiting schedule" : "Paused";
  select(".last-timer").textContent = timestamp(site.lastTimer);
  select(".build-state").textContent = site.building ? "Building now" : site.deploying ? "Deploying" : "Idle";
  const workflowRepo = site.workflowRepo || site.repo;
  if (workflowRepo) {
    select(".workflow").href = "https://github.com/" + workflowRepo + "/actions";
  } else {
    select(".workflow").remove();
  }
  if (liveMode || site.onDeploy) {
    const control = select(".manual-deployment");
    control.hidden = false;
    const target = site.sharedTimer ? "osher.cc" : site.domain;
    control.dataset.deployTarget = target;
    control.dataset.busy = String(Boolean(site.deploying || site.building));
    const button = control.querySelector("button");
    button.setAttribute("aria-label", `Deploy ${site.domain} now`);
    button.addEventListener("click", site.onDeploy || (() => deploySite(target)));
    updateDeployControl(control);
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

function renderChart(investigationBounds) {
  const chart = byId("activity-chart");
  const activeIndex = chart.contains(document.activeElement) ? document.activeElement.dataset.index : undefined;
  const range = Number(byId("event-range").value);
  const filtered = matchingEvents;
  const earliest = filtered.reduce((minimum, event) => Math.min(minimum, Date.parse(event.time)), sampledTime);
  const endTime = investigationBounds?.[1] ?? sampledTime;
  const span = investigationBounds ? endTime - investigationBounds[0]
    : range ? range * hour : Math.max(windowSize, sampledTime - earliest);
  const startTime = endTime - span;
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
    title.textContent = ({ clientIp: "Client IP", sourceIp: "Source IP" })[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2");
    const description = document.createElement("dd");
    description.textContent = value !== null && typeof value === "object" ? JSON.stringify(value) : String(value);
    group.append(title, description);
    const isIp = ipFields.includes(key);
    if ((isIp || key === "commit") && typeof value === "string" && value.trim()) {
      const related = document.createElement("button");
      related.type = "button";
      related.textContent = "Find related";
      related.setAttribute("aria-label", `Find events for ${isIp ? "IP" : "commit"} ${value}`);
      related.addEventListener("click", () => {
        clearEventFilters();
        relatedFilter = { fields: isIp ? ipFields : ["commit"], label: isIp ? "IP" : "Commit", value };
        resetEventRows();
        byId("clear-related").focus();
      });
      group.append(related);
    }
    if (isIp && typeof value === "string") {
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "copy-ip";
      copy.textContent = "Copy";
      copy.setAttribute("aria-label", "Copy IP address");
      copy.addEventListener("click", async () => {
        try {
          await window.navigator.clipboard.writeText(value);
          copy.textContent = "Copied";
          copy.setAttribute("aria-label", "IP address copied");
        } catch {
          copy.textContent = "Unavailable";
          copy.setAttribute("aria-label", "Clipboard unavailable");
        }
      });
      group.append(copy);
    }
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
  inspectedEvent = null;
  visibleCount = pageSize();
  renderEvents();
}

function eventNavigation(index) {
  const navigation = document.createElement("nav");
  navigation.className = "event-row-navigation";
  navigation.setAttribute("aria-label", "Browse filtered events");

  const position = document.createElement("span");
  position.textContent = `Event ${index + 1} of ${matchingEvents.length}`;

  const buttons = [-1, 1].map((step) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = step < 0 ? "Previous event" : "Next event";
    button.dataset.step = step;
    const nextIndex = index + step;
    button.disabled = !matchingEvents[nextIndex];
    button.addEventListener("click", () => {
      inspectedEvent = JSON.stringify(matchingEvents[nextIndex]);
      visibleCount = Math.max(visibleCount, Math.ceil((nextIndex + 1) / pageSize()) * pageSize());
      renderEvents();
      const row = byId("events").children[nextIndex];
      if (!row) return;
      const nextControl = row.querySelector(`[data-step="${step}"]:enabled`) ?? row.querySelector(".event-inspect");
      nextControl.focus({ preventScroll: true });
      row.querySelector(".event-inspect").scrollIntoView?.({ block: "nearest" });
    });
    return button;
  });

  navigation.append(buttons[0], position, buttons[1]);
  return navigation;
}

function renderSourceBreakdown(events, activeSource) {
  const breakdown = byId("source-breakdown");
  const focusedSource = breakdown.contains(document.activeElement) ? document.activeElement.dataset.source : undefined;
  const counts = new Map();
  for (const event of events) counts.set(event.site, (counts.get(event.site) ?? 0) + 1);
  if (activeSource && !counts.has(activeSource)) counts.set(activeSource, 0);

  const caption = document.createElement("span");
  caption.textContent = "Events by source";
  const sources = [["", events.length], ...[...counts].sort(([first], [second]) => first.localeCompare(second))];
  const buttons = sources.map(([source, count]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.source = source;
    button.setAttribute("aria-pressed", String(source === activeSource));
    button.textContent = `${source || "All sources"} · ${count}`;
    button.addEventListener("click", () => {
      byId("event-site").value = source;
      resetEventRows();
    });
    return button;
  });
  breakdown.hidden = !counts.size;
  breakdown.replaceChildren(caption, ...buttons);
  if (focusedSource !== undefined) (buttons.find(button => button.dataset.source === focusedSource) ?? buttons[0])
    .focus({ preventScroll: true });
}

function renderEvents() {
  const phrase = byId("event-query").value.trim().toLowerCase();
  const site = byId("event-site").value;
  const category = byId("event-category").value;
  const range = Number(byId("event-range").value);
  for (const button of document.querySelectorAll("[data-range]")) {
    button.setAttribute("aria-pressed", String(button.dataset.range === byId("event-range").value));
  }
  const investigationRadius = Number(byId("investigation-radius").value) * 60000;
  const investigationBounds = investigation
    ? [investigation.time - investigationRadius, investigation.time + investigationRadius] : null;
  const bounds = selectedWindow === null ? null : windowBounds(selectedWindow);
  const timeFormat = byId("event-utc").getAttribute("aria-pressed") === "true" ? logTimeUtc : logTime;
  byId("investigation").hidden = !investigation;
  byId("investigation-anchor").textContent = investigation
    ? `${timeFormat.format(investigation.time)} · ${investigation.event.message}` : "";
  byId("related-filter").hidden = !relatedFilter;
  byId("related-value").textContent = relatedFilter ? `${relatedFilter.label} ${relatedFilter.value}` : "";
  byId("hide-page-loads").setAttribute("aria-pressed", String(hidePageLoads));
  byId("pinned-events").setAttribute("aria-pressed", String(pinnedOnly));
  byId("pinned-count").textContent = pinnedEvents.size;
  let entries = pinnedOnly ? [...pinnedEvents.values()] : eventEntries;
  if (investigation && !pinnedOnly && !entries.some(event =>
    event.time === investigation.event.time && JSON.stringify(event) === investigation.key)) {
    entries = [...entries, investigation.event];
  }
  const eventsAcrossSources = entries.filter((event) => {
    const time = Date.parse(event.time);
    const inWindow = !bounds || (time >= bounds[0] && (selectedWindow === windowCount - 1 ? time <= bounds[1] : time < bounds[1]));
    const matchesRelated = !relatedFilter || relatedFilter.fields.some(field =>
      event.details?.[field] === relatedFilter.value);
    const inInvestigation = !investigationBounds || (time >= investigationBounds[0] && time <= investigationBounds[1]);
    return inInvestigation && (!hidePageLoads || event.component !== "Visits") && matchesRelated && inWindow && (!range || time >= sampledTime - range * hour) &&
      (!category || (category === hostErrors ? hostCategories.has(event.component) && event.level === "error" : event.component === category)) &&
      (!phrase || [event.message, event.site, event.component, JSON.stringify(event.details || {})]
        .some((value) => value.toLowerCase().includes(phrase)));
  });
  renderSourceBreakdown(eventsAcrossSources.filter(event => !severities.size || severities.has(event.level)), site);
  const scopedEvents = site ? eventsAcrossSources.filter(event => event.site === site) : eventsAcrossSources;
  for (const button of document.querySelectorAll("[data-severity]")) {
    const level = button.dataset.severity;
    button.setAttribute("aria-pressed", String(severities.has(level)));
    button.querySelector("strong").textContent = scopedEvents.filter((event) => event.level === level).length;
  }
  matchingEvents = scopedEvents.filter((event) => !severities.size || severities.has(event.level));
  const direction = byId("event-order").value === "oldest" ? 1 : -1;
  matchingEvents.sort((first, second) => direction * (Date.parse(first.time) - Date.parse(second.time)));
  renderChart(investigationBounds);
  const rows = matchingEvents.slice(0, visibleCount);
  byId("event-count").textContent = matchingEvents.length
    ? `Showing ${rows.length} of ${matchingEvents.length} events`
    : pinnedOnly && !pinnedEvents.size ? "No pinned events" : "No matching events";
  byId("reset-empty-results").hidden = Boolean(matchingEvents.length) ||
    !(phrase || site || category || range || selectedWindow !== null || relatedFilter ||
      severities.size || hidePageLoads || pinnedOnly || investigation);
  const showMore = byId("show-more");
  const nextCount = Math.min(pageSize(), matchingEvents.length - rows.length);
  showMore.hidden = nextCount === 0;
  byId("show-less").hidden = rows.length <= pageSize();
  showMore.textContent = `Show ${nextCount} more events`;
  byId("export-events").disabled = !matchingEvents.length;
  byId("export-csv").disabled = !matchingEvents.length;
  if (byId("json-panel").open) byId("event-json").textContent = filteredJson();
  const list = byId("events");
  const active = list.contains(document.activeElement) ? document.activeElement : null;
  const focused = active?.closest("li")?.dataset.event;
  const focusedControl = active?.classList.contains("event-pin") ? ".event-pin"
    : active?.classList.contains("event-download") ? ".event-download"
    : active?.classList.contains("event-investigate") ? ".event-investigate"
    : active?.classList.contains("event-copy-summary") ? ".event-copy-summary"
    : active?.dataset.step ? `[data-step="${active.dataset.step}"]:enabled` : ".event-inspect";
  list.replaceChildren(...rows.map((event, index) => {
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
    const pinned = pinnedEvents.has(key);
    item.dataset.event = key;
    if (investigation?.key === key) {
      item.dataset.investigationAnchor = "";
      source.append(" · Investigation starting point");
    }
    if (pinned) {
      const marker = document.createElement("small");
      marker.className = "event-pinned";
      marker.textContent = "Pinned";
      source.append(" · ", marker);
    }
    const inspect = document.createElement("button");
    inspect.type = "button";
    inspect.className = "event-inspect";
    inspect.textContent = event.message;
    inspect.setAttribute("aria-expanded", String(inspectedEvent === key));
    inspect.addEventListener("click", () => {
      inspectedEvent = inspectedEvent === key ? null : key;
      renderEvents();
    });
    detail.append(inspect, source);
    const time = document.createElement("time");
    time.dateTime = event.time;
    time.textContent = timeFormat.format(new Date(event.time));
    item.append(badge, detail, time);
    if (inspectedEvent === key) {
      if (event.details) detail.append(eventContext(event));
      const json = document.createElement("pre");
      json.className = "event-json";
      json.tabIndex = 0;
      json.setAttribute("aria-label", "Event JSON");
      json.textContent = JSON.stringify(event, null, 2);
      const actions = document.createElement("div");
      actions.className = "event-row-actions";
      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = "event-pin";
      pin.textContent = pinned ? "Unpin event" : "Pin event";
      pin.addEventListener("click", () => {
        if (pinned) pinnedEvents.delete(key);
        else pinnedEvents.set(key, event);
        if (pinned && pinnedOnly) inspectedEvent = null;
        renderEvents();
      });
      const download = document.createElement("button");
      download.type = "button";
      download.className = "event-download";
      download.textContent = "Download event JSON";
      download.addEventListener("click", () => downloadEvents(json.textContent, "application/json", "deployment-event.json"));
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "event-copy-summary";
      copy.textContent = "Copy summary";
      const copyStatus = document.createElement("span");
      copyStatus.setAttribute("role", "status");
      copy.addEventListener("click", async () => {
        try {
          await window.navigator.clipboard.writeText(
            `[${event.time}] ${event.level.toUpperCase()} · ${event.site} · ${event.component}\n${event.message}`,
          );
          copyStatus.textContent = "Summary copied";
        } catch {
          copyStatus.textContent = "Clipboard unavailable";
        }
      });
      const investigate = document.createElement("button");
      investigate.type = "button";
      investigate.className = "event-investigate";
      investigate.textContent = "Investigate around this event";
      investigate.addEventListener("click", () => {
        clearEventFilters();
        investigation = { event, key, time: Date.parse(event.time), previousOrder: byId("event-order").value };
        byId("event-order").value = "oldest";
        resetEventRows();
        byId("investigation-radius").focus();
      });
      actions.append(investigate, pin, download, copy, copyStatus);
      item.append(eventNavigation(index), actions, json);
    }
    return item;
  }));
  if (focused) {
    const row = [...list.children].find(item => item.dataset.event === focused);
    const control = row?.querySelector(focusedControl);
    if (control) control.focus({ preventScroll: true });
    else if (focusedControl === ".event-pin" && pinnedOnly) byId("pinned-events").focus({ preventScroll: true });
  }
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

function renderAttention(sites, security) {
  const issues = [];
  for (const site of sites) {
    if (!site.online) issues.push(`${site.domain} is offline`);
    if (site.failed) issues.push(`${site.domain} has a failed deployment`);
    if (!site.timer && !site.sharedTimer && !site.manualDeploy) issues.push(`${site.domain} fallback timer is inactive`);
  }
  if (!security.auditActive) issues.push("System audit is inactive");
  if (!security.fail2ban) issues.push("SSH protection is inactive");
  if (!security.integrityTimer) issues.push("File integrity timer is inactive");
  if (security.integrity === "changes") issues.push("File integrity changes detected");
  if (security.integrity === "failed") issues.push("File integrity scan failed");

  const status = byId("attention-status");
  const message = issues.length ? `${issues.length} active ${issues.length === 1 ? "issue" : "issues"}` : "No active issues in the latest sample";
  if (status.textContent !== message) status.textContent = message;
  const list = byId("attention-items");
  list.hidden = !issues.length;
  list.replaceChildren(...issues.map(issue => {
    const item = document.createElement("li");
    item.textContent = issue;
    return item;
  }));
}

function renderSecurityOperations(events, now, updated) {
  const recent = events.filter(event => {
    const time = Date.parse(event.time);
    return time >= now - 24 * hour && time <= now;
  });
  const blocked = new Set(recent.filter(event => event.component === "Fail2ban" && event.details?.action === "blocked")
    .map(event => event.details.sourceIp).filter(Boolean));
  byId("soc-ssh").textContent = updated ? blocked.size : "—";
  byId("soc-audit").textContent = updated ? recent.filter(event => event.component === "Auditd").length : "—";
  byId("soc-integrity").textContent = updated ? recent.filter(event => event.component === "AIDE" && ["warning", "error"].includes(event.level)).length : "—";
  byId("soc-freshness").textContent = updated ? "Collected " + timestamp(updated) : "Security event snapshot unavailable";
  const alerts = recent.filter(event => event.component === "SOC");
  byId("soc-alert-status").textContent = updated
    ? alerts.length + " alerts in the last 24 hours"
    : "Security event snapshot unavailable";
  const list = byId("soc-alerts");
  list.hidden = !alerts.length;
  list.replaceChildren(...alerts.slice(0, 5).map(event => {
    const item = document.createElement("li");
    item.textContent = timestamp(event.time) + " · " + event.message;
    return item;
  }));
}

function renderTraffic(events, now, updated) {
  const bySite = new Map();
  for (const event of events) {
    const time = Date.parse(event.time);
    if (event.component !== "Visits" || !(time >= now - 24 * hour && time <= now)) continue;

    if (!bySite.has(event.site)) bySite.set(event.site, { loads: 0, clientErrors: 0, serverErrors: 0, times: [] });
    const counts = bySite.get(event.site);
    const { httpStatus, originResponseMs } = event.details || {};
    counts.loads++;
    if (httpStatus >= 400 && httpStatus < 500) counts.clientErrors++;
    if (httpStatus >= 500 && httpStatus < 600) counts.serverErrors++;
    if (Number.isFinite(originResponseMs) && originResponseMs >= 0) counts.times.push(originResponseMs);
  }

  const rows = [...bySite].sort(([left], [right]) => left.localeCompare(right)).map(([site, counts]) => {
    const row = document.createElement("tr");
    const title = document.createElement("th");
    title.scope = "row";
    title.textContent = site;
    row.append(title);
    const times = counts.times.sort((left, right) => left - right);
    const p95 = times[Math.ceil(times.length * 0.95) - 1];
    for (const value of [counts.loads, `${counts.clientErrors} / ${counts.serverErrors}`, p95 === undefined ? "—" : `${p95} ms`]) {
      row.insertCell().textContent = value;
    }
    return row;
  });
  byId("traffic-rows").replaceChildren(...rows);
  byId("traffic-table").hidden = !rows.length;
  const empty = byId("traffic-empty");
  empty.hidden = !!rows.length;
  const message = updated ? "No retained page loads in the last 24 hours" : "Log snapshot unavailable";
  if (empty.textContent !== message) empty.textContent = message;
}

export function renderStatus(data) {
  const { sites, security } = data;
  byId("live").textContent = sites.filter((site) => site.online).length + "/" + sites.length;
  byId("building").textContent = sites.filter((site) => site.deploying).length;
  const independentSites = sites.filter(site => !site.sharedTimer && !site.manualDeploy);
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
  renderAttention(sites, security);
  const sourceSelect = byId("event-site");
  for (const site of sites) {
    if (![...sourceSelect.options].some((option) => option.value === site.domain)) {
      sourceSelect.add(new Option(site.domain, site.domain));
    }
  }
  sampledTime = Date.parse(data.sampled);
  clockOffset = sampledTime - Date.now();
  renderEventSnapshot(data.events);
  updateBuildCountdowns();
}

function renderEventSnapshot(events) {
  if (eventsUpdated && (!events.updated || Date.parse(events.updated) < Date.parse(eventsUpdated))) {
    renderEvents();
    return;
  }
  sampledTime = Math.max(sampledTime, Date.parse(events.updated) || 0);
  eventEntries = events.entries;
  const sourceSelect = byId("event-site");
  const knownSources = new Set([...sourceSelect.options].map(option => option.value));
  for (const source of new Set(eventEntries.map(event => event.site))) {
    if (!knownSources.has(source)) sourceSelect.add(new Option(source, source));
  }
  eventsUpdated = events.updated;
  const categorySelect = byId("event-category");
  for (const category of [...new Set(["SOC", "Auditd", "Fail2ban", "AIDE", "Deploy", ...eventEntries.map(event => event.component)])].sort()) {
    if (![...categorySelect.options].some(option => option.value === category)) {
      categorySelect.add(new Option(category, category));
    }
  }
  renderTraffic(eventEntries, sampledTime, eventsUpdated);
  renderSecurityOperations(eventEntries, sampledTime, eventsUpdated);
  const hostEvents = eventEntries.filter(event => hostCategories.has(event.component) && Date.parse(event.time) >= sampledTime - 24 * hour);
  for (const [component, countId] of hostCategories) {
    byId(countId).textContent = hostEvents.filter(event => event.component === component).length;
  }
  byId("host-error-count").textContent = hostEvents.filter(event => event.level === "error").length;
  byId("event-update").textContent = eventsUpdated
    ? "Collected " + timestamp(eventsUpdated)
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

for (const button of document.querySelectorAll("[data-soc-view], [data-event-preset]")) {
  button.addEventListener("click", () => {
    clearEventFilters();
    byId("event-range").value = "24";
    byId("event-category").value = button.dataset.socView ?? button.dataset.eventPreset;
    for (const level of button.dataset.levels?.split(" ") ?? []) severities.add(level);
    resetEventRows();
    if (button.dataset.socView) byId("activity-heading").scrollIntoView?.();
  });
}

for (const id of ["event-query", "event-site", "event-category"]) {
  byId(id).addEventListener("input", resetEventRows);
}
byId("event-range").addEventListener("input", () => {
  endInvestigation();
  selectedWindow = null;
  updateChartSelection();
  resetEventRows();
});
for (const button of document.querySelectorAll("[data-range]")) {
  button.addEventListener("click", () => {
    endInvestigation();
    byId("event-range").value = button.dataset.range;
    selectedWindow = null;
    updateChartSelection();
    resetEventRows();
  });
}
for (const button of document.querySelectorAll("[data-severity]")) {
  button.addEventListener("click", () => {
    const level = button.dataset.severity;
    if (severities.has(level)) severities.delete(level);
    else severities.add(level);
    resetEventRows();
  });
}
function endInvestigation() {
  if (investigation) byId("event-order").value = investigation.previousOrder;
  investigation = null;
}

function clearEventFilters() {
  endInvestigation();
  for (const id of ["event-query", "event-site", "event-category", "event-range"]) byId(id).value = "";
  severities.clear();
  hidePageLoads = false;
  selectedWindow = null;
  relatedFilter = null;
  pinnedOnly = false;
}

byId("clear-filters").addEventListener("click", () => {
  clearEventFilters();
  resetEventRows();
});
byId("reset-empty-results").addEventListener("click", () => {
  clearEventFilters();
  resetEventRows();
  byId("event-query").focus();
});
byId("investigation-radius").addEventListener("change", () => {
  selectedWindow = null;
  resetEventRows();
});
byId("close-investigation").addEventListener("click", () => {
  endInvestigation();
  selectedWindow = null;
  resetEventRows();
  byId("event-query").focus();
});
byId("clear-related").addEventListener("click", () => {
  relatedFilter = null;
  resetEventRows();
  byId("event-query").focus();
});
byId("hide-page-loads").addEventListener("click", () => {
  hidePageLoads = !hidePageLoads;
  resetEventRows();
});
byId("pinned-events").addEventListener("click", () => {
  pinnedOnly = !pinnedOnly;
  resetEventRows();
});
byId("event-utc").addEventListener("click", ({ currentTarget }) => {
  currentTarget.setAttribute("aria-pressed", String(currentTarget.getAttribute("aria-pressed") !== "true"));
  renderEvents();
});
byId("event-order").addEventListener("change", resetEventRows);
eventPageSize.addEventListener("change", resetEventRows);
document.addEventListener("keydown", (event) => {
  if (event.key !== "/" || event.defaultPrevented || event.isComposing ||
      event.altKey || event.ctrlKey || event.metaKey ||
      event.target.closest?.("input, textarea, select, [contenteditable]")) return;
  event.preventDefault();
  byId("event-query").focus();
});
byId("show-less").addEventListener("click", () => {
  resetEventRows();
  byId("show-more").focus();
});
byId("show-more").addEventListener("click", () => {
  visibleCount = Math.min(visibleCount + pageSize(), matchingEvents.length);
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
    const seconds = Number(select.value);
    if (seconds > 0) {
      timer = setInterval(() => {
        if (!document.hidden) update();
      }, seconds * 1000);
    }
  };
  select.addEventListener("change", () => {
    try {
      window.localStorage.setItem(refreshPreference, select.value);
    } catch {
      // Keep the user's selection for this page even without persistent storage.
    }
    schedule();
    if (select.value !== "0") update();
  });
  button.hidden = false;
  button.addEventListener("click", update);
  setInterval(updateBuildCountdowns, 1000);
  schedule();
  update();
}

function startEventStream() {
  const status = byId("event-stream");
  const speed = byId("refresh-rate");
  if (!window.WebSocket) return;
  let connected = false;
  let latest;
  const showStatus = () => {
    status.hidden = false;
    status.textContent = speed.value === "0" ? "Log updates paused" : connected ? "Live stream" : "Polling";
  };
  const connect = () => {
    const url = new URL("/api/events", location.href);
    url.protocol = "wss:";
    const socket = new window.WebSocket(url);
    socket.addEventListener("open", () => {
      connected = true;
      showStatus();
    });
    socket.addEventListener("message", ({ data }) => {
      try {
        const events = JSON.parse(data);
        if (!Array.isArray(events.entries) || !Number.isFinite(Date.parse(events.updated))) return;
        latest = events;
        if (speed.value !== "0") renderEventSnapshot(events);
      } catch {
        socket.close();
      }
    });
    socket.addEventListener("close", () => {
      connected = false;
      showStatus();
      setTimeout(connect, 5000);
    });
  };
  speed.addEventListener("change", () => {
    showStatus();
    if (speed.value !== "0" && latest) renderEventSnapshot(latest);
  });
  showStatus();
  connect();
}

export function startLive() {
  liveMode = true;
  byId("live-controls").hidden = false;
  byId("host-activity").hidden = false;
  const views = {
    overview: {},
    builds: { category: "Build" },
    rollbacks: { query: "rollback" },
    integrity: { category: "AIDE", level: "warning" },
    visits: { category: "Visits" },
  };
  for (const button of document.querySelectorAll("[data-live-view], [data-host-view]")) {
    button.addEventListener("click", () => {
      const hostView = button.dataset.hostView;
      const { query = "", category = "", level = "" } = hostView
        ? { category: hostView === "errors" ? hostErrors : hostView }
        : views[button.dataset.liveView];
      clearEventFilters();
      byId("event-query").value = query;
      byId("event-range").value = hostView ? "24" : "";
      const select = byId("event-category");
      if (![...select.options].some(option => option.value === category)) select.add(new Option(category, category));
      select.value = category;
      if (level) severities.add(level);
      resetEventRows();
      byId("activity-heading").scrollIntoView?.({ block: "start" });
    });
  }
  startRefresh(refresh);
  startEventStream();
}
