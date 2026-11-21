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
  details: { baseline: "matched", outcome: "verified" },
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
  assert.deepEqual([...speed.options].map(option => Number(option.value)), [5, 10, 20, 30, 40, 50, 60, 600, 1200, 1800, 2700, 3600]);
  speed.value = "1200";
  speed.dispatchEvent(new dom.window.Event("change"));
  await new Promise(setImmediate);
  assert.deepEqual(scheduled, [1000, 10000, 1200000]);
  assert.equal(window.localStorage.getItem("osher-console-refresh"), "1200");
} finally {
  globalThis.setInterval = setInterval;
}

assert.equal(document.querySelector(".demo-controls").hidden, live);
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
  assert.equal(requests, 2);
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
} else {
  assert.equal(requests, 0);
  assert.equal(byId("audit-status").textContent, "Active");
  assert.equal(byId("integrity-status").textContent, "Baseline matches");
  assert.equal(byId("live").textContent, "3/3");
  assert.equal(byId("fallback").textContent, "2/2");
  assert.match(byId("sites").textContent, /Shared release schedule/);
  byId("activity-chart").children[0].click();
  assert.equal(events().length, 0);
  byId("clear-filters").click();
  assert.equal(events().length, 12);
  const category = byId("event-category");
  category.value = "Visits";
  category.dispatchEvent(new dom.window.Event("input"));
  assert.equal(events().length, 3);
  events()[0].querySelector(".event-inspect").click();
  assert.equal(JSON.parse(events()[0].querySelector(".event-json").textContent).details.httpStatus, 200);
  byId("clear-filters").click();
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
  assert.match(events()[0].querySelector(".event-context").textContent, /health checkfailed/i);
  events()[0].querySelector(".event-inspect").click();
  assert.deepEqual(JSON.parse(events()[0].querySelector(".event-json").textContent), matching[0]);
  assert.equal(byId("export-csv").disabled, false);
  byId("clear-filters").click();
  scenario("integrity");
  assert.equal(byId("integrity-status").textContent, "Changes detected");
}
console.log(`Deployment console ${live ? "production" : "demo"} checks passed.`);
