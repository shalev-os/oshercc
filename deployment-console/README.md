# Osher Deployment Console

An interactive demo of the private dashboard that monitors the Linux and Nginx deployments behind osher.cc and mazonhaosher.co.il.

- Inspect release health, deployed commits, Actions signals, and fallback timer status.
- Track the deployment console itself alongside the public websites.
- See the next scheduled fallback check with a live countdown and actual build state.
- Review Auditd, AIDE file integrity, and Fail2ban SSH protection.
- Inspect host uptime, CPU load, memory, swap, and disk usage.
- Set the refresh rate to 5–60 seconds or 10–60 minutes.
- Filter the event log with visible time shortcuts for 1 hour, 24 hours, 48 hours, 7 days, 14 days, or all retained events, or use source, severity, and search filters. The six-bucket activity chart and severity counts follow the active filters. Read structured event details, open each event as JSON, or export the filtered set as JSON or Excel-compatible CSV.
- Inspect recent origin page loads with source IP, HTTP status, origin response time, response bytes, and protocol. Records omit full URLs and browser identifiers. The demo uses documentation-only sample IPs.
- Use live shortcuts for builds, rollbacks, integrity alerts, and page loads.
- Browse up to 14 days of retained events, capped at 1,250 page loads, 1,250 deployment and integrity events, and 1,250 host events. The activity chart shows the last 24 hours.
- Inspect systemd service jobs, host service warnings, and kernel alerts as structured events.
- Switch between a healthy release, an active deployment, a rollback, and an integrity alert.

The console and demo use the same frontend files. On the deployment hostname the frontend reads the protected status API. On the portfolio it loads browser-local sample data with no requests to production. The public status API path returns 404.

The portfolio's CI tests both modes. After validation on `main`, the Linux server publishes one build for the public demo and the authenticated console. Vite includes content hashes in the asset names so an HTML release can request its exact assets through the CDN.

Open [the public demo](https://osher.cc/deployment-console/) or serve this directory with a static HTTP server.
