import { startLive } from "./console.js";

const live = location.hostname === "deploy.osher.cc";
const byId = (id) => document.getElementById(id);

byId("environment-label").textContent = live ? "LINUX PRODUCTION" : "INTERACTIVE DEMO";
byId("sites-heading").textContent = live ? "Production sites" : "Sample sites";
byId("console-description").textContent = live
  ? "Live release status for the Osher websites."
  : "Explore deployment workflows with simulated events and host metrics. This demo is offline from production.";

if (live) {
  byId("connection").hidden = false;
  startLive();
} else {
  document.title = "Deployment Console Demo · Osher";
  byId("portfolio-link").hidden = false;
  document.querySelector(".demo-controls").hidden = false;
}

export const ready = live ? Promise.resolve() : import("./demo.js");
