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

const byId = (id) => document.getElementById(id);
const events = () => [...byId("events").children];
const scenario = (mode) => document.querySelector(`[data-scenario="${mode}"]`).click();
const time = new Date().toISOString();
const site = {
  domain: "osher.cc", name: "Test site", mark: "TS", online: true, timer: true,
  repo: "shalev-os/oshercc", release: "0123456789abcdef0123456789abcdef01234567",
  published: time, signal: time, lastCheck: time,
};
const event = {
  site: "server", component: "AIDE", time, level: "success",
  message: "Protected files match the integrity baseline",
};
const snapshot = {
  sites: [site],
  security: { auditActive: true, integrity: "clean", integrityTimer: true, nextScan: time, lastScan: time },
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
globalThis.setInterval = () => 0;
try {
  await import(new URL("entry.js", root));
  await new Promise(setImmediate);
} finally {
  globalThis.setInterval = setInterval;
}

assert.equal(document.querySelector(".demo-controls").hidden, live);
assert.equal(byId("portfolio-link").hidden, live);
assert.equal(byId("refresh").hidden, !live);
assert.equal(byId("activity-chart").children.length, 6);
assert.doesNotMatch(html, />\s*Checking\s*</i);
assert.equal(byId("audit-status").hidden, false);
assert.equal(byId("integrity-status").hidden, false);

if (live) {
  assert.equal(requests, 1);
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
  assert.equal(byId("live").textContent, "2/2");
  byId("activity-chart").children[0].click();
  assert.equal(events().length, 0);
  byId("clear-filters").click();
  assert.equal(events().length, 7);
  scenario("deploying");
  assert.equal(byId("building").textContent, "1");
  assert.equal(byId("host-load").textContent, "1.18");
  scenario("rollback");
  document.querySelector('[data-severity="error"]').click();
  assert.equal(events().length, 1);
  byId("json-panel").open = true;
  byId("json-panel").dispatchEvent(new dom.window.Event("toggle"));
  const matching = JSON.parse(byId("event-json").textContent);
  assert.equal(matching.length, 1);
  assert.match(matching[0].message, /Previous release restored/);
  byId("clear-filters").click();
  scenario("integrity");
  assert.equal(byId("integrity-status").textContent, "Changes detected");
}
console.log(`Deployment console ${live ? "production" : "demo"} checks passed.`);
