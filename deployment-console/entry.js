import { startLive } from "./console.js";

const live = location.hostname === "deploy.osher.cc";
const byId = (id) => document.getElementById(id);

byId("environment-label").textContent = live ? "PRODUCTION" : "DEMO";
byId("sites-heading").textContent = live ? "Production sites" : "Sample sites";
byId("console-description").textContent = live
  ? "Live release status for the Osher websites."
  : "Sample releases, events, and server metrics.";

if (live) {
  byId("connection").hidden = false;
  startLive();
} else {
  document.title = "Deployment Console Demo · Osher";
  byId("portfolio-link").hidden = false;
  byId("demo-controls").hidden = false;
}

export const ready = live ? Promise.resolve() : import("./demo.js");
