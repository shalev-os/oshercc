import { downloadFile } from "./download.js";

const byId = (id) => document.getElementById(id);
const threshold = byId("reliability-threshold");
const target = byId("reliability-target");
const download = byId("reliability-export");
const hour = 3600000;
const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
let exportData;

function groupBy(events, fields) {
  const groups = new Map();
  for (const event of events) {
    const key = fields(event);
    const id = JSON.stringify(key);
    if (!groups.has(id)) groups.set(id, { key, events: [] });
    groups.get(id).events.push(event);
  }
  return [...groups.values()];
}

const when = (value) => Number.isFinite(Date.parse(value)) ? date.format(new Date(value)) : "—";
const fixed = (value, unit = "") => Number.isFinite(value) ? value.toFixed(1) + unit : "—";
const signed = (value, formatter) => Number.isFinite(value) && value > 0 ? "+" + formatter(value) : formatter(value);
const code = (event) => event.details?.httpStatus;
const duration = (event) => event.details?.originResponseMs;
const page = (event) => event.details?.page || "Unknown page";
const isVisit = (event) => event.component === "Visits";
const isResponse = (event) => isVisit(event) && Number.isInteger(code(event)) && code(event) >= 100 && code(event) < 600;
const is5xx = (event) => code(event) >= 500 && code(event) < 600;
const hasDuration = (event) => Number.isFinite(duration(event)) && duration(event) >= 0;

function p95(events) {
  const values = events.filter(hasDuration).map(duration).sort((left, right) => left - right);
  return values.length ? values[Math.ceil(values.length * .95) - 1] : null;
}

function describeTraffic(events) {
  const responses = events.filter(isResponse);
  const errors = responses.filter(is5xx).length;
  return {
    responses: responses.length,
    errors,
    rate: responses.length ? 100 * errors / responses.length : null,
    latency: p95(events.filter(isVisit)),
  };
}

function comparisonRows(current, previous) {
  const now = describeTraffic(current);
  const before = describeTraffic(previous);
  const delta = (left, right) => left === null || right === null ? null : left - right;
  const alerts = entries => entries.filter(event => event.level === "error" || event.level === "warning").length;
  const currentAlerts = alerts(current);
  const previousAlerts = alerts(previous);
  return [
    ["HTTP responses", now.responses, before.responses, signed(now.responses - before.responses, String)],
    ["5xx responses", now.errors, before.errors, signed(now.errors - before.errors, String)],
    ["5xx rate", fixed(now.rate, "%"), fixed(before.rate, "%"), signed(delta(now.rate, before.rate), value => fixed(value, " pp"))],
    ["Origin latency P95", fixed(now.latency, " ms"), fixed(before.latency, " ms"), signed(delta(now.latency, before.latency), value => fixed(value, " ms"))],
    ["Warnings and errors", currentAlerts, previousAlerts, signed(currentAlerts - previousAlerts, String)],
  ];
}

function intervalLabel(milliseconds) {
  if (milliseconds >= 24 * hour) return fixed(milliseconds / (24 * hour), " d");
  if (milliseconds >= hour) return fixed(milliseconds / hour, " h");
  return fixed(milliseconds / 60000, " min");
}

function medianInterval(entries) {
  const times = [...new Set(entries.map(event => Date.parse(event.time)))].sort((a, b) => a - b);
  const intervals = times.slice(1).map((value, index) => value - times[index]).sort((a, b) => a - b);
  if (!intervals.length) return "—";
  const middle = Math.floor(intervals.length / 2);
  return intervalLabel((intervals[middle] + intervals[Math.floor((intervals.length - 1) / 2)]) / 2);
}

function incidentGroups(events) {
  return groupBy(events, event => [event.site, event.component, event.message])
    .sort((left, right) => right.events.length - left.events.length);
}

export function configureReliability(refresh) {
  threshold.addEventListener("change", refresh);
  target.addEventListener("change", refresh);
  download.addEventListener("click", () => {
    if (!exportData) return;
    downloadFile(JSON.stringify(exportData, null, 2), "application/json", "reliability-insights.json");
  });
}

export function renderReliability({ events, published, incidents, start, end, snapshot, status, source, table, action }) {
  const windowLength = end - start;
  const priorStart = start - windowLength;
  const previous = snapshot.entries.filter(event => {
    const time = Date.parse(event.time);
    return time >= priorStart && time < start && (!source || event.site === source);
  });
  const visits = events.filter(isVisit);
  const responseEvents = visits.filter(isResponse);
  const slowThreshold = Number(threshold.value);
  const availabilityTarget = Number(target.value);
  const scope = source || "All sources";
  const selectedHours = windowLength / hour;
  byId("reliability-scope").textContent = snapshot.updated
    ? `${scope} · last ${selectedHours} hours · based on retained logs`
    : "Log snapshot unavailable.";

  const tables = {};
  function show(id, columns, rows, empty, caption) {
    table(id, columns, rows, empty, caption);
    // Keep export rows aligned with the visible metrics and omit interactive cells.
    const exportedColumns = columns.filter(column => column !== "Event");
    tables[id] = {
      columns: exportedColumns,
      caption: rows.length ? caption : empty,
      rows: rows.map(row => row.slice(0, exportedColumns.length)),
    };
  }

  let comparisonNote = "Current window versus the immediately preceding window of the same length. Comparison uses retained samples.";
  if (selectedHours === 336) comparisonNote = "The preceding window falls outside the 14-day retention period.";
  else if (!previous.length) comparisonNote = "The preceding window has no retained samples for this source.";
  show("comparison", ["Metric", "Current", "Previous", "Change"],
    snapshot.updated && selectedHours < 336 && previous.length ? comparisonRows(events, previous) : [], comparisonNote, comparisonNote);

  const budgets = groupBy(responseEvents, event => [event.site]).map(({ key: [site], events: samples }) => {
    const errors = samples.filter(is5xx).length;
    const allowance = Math.floor((100 - availabilityTarget) * samples.length / 100 + 1e-9);
    const remaining = allowance - errors;
    return [site, samples.length, errors, allowance, remaining, remaining < 0 ? "Exceeded" : "Within target"];
  });
  show("budget", ["Site", "Responses", "5xx", "Allowed", "Remaining", "Budget"], budgets,
    "No retained HTTP responses in this window.", "Sample-based budget. Non-5xx responses count toward the target.");

  const pages = groupBy(visits, event => [event.site, page(event)])
    .sort((left, right) => right.events.length - left.events.length);
  show("pages", ["Site", "Page", "Visits", "5xx", "P95", "Event"], pages.slice(0, 20).map(group => [
    ...group.key, group.events.length, group.events.filter(is5xx).length, fixed(p95(group.events), " ms"), [action(group.events[0])],
  ]), "No retained page visits in this window.", `Top ${Math.min(pages.length, 20)} of ${pages.length} pages by visit count.`);

  const codes = groupBy(responseEvents, event => [event.site, code(event)])
    .sort((left, right) => right.key[1] - left.key[1] || right.events.length - left.events.length);
  show("codes", ["Site", "Status", "Count", "Last seen", "Event"], codes.slice(0, 20).map(group => [
    ...group.key, group.events.length, when(group.events[0].time), [action(group.events[0])],
  ]), "No HTTP status codes in this window.", `Showing ${Math.min(codes.length, 20)} of ${codes.length} site and status pairs.`);

  const slow = visits.filter(event => hasDuration(event) && duration(event) >= slowThreshold)
    .sort((left, right) => duration(right) - duration(left));
  show("slow", ["Time", "Site", "Page", "Status", "Origin latency", "Event"], slow.slice(0, 20).map(event => [
    when(event.time), event.site, page(event), code(event) ?? "—", fixed(duration(event), " ms"), [action(event)],
  ]), `No retained responses reached ${slowThreshold} ms.`,
  `${slow.length} responses reached ${slowThreshold} ms. Showing the slowest ${Math.min(slow.length, 20)}.`);

  show("cadence", ["Site", "Publishes", "Last publish", "Median interval"], groupBy(published, event => [event.site])
    .map(({ key: [site], events: releases }) => [site, releases.length, when(releases[0].time), medianInterval(releases)]),
  "No retained publishes in this window.", "Intervals are measured between retained publish events.");

  const failures = incidentGroups(incidents.filter(event => event.component === "Build" && event.level === "error"));
  show("failures", ["Site", "Failure", "Occurrences", "Last seen", "Event"], failures.slice(0, 20).map(group => {
    const latest = group.events[0];
    return [latest.site, latest.message, group.events.length, when(latest.time), [action(latest)]];
  }), "No build errors in this window.", `Showing ${Math.min(failures.length, 20)} of ${failures.length} failure groups.`);

  const recurring = incidentGroups(incidents).filter(group => group.events.length > 1);
  show("recurrence", ["Source", "Component", "Incident", "Count", "First in window", "Last seen", "Event"],
    recurring.slice(0, 20).map(group => [
      ...group.key, group.events.length, when(group.events.at(-1).time), when(group.events[0].time), [action(group.events[0])],
    ]), "No repeated warning or error messages in this window.", `Showing ${Math.min(recurring.length, 20)} of ${recurring.length} recurring incidents.`);

  const freshness = [
    ["Status API", status.sampled],
    ["Event snapshot", snapshot.updated],
    ...[...new Set(events.map(event => event.component))].sort()
      .map(component => [component, events.find(event => event.component === component).time]),
  ].map(([name, timestamp]) => {
    const age = end - Date.parse(timestamp);
    return [name, when(timestamp), Number.isFinite(age) ? intervalLabel(Math.max(0, age)) : "—"];
  });
  show("freshness", ["Feed", "Latest observed", "Age at snapshot"], freshness, "Waiting for telemetry.",
    "A component’s timestamp reflects its latest retained event in the selected window.");

  exportData = snapshot.updated ? {
    scope, window: { from: new Date(start).toISOString(), to: new Date(end).toISOString() },
    collectedAt: snapshot.updated, slowThresholdMs: slowThreshold, non5xxTargetPercent: availabilityTarget, tables,
  } : null;
  // Messages can contain operator context. Export counts and timing for incident groups.
  if (exportData) {
    for (const id of ["failures", "recurrence"]) {
      const { columns, caption, rows } = tables[id];
      const messageIndex = columns.indexOf(id === "failures" ? "Failure" : "Incident");
      tables[id] = { caption, columns: columns.filter((_, index) => index !== messageIndex),
        rows: rows.map(row => row.filter((_, index) => index !== messageIndex)) };
    }
  }
  download.disabled = !exportData;
}
