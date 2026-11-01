# Static site delivery

Repository: `shalev-os/oshercc`
Website: <https://osher.cc>

The public website is a static Vite application. It has no sign-in, administration area, database, hosted backend, provider SDK, or build-time database credentials. Contact links open the visitor's email application or the existing public contact channels; the site does not claim to submit or store messages.

## Validation and releases

Pull requests run static integration checks, TypeScript validation, available unit tests, and the production build on GitHub-hosted Ubuntu runners. Changes to `main` and manual runs on `main` also produce a ZIP artifact. A separate clean deployment job downloads the exact immutable artifact, verifies its digest, signs the ZIP, and sends it through Cloudflare Access to the loopback-only IIS deployment receiver. Build steps never receive deployment secrets. Public repositories must not use a self-hosted runner on the production server.

The receiver accepts only this repository on `refs/heads/main`, checks the archive and HMAC, rejects replayed requests and unsafe paths, and preserves the server's `web.config`. Existing source `public/web.config` is excluded from the deployment package. IIS serves the site from `C:\Sites\osher` on port 8081 behind Cloudflare Tunnel.

## One-time production setup

Create the GitHub environment `production`, allow deployment only from `main`, and configure:

| Kind | Name | Purpose |
| --- | --- | --- |
| Variable | `DEPLOY_URL` | Working HTTPS deployment hostname protected by Cloudflare Access |
| Secret | `CF_ACCESS_CLIENT_ID` | Access service-token identifier |
| Secret | `CF_ACCESS_CLIENT_SECRET` | Access service-token secret |
| Secret | `DEPLOY_HMAC_KEY` | Repository-specific key matching the receiver's configured key |

No website/database environment variables are required. Keep all deployment secrets out of source control and logs. Restrict changes to the default branch and workflow files through repository review rules.

Before enabling automatic delivery, an authenticated `/healthz` request must return 200, an anonymous request must be denied by Access, and a first signed deployment must pass. A Cloudflare bot challenge is not proof that Access is correctly configured. Ordinary Bot Fight Mode cannot be bypassed with a per-hostname WAF skip rule; resolve that deployment-host conflict before releasing.

## Recovery

The receiver creates a backup before synchronization and restores it if copying or a local IIS health check fails. A failure of the workflow's later public availability check does not trigger receiver rollback; inspect Cloudflare and the deployment logs before retrying.

For a reviewed application rollback, revert the release commit with a new Git commit on `main`; the same pipeline rebuilds and deploys the reverted source. Do not rewrite published Git history or expose credentials during recovery. Backups are retained on the server and need deliberate retention management.

## Current publication status

The migration is prepared locally. Remote writes currently require a GitHub connection whose token permits repository contents and workflow changes. User repository administration rights alone do not establish the integration's token scope. Cloudflare deployment-host authentication also needs successful end-to-end verification before automatic deployment is considered active.
