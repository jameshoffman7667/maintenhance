# Pending changes

Requests are logged here and built only when James sends a build message. Entries move from Pending to Done (Built or Dropped) and are never deleted. IDs are never reused.

Current release: v2.9.0

## Pending

### P-6 - Runtime hardening to match the app spec (healthz and HEALTHCHECK moved to P-9)
Requested: 2026-10-22 (logged by Claude from the spec audit during v2.7.1, not requested by James)
Type: patch        Status: Pending
Notes / questions: Add tini as the image ENTRYPOINT, run as a non-root user, and stop cleanly on SIGTERM within 10 seconds (server.js has no SIGTERM handler today, so a stop may end in exit 137). Question: non-root changes who can write the existing /data and /files folders, so the host folders would need a one-time chown to 1000:100. OK to do that?

### P-7 - PWA gaps against the app spec
Requested: 2026-10-22 (logged by Claude from the spec audit during v2.7.1, not requested by James)
Type: minor        Status: Pending
Notes / questions: Found so far: the manifest has no `id` and no wide or narrow `screenshots`; the service worker cache name is the fixed `maintenhance-shell-v1` instead of carrying the app version. Not yet audited: update prompt, install button, offline page, no reload on first install, layouts at 390x844, 768x1024, 1440x900 and 320 px, Lighthouse PWA result.

### P-8 - Housekeeping for the release flow
Requested: 2026-10-22 (logged by Claude from the spec audit during v2.7.1, not requested by James)
Type: patch        Status: Pending
Notes / questions: (a) The in-app version history parses only the old "Commit short description" format, so v2.7.1 and later entries show their Short and Long lines as raw text under an empty title; make it read Short and Long. (b) Move the functional spec to docs/functional-spec.md and add Mobile layout, Desktop layout and PWA sections (it is Home_CMMS_Functional_Specification.md at the repo root today). (c) Add a one-command automated test run (there are no tests today) covering the version, changelog length, PWA file and healthcheck rules.

### P-11 - Make deploy notes match the real server stack
Requested: 2026-10-22 (from Claude Code's deploy plan for v2.8.1, relayed by James)
Type: patch (docs and compose only)        Status: Pending
Notes / questions: (a) deploy/RELEASE.md "Verify after deploy" uses curl, but vm101 has wget and no curl; use `wget -qO- http://127.0.0.1:<PORT>/healthz`. (b) The server stack is this repo's docker-compose.yml, not deploy/compose.yaml; its data paths come from DATA_PATH and FILES_PATH in the stack's .env, not the FAST_STORAGE and SLOW_STORAGE defaults. Say so in RELEASE.md and in the README's deploy section. (c) docker-compose.yml has no healthcheck; add the same /healthz healthcheck (30s start period) so the repo file and the server stack agree, and decide whether it should also move off :latest to a pinned tag. (d) maintenhance_twl (port 8041) runs the same image and digest as the home instance; RELEASE.md should mention it needs its own separate update. (e) Spec copy: Claude Code reports the homelab repo's app spec is v1.6 with the push-to-main flow and no v1.7; the copy used in this chat says v1.7 with the tag flow. Reconcile before the next release.

## Done

### P-1 - Build with AI: multi-entity from a list (text or attachment)
Requested: 2026-10-02 or earlier (James)
Type: minor (new feature)        Status: Built in v2.9.0
Notes / questions: Checkbox "This is a list" in Build with AI on the work order, work request, asset, vendor and part forms; paste a list and/or attach up to 3 text, CSV, PDF or image files. Drafts are reviewed one at a time in an editable form (Add or Skip), with the AI's multiple-choice or text questions at the bottom of each item and an Update draft button. Locations, BOM, PM programs and templates keep their existing tick-box lists.

### P-2 - Forward an email or text message to the app to create an AI-built work request
Requested: 2026-10-02 or earlier (James); decisions given 2026-10-30
Type: minor (new feature)        Status: Built in v2.9.0
Notes / questions: Cloudflare Email Routing and an Email Worker (deploy/inbound-email-worker.js) post each raw message to POST /api/inbound/email with INBOUND_EMAIL_SECRET. Allowed senders: any registered user's email plus alternate sender addresses on My account (for the Telus text gateway). Messages wait in a review queue on Work Requests (not a work request status) so the server never rewrites the saved data; Review opens the normal form filled from the AI draft. No IMAP; no SMS provider. James sets up the Cloudflare side.

### P-3 - Build with AI button to convert a work request to a work order
Requested: 2026-10-02 or earlier (James)
Type: minor (new feature)        Status: Built in v2.9.0
Notes / questions: Convert to work order has a Build with AI button that drafts type, work plan, crew, hours and required-by date from the request; the plan is added to the work order description.


### P-4 - Switch to the standard release flow from the home server app spec
Requested: 2026-10-22 (James: "Please switch this app to the standard release flow in the home server app spec")
Type: patch (tooling only)        Status: Built in v2.7.1
Notes / questions: A tag `vMAJOR.MINOR.PATCH` runs `.github/workflows/release.yml`: validate version and CHANGELOG, build and push `mybadreligon/maintenhance:X.Y.Z`, `X.Y` and `latest`, then create the GitHub release as the last step. Each release leaves deploy/RELEASE.md and deploy/compose.yaml. Replaces docker-publish.yml. The version check reads backend/package.json and requires frontend/package.json to match, because the repo has no root version file. This file moved from the repo root PENDING_CHANGES.md to docs/pending-changes.md.

### P-5 - Add a fixed Update field to deploy/RELEASE.md
Requested: 2026-10-22 (James: "add a fixed field Update: now or Update: later")
Type: patch (tooling only)        Status: Built in v2.7.1
Notes / questions: `Update: now` only when James's build message is "build, push and update"; any other build message gives `Update: later`. v2.7.1 was built on "build and push", so it says `Update: later`. Placed after the Type line.

### P-9 - Health endpoint /healthz and matching healthchecks
Requested: 2026-10-22 (James: "Make sure the app answers GET /healthz on $PORT with {"status":"ok","version":"<same as the image tag>"}, no login, no private data, and no checks of outside services. Add a matching HEALTHCHECK to the image and the compose file, with a 30 second start period.")
Type: minor (new endpoint)        Status: Built in v2.8.0
Notes / questions: Answers 200 {"status":"ok","version":"2.8.0"} (full package version, equal to the image tag; the in-app label still drops a trailing .0). Checks only the local database; 503 {"status":"error",...} if that fails. Registered before auth and the web page catch-all, never cached, skipped by the service worker. Image HEALTHCHECK and deploy/compose.yaml use the same node command against 127.0.0.1:${PORT}, 30s interval, 5s timeout, 3 retries, 30s start period. Also from James: no zip delivery from now on, releases are pushed to GitHub only.

### P-10 - Release on a push to main, no tag push
Requested: 2026-10-22 (James: "Change the release workflow so it never needs a tag push. Trigger it on a push to main that changes the version...")
Type: patch (release tooling only)        Status: Built in v2.8.1
Notes / questions: Version file is backend/package.json (frontend/package.json must match). The workflow runs on a push to main that changes backend/package.json and skips if the version number itself did not change. It fails if tag vX.Y.Z or a GitHub release for it already exists, or the CHANGELOG entry is missing or too long; builds and pushes X.Y.Z, X.Y and latest; then runs `gh release create vX.Y.Z --target $GITHUB_SHA` with the workflow's own token (contents: write), which creates the tag. The v*.*.* tag trigger remains as a manual fallback; all runs share one concurrency group. 2.7.1 and 2.8.0 were never built or tagged on GitHub; 2.8.1 is the first image. The home server app spec (v1.7) and handoff doc still describe the tag flow; this repo deliberately differs.
