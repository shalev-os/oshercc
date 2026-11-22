const byId = (id) => document.getElementById(id);
const source = byId("operations-source");
const range = byId("operations-range");
const includeReviewed = byId("operations-reviewed");
const copy = byId("operations-copy");
const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const hour = 3600000;
const hostSamples = [];
const reviewed = new Set();
let status;
let snapshot;
let investigate;
let report = "";

const time = (value) => value ? date.format(new Date(value)) : "—";
const number = (value) => Number.isFinite(value) ? value : null;
const percent = (part, total) => total > 0 ? 100 * part / total : null;
const ratio = (metric) => percent(metric?.used, metric?.total);
const formatted = (value, unit = "%") => number(value) === null ? "—" : value.toFixed(1) + unit;
const eventKey = (event) => JSON.stringify(event);
const commit = (event) => event?.details?.commit?.slice(0, 12) || "—";

function percentile(values, fraction) {
  const sorted = values.filter(value => number(value) !== null && value >= 0).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.ceil(sorted.length * fraction) - 1] : null;
}

function button(label, action, key) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.dataset.operationKey = key;
  element.addEventListener("click", action);
  return element;
}

function table(id, headers, rows, empty, summary) {
  const target = byId("operations-" + id);
  const focused = target.contains(document.activeElement) ? document.activeElement.dataset.operationKey : undefined;
  target.classList.add("operations-table");
  const note = document.createElement("p");
  note.textContent = rows.length ? summary || "" : empty;
  const fallback = id === "incidents" ? includeReviewed : source;
  if (!rows.length) {
    target.replaceChildren(note);
    if (focused) fallback.focus({ preventScroll: true });
    return;
  }
  const element = document.createElement("table");
  element.setAttribute("aria-label", target.previousElementSibling?.textContent?.trim() || id);
  const heading = element.createTHead().insertRow();
  for (const label of headers) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    heading.append(cell);
  }
  const body = element.createTBody();
  for (const values of rows) {
    const row = body.insertRow();
    for (const value of values) {
      const cell = row.insertCell();
      if (Array.isArray(value)) cell.append(...value);
      else cell.textContent = value;
    }
  }
  target.replaceChildren(...(summary ? [note, element] : [element]));
  if (focused) {
    const control = [...target.querySelectorAll("button")].find(item => item.dataset.operationKey === focused);
    (control ?? fallback).focus({ preventScroll: true });
  }
}

function eventRows(events, fields) {
  return events.slice(0, 20).map(event => [
    time(event.time), event.site, ...fields(event),
    [button("Investigate", () => investigate(event), eventKey(event) + ":investigate")],
  ]);
}

function renderIncidents(incidents) {
  const visible = includeReviewed.checked ? incidents : incidents.filter(event => !reviewed.has(eventKey(event)));
  const pending = incidents.filter(event => !reviewed.has(eventKey(event))).length;
  table("incidents", ["Time", "Source", "Incident", "Actions"], visible.slice(0, 20).map(event => {
    const key = eventKey(event);
    return [time(event.time), event.site, `${event.level} · ${event.message}`, [
      button("Investigate", () => investigate(event), key + ":investigate"),
      button(reviewed.has(key) ? "Reopen" : "Mark reviewed", () => {
        if (reviewed.has(key)) reviewed.delete(key);
        else reviewed.add(key);
        render();
      }, key + ":review"),
    ]];
  }), pending ? "No matching incidents." : "No unreviewed incidents in this window.",
  `${pending} unreviewed · showing ${Math.min(20, visible.length)} of ${visible.length}. Review state lasts for this page session.`);
  return pending;
}

function renderHost() {
  const last = hostSamples.at(-1);
  const first = hostSamples[0];
  const metrics = [["CPU load / core", "load"], ["Memory", "memory"], ["Swap", "swap"], ["Disk", "disk"]];
  table("host", ["Resource", "Latest", "Peak", "Change"], last ? metrics.map(([label, key]) => {
    const unit = key === "load" ? "" : "%";
    const values = hostSamples.map(sample => sample[key]).filter(value => number(value) !== null);
    return [label, formatted(last[key], unit), formatted(values.length ? Math.max(...values) : null, unit),
      last[key] !== null && first[key] !== null && hostSamples.length > 1
        ? formatted(last[key] - first[key], key === "load" ? "" : " pp") : "—"];
  }) : [], "Waiting for a host sample.",
  last && `${hostSamples.length} samples in this page session · ${time(first.time)} to ${time(last.time)}. Host-wide, latest 120 samples.`);
}

function render() {
  if (!status || !snapshot) return;
  const domains = new Set([...status.sites.map(site => site.domain), ...snapshot.entries.map(event => event.site)]);
  const selected = source.value;
  const known = [...source.options].slice(1).map(option => option.value);
  const sorted = [...domains].sort();
  if (known.join("\n") !== sorted.join("\n")) {
    source.replaceChildren(new Option("All sources", ""), ...sorted.map(domain => new Option(domain, domain)));
    source.value = domains.has(selected) ? selected : "";
  }

  const end = Math.max(Date.parse(status.sampled), Date.parse(snapshot.updated) || 0);
  const start = end - Number(range.value) * hour;
  const events = snapshot.entries.filter(event => {
    const timestamp = Date.parse(event.time);
    return timestamp >= start && timestamp <= end && (!source.value || event.site === source.value);
  }).sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  byId("operations-coverage").textContent = snapshot.updated
    ? `${events.length} retained events in the selected window · collected ${time(snapshot.updated)}. Counts reflect available logs.`
    : "Log snapshot unavailable. Current site status and host samples remain visible.";

  const published = events.filter(event => event.component === "Deploy" &&
    (event.details?.outcome === "published" || event.details?.healthCheck === "passed"));
  const rollbacks = events.filter(event => event.component === "Deploy" && event.details?.rollback);
  const deferrals = events.filter(event => event.component === "Build" && event.details?.outcome === "deferred");
  const incidents = events.filter(event => event.level === "error" || event.level === "warning");
  const pending = renderIncidents(incidents);
  const sites = status.sites.filter(site => !source.value || source.value === site.domain);
  const verification = sites.map(site => {
    const evidence = published.find(event => event.site === site.domain && event.details?.commit === site.release);
    return [
      site.domain, site.release?.slice(0, 12) || "—", site.online ? "Online" : "Offline",
      evidence ? `Health check passed · ${time(evidence.time)}` : "No matching publish event in this window",
    ];
  });
  table("verification", ["Site", "Serving commit", "Origin", "Publish evidence"], verification, "No deployment target matches this source.");
  table("releases", ["Time", "Site", "Commit", "Event"], eventRows(published, event => [commit(event)]),
    "No published releases in this window.", `Latest ${Math.min(20, published.length)} of ${published.length} retained releases.`);
  table("rollbacks", ["Time", "Site", "Outcome", "Event"], eventRows(rollbacks, event => [event.details.rollback]),
    "No recorded rollbacks in this window.", `${rollbacks.length} recorded · ${rollbacks.filter(event => event.details.rollback === "failed").length} failed. Showing up to 20.`);

  const newestDeferrals = new Map();
  for (const event of deferrals) {
    const key = JSON.stringify([event.site, event.details.commit]);
    if (!newestDeferrals.has(key)) newestDeferrals.set(key, event);
  }
  table("queue", ["Last deferred", "Site", "Commit", "CI status", "Event"],
    eventRows([...newestDeferrals.values()], event => [commit(event), event.details.ciStatus || "Unknown"]),
    "No CI deferrals in this window.", `${deferrals.length} deferrals across ${newestDeferrals.size} site and commit pairs. Latest recorded state per pair, up to 20.`);

  const groups = new Map();
  for (const event of events) {
    if (!groups.has(event.site)) groups.set(event.site, { builds: [], visits: [] });
    const group = groups.get(event.site);
    if (event.component === "Build" && event.details?.outcome === "built" && number(event.details.durationSeconds) !== null && event.details.durationSeconds >= 0) {
      group.builds.push(event.details.durationSeconds);
    }
    if (event.component === "Visits") group.visits.push(event.details || {});
  }
  const builds = [];
  const traffic = [];
  const latency = [];
  for (const [domain, group] of [...groups].sort(([left], [right]) => left.localeCompare(right))) {
    if (group.builds.length) builds.push([domain, group.builds.length,
      formatted(group.builds[0], " s"), formatted(percentile(group.builds, .5), " s"), formatted(percentile(group.builds, .95), " s")]);
    const codes = group.visits.map(visit => visit.httpStatus).filter(code => Number.isInteger(code) && code >= 100 && code < 600);
    if (codes.length) {
      const counts = [1, 2, 3, 4, 5].map(prefix => codes.filter(code => Math.floor(code / 100) === prefix).length);
      traffic.push([domain, codes.length, ...counts, formatted(percent(counts[4], codes.length))]);
    }
    const timings = group.visits.map(visit => visit.originResponseMs).filter(value => number(value) !== null && value >= 0);
    if (timings.length) latency.push([domain, timings.length, formatted(percentile(timings, .5), " ms"),
      formatted(percentile(timings, .95), " ms"), formatted(Math.max(...timings), " ms")]);
  }
  table("builds", ["Site", "Builds", "Latest", "Median", "P95"], builds, "No completed builds with timings in this window.");
  table("traffic", ["Site", "Responses", "1xx", "2xx", "3xx", "4xx", "5xx", "5xx rate"], traffic, "No HTTP status samples in this window.");
  table("latency", ["Site", "Samples", "Median", "P95", "Slowest"], latency, "No origin latency samples in this window.");
  renderHost();

  report = [
    "Deployment handoff", `Scope: ${source.value || "All sources"} · last ${range.value} hours`,
    `Status sampled: ${status.sampled}`, `Logs collected: ${snapshot.updated || "unavailable"}`,
    "", "Release verification", ...verification.map(row => row.join(" · ")),
    "", `Retained events: ${events.length} · Published: ${published.length} · Rollbacks: ${rollbacks.length} · CI deferrals: ${deferrals.length}`,
    `Incidents: ${pending} unreviewed / ${incidents.length} total`,
    ...incidents.filter(event => !reviewed.has(eventKey(event))).slice(0, 5)
      .map(event => `${event.time} · ${event.site} · ${event.component} · ${event.level}`),
    "", "HTTP 5xx rate", ...traffic.map(row => `${row[0]} · ${row.at(-1)} of ${row[1]} sampled responses`),
    "", "Origin latency (P95)", ...latency.map(row => `${row[0]} · ${row[3]} from ${row[1]} samples`),
  ].join("\n");
  copy.disabled = false;
}

source.addEventListener("change", render);
range.addEventListener("change", render);
includeReviewed.addEventListener("change", render);
copy.addEventListener("click", async () => {
  const feedback = byId("operations-report-status");
  try {
    await window.navigator.clipboard.writeText(report);
    feedback.textContent = "Handoff report copied.";
  } catch {
    feedback.textContent = "Clipboard unavailable.";
  }
});

export function updateOperationsStatus(data, openInvestigation) {
  status = data;
  investigate = openInvestigation;
  const sampled = Date.parse(data.sampled);
  const host = data.host;
  if (!host || !Number.isFinite(sampled) || sampled <= (hostSamples.at(-1)?.sampled ?? 0)) return;
  const sample = { sampled, time: data.sampled, load: host.cores > 0 ? number(host.load?.[0] / host.cores) : null,
    memory: number(ratio(host.memory)), swap: number(ratio(host.swap)), disk: number(ratio(host.disk)) };
  hostSamples.push(sample);
  if (hostSamples.length > 120) hostSamples.shift();
}

export function updateOperationsEvents(events) {
  snapshot = events;
  render();
}
