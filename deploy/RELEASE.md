# Release v2.7.1
Image: mybadreligon/maintenhance:2.7.1   (built by the v2.7.1 tag workflow; also tagged 2.7 and latest)
Short: Move to tag-based release workflow
Long: Version tags like v2.7.1 now build and push mybadreligon/maintenhance 2.7.1, 2.7 and latest, then create the GitHub release. Adds deploy/RELEASE.md and deploy/compose.yaml and replaces the push-to-main workflow. No app changes.
Release commit: the commit tagged v2.7.1 on main (short hash in the release report)        Tag pushed from authoring session: no (Claude Code pushes it)
Type: patch (tooling only, no app code changed)
Update: later
Port: 8040 (host = container; existing assignment; second instance maintenhance_twl is 8041)   Exception: none
Public hostname: unchanged (existing deployment)        Needs Caddy route: no
New or changed env vars: none (deploy/.env.example lists all; the stack uses PORT_HOST for the host and container port; JWT_SECRET is required)
Data: /data (SQLite database) and /files (photos, nightly snapshots); folders already exist; migration: none. The image runs as root, so there are no owner requirements on the host folders.
Resources: not measured this release; no app code changed from v2.7.0, so unchanged. No compose limits recommended.
Healthcheck: no /healthz endpoint yet; compose checks GET /api/config on $PORT -> 200 using node (the slim image has no wget or curl)
Verify after deploy: (1) docker ps shows maintenhance healthy; (2) the /api/config response on the host port (127.0.0.1) reports version 2.7.1; (3) sign in and open Work Orders, a page that reads real data, and check Settings, version history shows v2.7.1 marked Installed.
PWA: no PWA changes in this release. Install checks, layout checks at 390x844, 768x1024 and 1440x900, and Lighthouse were not run. Cloudflare Access bypass for manifest, service worker and icons: not checked; confirm it is in place.
Docker build: not run locally (no Docker daemon in the authoring session); the Dockerfile is unchanged since v2.7.0, so the first build with the new workflow is the tag run
Rollback: no earlier semver tag exists (v2.7.0 was never tagged); use the pinned rollback digest of the currently running image. Data restore needed: no
Known issues: no /healthz; the image runs as root without tini; the service worker cache name is not versioned; the in-app changelog shows the new Short/Long lines raw. All logged in docs/pending-changes.md.
Backup tier: small/critical (include in Tier 1); SQLite needs stop during copy
