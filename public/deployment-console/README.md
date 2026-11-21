# Osher Deployment Console

An interactive demo of the private dashboard that monitors the Linux and Nginx deployments behind osher.cc and mazonhaosher.co.il.

- Inspect release health, deployed commits, Actions signals, and fallback timer status.
- Review Auditd and AIDE scan status.
- Search and filter the event log by source or severity, or export filtered results as JSON.
- Switch between a healthy release, an active deployment, a rollback, and an integrity alert.

The demo uses browser-local sample data. It makes no calls to the private production status API.

Open [the public demo](https://osher.cc/deployment-console/) or serve this directory with a static HTTP server.
