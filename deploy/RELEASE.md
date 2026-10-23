# Release v2.8.1
Image: mybadreligon/maintenhance:2.8.1   (built by the release workflow on the push to main that set version 2.8.1; also tagged 2.8 and latest)
Short: Release on push to main, no tag push needed
Long: A push to main that changes the version in backend/package.json now builds and pushes mybadreligon/maintenhance X.Y.Z, X.Y and latest, then creates the tag and release. Tag trigger is a fallback. First image is 2.8.1; 2.7.1, 2.8.0 were never built.
Release commit: the main commit that sets version 2.8.1 (short hash in the release report)        Tag: created by the workflow with gh release create v2.8.1 --target $GITHUB_SHA (nothing is pushed from the authoring session)
Type: patch (release tooling only; app code is unchanged since v2.8.0, which adds /healthz)
Update: later
Port: 8040 (host = container; existing assignment; second instance maintenhance_twl is 8041)   Exception: none
Public hostname: unchanged (existing deployment)        Needs Caddy route: no
New or changed env vars: none (deploy/.env.example lists all; the stack uses PORT_HOST for the host and container port; JWT_SECRET is required)
Data: /data (SQLite database) and /files (photos, nightly snapshots); folders already exist; migration: none. The image runs as root, so there are no owner requirements on the host folders.
Resources: not measured; one trivial route and a health probe every 30 seconds are the only additions since v2.7.0. No compose limits recommended.
Healthcheck: GET /healthz on $PORT -> 200 {"status":"ok","version":"2.8.1"}; 503 {"status":"error",...} if the database cannot be read. Image HEALTHCHECK and compose use the same node command (the slim image has no wget or curl), start period 30s.
Verify after deploy: (1) docker ps shows maintenhance healthy; (2) curl -s http://127.0.0.1:<PORT>/healthz returns {"status":"ok","version":"2.8.1"} with no login; (3) sign in and open Work Orders, a page that reads real data, and check the version history shows v2.8.1 marked Installed.
PWA: unchanged since v2.8.0 (the service worker skips /healthz). Install checks, layout checks at 390x844, 768x1024 and 1440x900, and Lighthouse were not run. Cloudflare Access bypass for manifest, service worker and icons: not checked; confirm it is in place. An external uptime monitor on /healthz through Cloudflare Access needs a bypass for that path; the container's own check is unaffected.
Docker build: not run locally (no Docker daemon in the authoring session); first build is the release workflow run. The HEALTHCHECK command was checked by running the same command against the app, not through Docker. The workflow's version detection and checks were simulated locally; the first real run is the first full test.
Rollback: no earlier image exists under mybadreligon/maintenhance (2.7.1 and 2.8.0 were never built); use the pinned rollback digest of the currently running image. Data restore needed: no
Known issues: the image runs as root without tini and has no SIGTERM handler; the service worker cache name is not versioned; the in-app changelog shows Short and Long lines raw. All logged in docs/pending-changes.md. The home server app spec (v1.7) still describes the tag-push flow; this repo deliberately differs from it.
Backup tier: small/critical (include in Tier 1); SQLite needs stop during copy
