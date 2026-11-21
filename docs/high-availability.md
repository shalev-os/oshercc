# Linux and IIS failover

The Linux origins for osher.cc and mazonhaosher.co.il expose `/_ops/healthz`. Nginx returns 200 with caching disabled while it can locate each site's published index. Linux currently serves both public websites.

When the IIS machine is available:

1. Configure independent Cloudflare Tunnels for Linux and Windows. Bind IIS to loopback and run its own connector. Configure an equivalent readiness endpoint in IIS.
2. Publish the same CI-validated release to both origins. Verify the entry HTML and hashed assets served by each origin before activating standby traffic. Keep each server's site configuration separate from the release.
3. Configure Cloudflare Load Balancing for each public hostname, with Linux as primary and IIS as standby. Use an HTTPS monitor that expects 200 at `/_ops/healthz` and sends the relevant site hostname in its Host header. The protected deployment console remains a separate Linux service.
4. Test failover and failback on a test hostname. Confirm the standby serves the same release when the primary fails and that routing returns to the primary after it recovers.

[Cloudflare Tunnel load balancers](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/public-load-balancers/) · [Active-passive steering](https://developers.cloudflare.com/load-balancing/understand-basics/traffic-steering/steering-policies/standard-options/)
