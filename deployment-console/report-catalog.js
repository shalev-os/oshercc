const field = (name, value) => event => event.details?.[name] === value;
const hasNumber = (name, minimum = 0) => event =>
  Number.isFinite(event.details?.[name]) && event.details[name] >= minimum;
const status = (from, to = from) => event => {
  const code = event.details?.httpStatus;
  return Number.isInteger(code) && code >= from && code <= to;
};
const level = value => event => event.level === value;
const oneOf = (name, values) => event => values.includes(event.details?.[name]);
const present = name => event => Boolean(event.details?.[name]);
const all = () => true;

// Each report names its event stream, match criteria, and optional measurement.
const groups = [
  ["Release delivery", [
    ["publish-triggers", "Deployment triggers", ["Deploy", "GitHub Actions"], present("trigger"), "trigger"],
    ["signal-completions", "Completed GitHub Actions signal jobs", "GitHub Actions", field("phase", "finished")],
    ["deploy-errors", "Deployment errors", "Deploy", level("error")],
    ["health-failures", "Failed release health checks", "Deploy", field("healthCheck", "failed")],
    ["rollback-recovery", "Successful restorations", "Deploy", field("rollback", "restored")],
    ["rollback-errors", "Failed restorations", "Deploy", field("rollback", "failed")],
    ["ci-signals", "GitHub Actions signals received or started", "GitHub Actions", oneOf("phase", ["accepted", "started"])],
    ["ci-signal-errors", "GitHub Actions signal errors", "GitHub Actions", level("error")],
    ["ci-active", "Deferrals while CI is active", "Build", event =>
      field("outcome", "deferred")(event) && oneOf("ciStatus", ["queued", "in_progress", "pending"])(event), "ciStatus"],
    ["ci-failed", "Deferrals after unsuccessful CI", "Build", event =>
      field("outcome", "deferred")(event) && oneOf("ciStatus", ["failure", "cancelled", "timed_out", "action_required", "startup_failure", "stale"])(event), "ciStatus"],
  ]],
  ["Build and dependencies", [
    ["package-installs", "Packages installed", "Build", hasNumber("packages"), null, "packages", "packages"],
    ["install-timing", "Dependency install duration", "Build", event =>
      field("tool", "npm")(event) && hasNumber("durationSeconds")(event), null, "durationSeconds", "s"],
    ["vite-starts", "Vite production build starts", "Build", field("phase", "build")],
    ["module-count", "Source modules transformed", "Build", hasNumber("modules"), null, "modules", "modules"],
    ["rendering", "Output chunk rendering", "Build", field("phase", "render")],
    ["compression", "Compressed output measurements", "Build", field("phase", "measure")],
    ["deprecated", "Deprecated dependency warnings", "Build", present("package"), "package"],
    ["npm-errors", "npm error codes", "Build", event =>
      field("tool", "npm")(event) && present("error")(event), "error"],
    ["build-memory", "Build memory exhaustion", "Build", field("resource", "memory")],
    ["build-disk", "Build disk exhaustion", "Build", field("resource", "disk")],
  ]],
  ["HTTP outcomes", [
    ["partial", "Partial content responses", "Visits", status(206), "page"],
    ["permanent-redirects", "Permanent redirects", "Visits", event => status(301)(event) || status(308)(event), "page"],
    ["temporary-redirects", "Temporary redirects", "Visits", event =>
      status(302)(event) || status(303)(event) || status(307)(event), "page"],
    ["cached", "Not modified responses", "Visits", status(304), "page"],
    ["access-denied", "Authentication and access denials", "Visits", event => status(401)(event) || status(403)(event), "page"],
    ["not-found", "Missing page responses", "Visits", status(404), "page"],
    ["rate-limited", "Rate-limited responses", "Visits", status(429), "page"],
    ["client-close", "Client closed requests", "Visits", status(499), "page"],
    ["gateway-errors", "Bad gateway and gateway timeout responses", "Visits", event => status(502)(event) || status(504)(event), "page"],
    ["unavailable", "Service unavailable responses", "Visits", status(503), "page"],
  ]],
  ["Response performance", [
    ["response-volume", "Response payload size by page", "Visits", hasNumber("responseBytes"), "page", "responseBytes", "bytes"],
    ["large-responses", "Responses of at least 100 KiB", "Visits", hasNumber("responseBytes", 102400), "page", "responseBytes", "bytes"],
    ["empty-responses", "Zero-byte responses", "Visits", field("responseBytes", 0), "httpStatus"],
    ["protocols", "Origin protocol distribution", "Visits", present("originProtocol"), "originProtocol"],
    ["protocol-latency", "Latency by origin protocol", "Visits", event =>
      present("originProtocol")(event) && hasNumber("originResponseMs")(event), "originProtocol", "originResponseMs", "ms"],
    ["successful-latency", "Successful response latency", "Visits", event =>
      status(200, 299)(event) && hasNumber("originResponseMs")(event), "page", "originResponseMs", "ms"],
    ["redirect-latency", "Redirect latency", "Visits", event =>
      status(300, 399)(event) && hasNumber("originResponseMs")(event), "httpStatus", "originResponseMs", "ms"],
    ["client-error-latency", "Client error response latency", "Visits", event =>
      status(400, 499)(event) && hasNumber("originResponseMs")(event), "httpStatus", "originResponseMs", "ms"],
    ["server-error-latency", "Server error response latency", "Visits", event =>
      status(500, 599)(event) && hasNumber("originResponseMs")(event), "httpStatus", "originResponseMs", "ms"],
    ["fast-responses", "Responses under 50 ms", "Visits", event =>
      hasNumber("originResponseMs")(event) && event.details.originResponseMs < 50, "page", "originResponseMs", "ms"],
  ]],
  ["Security and integrity", [
    ["ssh-blocks", "SSH blocks by hour", "Fail2ban", event =>
      field("action", "blocked")(event) && !field("context", "Firewall verification")(event), "hour"],
    ["ssh-unblocks", "SSH block releases by hour", "Fail2ban", field("action", "unblocked"), "hour"],
    ["firewall-checks", "Firewall verification activity", "Fail2ban", field("context", "Firewall verification"), "action"],
    ["ssh-bursts", "Correlated SSH block windows", "SOC", hasNumber("distinctSources"), "jail", "distinctSources", "sources"],
    ["audit-rules", "Audit activity by rule", "Auditd", present("rule"), "rule"],
    ["baseline-matches", "Verified integrity baselines", "AIDE", field("baseline", "matched")],
    ["baseline-changes", "Integrity baseline alerts by day", "AIDE", field("baseline", "changed"), "day"],
    ["integrity-additions", "Files added to monitored paths", "AIDE", field("change", "added"), null, "entries", "entries"],
    ["integrity-removals", "Files removed from monitored paths", "AIDE", field("change", "removed"), null, "entries", "entries"],
    ["integrity-modifications", "Modified files in monitored paths", "AIDE", field("change", "changed"), null, "entries", "entries"],
  ]],
  ["Host services", [
    ["service-starts", "Service start jobs", "Systemd", field("jobType", "start"), "unit"],
    ["service-stops", "Service stop jobs", "Systemd", field("jobType", "stop"), "unit"],
    ["service-restarts", "Service restart jobs", "Systemd", field("jobType", "restart"), "unit"],
    ["service-reloads", "Service reload jobs", "Systemd", field("jobType", "reload"), "unit"],
    ["failed-service-jobs", "Failed systemd jobs", "Systemd", level("error"), "jobResult"],
    ["service-warnings", "Host service warnings", "Host services", level("warning"), "unit"],
    ["service-errors", "Host service errors", "Host services", level("error"), "unit"],
    ["kernel-warnings", "Kernel warnings by hour", "Kernel", level("warning"), "hour"],
    ["kernel-errors", "Kernel errors by hour", "Kernel", level("error"), "hour"],
    ["urgent-journal", "Journal priority 0–2 alerts", ["Kernel", "Host services"], oneOf("priority", [0, 1, 2]), "priority"],
  ]],
  ["Telemetry coverage", [
    ["event-volume", "Retained events by UTC hour", null, all, "hour"],
    ["daily-volume", "Retained events by UTC day", null, all, "day"],
    ["feed-volume", "Event volume by component", null, all, "component"],
    ["collector-volume", "Event volume by collector", null, present("source"), "source"],
    ["warning-volume", "Warnings by component", null, level("warning"), "component"],
    ["error-volume", "Errors by component", null, level("error"), "component"],
    ["missing-status", "Visits missing a valid HTTP status", "Visits", event => !status(100, 599)(event), "page"],
    ["missing-timing", "Visits missing origin latency", "Visits", event => !hasNumber("originResponseMs")(event), "page"],
    ["missing-size", "Visits missing response size", "Visits", event => !hasNumber("responseBytes")(event), "page"],
    ["missing-protocol", "Visits missing origin protocol", "Visits", event => !present("originProtocol")(event), "page"],
  ]],
];

export const reportCatalog = groups.flatMap(([category, definitions]) => definitions.map(
  ([id, title, component, match, dimension, measure, unit]) =>
    ({ id, title, category, component, match, dimension, measure, unit })
));
