import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const live = process.argv.includes("--live");
const root = new URL("../deployment-console/", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const dom = new JSDOM(html, {
  url: live ? "https://deploy.osher.cc/" : "https://osher.cc/deployment-console/",
});
globalThis.document = dom.window.document;
globalThis.location = dom.window.location;
globalThis.Option = dom.window.Option;
globalThis.window = dom.window;
let socket;
window.WebSocket = class extends window.EventTarget {
  constructor(url) {
    super();
    assert.equal(live, true, "The public demo must not open a production WebSocket");
    assert.equal(String(url), "wss://deploy.osher.cc/api/events");
    socket = this;
  }
};
let copiedText = "";
Object.defineProperty(dom.window.navigator, "clipboard", {
  value: { writeText: async (value) => { copiedText = value; } },
});

const byId = (id) => document.getElementById(id);
const events = () => [...byId("events").children];
const scenario = (mode) => document.querySelector(`[data-scenario="${mode}"]`).click();
const time = new Date().toISOString();
const site = {
  domain: "osher.cc", name: "Test site", mark: "TS", online: true, timer: true,
  repo: "shalev-os/oshercc", release: "0123456789abcdef0123456789abcdef01234567",
  published: time, signal: time, lastCheck: time,
  lastTimer: time, nextBuild: new Date(Date.now() + 180000).toISOString(),
};
const event = {
  site: "server", component: "AIDE", time, level: "success",
  message: "Protected files match the integrity baseline",
  details: {
    baseline: "matched", outcome: "verified", source: "systemd journal",
    unit: "osher-integrity-check.service", processId: 42, priority: 6,
  },
};
const snapshot = {
  sites: [site],
  security: { auditActive: true, audit: {watches: 8, lost: 0}, fail2ban: true, ssh: {banned: 1, failed: 8}, integrity: "clean", integrityTimer: true, nextScan: time, lastScan: time },
  events: { entries: [event], updated: time },
  host: {
    uptime: 90000, load: [.42, .28, .15], cores: 2,
    memory: { used: 90, total: 100 }, swap: { used: 0, total: 0 }, disk: { used: 45, total: 100 },
  },
  sampled: time,
};
const fetchBlob = globalThis.fetch;
let requests = 0;
globalThis.fetch = async (url) => {
  requests++;
  assert.equal(live, true, "The public demo must not request production data");
  assert.equal(url, "api/status");
  return { ok: true, json: async () => snapshot };
};
const setInterval = globalThis.setInterval;
const scheduled = [];
globalThis.setInterval = (_, delay) => {
  scheduled.push(delay);
  return 0;
};
try {
  const { ready } = await import(new URL("entry.js", root));
  await ready;
  await new Promise(setImmediate);
  const speed = byId("refresh-rate");
  assert.equal(speed.value, "10");
  assert.deepEqual([...speed.options].map(option => Number(option.value)), [0, 5, 10, 20, 30, 40, 50, 60, 600, 1200, 1800, 2700, 3600]);
  speed.value = "1200";
  speed.dispatchEvent(new dom.window.Event("change"));
  await new Promise(setImmediate);
  assert.deepEqual(scheduled, [1000, 10000, 1200000]);
  assert.equal(window.localStorage.getItem("osher-console-refresh"), "1200");
  speed.value = "0";
  speed.dispatchEvent(new dom.window.Event("change"));
  await new Promise(setImmediate);
  assert.deepEqual(scheduled, [1000, 10000, 1200000]);
  assert.equal(window.localStorage.getItem("osher-console-refresh"), "0");
  assert.equal(requests, live ? 2 : 0);
  byId("refresh").click();
  await new Promise(setImmediate);
} finally {
  globalThis.setInterval = setInterval;
}

assert.equal(byId("demo-controls").hidden, live);
assert.equal(byId("live-controls").hidden, !live);
assert.equal(byId("portfolio-link").hidden, live);
assert.equal(byId("refresh").hidden, false);
assert.equal(byId("activity-chart").children.length, 6);
assert.doesNotMatch(html, />\s*Checking\s*</i);
assert.equal(byId("audit-status").hidden, false);
assert.equal(byId("integrity-status").hidden, false);
assert.match(document.querySelector(".build-countdown").textContent, /^\d+m \d{2}s$/);
assert.equal(document.querySelector(".timer-state").textContent, "Timer running");
assert.ok(document.querySelector(".next-build").dateTime);
assert.equal(byId("audit-watches").textContent, "8");
assert.equal(byId("ssh-blocked").textContent, "1");

if (live) {
  assert.equal(requests, 3);
  assert.equal(byId("traffic-table").hidden, true);
  assert.match(byId("traffic-empty").textContent, /No retained page loads/);
  assert.equal(byId("connection").textContent, "Live");
  assert.equal(byId("live").textContent, "1/1");
  assert.equal(byId("integrity-status").textContent, "Baseline matches");
  assert.equal(byId("host-load").textContent, "0.42");
  assert.equal(byId("memory-meter").dataset.pressure, "true");
  assert.equal(byId("swap-meter").hidden, true);
  assert.match(events()[0].textContent, /Protected files match/);
  byId("json-panel").open = true;
  byId("json-panel").dispatchEvent(new dom.window.Event("toggle"));
  assert.deepEqual(JSON.parse(byId("event-json").textContent), [event]);
  document.querySelector('[data-live-view="integrity"]').click();
  assert.equal(events().length, 0);
  document.querySelector('[data-live-view="overview"]').click();
  assert.equal(events().length, 1);
  socket.dispatchEvent(new window.Event("open"));
  const push = new window.MessageEvent("message", {
    data: JSON.stringify({
      updated: new Date(Date.parse(time) + 1000).toISOString(),
      entries: Array.from({ length: 57 }, (_, index) => ({
        ...event,
        ...(index === 56 && { component: "Kernel", level: "error" }),
        message: index === 0 ? "Release event delivered by WebSocket" : `Earlier event ${index}`,
      })),
    }),
  });
  socket.dispatchEvent(push);
  assert.equal(byId("event-stream").textContent, "Log updates paused");
  assert.match(events()[0].textContent, /Protected files match/);
  byId("refresh-rate").value = "10";
  const realSetInterval = globalThis.setInterval;
  globalThis.setInterval = () => 0;
  try {
    byId("refresh-rate").dispatchEvent(new window.Event("change"));
  } finally {
    globalThis.setInterval = realSetInterval;
  }
  await new Promise(setImmediate);
  assert.equal(byId("event-stream").textContent, "Live stream");
  assert.match(events()[0].textContent, /Release event delivered by WebSocket/);
  assert.equal(events().length, 5);
  assert.equal(byId("show-more").textContent, "Show 5 more events");
  byId("show-more").click();
  assert.equal(events().length, 10);
  byId("show-less").click();
  assert.equal(events().length, 5);
  byId("event-page-size").value = "50";
  byId("event-page-size").dispatchEvent(new window.Event("change"));
  assert.equal(events().length, 50);
  assert.equal(byId("show-more").textContent, "Show 7 more events");
  byId("show-more").click();
  assert.equal(events().length, 57);
  assert.equal(byId("show-more").hidden, true);
  assert.equal(byId("host-kernel-count").textContent, "1");
  assert.equal(byId("host-error-count").textContent, "1");
  document.querySelector('[data-host-view="errors"]').click();
  assert.equal(byId("event-range").value, "24");
  assert.equal(events().length, 1);
  assert.match(events()[0].textContent, /Kernel/);
} else {
  assert.equal(requests, 0);
  const sources = byId("source-breakdown");
  const consoleSource = sources.querySelector('[data-source="console.example"]');
  assert.match(consoleSource.textContent, /console\.example · 1/);
  consoleSource.click();
  assert.equal(byId("event-site").value, "console.example");
  assert.equal(events().length, 1);
  assert.equal(sources.querySelector('[data-source="console.example"]').getAttribute("aria-pressed"), "true");
  sources.querySelector('[data-source=""]').click();
  assert.equal(events().length, 5);
  const query = byId("event-query");
  query.value = "no matching sample event";
  query.dispatchEvent(new window.Event("input"));
  assert.equal(byId("reset-empty-results").hidden, false);
  byId("reset-empty-results").click();
  assert.equal(query.value, "");
  assert.equal(events().length, 5);
  document.body.dispatchEvent(new window.KeyboardEvent("keydown", { key: "/", bubbles: true }));
  assert.equal(document.activeElement, byId("event-query"));
  const order = byId("event-order");
  const firstTime = events()[0].querySelector("time").dateTime;
  order.value = "oldest";
  order.dispatchEvent(new window.Event("change"));
  assert.ok(Date.parse(events()[0].querySelector("time").dateTime) < Date.parse(firstTime));
  order.value = "newest";
  order.dispatchEvent(new window.Event("change"));
  assert.equal(events()[0].querySelector("time").dateTime, firstTime);
  events()[0].querySelector(".event-inspect").click();
  events()[0].querySelector(".event-investigate").click();
  assert.equal(byId("investigation").hidden, false);
  assert.equal(order.value, "oldest");
  assert.equal(events().length, 3);
  assert.equal(events()[2].querySelector("time").dateTime, firstTime);
  assert.equal(events()[2].hasAttribute("data-investigation-anchor"), true);
  const radius = byId("investigation-radius");
  radius.value = "60";
  radius.dispatchEvent(new window.Event("change"));
  assert.match(byId("event-count").textContent, /of 7 events/);
  const bucketCount = [...byId("activity-chart").querySelectorAll("strong")]
    .reduce((total, bucket) => total + Number(bucket.textContent), 0);
  assert.equal(bucketCount, 7);
  byId("close-investigation").click();
  assert.equal(byId("investigation").hidden, true);
  assert.equal(order.value, "newest");
  document.querySelector('[data-event-preset="Fail2ban"]').click();
  assert.equal(events().length, 1);
  assert.match(events()[0].textContent, /blocked an SSH source/);
  byId("clear-filters").click();
  assert.equal(byId("audit-status").textContent, "Active");
  assert.equal(byId("integrity-status").textContent, "Baseline matches");
  assert.equal(byId("live").textContent, "3/3");
  assert.equal(byId("fallback").textContent, "2/2");
  assert.equal(byId("attention-items").hidden, true);
  assert.equal(byId("traffic-table").hidden, false);
  assert.equal(byId("traffic-rows").rows.length, 3);
  const consoleTraffic = [...byId("traffic-rows").rows].find(row => row.cells[0].textContent === "console.example");
  assert.deepEqual([...consoleTraffic.cells].map(cell => cell.textContent), ["console.example", "1", "0 / 0", "9 ms"]);
  assert.equal(byId("sites").firstElementChild.querySelector(".build-window-note").textContent, "The fallback timer checks for a validated release.");
  byId("event-category").value = "Visits";
  byId("event-category").dispatchEvent(new dom.window.Event("input"));
  assert.equal(events()[0].querySelector(".event-context"), null);
  events()[0].querySelector(".event-inspect").click();
  assert.match(events()[0].querySelector(".event-context").textContent, /203\.0\.113\./);
  events()[0].querySelector(".copy-ip").click();
  await new Promise(setImmediate);
  assert.equal(copiedText, "203.0.113.42");
  assert.equal(events()[0].querySelector(".copy-ip").textContent, "Copied");
  events()[0].querySelector('[aria-label="Find events for IP 203.0.113.42"]').click();
  assert.equal(byId("related-filter").hidden, false);
  assert.equal(byId("related-value").textContent, "IP 203.0.113.42");
  assert.equal(events().length, 1);
  assert.equal(byId("event-category").value, "");
  byId("event-utc").click();
  assert.equal(byId("event-utc").getAttribute("aria-pressed"), "true");
  assert.match(events()[0].querySelector("time").textContent, /UTC/);
  byId("event-utc").click();
  byId("clear-related").click();
  assert.equal(byId("related-filter").hidden, true);
  events()[0].querySelector(".event-inspect").click();
  const pinnedMessage = events()[0].querySelector(".event-inspect").textContent;
  const firstRow = events()[0];
  assert.equal(firstRow.querySelector('[data-step="-1"]').disabled, true);
  firstRow.querySelector('[data-step="1"]').click();
  assert.equal(events()[1].querySelector(".event-inspect").getAttribute("aria-expanded"), "true");
  events()[1].querySelector('[data-step="-1"]').click();
  assert.equal(events()[0].querySelector(".event-inspect").getAttribute("aria-expanded"), "true");
  events()[0].querySelector(".event-copy-summary").click();
  await new Promise(setImmediate);
  assert.match(copiedText, /INFO · console\.example · Visits/);
  assert.ok(copiedText.endsWith(pinnedMessage));
  events()[4].querySelector(".event-inspect").click();
  events()[4].querySelector('[data-step="1"]').click();
  assert.equal(events().length, 10);
  assert.equal(events()[5].querySelector(".event-inspect").getAttribute("aria-expanded"), "true");
  byId("show-less").click();
  events()[0].querySelector(".event-inspect").click();
  const anchorClick = window.HTMLAnchorElement.prototype.click;
  let download;
  window.HTMLAnchorElement.prototype.click = function () {
    download = { filename: this.download, href: this.href };
  };
  try {
    events()[0].querySelector(".event-download").click();
    assert.equal(download.filename, "deployment-event.json");
    const response = await fetchBlob(download.href);
    assert.equal((await response.json()).message, pinnedMessage);
  } finally {
    window.HTMLAnchorElement.prototype.click = anchorClick;
  }
  events()[0].querySelector(".event-pin").click();
  assert.equal(byId("pinned-count").textContent, "1");
  assert.equal(events()[0].querySelector(".event-pinned").textContent, "Pinned");
  byId("pinned-events").click();
  scenario("rollback");
  assert.equal(events().length, 1);
  assert.equal(events()[0].querySelector(".event-inspect").textContent, pinnedMessage);
  events()[0].querySelector(".event-inspect").click();
  events()[0].querySelector(".event-pin").click();
  assert.equal(events().length, 0);
  assert.match(byId("event-count").textContent, /No pinned events/);
  byId("pinned-events").click();
  scenario("healthy");
  assert.equal(events().length, 5);
  byId("clear-filters").click();
  assert.equal(document.querySelectorAll("[data-range]").length, 6);
  document.querySelector('[data-range="48"]').click();
  assert.equal(byId("event-range").value, "48");
  assert.match(byId("event-count").textContent, /of 15 events/);
  byId("clear-filters").click();
  byId("activity-chart").children[0].click();
  assert.equal(events().length, Math.min(5, Number(byId("activity-chart").children[0].querySelector("strong").textContent)));
  byId("clear-filters").click();
  assert.equal(events().length, 5);
  const category = byId("event-category");
  category.value = "Visits";
  category.dispatchEvent(new dom.window.Event("input"));
  assert.equal(events().length, 5);
  events()[0].querySelector(".event-inspect").click();
  assert.equal(JSON.parse(events()[0].querySelector(".event-json").textContent).details.httpStatus, 200);
  byId("clear-filters").click();
  const range = byId("event-range");
  range.value = "48";
  range.dispatchEvent(new dom.window.Event("input"));
  assert.match(byId("event-count").textContent, /of 15 events/);
  range.value = "336";
  range.dispatchEvent(new dom.window.Event("input"));
  assert.match(byId("event-count").textContent, /of 17 events/);
  byId("clear-filters").click();
  const manualCard = document.querySelector('[data-deploy-target="console.example"]').closest(".card");
  assert.match(manualCard.querySelector(".build-window").textContent, /Deployment schedule/);
  assert.match(manualCard.querySelector(".build-window-note").textContent, /simulated deployment/);
  assert.equal(manualCard.querySelector(".timer-state").textContent, "No timer");
  assert.equal(manualCard.querySelector(".build-countdown").textContent, "On demand");
  assert.equal(manualCard.querySelector(".last-timer").parentElement.hidden, true);
  const demoActions = [...document.querySelectorAll(".workflow")];
  assert.equal(demoActions.length, 3);
  assert.equal(demoActions[1].href, "https://github.com/shalev-os/mazonhaosher/actions");
  document.querySelector('[aria-label="Deploy catalog.example now"]').click();
  assert.match(byId("scenario-description").textContent, /Simulated deployment for catalog\.example/);
  assert.equal(byId("building").textContent, "1");
  scenario("deploying");
  assert.equal(byId("building").textContent, "1");
  assert.equal(document.querySelector(".build-state").textContent, "Building now");
  assert.equal(byId("host-load").textContent, "1.18");
  scenario("rollback");
  document.querySelector('[data-severity="error"]').click();
  assert.equal(events().length, 1);
  byId("json-panel").open = true;
  byId("json-panel").dispatchEvent(new dom.window.Event("toggle"));
  const matching = JSON.parse(byId("event-json").textContent);
  assert.equal(matching.length, 1);
  assert.match(matching[0].message, /Previous release restored/);
  assert.equal(matching[0].details.rollback, "restored");
  const warning = document.querySelector('[data-severity="warning"]');
  warning.click();
  assert.equal(events().length, 4);
  assert.equal(warning.getAttribute("aria-pressed"), "true");
  assert.deepEqual(JSON.parse(byId("event-json").textContent).map(event => event.level), ["error", "warning", "warning", "warning"]);
  warning.click();
  events()[0].querySelector(".event-inspect").click();
  assert.match(events()[0].querySelector(".event-context").textContent, /health checkfailed/i);
  assert.deepEqual(JSON.parse(events()[0].querySelector(".event-json").textContent), matching[0]);
  assert.equal(byId("export-csv").disabled, false);
  byId("clear-filters").click();
  scenario("integrity");
  assert.equal(byId("soc-ssh").textContent, "3");
  assert.equal(byId("soc-integrity").textContent, "1");
  assert.match(byId("soc-alerts").textContent, /3 distinct SSH sources/);
  document.querySelector('[data-soc-view="SOC"]').click();
  assert.equal(byId("event-category").value, "SOC");
  assert.equal(events().length, 1);
  byId("clear-filters").click();
  document.querySelector('[data-levels="warning error"]').click();
  assert.equal(byId("event-range").value, "24");
  assert.equal(document.querySelector('[data-severity="error"]').getAttribute("aria-pressed"), "true");
  assert.ok(events().every(row => row.querySelector(".event-level").dataset.level === "warning"));
  byId("clear-filters").click();
  byId("hide-page-loads").click();
  assert.equal(byId("hide-page-loads").getAttribute("aria-pressed"), "true");
  assert.ok(JSON.parse(byId("event-json").textContent).every(event => event.component !== "Visits"));
  byId("clear-filters").click();
  assert.equal(byId("hide-page-loads").getAttribute("aria-pressed"), "false");
  assert.ok(JSON.parse(byId("event-json").textContent).some(event => event.component === "Visits"));
  assert.match(byId("attention-items").textContent, /File integrity changes detected/);
  assert.equal(byId("integrity-status").textContent, "Changes detected");
}
const operations = (name) => byId("operations-" + name);
const changeOperations = (name, value) => {
  operations(name).value = value;
  operations(name).dispatchEvent(new window.Event("change"));
};
assert.match(operations("host").textContent, /CPU load \/ core/);
assert.equal(operations("copy").disabled, false);

if (live) {
  assert.match(operations("verification").textContent, /0123456789abOnline/);
  assert.match(operations("latency").textContent, /No origin latency samples/);
} else {
  scenario("healthy");
  assert.match(operations("verification").textContent, /Health check passed/);
  assert.match(operations("builds").textContent, /8\.4 s/);
  assert.match(operations("queue").textContent, /No CI deferrals/);
  changeOperations("range", "168");
  changeOperations("source", "catalog.example");
  assert.match(operations("releases").textContent, /f82306c/);
  assert.match(operations("queue").textContent, /3a91fc8in_progress/);
  assert.match(operations("traffic").textContent, /50\.0%/);
  assert.match(operations("latency").textContent, /330\.0 ms/);
  assert.doesNotMatch(operations("traffic").textContent, /portfolio\.example/);
  scenario("rollback");
  assert.match(operations("rollbacks").textContent, /restored/);
  operations("rollbacks").querySelector("button").click();
  assert.equal(byId("investigation").hidden, false);
  assert.match(byId("investigation-anchor").textContent, /Previous release restored/);
  byId("close-investigation").click();
  const incidentRow = () => [...operations("incidents").querySelectorAll("tbody tr")]
    .find(row => row.textContent.includes("Previous release restored"));
  incidentRow().lastElementChild.lastElementChild.click();
  assert.equal(incidentRow(), undefined);
  operations("reviewed").click();
  assert.equal(incidentRow().lastElementChild.lastElementChild.textContent, "Reopen");
  incidentRow().lastElementChild.lastElementChild.click();
  assert.equal(incidentRow().lastElementChild.lastElementChild.textContent, "Mark reviewed");
  operations("copy").click();
  await new Promise(setImmediate);
  assert.match(copiedText, /Scope: catalog\.example/);
  assert.match(copiedText, /Rollbacks: 1/);
  assert.doesNotMatch(copiedText, /203\.0\.113/);
}
console.log(`Deployment console ${live ? "production" : "demo"} checks passed.`);
