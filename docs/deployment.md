# Static site delivery

Repository: `shalev-os/oshercc`  
Website: <https://osher.cc>

GitHub Actions validates pull requests and pushes to `main`, and can also run manually. It runs the static checks, TypeScript validation, available tests, and a production Vite build, then retains the build ZIP for seven days.

Production runs Nginx on Linux behind Cloudflare Tunnel. After successful validation on `main`, GitHub Actions sends an authenticated OIDC notification to the Linux server. The systemd deployment timer also checks GitHub about every five minutes as a fallback. It waits for a successful push or manual validation run for the exact current commit on `main`. The server checks out that commit, builds it under an isolated systemd user, and checks that it is still the current commit before publishing. The notification carries no release files or long-lived secret.

The server swaps the site directory atomically and verifies that local Nginx serves the new index. It restores the prior directory if that check fails and keeps the previous successful release in `/var/www/.osher.cc-previous`. A revert on `main` follows the normal validation and deployment path.

The portfolio release includes the sample-data demo at `/deployment-console/`. The authenticated dashboard at `deploy.osher.cc` uses its own build, document root, previous release and deployed commit record. Both deployments use a validated commit on `main`, and CI exercises both frontend modes.

Deploy the dashboard on demand using the Deployment Console card or `sudo systemctl start osher-site-deploy@deploy.osher.cc.service`. The service publishes to `/var/www/deploy.osher.cc` and records the commit in `/var/lib/osher-site-releases/deploy.osher.cc`. The portfolio notification and timer publish only the portfolio and its demo.

Check production logs with `journalctl -u osher-site-deploy@osher.cc -u osher-site-build@osher.cc`. Start a check immediately with `sudo systemctl start osher-site-deploy@osher.cc`. The last deployed commit is recorded in `/var/lib/osher-site-releases/osher.cc`.

See the [Linux and IIS failover runbook](high-availability.md) for the readiness endpoint and standby setup.
