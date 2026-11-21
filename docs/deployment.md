# Static site delivery

Repository: `shalev-os/oshercc`  
Website: <https://osher.cc>

GitHub Actions validates pull requests and pushes to `main`, and can also run manually. It runs the static checks, TypeScript validation, available tests, and a production Vite build, then retains the build ZIP for seven days.

Production runs Nginx on Linux behind Cloudflare Tunnel. The server's `osher-site-deploy@osher.cc.timer` checks GitHub about every five minutes. It waits for a successful push or manual validation run for the exact current commit on `main`. The server checks out that commit, builds it under an isolated systemd user, and checks that it is still the current commit before publishing. Deployment needs no inbound webhook or GitHub secret.

The server swaps the site directory atomically and verifies that local Nginx serves the new index. It restores the prior directory if that check fails and keeps the previous successful release in `/var/www/.osher.cc-previous`. A revert on `main` follows the normal validation and deployment path.

Check production logs with `journalctl -u osher-site-deploy@osher.cc -u osher-site-build@osher.cc`. Start a check immediately with `sudo systemctl start osher-site-deploy@osher.cc`. The last deployed commit is recorded in `/var/lib/osher-site-releases/osher.cc`.
