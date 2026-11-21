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
  assert.equal(byId("audit-status").textContent, "Active");
  assert.equal(byId("integrity-status").textContent, "Baseline matches");
  assert.equal(byId("live").textContent, "3/3");
  assert.equal(byId("fallback").textContent, "2/2");
  assert.equal(byId("attention-items").hidden, true);
  assert.equal(byId("traffic-table").hidden, false);
  assert.equal(byId("traffic-rows").rows.length, 3);
  const consoleTraffic = [...byId("traffic-rows").rows].find(row => row.cells[0].textContent === "console.example");
  assert.deepEqual([...consoleTraffic.cells].map(cell => cell.textContent), ["console.example", "1", "0 / 0", "9 ms"]);
  assert.equal(byId("sites").lastElementChild.querySelector(".build-window-note").textContent, "The fallback timer checks for a validated release.");
  byId("event-category").value = "Visits";
  byId("event-category").dispatchEvent(new dom.window.Event("input"));
  assert.match(events()[0].querySelector(".event-context").textContent, /203\.0\.113\./);
  events()[0].querySelector(".copy-ip").click();
  await new Promise(setImmediate);
  assert.equal(copiedText, "203.0.113.42");
  assert.equal(events()[0].querySelector(".copy-ip").textContent, "Copied");
  byId("clear-filters").click();
  assert.equal(document.querySelectorAll("[data-range]").length, 6);
  document.querySelector('[data-range="48"]').click();
  assert.equal(byId("event-range").value, "48");
  assert.match(byId("event-count").textContent, /of 13 events/);
  byId("clear-filters").click();
  byId("activity-chart").children[0].click();
  assert.equal(events().length, Number(byId("activity-chart").children[0].querySelector("strong").textContent));
  byId("clear-filters").click();
  assert.equal(events().length, 15);
  const category = byId("event-category");
  category.value = "Visits";
  category.dispatchEvent(new dom.window.Event("input"));
  assert.equal(events().length, 4);
  events()[0].querySelector(".event-inspect").click();
  assert.equal(JSON.parse(events()[0].querySelector(".event-json").textContent).details.httpStatus, 200);
  byId("clear-filters").click();
  const range = byId("event-range");
  range.value = "48";
  range.dispatchEvent(new dom.window.Event("input"));
  assert.match(byId("event-count").textContent, /of 13 events/);
  range.value = "336";
  range.dispatchEvent(new dom.window.Event("input"));
  assert.match(byId("event-count").textContent, /of 15 events/);
  byId("clear-filters").click();
  scenario("deploying");
  assert.equal(byId("building").textContent, "2");
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
  assert.match(events()[0].querySelector(".event-context").textContent, /health checkfailed/i);
  events()[0].querySelector(".event-inspect").click();
  assert.deepEqual(JSON.parse(events()[0].querySelector(".event-json").textContent), matching[0]);
  assert.equal(byId("export-csv").disabled, false);
  byId("clear-filters").click();
  scenario("integrity");
  assert.match(byId("attention-items").textContent, /File integrity changes detected/);
  assert.equal(byId("integrity-status").textContent, "Changes detected");
}
console.log(`Deployment console ${live ? "production" : "demo"} checks passed.`);
