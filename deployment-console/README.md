# Osher Deployment Console

An interactive demo of the private dashboard that monitors the Linux and Nginx deployments behind osher.cc and mazonhaosher.co.il.

- Inspect release health, deployed commits, Actions signals, and fallback timer status.
- Review Auditd and AIDE scan status.
- Inspect host uptime, CPU load, memory, swap, and disk usage.
- Set the refresh rate to 5–60 seconds or 10–60 minutes.
- Inspect activity over 24 hours and filter the event log by time range, source, severity, or search. View, copy, or export the filtered JSON.
- Switch between a healthy release, an active deployment, a rollback, and an integrity alert.

The console and demo use the same frontend files. On the deployment hostname the frontend reads the protected status API. On the portfolio it loads browser-local sample data with no requests to production. The public status API path returns 404, and the demo page’s Content Security Policy blocks application data connections.

The portfolio's CI tests both modes. After validation on `main`, the Linux server publishes one build for the public demo and the authenticated console. Vite includes content hashes in the asset names so an HTML release can request its exact assets through the CDN.

Open [the public demo](https://osher.cc/deployment-console/) or serve this directory with a static HTTP server.
