# Pending changes

Requests are logged here and built only when James sends a build message. Entries move from Pending to Done (Built or Dropped) and are never deleted. IDs are never reused.

Current release: v2.8.0

## Pending

### P-1 - Build with AI: multi-entity from a list (text or attachment)
Requested: 2026-10-02 or earlier (James)
Type: minor (new feature)        Status: Pending
Notes / questions: The prompt box accepts a pasted list or an attached file (txt/csv/pdf/image) and the AI returns several drafts at once (e.g. many work orders, assets, parts). Drafts are presented one at a time for approval in manual-edit mode (edit, approve, skip). Below each form the AI adds a "Clarifications" section with multiple-choice or free-text questions it needs answered to refine that item; answers re-run the draft.

### P-2 - Explore: forward an email or text message to the app to create an AI-built work request
Requested: 2026-10-02 or earlier (James)
Type: exploration only        Status: Pending
Notes / questions: Feasibility notes were given in chat. Not built until options are chosen.

### P-3 - Build with AI button to convert a work request to a work order
Requested: 2026-10-02 or earlier (James)
Type: minor (new feature)        Status: Pending
Notes / questions: On the work request review screen, a Build with AI button drafts the work order (type, priority, asset, parts, steps) from the request, for review before saving.

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

## Done

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
