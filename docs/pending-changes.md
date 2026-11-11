# Pending changes

Requests are logged here and built only when James sends a build message. Entries move from Pending to Done (Built or Dropped) and are never deleted. IDs are never reused.

Current release: v2.9.0

## Pending

### P-17 - Cloudflare Access check and two-step sign-in decision
Requested: 2026-11-07 (logged by Claude while building P-14, not requested by James)
Type: minor        Status: Pending
Notes / questions: (a) Optionally verify the Cloudflare Access JWT (CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD) on /api routes while leaving /healthz, the manifest, icons, service worker and the inbound-email route public. (b) The spec's baseline lists mandatory TOTP two-step sign-in, hashed server-side sessions, step-up password prompts and an audit log for apps with personal or financial data; decide which of these a household CMMS needs.

### P-18 - Mobile performance and accessibility findings from Lighthouse
Requested: 2026-11-07 (logged by Claude from the v2.10.0 Lighthouse run, not requested by James)
Type: minor        Status: Pending
Notes / questions: Mobile performance scored 61 (largest paint 7 s on the throttled test) because all of the app is one 1.1 MB script; split heavy screens and libraries (spreadsheet import, QR codes) so they load on demand. Accessibility scored 89: some form fields have no associated label, some text lacks contrast, and the sign-in page logs one console error. Also: nodemailer has a known advisory whose fix is a major version upgrade, and Google Fonts are loaded from Google (self-hosting them would remove the outside request and tighten the CSP).

### P-19 - Android app (Trusted Web Activity) and F-Droid publishing: the section 15 pilot
Requested: 2026-11-10 (James: "MaintEnhance is the Android pilot ... Log the Android pilot as a pending item per section 1a ... Do not build until I say build"). Spec: docs/handoff-app-development.md v1.10, section 15, in the homelab repo (the only copy; this repo keeps none), draft status lifted by James for this chat only.
Type: minor (new Android build, assetlinks route, workflow job)        Status: Pending
Notes / questions:
- Instance: the APK opens the home instance, https://maintenhance.hoffmanhouse.ca (port 8040), unless James says twl (https://maintenhance-twl.hoffmanhouse.ca, 8041). James has not chosen; default is home.
- Package id ca.hoffmanhouse.maintenhance; versionName = release version; versionCode = MAJOR*100000000 + MINOR*10000 + PATCH (2.11.0 -> 200110000). Expected bump: minor (2.11.0).
- Repo work when built: twa-manifest.json (Bubblewrap, fallbackType customtabs, maskable icons, startUrl ".", host above); split release.yml into prepare, image and android jobs (needs [prepare, image], gate step skips apps without twa-manifest.json, APK named maintenhance-<version>.apk, attached to the release the image job creates; no tag is ever pushed); serve /.well-known/assetlinks.json with its own route (express.static skips dot-folders), no redirect, application/json, package id plus the SHA-256 fingerprint James supplies (the fingerprint is public, so it can live in the repo); functional-spec Android section; RELEASE.md Android line; CHANGELOG.
- James's own steps, none done yet: (1) create the signing key himself with keytool (PKCS12, RSA 4096, 10000 days); (2) add the four GitHub secrets ANDROID_KEYSTORE_B64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD; (3) read the SHA-256 fingerprint and send it back (never the key or passwords); (4) Cloudflare Access: the existing bypass application "family apps public files" covers /manifest.json but not /manifest.webmanifest (which the page has linked since v2.10.0) and not /.well-known/assetlinks.json; both paths must be added or the install and the TWA verification get the Access login page; (5) keep a backup of the key (password manager plus offline copy); (6) check the first APK on a real phone (no address bar visible); (7) Claude Code adds jameshoffman7667/maintenhance to the fdroid apps.txt (one line, given after the APK exists).
- Expect the android job to need patch releases; a failed android job leaves the image, release and tag good.
- Out of scope: push notifications and share targets. Not built until James sends a build message; the release will say Update: later unless he writes "build, push and update".

### P-20 - AI usage to the v1.10 rules (section 14): provider-agnostic wrapper and declarations
Requested: 2026-11-10 (logged by Claude from the spec v1.10 gap check, not requested by James)
Type: minor        Status: Pending
Notes / questions: The app calls Google Gemini directly (GEMINI_API_KEY, GEMINI_MODEL; backend/aibuild.js, backend/prefill.js). Spec v1.10 requires: one wrapper module that is the only code talking to a model; configuration through AI_ENABLED, AI_BASE_URL (OpenAI-compatible endpoint), AI_API_KEY, AI_MODEL, optional AI_MODEL_<TASK>, AI_TIMEOUT_MS, AI_MAX_CONCURRENCY; strict JSON output with validation; one versioned prompt file per task plus a small fixture set; timeouts, retries with backoff and a concurrency cap; one log line per call (ai_call task=... model=... ok=... ms=... tokens_in=... tokens_out=...) with no prompts or responses logged; an "AI usage" section in docs/functional-spec.md and an AI line in deploy/RELEASE.md listing every feature (page prefill, Build with AI single and many, refine, email intake drafting), data sent (including photos and forwarded email text) and registry rows for the homelab docs/ai-inventory.md. Questions: keep GEMINI_API_KEY and GEMINI_MODEL working as fallbacks for existing .env files (recommended)? Is Gemini reached through its OpenAI-compatible endpoint by default, so a local Ollama or llama.cpp server is a drop-in?

### P-21 - RELEASE.md fields added in spec v1.10
Requested: 2026-11-10 (logged by Claude from the spec v1.10 gap check, not requested by James)
Type: patch (docs only)        Status: Pending
Notes / questions: v1.10 RELEASE.md adds AI: and Android: lines and a Docker build line after Rollback; ours has the Docker build text inside a longer line and no AI or Android line. Folded into P-19 (Android line) and P-20 (AI line); this entry covers the remaining layout so the file matches section 8 exactly. Can be built with P-19 or alone.

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

### P-6 - Runtime hardening to match the app spec (healthz and HEALTHCHECK moved to P-9)
Requested: 2026-10-22 (logged by Claude from the spec audit during v2.7.1, not requested by James)
Type: patch        Status: Built in v2.10.0
Notes / questions: Add tini as the image ENTRYPOINT, run as a non-root user, and stop cleanly on SIGTERM within 10 seconds (server.js has no SIGTERM handler today, so a stop may end in exit 137). Question: non-root changes who can write the existing /data and /files folders, so the host folders would need a one-time chown to 1000:100. OK to do that?

### P-7 - PWA gaps against the app spec
Requested: 2026-10-22 (logged by Claude from the spec audit during v2.7.1, not requested by James)
Type: minor        Status: Built in v2.10.0
Notes / questions: Gap analysis 2026-11-05 adds: manifest is manifest.json (spec: manifest.webmanifest served as application/manifest+json), start_url and scope are ".", no apple-touch-icon at 180x180 (uses the 192 icon), no offline fallback page, the service worker is cache-first for every GET (spec: network-first for navigations, precache the shell only), calls skipWaiting immediately with no "Update available, reload" prompt, registration has no controllerchange handling, mobile has no bottom nav and breakpoints are 860/600/480 px rather than 768/1024, no 320 px overflow check. Found so far: the manifest has no `id` and no wide or narrow `screenshots`; the service worker cache name is the fixed `maintenhance-shell-v1` instead of carrying the app version. Not yet audited: update prompt, install button, offline page, no reload on first install, layouts at 390x844, 768x1024, 1440x900 and 320 px, Lighthouse PWA result. James 2026-11-07: iOS install instructions are not wanted. Add a Lighthouse check: run Lighthouse (PWA installability plus mobile and desktop) against the built app and report the scores in the release notes; fix anything it flags as an installability failure. Built in v2.10.0: webmanifest with id and screenshots, 180 px Apple touch icon, offline page, versioned network-first service worker with an Update available prompt, bottom navigation under 768 px, breakpoint moved from 860 to 767 px, visible keyboard focus. iOS install instructions dropped by James 2026-11-07. Lighthouse 12 (no PWA category) run: mobile 61/89/93/91, desktop 94/89/96/91 (performance, accessibility, best practices, SEO); Chromium reports no installability errors. Not checked on a real phone or tablet.

### P-8 - Housekeeping for the release flow
Requested: 2026-10-22 (logged by Claude from the spec audit during v2.7.1, not requested by James)
Type: patch        Status: Built in v2.10.0
Notes / questions: (a) The in-app version history parses only the old "Commit short description" format, so v2.7.1 and later entries show their Short and Long lines as raw text under an empty title; make it read Short and Long. (b) Move the functional spec to docs/functional-spec.md and add Mobile layout, Desktop layout and PWA sections (it is Home_CMMS_Functional_Specification.md at the repo root today). (c) Add a one-command automated test run (there are no tests today) covering the version, changelog length, PWA file and healthcheck rules. Built in v2.10.0: (a) version history reads Short/Long, (b) docs/functional-spec.md with Mobile layout, Desktop layout and PWA sections, (c) npm test in backend/ (18 tests).

### P-11 - Make deploy notes match the real server stack
Requested: 2026-10-22 (from Claude Code's deploy plan for v2.8.1, relayed by James)
Type: patch (docs and compose only)        Status: Built in v2.10.0
Notes / questions: (a) deploy/RELEASE.md "Verify after deploy" uses curl, but vm101 has wget and no curl; use `wget -qO- http://127.0.0.1:<PORT>/healthz`. (b) The server stack is this repo's docker-compose.yml, not deploy/compose.yaml; its data paths come from DATA_PATH and FILES_PATH in the stack's .env, not the FAST_STORAGE and SLOW_STORAGE defaults. Say so in RELEASE.md and in the README's deploy section. (c) docker-compose.yml has no healthcheck; add the same /healthz healthcheck (30s start period) so the repo file and the server stack agree, and decide whether it should also move off :latest to a pinned tag. (d) maintenhance_twl (port 8041) runs the same image and digest as the home instance; RELEASE.md should mention it needs its own separate update. (e) Spec copy: Claude Code reports the homelab repo's app spec is v1.6 with the push-to-main flow and no v1.7; the copy used in this chat says v1.7 with the tag flow. Reconcile before the next release. Built in v2.10.0 (a)-(d). (e) the chat copy of the spec (skill) said v1.7 while the homelab repo is v1.9; the repo copy was used.

### P-12 - Health check must require the status body, and /healthz needs tests
Requested: 2026-11-05 (logged by Claude from the spec v1.9 gap analysis, not requested by James)
Type: patch        Status: Built in v2.10.0
Notes / questions: Spec v1.9 requires the image and compose health checks to fail unless the body contains "status":"ok"; ours only test the HTTP status (r.ok), so a 200 with a wrong body would pass. Change both checks (the slim image has no wget, so keep node and test the parsed body). A test should lock the exact body {"status":"ok","version":"<package version>"}, that it needs no login and sets no cookie. Depends on the test runner in P-8(c).

### P-13 - Reproducible, smaller image
Requested: 2026-11-05 (logged by Claude from the spec v1.9 gap analysis, not requested by James)
Type: patch        Status: Built in v2.10.0
Notes / questions: (a) No package-lock.json in backend or frontend and the Dockerfile uses `npm install`, so builds are not reproducible; commit lockfiles and use `npm ci`. (b) Base images are `node:20-slim` (floating); pin major.minor (e.g. node:20.19-slim). (c) The final stage installs python3 and build-essential to compile better-sqlite3 and keeps them; move the compile to a build stage and copy node_modules across, then report the image size (spec target under 300 MB). Recommendation (Claude, 2026-11-05, awaiting James's OK): stay on Debian slim but use a two-stage build (compile better-sqlite3 in a build stage, copy only node_modules into a clean final image), with pinned version and lockfiles. Switch to Alpine (spec's default) only if the image is still over 300 MB. Built in v2.10.0 with the Debian slim two-stage build (node:20.19-slim, lockfiles, npm ci, tini). Image size not measured (no Docker in the authoring session).

### P-14 - Security baseline gaps
Requested: 2026-11-05 (logged by Claude from the spec v1.9 gap analysis, not requested by James)
Type: minor        Status: Built in v2.10.0
Notes / questions: (a) JWT_SECRET missing only logs a warning and falls back to a hard-coded secret; spec says required secrets fail fast. (b) No `trust proxy`: behind Caddy req.ip is the proxy address, so the forgot-password and inbound-secret limiters are shared by everyone; trust forwarded headers from the Docker network only. (c) CSRF is only SameSite=Lax; add an Origin/Host check on writes. (d) No security headers except on one route: add frame denial, no-referrer and a Content-Security-Policy. A strict CSP (no inline style) conflicts with the ~975 inline style attributes in App.jsx, so a strict CSP means a large refactor. Recommendation (Claude, 2026-11-05, awaiting James's OK): ship a relaxed CSP now (restrict script sources, allow inline styles); tighten to a strict CSP later only if wanted. (e) Optional: verify the Cloudflare Access JWT (CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD) on /api routes. The two-step sign-in (TOTP) part of the baseline applies to finance data; decide whether a household CMMS needs it. Built in v2.10.0: (a) JWT_SECRET required, (b) trust proxy, (c) Origin check on writes (also allows X-Forwarded-Host and APP_URL host; ORIGIN_CHECK=false turns it off), (d) security headers with the relaxed CSP James approved (inline styles allowed). Not built: (e) Cloudflare Access JWT check and the TOTP question, logged as P-17.

### P-15 - Schema versioning and pre-migration backup
Requested: 2026-11-05 (logged by Claude from the spec v1.9 gap analysis, not requested by James)
Type: patch        Status: Built in v2.10.0
Notes / questions: Migrations are ad hoc `PRAGMA table_info` plus ALTER TABLE in db.js with no schema_version table and no timestamped copy before a data-changing migration (/data/backups/pre-migrate-<from>-to-<to>.db). All migrations so far are additive, so this is a process gap rather than a data risk today. Add schema_version, run migrations in a transaction, copy the database before any migration that changes or drops data.

### P-16 - Deploy file format against spec v1.9
Requested: 2026-11-05 (logged by Claude from the spec v1.9 gap analysis, not requested by James)
Type: patch (docs and compose only)        Status: Built in v2.10.0
Notes / questions: (a) RELEASE.md has `Update:` after the Type line; spec says it is the line right after the heading. (b) RELEASE.md has no `Actions run:` line. (c) No deploy/.env.example (only the root .env.example). (d) The root docker-compose.yml has no healthcheck, no log limits and uses :latest (overlaps P-11c). (e) Training guides are no longer regenerated each release (not a spec item; say if you still want them). Built in v2.10.0 (a)-(d). (e) not a spec item, nothing changed.
