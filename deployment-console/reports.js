import { downloadFile } from "./download.js";
import { reportCatalog } from "./report-catalog.js";

const byId = id => document.getElementById(id);
const category = byId("report-category");
const search = byId("report-search");
const choice = byId("report-choice");
const download = byId("report-export");
const time = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" });
const count = new Intl.NumberFormat();
const decimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const rowLimit = 20;
let context;
let summary;

for (const name of new Set(reportCatalog.map(report => report.category))) {
  category.add(new Option(name, name));
}

function updateChoices() {
  const selected = choice.value;
  const query = search.value.trim().toLowerCase();
  const reports = reportCatalog.filter(report =>
    (!category.value || report.category === category.value) &&
    report.title.toLowerCase().includes(query));
  choice.replaceChildren(...reports.map(report => new Option(report.title, report.id)));
  if (reports.some(report => report.id === selected)) choice.value = selected;
  choice.disabled = !reports.length;
  draw();
}

function bucket(event, dimension) {
  switch (dimension) {
    case "hour": return new Date(event.time).toISOString().slice(0, 13) + ":00Z";
    case "day": return new Date(event.time).toISOString().slice(0, 10);
    case "component": return event.component;
    default: return dimension ? event.details?.[dimension] ?? "Unknown" : null;
  }
}

function summarize(matches, report) {
  const groups = new Map();
  for (const event of matches) {
    const group = bucket(event, report.dimension);
    const key = JSON.stringify([event.site, group]);
    if (!groups.has(key)) groups.set(key, { source: event.site, group, count: 0, values: [] });
    const row = groups.get(key);
    row.count++;
    const value = event.details?.[report.measure];
    if (Number.isFinite(value) && value >= 0) row.values.push(value);
  }
  return [...groups.values()].map(({ values, ...group }) => {
    if (!report.measure) return group;
    values.sort((a, b) => a - b);
    const samples = values.length;
    return {
      ...group, samples,
      average: samples ? values.reduce((sum, value) => sum + value, 0) / samples : null,
      p95: values[Math.ceil(samples * .95) - 1] ?? null,
      max: values.at(-1) ?? null,
    };
  }).sort((a, b) => b.count - a.count || a.source.localeCompare(b.source) ||
    String(a.group).localeCompare(String(b.group)));
}

const dimensions = {
  hour: "UTC hour", day: "UTC day", component: "Component", trigger: "Trigger",
  ciStatus: "CI status", package: "Package", error: "Error code", page: "Page",
  httpStatus: "HTTP status", originProtocol: "Origin protocol", action: "Action",
  jail: "Jail", rule: "Audit rule", unit: "Unit", jobResult: "Job result",
  priority: "Priority", source: "Collector",
};

function draw() {
  const report = reportCatalog.find(item => item.id === choice.value);
  summary = null;
  download.disabled = true;
  byId("report-title").textContent = report?.title ?? "No matching reports";
  const results = byId("report-title").parentElement;
  results.hidden = !report || !context?.updated;
  const scope = byId("report-scope");
  if (!report) {
    scope.textContent = "No reports match this search.";
    return;
  }
  if (!context?.updated) {
    scope.textContent = "Waiting for a log snapshot.";
    return;
  }

  const { events, source, updated, start, end, table, action } = context;
  const components = [report.component].flat();
  const matches = events.filter(event =>
    (!report.component || components.includes(event.component)) && report.match(event));
  const rows = summarize(matches, report);
  const format = value => value === null ? "—" : `${decimal.format(value)} ${report.unit}`;

  scope.textContent = `${source || "All sources"} · last ${(end - start) / 3600000} hours · ${count.format(matches.length)} matching retained events`;
  table("report-summary", [
    "Source", ...(report.dimension ? [dimensions[report.dimension]] : []), "Events",
    ...(report.measure ? ["Samples", "Average", "P95", "Maximum"] : []),
  ], rows.slice(0, rowLimit).map(row => [
    row.source, ...(report.dimension ? [row.group] : []), count.format(row.count),
    ...(report.measure ? [count.format(row.samples), format(row.average), format(row.p95), format(row.max)] : []),
  ]), "No retained events match this report.", `Showing ${Math.min(rows.length, rowLimit)} of ${rows.length} groups by event count.`);
  table("report-events", ["Time", "Source", "Component", "Severity", "Event"],
    matches.slice(0, rowLimit).map(event => [
      time.format(new Date(event.time)), event.site, event.component, event.level, [action(event)],
    ]), "No matching events to investigate.", `Showing ${Math.min(matches.length, rowLimit)} of ${matches.length} matching events.`);

  summary = {
    report: report.id, title: report.title, source: source || null, collectedAt: updated,
    window: { from: new Date(start).toISOString(), to: new Date(end).toISOString() },
    dimension: report.dimension ?? null, unit: report.unit ?? null, matches: matches.length, rows,
  };
  download.disabled = false;
}

category.addEventListener("change", updateChoices);
search.addEventListener("input", updateChoices);
choice.addEventListener("change", draw);
download.addEventListener("click", () => {
  if (summary) downloadFile(JSON.stringify(summary, null, 2), "application/json", `console-${summary.report}.json`);
});
updateChoices();

export function renderReports(data) {
  context = data;
  draw();
}
