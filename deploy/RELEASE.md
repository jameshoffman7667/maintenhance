# Release v2.13.0
Update: later
Image: mybadreligon/maintenhance:2.13.0   (built by the release workflow on the push to main that set version 2.13.0; also tagged 2.13 and latest)
Short: Open the item from a tapped push notification
Long: Tapping a push notification now opens the work order (assigned, due, overdue) or the new work request (scrolled to and highlighted), or the Alarms screen. Works when the app is closed or already open (P-30).
Release commit: the commit the tag v2.13.0 points to (this file is part of it)        Actions run: reported with the release (see the Actions tab, workflow "release")
Type: minor (extends push notifications from 2.12.0; no schema or env change)
Port: 8040 (host = container; existing assignment; second instance maintenhance_twl is 8041)   Exception: none
Public hostname: unchanged (maintenhance.hoffmanhouse.ca)        Needs Caddy route: no
New or changed env vars: none (see v2.12.0 for the optional PUSH_ENABLED and VAPID_* names, v2.11.0 for AI_*). The compose files change only in the image tag.
Data: /data (SQLite) and /files. Owner UID 1000 / GID 100 as before. Migration: none. Schema stays at 11.
Resources: unchanged plus one 5-minute timer (a small database read) and web-push (about 1 MB of dependencies).
Healthcheck: unchanged. GET /healthz on $PORT -> 200 {"status":"ok","version":"2.13.0"}; 503 if the database cannot be read.
Server stack note: the live stack uses this repo's docker-compose.yml (data paths from the stack .env). It now also carries PUSH_ENABLED and VAPID_* names (blank values are fine), so the hands-off updater is expected to return CONFIRM for maintenhance_home. maintenhance_twl (port 8041) needs its own separate update. Push messages leave the server to the browser vendors' push services (fcm.googleapis.com, updates.push.services.mozilla.com, etc.): outbound HTTPS must be allowed.
Verify after deploy: (1) docker ps shows maintenhance healthy with a new start time; (2) healthz returns version 2.13.0; (3) with push turned on for a device, assign a work order to that user from another account: the notification arrives and tapping it opens that work order; (4) submit a work request as an Executor: an Owner's device gets the notification and tapping it shows that request highlighted; (5) tap one with the app already open: it switches to the item without reloading.
PWA: service worker changed (notification tap now passes the link to the open window); cache name maintenhance-shell-v2.13.0, so phones show the "Update available" bar once. Cloudflare Access bypass paths unchanged. Layouts: no layout change (a 4-second highlight on a request card); not re-checked on a phone. Not checked: iOS.
AI: unchanged from v2.11.0 (no new model calls).
Android: yes. versionName 2.13.0, versionCode 201130000. No manifest change since 2.12.0 (notifications enabled there). The new maintenhance-2.13.0.apk is attached by the android job; the web part of the fix arrives with the deployed image, so the existing 2.12.0 app also gets it once the server is updated. Tapping a notification in the Android app: tested only in a desktop browser, not on a phone.
Docker build: not run locally (Docker Hub is unreachable from the authoring session); the workflow builds the image. Frontend build and all backend tests (57) ran locally on Node 22; the image uses Node 20.19. The notification links were exercised in headless Chromium (fresh start, request scroll and highlight, alarms, unknown id, and a link handed to an already-open app); the service worker's own click handler was not run.
Rollback: previous image tag 2.12.0 (or the pinned rollback digest); data restore needed: no.
Known issues: requests and alarms have no single-item view, so those notifications open the list (request scrolled to and highlighted); the service worker's notification-click code was not run in a browser and is untested on a phone; push is untested on a real device and not on iOS; Back does not step through selections inside a page; nodemailer and web-push have npm advisories noted, not addressed; Google Fonts still load from fonts.googleapis.com; AI_ENABLED defaults to "on when configured".
Backup tier: small/critical (include in Tier 1); SQLite needs stop during copy
