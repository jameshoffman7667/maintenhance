# Release v2.8.0
Image: mybadreligon/maintenhance:2.8.0   (built by the v2.8.0 tag workflow; also tagged 2.8 and latest)
Short: Add /healthz endpoint and image healthcheck
Long: GET /healthz on PORT returns {status:ok, version} (the image tag) with no login, no private data and no outside checks; 503 if the database fails. Image HEALTHCHECK and compose use it, 30s start period. Releases now push to GitHub only.
Release commit: the commit tagged v2.8.0 on main (short hash in the release report)        Tag pushed from authoring session: no (Claude Code pushes it)
Type: minor (new endpoint)
Update: later
Port: 8040 (host = container; existing assignment; second instance maintenhance_twl is 8041)   Exception: none
Public hostname: unchanged (existing deployment)        Needs Caddy route: no
New or changed env vars: none (deploy/.env.example lists all; the stack uses PORT_HOST for the host and container port; JWT_SECRET is required)
Data: /data (SQLite database) and /files (photos, nightly snapshots); folders already exist; migration: none. The image runs as root, so there are no owner requirements on the host folders.
Resources: not measured; the only addition is one trivial route and a health probe every 30 seconds. No compose limits recommended.
Healthcheck: GET /healthz on $PORT -> 200 {"status":"ok","version":"2.8.0"}; 503 {"status":"error",...} if the database cannot be read. Image HEALTHCHECK and compose use the same node command (the slim image has no wget or curl), start period 30s.
Verify after deploy: (1) docker ps shows maintenhance healthy; (2) curl -s http://127.0.0.1:<PORT>/healthz returns {"status":"ok","version":"2.8.0"} with no login; (3) sign in and open Work Orders, a page that reads real data, and check the version history shows v2.8.0 marked Installed.
PWA: only change is that the service worker no longer handles /healthz. Install checks, layout checks at 390x844, 768x1024 and 1440x900, and Lighthouse were not run. Cloudflare Access bypass for manifest, service worker and icons: not checked; confirm it is in place. If /healthz is reached through Cloudflare Access it needs a bypass too, or external uptime checks will be redirected to login; the container's own check is unaffected.
Docker build: not run locally (no Docker daemon in the authoring session); first build is the tag workflow. The new HEALTHCHECK line was checked by running the same command against the app, not through Docker.
Rollback: previous image tag 2.7.1 (the v2.7.1 tag may not be pushed yet; if not, use the pinned rollback digest of the running image). Data restore needed: no
Known issues: the image runs as root without tini and has no SIGTERM handler; the service worker cache name is not versioned; the in-app changelog shows Short and Long lines raw. All logged in docs/pending-changes.md.
Backup tier: small/critical (include in Tier 1); SQLite needs stop during copy
