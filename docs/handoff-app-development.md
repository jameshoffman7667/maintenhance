# App Development Specification (Docker apps for James's home server)

Spec version 1.10, 2026-11-10. Version history: v1.10: merged the Project's older fork into this canonical copy: AI usage declared per app and configured provider-agnostically (section 14) and optional Android build with publishing to James's own F-Droid repo (section 15, DRAFT until the MaintEnhance pilot passes), plus the matching RELEASE.md lines, report items, handoff prompt sentence and Do-not rules; v1.9: a release is a push to `main` that changes the version; the workflow builds the images and creates the GitHub release and the `vX.Y.Z` tag itself, so no tag is ever pushed from an authoring session (the `v*.*.*` tag trigger is only a manual fallback), `/healthz` must return exactly `{"status":"ok","version":"<image tag>"}` and the health checks require that body and wait 30 s; v1.8: `deploy/RELEASE.md` has a fixed `Update: now | later` field, `now` only when James says "build, push and update" for that release; v1.7: every release report ends with a ready-to-paste Claude Code prompt; v1.6: cloud authoring sessions cannot push tags, the image HEALTHCHECK uses `${PORT}`, and finance-hub is assigned port 8070; v1.5: pending changes log, nothing is built until James sends a build message; v1.1: no version digit caps, first digit moves only on James's word; v1.2: every app is an installable PWA with distinct mobile and desktop layouts; v1.4 merged two v1.3 variants: container port equals host port with defined port ranges, and lessons from finance-hub v0.1.0 (Dockerfile/PWA/layout/test pitfalls, security baseline for apps reachable from outside). The canonical copy is `docs/handoff-app-development.md` in James's private repo `homelab`; this skill is a copy. If you can read that repo, check it for a newer version and tell James if the skill is behind. Server layout, ports and storage are in `docs/home-server-reference.md` in the same repo; if this spec and that reference disagree about the server, the reference wins; about app packaging and releases, this spec wins.

## 1. Your job

You build or update ONE app. Every iteration ends with a release that is: committed and pushed to `main` of the app's GitHub repo with the version changed, built into a Docker Hub image by the GitHub Actions workflow (which also creates the GitHub release and the tag), and described so that Claude Code on James's claude-ops box can deploy it without asking you anything. Every release report therefore ends with the filled-in Claude Code prompt from section 10, ready to paste. You do not deploy. Claude Code deploys; James approves. Be direct about what you verified (built, ran, tested) and what you did not.

## 1a. Pending changes log (mandatory for every project)

Requests are logged, not built. Every app has a pending changes log at `docs/pending-changes.md` in its repo. When James asks for a change, a new feature, a fix, an idea or a tweak in the chat, you add it to the log and stop. You write no code, change no app files, bump no version, commit no release and push no release until James sends a message that specifically tells you to build.

- What counts as a build message: an explicit instruction such as "build it", "build P-3", "build P-2 and P-4", "build everything pending", "go ahead and build", "release it", "build, push and update". Anything vaguer ("sounds good", "ok", "yes", "that works", a thumbs up, an answer to your question) is NOT a build message. If unsure, ask: "Do you want me to build P-3 now?"
- The update decision: the exact words "build, push and update" are a build message that also says to deploy this release. Only that phrase sets `Update: now` in `deploy/RELEASE.md` (section 8). Every other build message ("build it", "release it", "build P-3"...) sets `Update: later`. The decision applies to that one release only; it does not carry over to later releases, and you never infer it from context, earlier messages or James seeming in a hurry. If James later says to update a release that was built with `Update: later`, that is a request to deploy it, not a new build: give him the section 10 prompt for that release with the field read as `now` (the committed file stays unchanged).
- What you do on a request: (1) add an entry; (2) show the current Pending list in your reply, short; (3) mention any question that blocks building it (unclear behavior, a conflict with another entry, a PWA or port impact); (4) say that nothing has been built. Discussing options, giving opinions and asking questions is fine; that is not building. Prototype code in the chat counts as building, so don't write it unless James asks to see an example.
- Entry format (one block per request, new ones at the bottom of the Pending list, IDs never reused):

```
### P-12 - Add dark mode toggle
Requested: 2026-10-17 (James: "can the settings page have a dark mode switch?")
Type: minor (new setting)        Status: Pending
Notes / questions: follow the system setting by default? store per device or per account?
```

- Statuses: Pending, Blocked (waiting on an answer), Built (with the version, e.g. "Built in v0.3.0"), Dropped (James cancelled it, with date and reason). Entries are never deleted; they move from `## Pending` to `## Done` (Built and Dropped). The file has exactly those two parts.
- On a build message: build exactly the entries named (all Pending entries if he says everything), as one release unless he asks for separate releases, following the release checklist in section 4. Pick the version bump from the largest change in the batch. Mark the entries Built with the version, and mention the entry IDs in the release's long comment when they fit. Do not add unlogged extras; anything new you notice goes into the log as a new entry.
- Bugs and urgent fixes follow the same rule: log first. When James says "build it" for a bug, build it as a patch release right away.
- Where it lives: commit log updates to `main` as docs-only commits that do not touch the version (a version change on `main` is a release, section 5; message like `docs: log P-12 dark mode`). If you cannot push, keep the log in the chat and give James the exact file text for `docs/pending-changes.md`. The first thing you do in an app chat is read `docs/pending-changes.md` (or ask James to attach it) and show the Pending list; if the file does not exist, create it on the first request.
- Reordering, merging, editing and dropping entries are allowed when James asks, and they are also not builds.

## 2. Fixed facts

- GitHub owner `jameshoffman7667`. One repo per app, named exactly like the app (lowercase, hyphens). Existing: `maintenhance`, `fantasy-support-app`, `pricewatch`, `marketplace-browser`, `finance-hub`. New apps: James names the repo, or you propose `<app>` and confirm before creating.
- Docker Hub namespace `mybadreligon` (image `mybadreligon/<app>`). CI secrets (set once per repo by James): `DOCKERHUB_USERNAME` (value `mybadreligon`) and `DOCKERHUB_TOKEN`. Never ask for or print their values. Apps with an Android build (section 15) also need `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`, set by James.
- Server: Proxmox VM 101 (OpenMediaVault, Debian 13), amd64 only (i5-9600K; shared VM with 8 GiB RAM and 4 vCPU running about 17 containers). Build `linux/amd64` only.
- Public access: Cloudflare Tunnel (Starlink: no port forwarding) to Caddy to the app over plain HTTP. One-level subdomains `<name>.hoffmanhouse.ca`. HTTPS is Cloudflare's job, not the app's.
- Ports: container port = host port wherever possible (e.g. `8070:8070`). Host ports come from the ranges in section 7 (Ports) and are assigned by Claude Code, never invented by the app chat.
- Timezone `America/Toronto`. Containers use `PUID=1000`, `PGID=100` if the base image supports it; otherwise run as a non-root user (for example a fixed `USER 1000:100`) and document the UID the data folders need.
- Email: SMTP2GO, sender `server@hoffmanhouse.ca`; apps read `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Host `mail.smtp2go.com`, port 587 STARTTLS. Values are in the server `.env`, never in the repo.
- Android app store: James's own F-Droid repo `https://apps.hoffmanhouse.ca/repo`, run by the `fdroid` app. Opt-in per app, see section 15.

## 3. Versioning rules (mandatory)

Format `MAJOR.MINOR.PATCH`, git tag `vMAJOR.MINOR.PATCH` (created by the release workflow, section 6). Every new app starts at v0.1.0.

| Change | Bump |
| --- | --- |
| Bug fix, small tweak, dependency bump, copy change | PATCH (third digit) |
| Moderate functional change: new feature, new screen, new setting, new endpoint | MINOR (second digit), PATCH resets to 0 |
| James explicitly says "major revision" | MAJOR (first digit) +1, MINOR and PATCH reset to 0 |

No digit has a cap. PATCH and MINOR keep counting (0.1.9 -> 0.1.10, 0.9.4 -> 0.10.0, 0.10.0 -> 0.11.0). The first digit changes only when James specifies a major revision; never bump it on your own, however large the change, and never because MINOR reached 10 or more. Compare versions numerically, not as text. If unsure between patch and minor, state your reasoning and choose the lower, then let James overrule.

Existing apps: continue from the version already in the repo. If the app has no version yet, its next release is v0.1.0 (say it is a baseline). `multiview-iptv` is currently 0.4.0.

The version lives in ONE source of truth in the repo (`package.json` `version`, or a `VERSION` file) and the image tag, git tag, `CHANGELOG.md` heading and OCI label must all equal it. Changing that version on `main` is what releases (section 5), so never change it outside a release. The app should expose it (footer, `/api/version` or `/healthz` JSON). Anything else that repeats the version (for example a service worker cache name) is checked against the version file by a test, so it cannot drift. Do not hard-code the version in the Dockerfile; the workflow's metadata step sets the OCI version label. (The Android `versionCode` in section 15 is derived from the version and supports MINOR and PATCH up to 9999.)

## 4. Per-iteration release checklist (do ALL, in order)

0. Start only after James has sent a build message (section 1a), and name the pending entries you are building. Note whether the message was "build, push and update" (Update: now) or any other build message (Update: later).
1. Decide the version bump (section 3) and state it to James in one line.
2. Make the change; run tests and a real `docker build` when you can. Say what was and was not run. If the authoring environment cannot pull base images (Docker Hub is blocked in some cloud sessions), say so plainly: the first build is then the release workflow, and James should confirm the container starts healthy after deploy before relying on it. Do not claim a build you did not run. For any UI change, check the layout at phone width (about 390 x 844) and desktop width (about 1440 x 900), and confirm the PWA requirements in section 7 still hold (manifest valid, service worker registers, app still installable).
3. Update the version file(s). Do this last among the code changes, in the release commit, because the version change is the release trigger.
4. Update `docs/functional-spec.md` if it exists (create it for a new app on the first release). It describes what the app does now: features, screens, settings, env vars, data model, API, known limits, an **AI usage** section (section 14) and, if the app has an Android build, an **Android** section (section 15). Edit in place; it is a current-state spec, not a log.
5. Write the two release comments. Short: 50 characters or fewer, imperative mood, no trailing period (the git commit subject and the GitHub release title suffix). Long: 250 characters or fewer, plain prose, what and why (the commit body). Count the characters; never guess. If a message does not fit, shorten it, never split it.
6. Update `CHANGELOG.md` (complete history, newest first, one entry per released version, never rewrite old entries):

```
## v0.2.1 - 2026-10-16
**Short:** Fix login redirect loop
**Long:** Login redirected back to /login when the proxy forwarded http. The app now trusts X-Forwarded-Proto, so sessions persist behind Caddy and Cloudflare.
```

Every released version appears with its exact short and long text, identical to the commit.
7. Update the `deploy/` release files (section 8): `deploy/compose.yaml`, `deploy/.env.example`, `deploy/RELEASE.md`. Write the `Update:` field in `RELEASE.md` on every release, as decided in step 0. Fill in its AI and Android lines (sections 14 and 15).
8. Run the tests, then commit with the short as subject and the long as body and push `main` (section 9). That push is the release; do not create or push a tag. Note the release commit's short hash (`git rev-parse --short HEAD`).
9. Find the workflow run for the push (section 9 shows how) and watch it to the end. Report to James: version, short, long, the `Update:` value, the release commit, the Actions run link and its result (or that you could not see it), what was and was not verified, whether the release adds, changes or removes any AI usage (registry rows, section 14), for Android-enabled apps the APK file name, the versionCode and whether the android job finished (section 15), and then, ALWAYS, the filled-in Claude Code prompt from section 10 in a code block, ready to paste. Do not claim the image exists unless the run finished green; say so if you cannot see the run. A report without the Claude Code prompt is incomplete.

## 5. Git and GitHub rules

- Default branch `main`. A release is a push to `main` whose commit changes the version in `package.json` (or the `VERSION` file). The workflow then builds and pushes the images and runs `gh release create vX.Y.Z --target $GITHUB_SHA`, which creates the tag on that exact commit. One release = one commit (or a squash of the iteration) that contains the code, the version change, the CHANGELOG entry and the deploy files.
- No tag is pushed from an authoring session or by hand. Cloud authoring sessions cannot push tags (their git proxy answers HTTP 403), and with this flow they do not need to.
- This spec is James's standing instruction to commit and push `main` at the end of each iteration (after a build message) for the app repo you are working on; it applies to app repos only (never `homelab`, which Claude Code owns). Attach the repo with push access (add_repo access push). Do not push to any other repo. If GitHub access is denied, say so plainly, give James the exact commands, and stop.
- A push to `main` that does not change the version builds nothing (docs, pending-changes log and other work-in-progress commits are safe). Never change the version on `main` outside a release, and never push a half-finished release.
- Do not create the tag or the GitHub release by hand (release page, API, `git tag`) on a repo that uses this workflow: the workflow refuses a version that already has a tag or release. The only exception is the manual fallback in section 9.
- Do not force-push, delete tags, or rewrite released history. A bad release is fixed by a new patch release.
- A brand-new repo may be empty: clone it, create `main`, commit, then push; the first push that carries the workflow and a version releases v0.1.0. Commit trailers (Co-Authored-By, session link) follow the attribution reminder in the session.
- Never commit secrets: `.env`, tokens, keys, API responses with personal data, database files. Commit `.env.example` (names only, safe defaults). Add a `.gitignore` (node_modules, .env, *.db, *.db-wal, *.db-shm, data/).
- Existing repos that still use the old tag-only workflow switch to the workflow in section 6 in their next release commit. A workflow change on its own releases nothing, so the same commit must also carry a version bump (and its CHANGELOG entry) to run for the first time.

## 6. GitHub Actions workflow (`.github/workflows/release.yml` in every app repo)

This is the workflow finance-hub runs (first used for v0.1.3, run 39886778797, which built the image and created the release and tag). Use it exactly; only the version-file paths and, for two-image apps, the build step change.

```yaml
name: release

# A release is a push to main that changes the version in package.json (or a VERSION file).
# The job builds and pushes the images, then `gh release create --target $GITHUB_SHA` creates
# the GitHub release and the vX.Y.Z tag itself. No tag push is needed.
# The v*.*.* tag trigger is a manual fallback only (tag pushed by hand from a machine that may push tags).
# Two runs for the same version cannot both release: they share a concurrency group, and the
# second one stops at the "already released" check.
on:
  push:
    branches: [main]
    paths: [package.json, VERSION]
    tags: ["v*.*.*"]

permissions:
  contents: write

jobs:
  prepare:
    runs-on: ubuntu-latest
    outputs:
      release: ${{ steps.v.outputs.release }}
      version: ${{ steps.v.outputs.version }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Read the version
        id: v
        shell: bash
        run: |
          set -euo pipefail
          read_version() { # $1 = git ref or empty for the working tree
            if [ -n "$1" ]; then
              if git cat-file -e "$1:package.json" 2>/dev/null; then git show "$1:package.json" | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).version"; elif git cat-file -e "$1:VERSION" 2>/dev/null; then git show "$1:VERSION" | tr -d '[:space:]'; fi
            else
              if [ -f package.json ]; then node -p "require('./package.json').version"; elif [ -f VERSION ]; then tr -d '[:space:]' < VERSION; fi
            fi
          }
          VERSION="$(read_version '')"
          [ -n "$VERSION" ] || { echo "No version file (package.json or VERSION)"; exit 1; }
          echo "Version in this commit: $VERSION"
          if [ "$GITHUB_REF_TYPE" = "tag" ]; then
            # manual fallback: the tag decides, and the version file must agree with it
            [ "${GITHUB_REF_NAME#v}" = "$VERSION" ] || { echo "Version file ($VERSION) != tag ($GITHUB_REF_NAME)"; exit 1; }
            RELEASE=true
          else
            BEFORE="${{ github.event.before }}"
            OLD=""
            if [ -n "$BEFORE" ] && ! echo "$BEFORE" | grep -Eq '^0+$' && git cat-file -e "$BEFORE^{commit}" 2>/dev/null; then
              OLD="$(read_version "$BEFORE" || true)"
            fi
            if [ "$OLD" = "$VERSION" ]; then
              echo "Version unchanged ($VERSION): nothing to release."
              RELEASE=false
            else
              echo "Version changed: '${OLD:-none}' -> '$VERSION'"
              RELEASE=true
            fi
          fi
          echo "release=$RELEASE" >> "$GITHUB_OUTPUT"
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"

  image:
    needs: prepare
    if: needs.prepare.outputs.release == 'true'
    runs-on: ubuntu-latest
    # one release per version at a time; a second run for the same version waits, then stops at the check below
    concurrency:
      group: release-${{ needs.prepare.outputs.version }}
      cancel-in-progress: false
    env:
      VERSION: ${{ needs.prepare.outputs.version }}
      GH_TOKEN: ${{ github.token }}
    steps:
      - uses: actions/checkout@v4

      - name: Validate release metadata
        shell: bash
        run: |
          set -euo pipefail
          echo "Releasing v$VERSION"
          # not released yet: neither a tag nor a GitHub release may exist for this version
          if git ls-remote --exit-code --tags origin "refs/tags/v$VERSION" >/dev/null 2>&1; then
            if [ "$GITHUB_REF_TYPE" != "tag" ]; then echo "Tag v$VERSION already exists: bump the version"; exit 1; fi
          fi
          if gh release view "v$VERSION" >/dev/null 2>&1; then echo "GitHub release v$VERSION already exists: bump the version"; exit 1; fi
          # changelog must contain this version with Short <= 50 and Long <= 250 chars
          grep -q "^## v$VERSION " CHANGELOG.md || { echo "CHANGELOG.md has no entry for v$VERSION"; exit 1; }
          SHORT="$(awk -v v="## v$VERSION " 'index($0,v)==1{f=1;next} f&&/^\*\*Short:\*\*/{sub(/^\*\*Short:\*\* /,"");print;exit}' CHANGELOG.md)"
          LONG="$(awk -v v="## v$VERSION " 'index($0,v)==1{f=1;next} f&&/^\*\*Long:\*\*/{sub(/^\*\*Long:\*\* /,"");print;exit}' CHANGELOG.md)"
          [ "${#SHORT}" -gt 0 ] && [ "${#SHORT}" -le 50 ] || { echo "Short is ${#SHORT} chars (max 50)"; exit 1; }
          [ "${#LONG}" -gt 0 ] && [ "${#LONG}" -le 250 ] || { echo "Long is ${#LONG} chars (max 250)"; exit 1; }
          echo "SHORT=$SHORT" >> "$GITHUB_ENV"

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: mybadreligon/${{ github.event.repository.name }}
          tags: |
            type=semver,pattern={{version}},value=v${{ env.VERSION }}
            type=semver,pattern={{major}}.{{minor}},value=v${{ env.VERSION }}
            type=raw,value=latest
          labels: |
            org.opencontainers.image.version=${{ env.VERSION }}

      - uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: GitHub release
        shell: bash
        run: |
          set -euo pipefail
          NOTES="$(mktemp)"
          awk -v v="## v$VERSION " 'index($0,v)==1{f=1;next} f&&/^## v/{exit} f' CHANGELOG.md > "$NOTES"
          if [ "$GITHUB_REF_TYPE" = "tag" ]; then
            gh release create "v$VERSION" --verify-tag --title "v$VERSION - $SHORT" --notes-file "$NOTES"
          else
            # creates the tag v$VERSION on this exact commit as part of the release
            gh release create "v$VERSION" --target "$GITHUB_SHA" --title "v$VERSION - $SHORT" --notes-file "$NOTES"
          fi
```

How it behaves: a push to `main` that does not change the version finishes green and builds nothing. A version change builds and pushes `mybadreligon/<app>` tags `X.Y.Z`, `X.Y` and `latest`, then creates the release and the tag. It fails (red) if the tag or release for that version already exists or the CHANGELOG entry is missing or invalid. A tag created by the workflow's own token does not start the tag trigger, and if a tag is pushed by hand while a main-triggered run is in progress, the two share the per-version concurrency group and the second stops at the "already released" check.

Notes: the image repo name is the GitHub repo name, so keep it identical to the Docker Hub repo `mybadreligon/<app>`. For apps with two images (Fantasy Manager: `fantasy-manager-server` and `fantasy-manager-client`), extend the build step to build both from their own contexts, both tagged with the same version. Pin Action versions as shown (major tags); never `@main`. No extra build args; the metadata step labels the version. The `type=semver,...,value=v${{ env.VERSION }}` form is needed because a branch push has no tag ref for the semver patterns to read. If the image step fails before the release step, no tag exists: fix the cause and push the next patch version (or, for a transient failure, re-run the failed run from the Actions tab). Apps with an Android build add the `android` job from section 15 to this same file.

## 7. Packaging standards

Dockerfile:
- Multi-stage build; minimal final stage (`node:20-alpine`, `python:3.12-slim`, distroless). Pin base image major.minor (for example `node:20.19-alpine`). Add `.dockerignore` (node_modules, .git, tests, docs, `.env`, database files).
- Do not start the Dockerfile with a `# syntax=` line: it makes the builder fetch an extra image from Docker Hub and fails where Docker Hub is blocked.
- Native npm modules on Alpine (for example `better-sqlite3`, argon2): install `python3 make g++` in the build stage only, confirm the lockfile carries the musl optional packages; prefer packages with prebuilt musl binaries.
- No `build:` dependency on the server: the server only pulls the image.
- Run as non-root (UID 1000 / GID 100, or honor `PUID`/`PGID`). With a fixed `USER 1000:100`, create and `chown` the data folders in the image and say in `RELEASE.md` which owner the host folders need.
- `EXPOSE` one HTTP port. The app listens on the port in the `PORT` environment variable (never a hard-coded number, with a neutral dev default that is overridden on the server). The host port is assigned by Claude Code from the port register, and the compose file sets `PORT` to that same number so container port = host port. Leave `TBD` in your notes; do not invent a host port.
- Health endpoint and check. `GET /healthz` on `$PORT` needs no login and returns HTTP 200 with exactly `{"status":"ok","version":"<same as the image tag>"}` (version read from the version file, the same value as the image tag, nothing else in the body). It exposes no private data (no counts, names, paths or config), sets no cookie, and checks only what is local to the container (a trivial read of its own database); it never calls an outside service, so an upstream outage cannot make the container unhealthy. If the local check fails it answers 503 with `"status":"error"`. A test locks the exact body and that it equals the version file.
- The image `HEALTHCHECK` is in shell form, reads `${PORT}` (not a hard-coded port), uses `127.0.0.1` rather than `localhost` (BusyBox `wget` on Alpine may try IPv6 first and fail against a server bound to IPv4), requires the body to contain `"status":"ok"`, and has a 30 s start period: `HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD wget -qO- http://127.0.0.1:${PORT}/healthz | grep -q '"status":"ok"' || exit 1`. The compose file carries the matching check (section 8).
- Handle SIGTERM: stop accepting requests, finish in-flight work, close the database cleanly, exit within 10 seconds. Past apps were force-killed (exit 137) because they ignored it. Use `tini` (install it and set it as ENTRYPOINT) or `init: true` if signals are not forwarded; do not rely on the compose file alone for something the image needs. Test it: send SIGTERM to the running app and confirm a clean log line and a fast exit.
- Reproducible installs (`npm ci`, locked requirements), no dev dependencies in the final image, no secrets or secret build args, OCI labels (source in the Dockerfile; version from the workflow). Aim under 300 MB; say if larger.

Ports (required):
- Match container and host ports. The compose file publishes `"<P>:<P>"` and sets `PORT=<P>`, so the number in the browser, the Caddyfile, the logs, the register and the container are all the same. Make the listen port configurable through `PORT` for this reason.
- Exceptions are allowed only when the port cannot be changed (third-party images with a fixed port, an app that cannot yet read `PORT`, or protocols that must use a standard port such as DNS 53). Then map host to the assigned number and write the exception in `RELEASE.md` ("container 3000 -> host 8048, image fixed").
- Ranges (James's standard): 8040-8099 for web apps and admin UIs (8040-8052 and 8060 are already assigned to existing apps; new apps are assigned from 8070-8099); 9000-9099 as overflow. Never use 22 (SSH), 53 (DNS), 80 (OMV web admin), 443, 8006 (Proxmox), or anything already in the register. Fixed and not moved: 53 (AdGuard DNS), 80 (OMV), 8123 (Home Assistant, host network), Tailscale.
- Existing assignments (2026-10-17 plan, subject to the port standardization being completed): maintenhance 8040, maintenhance_twl 8041, fantasy-manager-client 8042, iptv-multiview 8043, mealkit-manager 8044, classifieds-tracker 8045, mealie 8046, Dockhand 8047, AdGuard web 8048, free-games-claimer 8049 and 8052, heimdall 8050, homepage 8051, immich (reserved) 8060, finance-hub 8070. The port register in `docs/home-server-reference.md` (repo `homelab`) is authoritative; apps not yet moved may still run on their old ports (5000, 1234, 3600, 3501, 9925, 3000, 3030, 6080, 7080).
- Only one process per container listens on the published port; do not publish database, cache or internal ports. Internal-only services stay on the Docker network with no `ports:` entry.
- A new app asks Claude Code for a port (via the handoff prompt); Claude Code records it in the register and the Caddyfile. If the app chat needs a number to test locally, use any local port and say it is a placeholder.

Runtime behavior:
- Configuration only through environment variables (document each in `.env.example` with a comment and safe default). Required secrets fail fast with a clear message when missing (and a test proves it).
- Logs to stdout/stderr, one line per event, levels, no secrets or personal data; default level `info`.
- The VM is shared: keep idle RAM under about 256 MB unless justified; no busy loops; sensible job intervals. State expected RAM and CPU in `RELEASE.md`. If the app can burst (transcoding, scraping), add concurrency env vars and recommend compose limits (`cpus`, `mem_limit`) as was done for IPTV Multiview.
- Behind the proxy: trust `X-Forwarded-Proto/Host/For` (only from the Docker network), set cookies `Secure` when `COOKIE_SECURE=true`, use relative URLs or `APP_URL`, never redirect to `http://`. The app speaks plain HTTP; no TLS. Cloudflare's free plan caps request bodies at 100 MB. Service workers must not cache API responses or auth pages (a stale MaintEnhance service worker caused confusing 502s).
- Outbound calls: timeouts and retries with backoff; one failing upstream must not crash the app; log once per refresh, not once per item.
- Store time in UTC; display and schedule in `TZ`.

PWA and device support (required for every app with a user interface):

Every app is a Progressive Web App that can be installed on phone and desktop, and has a layout designed for each. "Mobile and desktop version" means one codebase and one image, with a mobile layout and a desktop layout that are each designed, not a squeezed or stretched copy. A separate mobile app or desktop build is not wanted unless James asks. Headless services with no UI are exempt, but must say so in `docs/functional-spec.md`.

Installability (all required):
- `manifest.webmanifest` (served as `application/manifest+json`) with `name`, `short_name`, `id`, `start_url` (relative, e.g. `/`), `scope`, `display: "standalone"`, `background_color`, `theme_color`, `description`, and `icons` at 192x192 and 512x512 (PNG) plus a 512x512 `maskable` icon. Also an `apple-touch-icon` (180x180), and the `theme-color` meta, `viewport` meta (`width=device-width, initial-scale=1`) and `<link rel="manifest">` tags in the HTML head.
- `screenshots` in the manifest with at least one `form_factor: "wide"` (about 1280 x 720) and one `form_factor: "narrow"` (about 540 x 960) image, so Chrome/Android show the richer install prompt. Keep the images in the repo (`public/screenshots/`). Capture them from the running app with demo data (Playwright/Chromium is usually pre-installed in the authoring environment); never use real personal data in committed screenshots.
- A service worker registered from the site root with a scope that covers the app, and an offline fallback page. Precache the app shell only. Never cache API responses, authentication pages or anything user-specific; use network-first for navigations. Version the cache name with the app version (`app-v0.2.1`), delete old caches on `activate`, and show an unobtrusive "Update available, reload" prompt when a new worker is waiting (never silently skip waiting in the middle of a form). Reload the page on `controllerchange` only when the page already had a controller; reloading on the very first install wipes whatever the user has just typed.
- An in-app install affordance: handle `beforeinstallprompt` (Chrome/Edge/Android) with an "Install app" button in settings or the menu, and show short manual instructions for iOS Safari ("Share, then Add to Home Screen").
- HTTPS is required for installation. On this server HTTPS comes from Cloudflare, so the app must be reached through its `https://<name>.hoffmanhouse.ca` hostname; a LAN address like `http://192.168.4.11:<port>` is not installable. Every app with a UI therefore needs a public hostname (Caddy route and tunnel hostname) or an agreed private alternative, and `RELEASE.md` must say which. To keep an app private, protect the hostname with Cloudflare Access instead of skipping the hostname. Cloudflare Access must let `/manifest.webmanifest`, `/sw.js` and `/icons/*` through (a Bypass policy on those paths), otherwise the browser cannot fetch them and the app will not install; list this as a deploy check.
- Behind Caddy and Cloudflare the manifest, icons and service worker must be served at stable URLs without redirects, with correct MIME types, and `Service-Worker-Allowed` set if the worker is not at the root. Use `Cache-Control: no-cache` for `sw.js` and the manifest; fingerprinted assets may be cached long.

Mobile and desktop layouts (all required):
- Responsive design with explicit breakpoints (mobile under 768 px, desktop from 1024 px) and a layout designed for each. Mobile: single column with bottom navigation or compact header, thumb-reachable primary actions, touch targets at least 44 x 44 px, safe-area insets (`env(safe-area-inset-*)`), no hover-only controls, correct input types and keyboards. Desktop: uses the width (sidebar navigation, multi-column and table views, side-by-side detail panes), keyboard navigation with visible focus, shortcuts for frequent actions, and no narrow phone column floating in a wide screen.
- Standalone mode behaves: back navigation works without browser UI, external links open correctly, overscroll or pull-to-refresh does not break the app.
- Light and dark mode via `prefers-color-scheme` (with a matching `theme-color`), readable contrast, text that respects user font size, no horizontal scrolling at 320 px width. CSS grid children need `min-width: 0` (and `minmax(0, 1fr)` columns) or wide content pushes the page sideways on phones; tables scroll inside their own wrapper.
- Performance: usable on a mid-range phone over Starlink: small initial JS, lazy-loaded heavy screens, compressed and sized images, no layout shift.
- With a strict Content-Security-Policy (no inline script or style), build the UI without inline `style` attributes or `innerHTML` markup; set dynamic widths through the DOM style API and build nodes with a small helper so text is never parsed as HTML.
- Check at minimum 390 x 844 (phone), 768 x 1024 (tablet) and 1440 x 900 (desktop), plus 320 px for horizontal overflow, and record the check in the release report. Drive the real app with Playwright/Chromium against demo data and look at the screenshots. Run the Lighthouse PWA/installability audit when available; if it was not run, say so. Playwright's offline switch does not affect a service worker's own requests, so test offline by stopping the server after the worker is active, then loading a page and confirming the offline page appears.
- `docs/functional-spec.md` has "Mobile layout", "Desktop layout" and "PWA" sections (screens, navigation, differences in features; feature parity expected unless stated; manifest values, offline and update behavior, install notes).

Data and migrations:
- Persistent state only under mounted paths: `/data` for databases and config (fast storage, SSD) and `/files` (or `/media`) for large files (slow storage, the SnapRAID pool). Nothing important in the container filesystem or anonymous volumes.
- SQLite: WAL is fine; copies need `.db`, `-wal` and `-shm` together, so document it; keep the database on `/data`. Use a `schema_version` table and forward-only, idempotent migrations run at start-up inside a transaction. `CREATE TABLE IF NOT EXISTS` alone does not alter existing tables.
- Before a migration that changes or drops data, write a timestamped database copy (`/data/backups/pre-migrate-<from>-to-<to>.db`) and log it; the release note states that a migration exists and whether it is reversible.
- Never delete user data on upgrade. A downgrade to the previous image should still start (additive migrations), or the release note says "not reversible; restore the pre-update data copy".
- Provide a built-in export/backup (JSON/CSV or database download) when the data matters.
- Money is stored as integer cents and quantities as decimal strings, never floats.

Security:
- No baked-in default admin password; first-run setup or `ADMIN_*` env vars. Hashed passwords (argon2/bcrypt), signed sessions, login rate limiting, CSRF protection for cookie auth, input validation, parameterized queries, no secrets in client bundles.
- Keep dependencies current; patch releases for security fixes.
- No privileged mode, Docker socket or host network unless truly needed (say why).
- Baseline for apps holding personal or financial data and reachable from outside the house (finance-hub is the reference implementation): mandatory TOTP two-step sign-in (seed stored encrypted with a required `APP_SECRET_KEY`, codes not reusable); sessions stored hashed server-side with an idle timeout; CSRF header plus same-origin `Origin` check on writes; rate limits on sign-in and password re-checks; password re-entry ("step-up") before export, password change and other sensitive actions; strict CSP, frame denial, no-referrer; forwarded headers trusted only from private networks; optional verification of the Cloudflare Access JWT (`CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`) on API routes while leaving `/healthz`, the manifest, icons and service worker public; an audit log of sign-ins, failures and exports.

Tests:
- Ship automated tests that run with one command (`npm test`; if using `node --test`, give an explicit glob such as `test/*.test.js`). Cover auth and permissions, the main data paths, migrations, fail-fast on missing config, `/healthz` (exact body, version equals the version file, no login, no cookie), the PWA files (manifest fields and referenced files exist, service worker version equals the version file, service worker skips API traffic, CHANGELOG entry lengths), that the image and compose health checks follow `PORT`, require the `status` body and use a 30 s start period, and that the release workflow keeps its triggers (push to `main` with version-file paths, tag fallback, `contents: write`, concurrency group, `--target $GITHUB_SHA`).
- Tests that sign in repeatedly with one-time codes must account for replay protection (use the next time window or reuse the session). Close server connections at the end of a test (for example `closeAllConnections()`) or the test process will not exit.

## 8. Files every release leaves in the repo

```
Dockerfile
.dockerignore
.gitignore
.github/workflows/release.yml
CHANGELOG.md
VERSION or package.json version
README.md                 short: what it is, how to run locally, how a release works (commit + push main)
docs/functional-spec.md   current-state functional spec (create if missing); includes the AI usage section and, for Android apps, the Android section
docs/pending-changes.md   pending changes log (section 1a; create on the first request)
deploy/compose.yaml       reference compose for the server
deploy/.env.example       every env var, names only
deploy/RELEASE.md         what Claude Code needs for THIS version
public/manifest.webmanifest, service worker, icons (192, 512, maskable, apple-touch 180)
public/screenshots/       at least one wide and one narrow image
twa-manifest.json         only if the app has an Android build (section 15)
```

(PWA file paths follow the app's framework; the files must exist and be served as described in section 7.) The README and the functional spec say that a release means committing and pushing `main` with a changed version, and that the workflow creates the tag and the GitHub release.

`deploy/compose.yaml` follows the server template: image pinned to the exact version tag (never `latest`), `restart: unless-stopped`, `container_name` = app name, `TZ=America/Toronto` (+ `PUID`/`PGID` if supported, or `user: "1000:100"` for an image with a fixed user), ports as `"<P>:<P>"` with `PORT=<P>` (container port = host port; `<P>` assigned by Claude Code, a placeholder until then), variablized volume paths, healthcheck, log limits, no `build:`:

```yaml
services:
  myapp:
    image: mybadreligon/myapp:0.1.0
    container_name: myapp
    restart: unless-stopped
    environment:
      - TZ=America/Toronto
      - PUID=1000
      - PGID=100
      - APP_URL=${APP_URL:-}
      - COOKIE_SECURE=${COOKIE_SECURE:-true}
      - PORT=${PORT_HOST:?assign from port register}
    ports:
      - "${PORT_HOST}:${PORT_HOST}"          # container port = host port
    volumes:
      - ${FAST_STORAGE:-/srv/dev-disk-by-uuid-758425e9-f9ca-4fbc-ad81-eaea80fdfb73/appdata-ssd}/myapp:/data
      - type: bind
        source: ${SLOW_STORAGE:-/srv/mergerfs/StoragePool/docker}/myapp
        target: /files
        bind:
          create_host_path: false      # pool paths must exist; fail loudly if the pool is not mounted
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:$${PORT}/healthz | grep -q '\"status\":\"ok\"' || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    stop_grace_period: 15s
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "3"
```

Storage rule: `FAST_STORAGE` (databases/config) and `SLOW_STORAGE` (bulk) with the defaults above; one folder per app named after the app; no other hard-coded host paths; pin the tag to the exact release; use `create_host_path: false` for pool paths. The healthcheck command must exist in the image (alpine has `wget` and `grep`; slim images may need `curl` or a built-in command). Required secrets use the `${NAME:?message}` form so the stack refuses to start without them.

`deploy/RELEASE.md` (rewrite each release, keep short). The `Update:` line is a fixed field: it is present in every RELEASE.md, always on the line right after the heading, and holds exactly `Update: now` or `Update: later`. Write `Update: now` only when James's build message for this release was "build, push and update"; otherwise write `Update: later` (section 1a). Never leave it out, blank or ambiguous, and never copy the previous release's value.

```
# Release v0.2.1
Update: later                      (now | later; now only when James said "build, push and update" for this release)
Image: mybadreligon/<app>:0.2.1   (built by the release workflow on the push of this version to main; the workflow also creates the v0.2.1 tag and the GitHub release)
Short: ...        Long: ...
Release commit: <short hash> on main        Actions run: <link, and result>
Type: patch | minor | major
Port: <P> (host = container; from the register, or TBD for a new app)   Exception: none | container X -> host P, image fixed
Public hostname: <sub>.hoffmanhouse.ca | none        Needs Caddy route: yes/no
New or changed env vars: <names only; secrets named, never valued>
Data: paths used (/data, /files), folders to create + owner, migration: none | yes (reversible? y/n)
Resources: expected RAM / CPU, any recommended compose limits
Healthcheck: GET /healthz on $PORT -> 200 {"status":"ok","version":"0.2.1"} (version = image tag; no login, no private data, no outside services); image HEALTHCHECK and compose both read PORT, require "status":"ok" in the body, 30 s start period
Verify after deploy: <3 concrete checks, including one page that reads real data>
PWA: installable on phone and desktop at https://<sub>.hoffmanhouse.ca (manifest ok, service worker registered, offline page works); layouts checked at 390x844, 768x1024, 1440x900; Lighthouse PWA result or "not run"; Cloudflare Access bypass for manifest, sw.js and icons: needed/done
AI: none | <feature: provider/model, trigger, data sent, needed quality, local candidate y/n> ; registry rows added/changed/removed: <IDs or none>
Android: none | package <ca.hoffmanhouse.app>, versionCode <n>, asset <repo>-0.2.1.apk on the GitHub release; apps.txt entry needed on the fdroid server: yes (first release) | already listed; assetlinks.json served: yes/no; android job result: <passed | not seen>
Docker build: run locally (result) | not run locally (reason); first build is the release workflow
Rollback: previous image tag 0.2.0; data restore needed? y/n
Known issues: ...
Backup tier: small/critical (include in Tier 1) | bulk (SnapRAID only); SQLite needs stop during copy
```

The release commit hash is known when RELEASE.md is written only after the commit; write the hash and run link into the report, and into RELEASE.md in a follow-up docs-only commit if James wants them recorded (that commit must not change the version).

## 9. Pushing procedure (exact)

```
git status && git diff --stat
```
```
npm test   # or the app's one-command test run; all green before the release commit
```
```
git add -A   # only after confirming .env, node_modules, *.db are not staged
```
```
git commit -m "<short, 50 chars max>" -m "<long, 250 chars max>"
```
```
git push origin main
```

Check lengths first (`printf %s "$SHORT" | wc -c`). The workflow rejects a release whose CHANGELOG entry violates the limits, and a rejected release means a new version. There is no tag command: the workflow creates the tag.

Finding the run (cloud sessions): GitHub GraphQL is blocked, so `gh release view` fails; the REST-backed commands work. Wait a few seconds after the push, then `gh run list -R jameshoffman7667/<repo> -L 3`, then `gh run view <id> -R jameshoffman7667/<repo> --json status,conclusion,url,jobs`, poll until `completed`. The run URL has the form `https://github.com/jameshoffman7667/<repo>/actions/runs/<id>`. Confirm the tag with `git ls-remote --tags origin` (vX.Y.Z should point at the release commit) or `gh api repos/jameshoffman7667/<repo>/releases/tags/vX.Y.Z`. If the run is red, read the failing step, say what it is, and fix it with a new patch release (or a re-run for a transient failure when no tag exists yet). Never claim the image exists unless the build-and-push step succeeded.

What the run does: validates version, tag, release and CHANGELOG, builds linux/amd64, pushes `mybadreligon/<app>` tags `X.Y.Z`, `X.Y` and `latest`, and creates the GitHub release and the tag. For a first build, the likeliest trouble is native npm modules on Alpine.

Manual fallback (only for a repo that still has the old tag-only workflow, or if Actions did not run): from a machine where tags may be pushed (claude-ops or any clone), `git fetch origin && git tag -a vX.Y.Z <release commit> -m "<short>" -m "<long>"` then `git push origin vX.Y.Z`; the workflow's tag trigger then releases it. Cloud authoring sessions cannot push tags (HTTP 403, a limit of the session and not a repo setting), so in a session do not try; hand James variant B of the prompt in section 10 instead. Do not create the tag or release through the GitHub release page or API.

For a new app, after Claude Code's plan is approved: put required secrets in the stack `.env` (for example `openssl rand -hex 32`), keep a backup copy of any key that encrypts stored data, create the data folders with the owner named in `RELEASE.md`, add the Cloudflare Tunnel hostname, create a Cloudflare Access application for it (with the bypass policy for the manifest, service worker and icons), then run the verification checks in `RELEASE.md` and install the app on phone and desktop. Check the container is healthy and read its log first if it restarts in a loop (usual causes: a missing secret, or folders the container user cannot write).

## 10. Handoff to Claude Code (James pastes this; you fill the blanks)

Where: the Android Claude app Code tab (session `homelab`) or claude-ops, user `james`, inside `claude`.

Every release report ends with ONE of these two prompts, fully filled in (no angle brackets left), in a code block James can copy. Use A for every repo on the push-to-main workflow (the standard case: the tag and release are created by the workflow). Use B only for a repo still on the old tag-only workflow. Both prompts make Claude Code read the `Update:` field in `deploy/RELEASE.md`: with `Update: later` it stops once the image is confirmed and does not touch the server; with `Update: now` (or when James says this is a manual update that runs now) it goes on to plan and perform the deploy.

Variant A (push-to-main workflow; the tag and release come from the workflow):

```
Deploy <app> v<X.Y.Z> from jameshoffman7667/<repo>. Read CLAUDE.md, docs/home-server-reference.md and docs/handoff-app-development.md in the homelab repo, and the app repo's deploy/RELEASE.md and deploy/compose.yaml. The release is the push of commit <short hash> ("<short>") to main; the release workflow creates the tag v<X.Y.Z> and the GitHub release itself, so do not create, move or delete any tag and do not use the release page or API. Wait for the release workflow run for that commit (<Actions run link>) to finish green, confirm the tag v<X.Y.Z> exists and points at <short hash>, and confirm the image mybadreligon/<app>:<X.Y.Z> exists; if the run failed, stop and show me the failing step. Then check the Update field in deploy/RELEASE.md: if it says Update: later, stop here, tell me the image is ready, and do not plan or change anything on the server. If it says Update: now, continue. New app: assign the host port from the port register (finance-hub is 8070), create stacks/<app>/, create data folders with the right owner, add the Caddy route and tell me the Cloudflare tunnel hostname to add, update the reference doc and homelab repo. Update of an existing app: follow the update procedure (Tier 1 snapshot age, data copy, pinned rollback digests), change only the pinned tag to <X.Y.Z> (and PORT_HOST if RELEASE.md says the port changed), use the healthcheck from deploy/compose.yaml, one stack at a time, not between 02:55 and 05:30 Toronto time. Afterwards run the verification checks in RELEASE.md and report the container health. Also compare the AI line in RELEASE.md with docs/ai-inventory.md in the homelab repo and update the registry rows (propose the diff). If the Android line is not "none": make sure jameshoffman7667/<repo> is listed in the fdroid stack's apps.txt, confirm the APK asset <repo>-<X.Y.Z>.apk is on the GitHub release, and after the next sync (up to 15 minutes) confirm the app appears in https://apps.hoffmanhouse.ca/repo/index-v1.json. Show the plan and wait for my approval before changing anything on the server.
```

Variant B (old tag-only workflow; Claude Code pushes the tag first):

```
Release <app> v<X.Y.Z> from jameshoffman7667/<repo>, and update the server only if the release says so. Step 1, tag: in a clone of the repo, fetch origin, confirm origin/main contains release commit <short hash> ("<short>") and that tag v<X.Y.Z> does not exist yet, then run: git tag -a v<X.Y.Z> <short hash> -m "<short>" -m "<long>" and git push origin v<X.Y.Z>. Do not move or delete tags, and do not create the release through the GitHub release page or API. Step 2: watch the release workflow run for v<X.Y.Z> until it finishes; if it fails, stop and show me the failing step (the fix will be a new patch release). Step 3: confirm the image mybadreligon/<app>:<X.Y.Z> exists, then check the Update field in the app repo's deploy/RELEASE.md: if it says Update: later, stop here, tell me the image is ready, and do not plan or change anything on the server. If it says Update: now, continue with step 4. Step 4, deploy: read CLAUDE.md, docs/home-server-reference.md and docs/handoff-app-development.md in the homelab repo, and the app repo's deploy/RELEASE.md and deploy/compose.yaml. New app: assign the host port from the port register (finance-hub is 8070), create stacks/<app>/, create data folders with the right owner, add the Caddy route and tell me the Cloudflare tunnel hostname to add, update the reference doc and homelab repo. Update of an existing app: follow the update procedure (Tier 1 snapshot age, data copy, pinned rollback digests), change only the pinned tag to <X.Y.Z> (and PORT_HOST if RELEASE.md says the port changed), one stack at a time, not between 02:55 and 05:30 Toronto time. Afterwards run the verification checks in RELEASE.md and report the container health. Also compare the AI line in RELEASE.md with docs/ai-inventory.md in the homelab repo and update the registry rows (propose the diff). If the Android line is not "none": make sure jameshoffman7667/<repo> is listed in the fdroid stack's apps.txt, confirm the APK asset <repo>-<X.Y.Z>.apk is on the GitHub release, and after the next sync (up to 15 minutes) confirm the app appears in https://apps.hoffmanhouse.ca/repo/index-v1.json. Show me the plan, including the tag push, and wait for my approval before pushing the tag or changing anything on the server.
```

Claude Code then follows the server's own deploy contract and update procedures. The update script only handles the stacks listed in CLAUDE.md ("Updating one of my own stacks"); any other app uses the manual flow until it is added.

## 11. When you start a chat on an app

1. Read `docs/pending-changes.md` (or ask James to attach it) and show the Pending list. Ask (or find in the repo) the app name, repo, current version, whether `docs/functional-spec.md`, `CHANGELOG.md`, `deploy/` and the workflow exist, and which workflow it has (push-to-main, section 6, or the old tag-only one). List what is missing.
2. If the app predates this spec, your first iteration also adds the missing release files and the workflow. State the baseline version (existing version, or v0.1.0). Also audit the app against this spec's current requirements and list what is missing (checklist below); fix it in this or the next release (after a build message). MaintEnhance is already a PWA; check the others. Apps without a public hostname need one to be installable. Also audit the app for AI usage (section 14) and declare it, even if the answer is "none". Also record its Android status (section 15): enabled, pending, or not wanted.
3. Confirm anything that blocks a clean deploy: port, subdomain, data paths, secrets (names only), expected load.
4. Work the section 4 checklist for each build. One release per build message; do not batch unrelated changes under one release.

Audit checklist for existing apps (use at the start of each app's next iteration):
- Workflow: the push-to-main release workflow from section 6 (not the old tag-only one), with `contents: write`, the concurrency group and the CHANGELOG check.
- Dockerfile: no `# syntax=` line, `tini` or `init`, health check on `127.0.0.1` using `${PORT}`, requiring `"status":"ok"`, 30 s start period, non-root, data folders owned correctly, listen port read from `PORT`.
- `/healthz` returns exactly `{"status":"ok","version":"<image tag>"}` with no login, no private data and no outside calls.
- SIGTERM stops the app cleanly within 10 seconds (Fantasy Manager currently exits 137).
- Missing required config fails fast with a clear message.
- A one-command test run exists and covers the points above.
- PWA: manifest, icons, wide and narrow screenshots, service worker that never caches API or sign-in pages, no reload on first install, offline page, update prompt, install button.
- Layouts: phone, tablet, desktop and 320 px checked; no sideways scrolling.
- Security baseline if the app holds personal data and will be reachable from outside.
- `deploy/RELEASE.md` has the `Update:` field, the Docker build line, the release commit and run lines and the Access bypass note, plus the AI and Android lines.
- AI usage declared in the functional spec (even "none"), provider-agnostic wrapper if any (section 14).
- Android status recorded (section 15): enabled, pending or not wanted.

Current apps (2026-10-22): MaintEnhance (`maintenhance`, image `mybadreligon/maintenhance`, two instances, port 8040 and 8041, Node/Express/SQLite PWA, update by manual flow; Android pilot app, section 15); Fantasy Manager (`fantasy-support-app`, images `fantasy-manager-server` and `fantasy-manager-client`, SQLite WAL, port 5000; known issues: exit 137 on stop, nflverse snap-count 404 logged every refresh, VAPID keys unset); IPTV Multiview (`multiview-iptv:0.4.0`, CPU-heavy, has CPU limits, keep Shared screen OFF until fixed); mealkit-manager (port 3600 to 3800); classifieds-tracker (port 3501, named volume); pricewatch and marketplace-browser (repos exist, not deployed); finance-hub (`finance-hub`, `mybadreligon/finance-hub`, Node 20/Express/SQLite PWA, port 8070 = host = container (the app reads `PORT`, default 8070), `finance-hub.hoffmanhouse.ca` behind Cloudflare Access; first app on the push-to-main workflow and the reference implementation of the security baseline and the health check; v0.1.0 is the deployed version; v0.1.3 was released by the workflow (tag and release created by run 39886778797) and is the first image with the 8070 default and the new health check, v0.1.1 and v0.1.2 were never built; v0.1.3 is waiting for a manual update; its RELEASE.md predates the `Update:` field; no `docs/pending-changes.md` yet). `fdroid` (repo `fdroid`, images `mybadreligon/fdroid` plus stock `nginx:1.27-alpine`, port 8096 published to container 80 as a documented exception, headless so no PWA; v0.1.1 deployed; serves the F-Droid repo at `apps.hoffmanhouse.ca/repo`). Server stacks live in James's private repo `homelab`; apps never push there.

## 13. Do not

- Do not build, write app code, bump versions, commit releases or push to `main` with a changed version until James sends a specific build message (section 1a); log the request and stop.
- Do not change the version in `package.json` or `VERSION` on `main` outside a release, and do not push a half-finished release: the version change is what releases.
- Do not push a tag, and do not create the tag or the GitHub release by hand (`git tag`, release page, API) on a repo that uses the push-to-main workflow; the workflow does it.
- Do not write `Update: now` unless James said "build, push and update" for this release; do not leave the `Update:` field out or carry it over from an earlier release.
- Do not end a release report without the filled-in Claude Code prompt (section 10); do not leave placeholders in it.
- Do not deploy, SSH, or ask for server credentials, tokens, `.env` values or passwords.
- Do not use `latest` in `deploy/compose.yaml`, add `build:` sections, or publish an image outside the release workflow.
- Do not invent host ports, subdomains or storage paths; use variables and `TBD` placeholders.
- Do not hard-code the listen port or map different container and host ports unless the image forces it (document the exception).
- Do not change a released version's changelog entry or move or delete a tag.
- Do not exceed 50 / 250 characters for short / long; do not skip the functional spec update.
- Do not make `/healthz` require a login, return anything but `status` and `version`, expose private data, or call an outside service.
- Do not add services that publish database ports or mount the Docker socket.
- Do not ship a UI that is not an installable PWA or that has only one layout (mobile-only or desktop-only); do not cache API responses or authenticated pages in the service worker; do not reload the page when a service worker first installs.
- Do not use `localhost` in a container health check, and do not claim a Docker build, Lighthouse run or CI result you did not see.
- Do not hard-code an AI provider, model name or API key, call a provider SDK directly from feature code, ship an AI call that is not declared in the functional spec and RELEASE.md, or make the app unusable when AI is off or failing (section 14).
- Do not commit an Android keystore or its passwords, create or ask for a signing key, generate a new key for an app that already has released APKs, reuse or lower a `versionCode`, or build an APK before section 15 is out of draft and James has asked for it (log it as a pending item instead).
- Do not retry a policy-denied push or download in a loop; report it with the Claude Code prompt and the exact commands James can run instead.

## 14. AI usage (required for every app; "none" is a valid declaration)

Goal: James can list every place AI is used on the server, see what data leaves it, and move calls to a local model (small quantized models through an OpenAI-compatible server such as Ollama or llama.cpp) by changing configuration, not code. The inventory is `docs/ai-inventory.md` in the `homelab` repo (create it from the template in the Project doc `claude/ai-inventory.md` if it does not exist yet). Claude Code owns the registry; the app chat supplies the facts.

**Declare it.** `docs/functional-spec.md` has an "AI usage" section, and `deploy/RELEASE.md` has an AI line, every release. For each AI-backed feature give: feature name, purpose, provider and model (current default), trigger and frequency (user action, schedule, per item), data sent (categories: receipts, household items, listings, logs, etc.; flag personal or financial data), needed quality tier (Low: classify, extract, tag, short summary; Medium: drafting, structured extraction from messy text; High: agentic, long context, code), whether it is a local-model candidate (yes, maybe, no, with one line why), and the fallback behavior when AI is unavailable. If the app has no AI, write "AI usage: none". A release that adds, changes or removes an AI call says so in the release report (section 4, step 9) and lists the registry rows to add, change or retire.

**Build it provider-agnostic.**
- One module/client wrapper is the only code that talks to a model. Features call the wrapper with a task name; they never import a provider SDK.
- Configuration by environment variables only: `AI_ENABLED` (default `false` unless the app is useless without it), `AI_BASE_URL` (OpenAI-compatible endpoint; default the provider's URL), `AI_API_KEY` (secret, from the server `.env`, never in the repo), `AI_MODEL`, optional per-task overrides `AI_MODEL_<TASK>`, `AI_TIMEOUT_MS`, `AI_MAX_CONCURRENCY`. Use the OpenAI-compatible chat/completions interface where the provider supports it, so a local server is a drop-in; if a provider-specific API is truly required, isolate it in the wrapper and say so in RELEASE.md.
- Use structured output (JSON schema or strict JSON with validation) for extraction and classification, validate the result, and reject or retry on malformed output. Small local models need short prompts and explicit formats, so keep prompts in versioned files or constants, one per task, not scattered in code.
- Keep each task's prompt and expected output testable: include a small fixture set (inputs with expected outputs, no real personal data) so James can compare a local model against the current one before switching.
- Timeouts, retries with backoff, and a concurrency cap (the VM is shared). One failing call must not crash the app or block the UI; log once per failure, not once per item.
- Core features work with `AI_ENABLED=false` or the provider down; AI features show a clear "unavailable" state.
- Minimize what is sent: only the fields the task needs, no credentials, no data of other users, and nothing from private areas unless the feature is about them.

**Log it.** One log line per call: `ai_call task=<name> model=<model> ok=<bool> ms=<n> tokens_in=<n> tokens_out=<n>`. Never log prompts, responses or personal data. `/healthz` itself never calls a model (section 7).

**Review.** Claude Code compares RELEASE.md with the registry at deploy time and checks AdGuard monthly for AI-provider traffic from clients with no registry row. Quarterly, James decides which Low and Medium rows to move to a local model.

## 15. Android app and F-Droid publishing (opt-in per app; DRAFT until the MaintEnhance pilot passes)

**Status (2026-11-10).** The server side is live: the `fdroid` app (repo `jameshoffman7667/fdroid`, v0.1.1) serves James's own F-Droid repo at `https://apps.hoffmanhouse.ca/repo`. The `android` job below has NOT been run anywhere. Until James says the pilot passed, an app chat does not build an APK: it logs a pending item (section 1a) saying what to do and for which app, and carries on with normal releases. The MaintEnhance chat is the pilot. Once the draft status is lifted, an app chat adds Android only when James asks for it for that app and sends a build message for it.

**Goal.** James installs and updates his apps on his phone from his own F-Droid repo instead of (or alongside) installing the PWA from Chrome. The APK is a Trusted Web Activity (TWA): a thin Android shell that opens the app's own `https://<sub>.hoffmanhouse.ca` site full-screen. It is the same PWA, so there is no second codebase and no second UI. The PWA remains the baseline and fallback.

**How a release flows.** Push to `main` with a new version -> `image` job builds the Docker image and, as its last step, creates the GitHub release and the tag -> `android` job (needs `image`, because a tag made by the workflow's own token does not start other workflows) builds and signs `<repo>-<version>.apk` and uploads it to that release -> the `fdroid-updater` container on the server polls the GitHub releases of every repo listed in its `apps.txt` (every 15 minutes), downloads new APKs and regenerates the signed index -> the phone's F-Droid client shows the update. App chats never push to the server; Claude Code lists the repo in `apps.txt` once.

**Requirements for an Android-enabled app (all required):**
1. The PWA requirements in section 7 are met and the app has a public hostname. A TWA needs a valid, HTTPS-served manifest, and Cloudflare Access must let the manifest, service worker, icons and `/.well-known/assetlinks.json` through.
2. **Package id** `ca.hoffmanhouse.<app>`: lowercase letters and digits only, no hyphens (`ca.hoffmanhouse.maintenhance`). It never changes after the first release.
3. **Signing key**: one key per app, created once by James with `keytool` (PKCS12, RSA 4096, validity 10000 days) and stored only as four GitHub secrets: `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`; James keeps a backup (password manager plus offline copy). An authoring chat never creates, sees or asks for the key or the passwords. Android refuses to update an app signed with a different key, so a lost key means uninstall and reinstall on every phone. Never generate a second key for an app that has a released APK.
4. **Version mapping**: `versionName` = the release version; `versionCode` = `MAJOR * 100000000 + MINOR * 10000 + PATCH` (0.2.1 -> 20001, 0.10.0 -> 100000). It must strictly increase. The job fails if MINOR or PATCH exceed 9999 or MAJOR exceeds 20.
5. **`twa-manifest.json`** is committed at the repo root (generated once with `bubblewrap init --manifest=https://<sub>.hoffmanhouse.ca/manifest.webmanifest`, then reviewed). It sets `packageId`, `host`, `name`, `launcherName`, `startUrl`, colors, icon URLs (including maskable), `display: standalone`, `enableNotifications` only if the app uses push, and `fallbackType: customtabs`. The job overwrites the version fields and the signing key path at build time; the keystore itself is never committed.
6. **Digital Asset Links**: the app serves `/.well-known/assetlinks.json` (no redirect, `application/json`) with the package id and the SHA-256 fingerprint of the signing certificate (`keytool -list -v -keystore <file> -alias <alias>`; James supplies the fingerprint). Without it the TWA falls back to a browser tab with an address bar. `RELEASE.md` says whether it is served, and the first Android release is checked on a real phone (no address bar visible).
7. The service worker and caching rules from section 7 still apply; the TWA uses the same site, so offline behavior is the PWA's.
8. Notifications, share targets and other native features are out of scope unless James asks; say so if the app needs them.
9. `docs/functional-spec.md` has an **Android** section (package id, current versionCode, key alias name, assetlinks status, known limits) and `deploy/RELEASE.md` has the Android line.

**`android` job** (add to the same `.github/workflows/release.yml`, after the `image` job). UNTESTED; the first run is the pilot, so expect to fix it with patch releases. The gate step makes the job a no-op for apps without `twa-manifest.json` (`hashFiles` cannot be used in a job-level `if`):

```yaml
  android:
    needs: [prepare, image]
    if: needs.prepare.outputs.release == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      VERSION: ${{ needs.prepare.outputs.version }}
      GH_TOKEN: ${{ github.token }}
    steps:
      - uses: actions/checkout@v4
      - name: Android build enabled?
        id: gate
        shell: bash
        run: |
          if [ -f twa-manifest.json ]; then echo "enabled=true" >> "$GITHUB_OUTPUT"; else echo "enabled=false" >> "$GITHUB_OUTPUT"; echo "No twa-manifest.json: no Android build for this app."; fi
      - uses: actions/setup-java@v4
        if: steps.gate.outputs.enabled == 'true'
        with:
          distribution: temurin
          java-version: "17"
      - uses: actions/setup-node@v4
        if: steps.gate.outputs.enabled == 'true'
        with:
          node-version: "20"
      - name: Build signed APK
        if: steps.gate.outputs.enabled == 'true'
        shell: bash
        env:
          ANDROID_KEYSTORE_B64: ${{ secrets.ANDROID_KEYSTORE_B64 }}
          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
        run: |
          set -euo pipefail
          IFS=. read -r MA MI PA <<< "$VERSION"
          [ "$MA" -le 20 ] && [ "$MI" -le 9999 ] && [ "$PA" -le 9999 ] || { echo "version too large for versionCode"; exit 1; }
          CODE=$(( MA*100000000 + MI*10000 + PA ))
          echo "$ANDROID_KEYSTORE_B64" | base64 -d > "$RUNNER_TEMP/android.keystore"
          npm install -g @bubblewrap/cli@1
          mkdir -p ~/.bubblewrap
          printf '{"jdkPath":"%s","androidSdkPath":"%s"}' "$JAVA_HOME" "$ANDROID_HOME" > ~/.bubblewrap/config.json
          jq --arg v "$VERSION" --argjson c "$CODE" --arg ks "$RUNNER_TEMP/android.keystore" --arg al "$ANDROID_KEY_ALIAS" \
             '.appVersionName=$v | .appVersion=$v | .appVersionCode=$c | .signingKey={path:$ks,alias:$al}' \
             twa-manifest.json > "$RUNNER_TEMP/twa.json" && cp "$RUNNER_TEMP/twa.json" twa-manifest.json
          BUBBLEWRAP_KEYSTORE_PASSWORD="$ANDROID_KEYSTORE_PASSWORD" BUBBLEWRAP_KEY_PASSWORD="$ANDROID_KEY_PASSWORD" \
            bubblewrap build --skipPwaValidation
          mv app-release-signed.apk "${GITHUB_REPOSITORY#*/}-${VERSION}.apk"
          echo "APK=${GITHUB_REPOSITORY#*/}-${VERSION}.apk" >> "$GITHUB_ENV"
      - name: Attach APK to the release
        if: steps.gate.outputs.enabled == 'true'
        run: gh release upload "v$VERSION" "$APK"
```

**Rules for the job.** The APK name is exactly `<repo-name>-<version>.apk` (the server downloads by that pattern and skips files it already has). Do not echo secrets. If the `android` job fails after `image` succeeded, the Docker image, the release and the tag are good (the run shows red): fix the job and ship a patch release; never move the tag. A failed APK must not block a server deploy. `fantasy-support-app` already has its own `android-apk.yml` (Gradle TWA project in `android/`, signed APK on a rolling `android-latest` release); how it relates to this contract (a versioned APK on each `vX.Y.Z` release) is a decision for the pilot.

**Server side and phone setup** are in the Project doc `claude/handoff-fdroid-android.md`. In short: Claude Code lists `jameshoffman7667/<repo>` in the fdroid stack's `apps.txt` once; James adds `https://apps.hoffmanhouse.ca/repo` (with the repo fingerprint from the updater log) to the F-Droid client, Droid-ify or Neo Store, and installs the app. Silent background updates need Android 12 or later and the client set as the installer; test on James's phone.
