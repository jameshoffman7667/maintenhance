# Handoff: App Development Specification (Docker apps for James's home server)

Paste this doc into, or point any new or existing chat at it, whenever that chat creates or updates an app that will run as a Docker container on James's server. Version 1.6 of this spec, 2026-11-08 (v1.6: a release is "commit and push main with a new version"; the release workflow creates the tag, and authoring sessions never push tags (cloud sessions get HTTP 403 on tag pushes); v1.5: optional Android app build and publishing to James's own F-Droid repo, section 15, DRAFT until the MaintEnhance pilot passes; v1.4: AI usage is declared per app, tracked in an inventory, and configured provider-agnostically so it can move to a local model; v1.3: container port equals host port, with defined port ranges; v1.1: no version digit caps, first digit moves only on James's word; v1.2: every app is an installable PWA with distinct mobile and desktop layouts). Companion docs in the Project: `claude/home-server-reference.md` (server layout, ports, storage), `claude/github-repos.md` (repos), `claude/ai-inventory.md` (AI usage inventory template and rules), `claude/handoff-fdroid-android.md` (F-Droid server side and phone setup), `claude/handoff-stack-updates.md` and `claude/handoff-server-maintenance.md` (how the server side works). If this spec and the server reference disagree about the server, the reference wins; about app packaging and releases, this spec wins.

## 1. Your job

You build or update ONE app. Every iteration ends with a release that is: committed and pushed to the app's GitHub repo (the push to `main` with a new version starts the release workflow, which builds the Docker Hub image and creates the tag), and described so that **Claude Code on James's claude-ops box can deploy it without asking you anything**. You do not deploy. Claude Code deploys; James approves.

Be direct about what you verified (built, ran, tested) and what you did not.

## 2. Fixed facts

| Item | Value |
| --- | --- |
| GitHub owner | `jameshoffman7667` |
| GitHub repo | one repo per app, named exactly like the app (lowercase, hyphens). Existing: `maintenhance`, `fantasy-support-app`, `pricewatch`, `marketplace-browser`. New apps: James names the repo, or you propose `<app>` and confirm before creating. |
| Docker Hub namespace | `mybadreligon` (image `mybadreligon/<app>`) |
| CI secrets (set once per repo by James) | `DOCKERHUB_USERNAME` (value `mybadreligon`), `DOCKERHUB_TOKEN`. Apps with an Android build (section 15) also need `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Never ask for or print their values. |
| Server | Proxmox VM 101 (OpenMediaVault, Debian 13), **amd64 only** (i5-9600K, shared VM with 8 GiB RAM and 4 vCPU running about 17 containers). Build `linux/amd64` only; arm64 under QEMU is slow and unused. |
| Public access | Cloudflare Tunnel (Starlink: no port forwarding) to Caddy to the app over plain HTTP. One-level subdomains `<name>.hoffmanhouse.ca`. HTTPS is Cloudflare's job, not the app's. |
| Ports | **Container port = host port wherever possible** (e.g. `8070:8070`) so a port number means the same thing everywhere. Host ports come from the ranges in section 7 (Ports) and are assigned by Claude Code, never invented by the app chat. |
| Timezone | `America/Toronto` |
| Container user | `PUID=1000`, `PGID=100` if the base image supports it; otherwise run as a non-root user and document the UID the data folders need |
| Email | SMTP2GO, sender `server@hoffmanhouse.ca`; apps read `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (same names as MaintEnhance). Host `mail.smtp2go.com`, port 587 STARTTLS. Values are in the server `.env`, never in the repo. |
| Android app store | James's own F-Droid repo `https://apps.hoffmanhouse.ca/repo`, run by the `fdroid` app. Opt-in per app, see section 15. |

## 3. Versioning rules (mandatory)

Format `MAJOR.MINOR.PATCH`, git tag `vMAJOR.MINOR.PATCH`. Every new app starts at **v0.1.0**.

| Change | Bump |
| --- | --- |
| Bug fix, small tweak, dependency bump, copy change | PATCH (third digit) |
| Moderate functional change: new feature, new screen, new setting, new endpoint | MINOR (second digit), PATCH resets to 0 |
| James explicitly says "major revision" | MAJOR (first digit) +1, MINOR and PATCH reset to 0 |

**No digit has a cap.** PATCH and MINOR keep counting (0.1.9 -> 0.1.10, 0.9.4 -> 0.10.0, 0.10.0 -> 0.11.0). The first digit changes **only** when James specifies a major revision; never bump it on your own, however large the change, and never because MINOR reached 10 or more. Compare versions numerically, not as text (0.10.0 is newer than 0.9.0). If you are unsure between patch and minor, state your reasoning and choose the lower, then let James overrule. (The Android `versionCode` in section 15 supports MINOR and PATCH up to 9999; the build fails loudly beyond that.)

Existing apps: continue from the version already in the repo. If the app has no version yet, its next release is **v0.1.0** (state this in the release note, and say it is a baseline). `multiview-iptv` is currently 0.4.0.

The version lives in ONE source of truth in the repo (`package.json` `version`, `pyproject.toml`, or a `VERSION` file) and the tag, image tag, `CHANGELOG.md` heading, and OCI label must all equal it. The app should expose it (footer, `/api/version` or `/healthz` JSON) so James can confirm what is running.

## 4. Per-iteration release checklist (do ALL, in order)

1. Decide the version bump (section 3) and state it to James in one line.
2. Make the change; run the tests and a real build (`docker build`) when you can. Say what was and was not run. For any UI change, check the layout at phone width (about 390 x 844) and desktop width (about 1440 x 900), and confirm the PWA requirements in section 7 still hold (manifest valid, service worker registers, app still installable).
3. Update the version file(s).
4. Update **`docs/functional-spec.md`** if it exists (and create it for a new app on the first release). It describes what the app does now: features, screens, settings, env vars, data model, API, known limits, an **AI usage** section (section 14) and, if the app has an Android build, an **Android** section (section 15). Edit in place; it is a current-state spec, not a log.
5. Write the two release comments:
   - **Short**: 50 characters or fewer, imperative mood, no trailing period. This is the git commit subject and the GitHub release title suffix.
   - **Long**: 250 characters or fewer, plain prose, what and why. This is the commit body.
   Count the characters; do not guess. If a message does not fit, shorten it, never split it.
6. Update **`CHANGELOG.md`** (complete history, newest first, one entry per released version, never rewrite old entries):

   ```
   ## v0.2.1 - 2026-10-16
   **Short:** Fix login redirect loop
   **Long:** Login redirected back to /login when the proxy forwarded http. The app now trusts X-Forwarded-Proto, so sessions persist behind Caddy and Cloudflare.
   ```
   Every released version appears with its exact short and long text, identical to the commit.
7. Update `deploy/` release files (section 8) for Claude Code: `deploy/compose.yaml`, `deploy/.env.example`, `deploy/RELEASE.md` (including its AI and Android lines).
8. Commit with the short as subject and the long as body, and push `main` (section 9). Commit only the files that belong to the release. Do not create or push a tag: the release workflow creates `vX.Y.Z` after the image is pushed and verified.
9. Report to James: version, short, long, what triggered the build (the push to `main` that changed the version file, or a manual run of the workflow), the run URL and result of the `release` workflow, whether the release adds, changes or removes any AI usage (rows for `claude/ai-inventory.md`, section 14), for Android-enabled apps the APK file name and `versionCode` and whether the `android` job finished (section 15), and the prompt to hand to Claude Code (section 10). Do not claim the image, the tag or the APK exists until the workflow run has finished; say so if you cannot see the run.

## 5. Git and GitHub rules

- Default branch `main`. One release = one commit (or a squash of the iteration) on `main` that changes the version file (and everything that must equal it).
- **A release is "commit and push `main` with a new version".** The push starts the `release` workflow (section 6), which validates, tests, builds and verifies the image, then creates the GitHub release `vX.Y.Z` with `--target $GITHUB_SHA`; that also creates the tag. **Authoring sessions never push tags** (cloud sessions get HTTP 403 on tag pushes, and the workflow does not need one). Pushing a tag by hand is only a manual fallback that James may do himself.
- This spec is James's **standing instruction to commit and push `main` at the end of each iteration for the app repo you are working on**; it replaces the "only push when asked" default in `claude/github-repos.md` for app releases. Attach the repo with push access (add_repo access push). Do not push to any other repo. If GitHub access is denied, say so plainly, give James the exact commands, and stop.
- Never commit secrets: `.env`, tokens, keys, keystores (`*.jks`, `*.keystore`, `*.p12`), API responses with personal data, database files. Commit `.env.example` (names only, safe defaults).
- Do not force-push, delete tags, or rewrite released history. A failed or bad release is fixed by releasing the next patch version: a failed run leaves no tag, so nothing is retagged.
- Ordinary pushes to `main` (any push that does not change the version file) start no workflow run and publish nothing. This keeps every published image tied to a version. A release can also be started by hand with **Run workflow** (workflow_dispatch) on `main` in the Actions tab, or `gh workflow run release.yml --ref main`; it releases whatever the version file says at that head.

## 6. GitHub Actions workflow (put in every app repo as `.github/workflows/release.yml`)

Reference implementations: `jameshoffman7667/fdroid` (one image, with a smoke-test job) and `jameshoffman7667/fantasy-support-app` (two images). Copy the closest one and adapt the version files, the image list and the compose check. Contract:

- **Trigger:** `push` to `main` with `paths: [<the version file>]` (so ordinary pushes start nothing); `workflow_dispatch` (validate rejects it unless the ref is `main`); optional manual fallback `push` of a tag `v[0-9]+.[0-9]+.[0-9]+` (validate: tag == version file). `permissions: contents: write`; `concurrency: group: release, cancel-in-progress: false`.
- **validate:** read X.Y.Z from the version file; fail (do not skip) if tag `vX.Y.Z` (`git ls-remote --tags`) or a GitHub release `vX.Y.Z` (`gh release view`) already exists; fail if the version files disagree; fail if the CHANGELOG entry is missing or Short is over 50 or Long over 250 chars; fail unless `deploy/RELEASE.md` has the heading `# Release vX.Y.Z` and exactly one `Update: now` or `Update: later` line; fail unless `deploy/compose.yaml` pins `mybadreligon/<image>:X.Y.Z` for each image and never uses `:latest`. Outputs: version, minor (X.Y), short.
- **smoke (when the app can be run headless):** build the image with `load: true` and run a script that starts it the way the server does and fails the run if it does not work. It gates the images job (`images` needs `[validate, smoke]`).
- **images:** build and push `mybadreligon/<image>` with `docker/metadata-action` using **raw tags**: `type=raw` X.Y.Z, `type=raw` X.Y, `type=raw` latest, `type=sha,format=short`. **Do not use `type=semver`:** it only works when the ref is a git tag, and on a push to `main` it silently leaves only `latest` and `sha-` (this broke fantasy-manager 4.12.2). Labels `org.opencontainers.image.version=X.Y.Z` and `org.opencontainers.image.revision=${{ github.sha }}`. Then a verify step that fails the run unless X.Y.Z, X.Y and latest all exist, have the same digest (`docker buildx imagetools inspect --raw`), and the pulled X.Y.Z image carries the right version and revision labels.
- **release (last job, needs everything before it):** `gh release create "vX.Y.Z" --target "$GITHUB_SHA" --title "vX.Y.Z - <Short>" --notes-file <CHANGELOG entry>`. This also creates the tag. A tag created with the workflow's own `GITHUB_TOKEN` does not start other workflows, so anything that used to be triggered by the tag (for example the Android build, section 15) must be a job in this same workflow.
- A failed run leaves no tag and no release. Fix the problem and release the next patch version.

```yaml
name: release
on:
  push:
    branches: [main]
    paths: ["VERSION"]                       # the app's version file
    tags: ["v[0-9]+.[0-9]+.[0-9]+"]          # manual fallback only
  workflow_dispatch: {}
permissions:
  contents: write
concurrency:
  group: release
  cancel-in-progress: false
jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    outputs:
      version: ${{ steps.check.outputs.version }}
      minor: ${{ steps.check.outputs.minor }}
      short: ${{ steps.check.outputs.short }}
    steps:
      - uses: actions/checkout@v4
      - name: Validate release metadata
        id: check
        shell: bash
        env:
          GH_TOKEN: ${{ github.token }}
          GH_REPO: ${{ github.repository }}
        run: |
          set -euo pipefail
          FILE_VERSION="$(tr -d '[:space:]' < VERSION)"
          [[ "$FILE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "VERSION ($FILE_VERSION) is not MAJOR.MINOR.PATCH"; exit 1; }
          if [ "$GITHUB_REF_TYPE" = "tag" ]; then
            [[ "$GITHUB_REF_NAME" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Tag $GITHUB_REF_NAME is not vMAJOR.MINOR.PATCH"; exit 1; }
            VERSION="${GITHUB_REF_NAME#v}"
            [ "$FILE_VERSION" = "$VERSION" ] || { echo "VERSION file ($FILE_VERSION) != tag ($VERSION)"; exit 1; }
          else
            [ "$GITHUB_REF" = "refs/heads/main" ] || { echo "Releases run from main only (ref is $GITHUB_REF)"; exit 1; }
            VERSION="$FILE_VERSION"
            if git ls-remote --exit-code --tags origin "refs/tags/v$VERSION" > /dev/null 2>&1; then
              echo "Tag v$VERSION already exists: bump VERSION to a new version"; exit 1
            fi
          fi
          if gh release view "v$VERSION" > /dev/null 2>&1; then
            echo "GitHub release v$VERSION already exists"; exit 1
          fi
          # add one check per other file that carries the version (package.json, Dockerfile ARG, ...)
          grep -q "^## v$VERSION " CHANGELOG.md || { echo "CHANGELOG.md has no entry for v$VERSION"; exit 1; }
          SHORT="$(awk -v v="## v$VERSION " 'index($0,v)==1{f=1;next} f&&/^\*\*Short:\*\*/{sub(/^\*\*Short:\*\* /,"");print;exit}' CHANGELOG.md)"
          LONG="$(awk -v v="## v$VERSION " 'index($0,v)==1{f=1;next} f&&/^\*\*Long:\*\*/{sub(/^\*\*Long:\*\* /,"");print;exit}' CHANGELOG.md)"
          [ "${#SHORT}" -gt 0 ] && [ "${#SHORT}" -le 50 ] || { echo "Short is ${#SHORT} chars (max 50)"; exit 1; }
          [ "${#LONG}" -gt 0 ] && [ "${#LONG}" -le 250 ] || { echo "Long is ${#LONG} chars (max 250)"; exit 1; }
          [ -f deploy/RELEASE.md ] && [ -f deploy/compose.yaml ] || { echo "deploy/RELEASE.md and deploy/compose.yaml are required"; exit 1; }
          [ "$(grep -cE '^Update: (now|later)( |$)' deploy/RELEASE.md)" = "1" ] || { echo "RELEASE.md needs exactly one 'Update: now' or 'Update: later' line"; exit 1; }
          grep -q "^# Release v$VERSION\$" deploy/RELEASE.md || { echo "RELEASE.md heading is not '# Release v$VERSION'"; exit 1; }
          grep -qE "^[[:space:]]*image: mybadreligon/<image>:$VERSION\$" deploy/compose.yaml || { echo "compose.yaml does not pin <image>:$VERSION"; exit 1; }
          ! grep -qE 'image:.*:latest' deploy/compose.yaml || { echo "compose.yaml must not use :latest"; exit 1; }
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"
          echo "minor=${VERSION%.*}" >> "$GITHUB_OUTPUT"
          echo "short=$SHORT" >> "$GITHUB_OUTPUT"

  # smoke:  (optional job: build with load: true and run a script that fails unless the image really works)

  images:
    needs: [validate]                         # add smoke here when the app has one
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
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
            type=raw,value=${{ needs.validate.outputs.version }}
            type=raw,value=${{ needs.validate.outputs.minor }}
            type=raw,value=latest
            type=sha,format=short
          labels: |
            org.opencontainers.image.version=${{ needs.validate.outputs.version }}
            org.opencontainers.image.revision=${{ github.sha }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64
          push: true
          build-args: APP_VERSION=${{ needs.validate.outputs.version }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Verify tags and labels
        env:
          IMAGE: mybadreligon/${{ github.event.repository.name }}
          VERSION: ${{ needs.validate.outputs.version }}
          MINOR: ${{ needs.validate.outputs.minor }}
        run: |
          set -euo pipefail
          for t in "$VERSION" "$MINOR" latest; do
            docker buildx imagetools inspect "$IMAGE:$t" > /dev/null || { echo "$IMAGE:$t is missing"; exit 1; }
          done
          d1="$(docker buildx imagetools inspect --raw "$IMAGE:$VERSION" | sha256sum)"
          for t in "$MINOR" latest; do
            [ "$d1" = "$(docker buildx imagetools inspect --raw "$IMAGE:$t" | sha256sum)" ] || { echo "$IMAGE:$t is not the same image as $IMAGE:$VERSION"; exit 1; }
          done
          docker pull -q "$IMAGE:$VERSION" > /dev/null
          v="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.version" }}' "$IMAGE:$VERSION")"
          r="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$IMAGE:$VERSION")"
          [ "$v" = "$VERSION" ] || { echo "version label is '$v', expected $VERSION"; exit 1; }
          [ "$r" = "$GITHUB_SHA" ] || { echo "revision label is '$r', expected $GITHUB_SHA"; exit 1; }

  release:
    needs: [validate, images]                 # and smoke, when present
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - name: GitHub release (also creates the tag)
        env:
          GH_TOKEN: ${{ github.token }}
          VERSION: ${{ needs.validate.outputs.version }}
          SHORT: ${{ needs.validate.outputs.short }}
        run: gh release create "v$VERSION" --target "$GITHUB_SHA" --title "v$VERSION - $SHORT" --notes-file <(awk -v v="## v$VERSION " 'index($0,v)==1{f=1;next} f&&/^## v/{exit} f' CHANGELOG.md)
```

Notes: the image repo name is the GitHub repo name, so keep them identical to the Docker Hub repo `mybadreligon/<app>`. Docker Hub creates a repo on first push. The image name for `fantasy-support-app` differs today (`fantasy-manager-client` and `fantasy-manager-server`): for apps with two images, run the images job as a matrix over both, one cache scope each, and keep both tagged with the same version. Pin Action versions as shown (major tags); do not use `@main`. Apps with an Android build add the `android` job from section 15 to this same file.

## 7. Packaging standards (what "optimized and clean" means here)

**Dockerfile**
- Multi-stage build; final stage minimal (`node:20-alpine`, `python:3.12-slim`, distroless, or similar). Pin base image major.minor. Add `.dockerignore` (node_modules, .git, tests, docs, `.env`).
- No `build:` dependency on the server: the server only pulls the image.
- Run as non-root. Create the user with UID 1000 / GID 100 or honor `PUID`/`PGID`.
- `EXPOSE` one HTTP port. The app listens on the port in the `PORT` environment variable (never a hard-coded number, with a neutral dev default such as 8080 that is overridden on the server). The **host port is assigned by Claude Code from the port register**, and the compose file sets `PORT` to that same number so container port = host port. Leave `TBD` in your notes; do not invent a host port.
- Include a `HEALTHCHECK` (or give Claude Code the exact test for compose) against a cheap `/healthz` endpoint that checks the database is reachable, returns JSON `{status, version}`, and does not need auth. It must not call an AI provider.
- Handle `SIGTERM`: stop accepting requests, finish in-flight work, close the database cleanly, exit within 10 seconds. Past apps were force-killed (exit 137) because they ignored SIGTERM. Use `tini` or `init: true` if the runtime does not forward signals.
- Reproducible installs (`npm ci`, locked requirements), no dev dependencies in the final image, no secrets or build args containing secrets, OCI labels (version, source repo).
- Image small: aim under 300 MB; say if larger.

**Ports (required)**

- **Match container and host ports.** The compose file publishes `"<P>:<P>"` and sets `PORT=<P>`, so the number in the browser, the Caddyfile, the logs, the register and the container are all the same. This removes the "which side is 8080?" confusion. Make the listen port configurable through `PORT` for this reason.
- **Exceptions are allowed only when the port cannot be changed** (third-party images with a fixed port, or protocols that must use a standard port such as DNS 53). Then map host to the assigned number and write the exception in `RELEASE.md` ("container 3000 -> host 8048, image fixed").
- **Ranges (James's standard):**

| Range | Use |
| --- | --- |
| 8040-8099 | Web apps and admin UIs (the standard range). 8040-8052 and 8060 are already assigned to existing apps; **new apps are assigned from 8070-8099** |
| 9000-9099 | Overflow if 8070-8099 fills up |
| Never | 22 (SSH), 53 (DNS), 80 (OMV web admin), 443, 8006 (Proxmox), and anything already in the register |
| Fixed, not moved | 53 (AdGuard DNS), 80 (OMV), 8123 (Home Assistant, host network), Tailscale |

- Existing assignments in the standard range (2026-10-16 plan, subject to the port standardization being completed): maintenhance 8040, maintenhance_twl 8041, fantasy-manager-client 8042, iptv-multiview 8043, mealkit-manager 8044, classifieds-tracker 8045, mealie 8046, Dockhand 8047, AdGuard web 8048, free-games-claimer 8049 and 8052, heimdall 8050, homepage 8051, immich (reserved) 8060. The register in the Project's `claude/home-server-reference.md` is authoritative; apps not yet moved may still run on their old ports (5000, 1234, 3600, 3501, 9925, 3000, 3030, 6080, 7080).
- Only one process per container listens on the published port; do not publish database, cache or internal ports. Internal-only services stay on the Docker network with no `ports:` entry.
- A new app asks Claude Code for a port (via the handoff prompt); Claude Code records it in the register and the Caddyfile. If the app chat needs a number to test locally, use any local port and say it is a placeholder.

**Runtime behavior**
- Configuration only through environment variables (document each in `.env.example` with a comment and a safe default). Required secrets fail fast with a clear message when missing.
- Logs to stdout/stderr, one line per event, levels, no secrets or personal data; default level `info`.
- Resource use: the VM is shared. Keep idle RAM under about 256 MB unless justified; no busy loops; schedule jobs with sensible intervals. State expected RAM and CPU in `RELEASE.md`. If the app can burst (transcoding, scraping), give it knobs (concurrency env vars) and recommend compose limits (`cpus`, `mem_limit`) as was done for IPTV Multiview.
- Behind the proxy: trust `X-Forwarded-Proto/Host/For` (only from the Docker network), set cookies `Secure` when `COOKIE_SECURE=true`, use relative URLs or `APP_URL`, never redirect to `http://`. The app speaks plain HTTP; do not add TLS. Cloudflare's free plan caps request bodies at 100 MB. Service workers must not cache API responses or auth pages (a stale MaintEnhance service worker caused confusing 502s).
- Outbound calls: timeouts and retries with backoff; one failing upstream must not crash the app; log once per refresh, not once per item. (Known past problems: an upstream 404 logged on every refresh; quota errors from external APIs.)
- Time: store UTC, display and schedule in `TZ`.

**PWA and device support (required for every app with a user interface)**

Every app is a Progressive Web App that can be installed on phone and desktop, and has a layout designed for each. "Mobile and desktop version" means one codebase and one image, with a mobile layout and a desktop layout that are each designed, not just a squeezed or stretched copy. A separate mobile app or separate desktop build is not wanted unless James asks (the optional Android wrapper in section 15 is the same PWA, packaged, not a separate app). Headless services with no UI (workers, APIs only) are exempt, but must say so in `docs/functional-spec.md`.

Installability (all required):
- `manifest.webmanifest` (served with `Content-Type: application/manifest+json`) with: `name`, `short_name`, `id`, `start_url` (relative, e.g. `/`), `scope`, `display: "standalone"`, `background_color`, `theme_color`, `description`, and `icons` at 192x192 and 512x512 (PNG) plus a 512x512 `maskable` icon. Also an `apple-touch-icon` (180x180) and the `<meta name="theme-color">`, `<meta name="viewport" content="width=device-width, initial-scale=1">` and `<link rel="manifest">` tags in the HTML head.
- `screenshots` in the manifest with at least one `form_factor: "wide"` (desktop, about 1280 x 720) and one `form_factor: "narrow"` (phone, about 540 x 960) image, so Chrome/Android show the richer install prompt on both. Keep the images in the repo (`public/screenshots/`).
- A service worker registered from the site root with a scope that covers the app, and an offline fallback page, so the app launches offline with a clear "offline" state instead of the browser error. Precache the app shell only. **Never cache API responses, authentication pages or anything user-specific**; use network-first for navigations. Version the cache name with the app version (`app-v0.2.1`), delete old caches on `activate`, and show an unobtrusive "Update available, reload" prompt when a new service worker is waiting (do not silently skip waiting in the middle of a form).
- An in-app install affordance: handle `beforeinstallprompt` (Chrome/Edge/Android) with an "Install app" button in settings or the menu, and show short manual instructions for iOS Safari ("Share, then Add to Home Screen") since iOS has no install prompt.
- HTTPS is required for installation (service workers and install prompts only work in a secure context). On this server HTTPS comes from Cloudflare, so the app must be reached through its `https://<name>.hoffmanhouse.ca` hostname; a LAN address like `http://192.168.4.11:<port>` is not installable. Therefore every app with a UI needs a public hostname (Caddy route and tunnel hostname) or an agreed private alternative, and `RELEASE.md` must say which. If James wants an app kept private, protect the hostname with Cloudflare Access instead of skipping the hostname.
- Behind Caddy and Cloudflare the manifest, icons and service worker must be served at stable URLs without redirects, with correct MIME types, and `Service-Worker-Allowed` set if the worker is not at the root. Do not set long `Cache-Control` on `sw.js` or the manifest (use `no-cache`); fingerprinted assets may be cached long.

Mobile and desktop layouts (all required):
- Responsive design with explicit breakpoints (mobile under 768 px, desktop from 1024 px, tablets either by choice) and layouts designed for each: the **mobile layout** is single column with a bottom navigation or compact header, thumb-reachable primary actions, touch targets of at least 44 x 44 px, safe-area insets (`env(safe-area-inset-*)`), no hover-only controls, and forms that use the right input types and keyboards. The **desktop layout** uses the width (sidebar navigation, multi-column and table views, side-by-side detail panes), supports keyboard navigation and visible focus, sensible shortcuts for frequent actions, and does not leave a narrow phone column in the middle of a wide screen.
- Standalone mode behaves: back navigation works without the browser UI, no reliance on browser chrome, external links open correctly, and pull-to-refresh or overscroll does not break the app on mobile.
- Light and dark mode via `prefers-color-scheme` (and `theme-color` matching), readable contrast, text that respects user font size, and no horizontal scrolling at 320 px width.
- Performance: usable on a mid-range phone over Starlink: keep the initial JS small, lazy-load heavy screens, compress and size images, and avoid layout shift.
- Check at minimum 390 x 844 (phone), 768 x 1024 (tablet) and 1440 x 900 (desktop), and record the check in the release report. When Lighthouse or an equivalent is available, run the PWA/installability audit and report the result; if it was not run, say so.
- `docs/functional-spec.md` has a "Mobile layout" and a "Desktop layout" section describing the screens, navigation and any differences in features (feature parity is expected unless the spec says otherwise), and a "PWA" section (manifest values, offline behavior, update behavior, install notes).

**Data and migrations**
- All persistent state lives under mounted paths only: **`/data`** for databases and config (fast storage, SSD) and **`/files`** (or `/media`) for large files (slow storage, the SnapRAID pool). Nothing important in the container filesystem or anonymous volumes.
- SQLite: WAL mode is fine; copy rules need `.db`, `-wal` and `-shm` together, so document it; keep the database file on `/data`. Use a migration table (`schema_version`) and forward-only, idempotent migrations that run at start-up inside a transaction. `CREATE TABLE IF NOT EXISTS` alone does not alter existing tables (it caused a past 500 error with a stale CHECK constraint).
- Before a migration that changes or drops data, the app writes a timestamped copy of the database next to it (`/data/backups/pre-migrate-<from>-to-<to>.db`) and logs it; the release note states that a migration exists and whether it is reversible.
- Do not delete user data on upgrade. A downgrade to the previous image must still start (additive migrations), or the release note says "not reversible; restore the pre-update data copy".
- Provide a built-in export/backup (JSON/CSV or database file download) when the data matters to James.

**Security**
- No default admin passwords baked in; first-run setup or `ADMIN_*` env vars. Hash passwords (argon2/bcrypt), signed sessions, rate-limit login, CSRF protection for cookie auth, input validation, parameterized queries, no secrets in client bundles.
- Keep dependencies current; patch releases for security updates.
- No privileged mode, no Docker socket, no host network unless the app truly needs it (and then say why).

## 8. Files every release must leave in the repo (for Claude Code)

```
Dockerfile
.dockerignore
.github/workflows/release.yml
CHANGELOG.md
VERSION or package.json version
README.md                 short: what it is, how to run locally
docs/functional-spec.md   current-state functional spec (create if missing); includes AI usage section
deploy/compose.yaml       reference compose for the server (see below)
deploy/.env.example       every env var, names only
deploy/RELEASE.md         what Claude Code needs for THIS version (see below)
public/manifest.webmanifest, service worker, icons (192, 512, maskable, apple-touch 180)
public/screenshots/       at least one wide and one narrow image
twa-manifest.json         only if the app has an Android build (section 15)
```
(Paths for the PWA files follow the app's framework; the files must exist and be served as described in section 7.)

**`deploy/compose.yaml`** follows the server template: image pinned to the exact version tag, `restart: unless-stopped`, `container_name` = app name, environment with `TZ=America/Toronto` (+ `PUID`/`PGID` if supported), `ports` as `"<P>:<P>"` with `PORT=<P>` (container port = host port; `<P>` is assigned by Claude Code, a placeholder until then), volumes **with variablized paths** (standing rule), healthcheck, log limits. Example:

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
      test: ["CMD-SHELL", "wget -qO- http://localhost:$${PORT}/healthz >/dev/null || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    stop_grace_period: 15s
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "3"
```

Rules: variables `FAST_STORAGE` (databases/config) and `SLOW_STORAGE` (bulk) with the defaults above; one folder per app named after the app; never hard-code other host paths; pin the tag to the exact release (the server never floats on `latest` for data apps); no `build:`; use `create_host_path: false` for pool paths; healthcheck command must exist in the image (alpine has `wget`, slim images may need `curl` or a built-in command). Apps that use AI add the `AI_*` variables from section 14 (names with safe defaults; the key comes from the server `.env`).

**`deploy/RELEASE.md`** (rewrite each release; keep it short):

```
# Release v0.2.1
Image: mybadreligon/<app>:0.2.1   (built by the release workflow from the push to main; the workflow creates tag v0.2.1)
Update: now | later   (exactly one such line; the release workflow rejects the release without it)
Short: ...        Long: ...
Type: patch | minor | major
Port: <P> (host = container; from the register, or TBD for a new app)   Exception: none | container X -> host P, image fixed
Public hostname: <sub>.hoffmanhouse.ca | none        Needs Caddy route: yes/no
New or changed env vars: <names only; secrets named, never valued>
Data: paths used (/data, /files), folders to create + owner, migration: none | yes (reversible? y/n)
Resources: expected RAM / CPU, any recommended compose limits
Healthcheck: GET /healthz on $PORT -> 200 {status, version}
Verify after deploy: <3 concrete checks, including one page that reads real data>
PWA: installable on phone and desktop at https://<sub>.hoffmanhouse.ca (manifest ok, service worker registered, offline page works); layouts checked at 390x844, 768x1024, 1440x900; Lighthouse PWA result or "not run"
AI: none | <feature: provider/model, trigger, data sent, needed quality, local candidate y/n> ; registry rows added/changed/removed: <IDs or none>
Android: none | package <ca.hoffmanhouse.app>, versionCode <n>, asset <app>-0.2.1.apk on the GitHub release; apps.txt entry needed on the fdroid server: yes (first release) | already listed; assetlinks.json served: yes/no; android job result: <passed | not seen>
Rollback: previous image tag 0.2.0; data restore needed? y/n
Known issues: ...
Backup tier: small/critical (include in Tier 1) | bulk (SnapRAID only); SQLite needs stop during copy
```

## 9. Pushing procedure (exact)

```
git status && git diff --stat
```
```
git add -A   # only after confirming .env, node_modules, *.db, keystores are not staged
```
```
git commit -m "<short, 50 chars max>" -m "<long, 250 chars max>"
```
```
git push origin main
```

No tag command: **never create or push a tag.** The push changes the version file, which starts the release workflow; the workflow creates `vX.Y.Z` itself once the image is pushed and verified. Check the lengths before committing (`printf %s "$SHORT" | wc -c`). The workflow rejects a release whose CHANGELOG entry violates the limits; since a failed run leaves no tag, the fix is to release the next patch version. If the push did not start a run (the version file was not part of the change), start one with **Run workflow** on `main` in the Actions tab or `gh workflow run release.yml --ref main`.

## 10. Handoff to Claude Code (James pastes this; you fill the blanks)

**Where:** Android Claude app Code tab (session `homelab`) or claude-ops, user `james`, inside `claude`.

```
Deploy <app> v<X.Y.Z> from jameshoffman7667/<repo>. Read CLAUDE.md, claude/home-server-reference.md and the repo's deploy/RELEASE.md and deploy/compose.yaml. Confirm the image mybadreligon/<app>:<X.Y.Z> exists. New app: assign the host port from the port register, create stacks/<app>/, create data folders with the right owner, add the Caddy route and tell me the Cloudflare tunnel hostname to add, update the reference doc and homelab repo. Update of an existing app: follow the update procedure (Tier 1 snapshot age, data copy, pinned rollback digests), change only the pinned tag, one stack at a time, not between 02:55 and 05:30 Toronto time. Also compare the AI line in RELEASE.md with docs/ai-inventory.md in the homelab repo and update the registry rows (propose the diff). If the Android line is not "none": make sure the repo is listed in the fdroid stack's apps.txt, confirm the APK asset is on the GitHub release, and after the next sync (up to 15 minutes) confirm the app appears in https://apps.hoffmanhouse.ca/repo/index-v1.json. Show the plan and wait for my approval before changing anything.
```

Claude Code then follows the server's own deploy contract (reference doc section 7) and update procedures. The update script `scripts/update-stack.sh` currently supports **fantasymanager only**; other apps use the manual flow until they are added.

## 11. When you start a chat on an app

1. Ask (or find in the repo) the app name, repo, current version, whether `docs/functional-spec.md`, `CHANGELOG.md`, `deploy/` and the workflow exist. List what is missing.
2. If the app predates this spec, your **first iteration** also adds the missing release files and workflow. State the baseline version (existing version, or v0.1.0). Also audit the UI against the PWA and mobile/desktop requirements in section 7 and list what is missing; fix it in this or the next release (MaintEnhance is already a PWA; check the others). Apps without a public hostname need one to be installable. Also audit the app for AI usage (section 14) and declare it, even if the answer is "none". Also record its Android status (section 15): enabled, pending, or not wanted.
3. Confirm anything that blocks a clean deploy: port, subdomain, data paths, secrets (names only), expected load.
4. Then work the checklist in section 4 for each change. One release per iteration; do not batch unrelated changes under one release.

## 12. Current apps (for context, 2026-10-16)

| App | Repo | Image(s) | Notes |
| --- | --- | --- | --- |
| MaintEnhance (two instances: home, twl) | `maintenhance` | `mybadreligon/maintenhance` | Node/Express/SQLite PWA, port 8040 (home), 8041 (twl); `/data` fast + `/files` pool; floats on `latest`; update by manual flow. Android pilot app (section 15) |
| Fantasy Manager | `fantasy-support-app` | `fantasy-manager-server`, `fantasy-manager-client` | SQLite WAL; port 5000; known issues: exit 137 on stop, nflverse snap-count 404 logged every refresh, VAPID keys unset; only app with the scripted update flow |
| IPTV Multiview | (repo TBD) | `multiview-iptv:0.4.0` | CPU-heavy; compose has CPU limits; keep Shared screen OFF until fixed |
| mealkit-manager | TBD | `mealkit-manager` | port 3600 to 3800 |
| classifieds-tracker | TBD | image from `TRACKER_IMAGE` | port 3501, named volume |
| pricewatch, marketplace-browser | repos exist | not deployed yet | |
| fdroid | `fdroid` | `mybadreligon/fdroid` (+ `nginx:1.27-alpine`) | New 2026-11-04; v0.1.1 released 2026-11-08 by the push-to-main workflow (v0.1.0 crashed on first start: no git); not yet deployed. Headless (no PWA). Serves the F-Droid repo at apps.hoffmanhouse.ca/repo |

Server stacks live in James's private repo `homelab`; apps never push there. Claude Code owns that repo.

## 13. Do not

- Do not deploy, SSH, or ask for server credentials, tokens, `.env` values or passwords.
- Do not use `latest` in `deploy/compose.yaml`, add `build:` sections, or publish an image outside the release workflow.
- Do not invent host ports, subdomains or storage paths; use variables and `TBD` placeholders.
- Do not hard-code the listen port or map different container and host ports unless the image forces it (document the exception).
- Do not change a released version's changelog entry, and do not create, move, delete or push a tag (the release workflow creates it). Do not use `type=semver` image tags in the workflow (it silently drops `X.Y.Z` and `X.Y` on a push to `main`).
- Do not exceed 50 / 250 characters for short / long; do not skip the functional spec update.
- Do not add services that publish database ports or mount the Docker socket.
- Do not ship a UI that is not an installable PWA or that has only one layout (mobile-only or desktop-only); do not cache API responses or authenticated pages in the service worker.
- Do not hard-code an AI provider, model name or API key, call a provider SDK directly from feature code, ship an AI call that is not declared in the functional spec and RELEASE.md, or make the app unusable when AI is off or failing.
- Do not commit an Android keystore or its passwords, generate a new Android signing key for an app that already has released APKs, reuse or lower a `versionCode`, or build an APK before section 15 is out of draft and James has asked for it (log it as a pending item instead).

## 14. AI usage (required for every app; "none" is a valid declaration)

Goal: James can list every place AI is used on the server, see what data leaves it, and move calls to a local model (small quantized models through an OpenAI-compatible server such as Ollama or llama.cpp) by changing configuration, not code. The inventory is `docs/ai-inventory.md` in the `homelab` repo (template and rules in `claude/ai-inventory.md`). Claude Code owns the registry; the app chat supplies the facts.

**Declare it.** `docs/functional-spec.md` has an "AI usage" section, and `deploy/RELEASE.md` has an AI line, every release. For each AI-backed feature give: feature name, purpose, provider and model (current default), trigger and frequency (user action, schedule, per item), data sent (categories: receipts, household items, listings, logs, etc.; flag personal or financial data), needed quality tier (Low: classify, extract, tag, short summary; Medium: drafting, structured extraction from messy text; High: agentic, long context, code), whether it is a local-model candidate (yes, maybe, no, with one line why), and the fallback behavior when AI is unavailable. If the app has no AI, write "AI usage: none". A release that adds, changes or removes an AI call says so in the release report (checklist step 9) and lists the registry rows to add, change or retire.

**Build it provider-agnostic.**
- One module/client wrapper is the only code that talks to a model. Features call the wrapper with a task name; they never import a provider SDK.
- Configuration by environment variables only: `AI_ENABLED` (default `false` unless the app is useless without it), `AI_BASE_URL` (OpenAI-compatible endpoint; default the provider's URL), `AI_API_KEY` (secret, from the server `.env`, never in the repo), `AI_MODEL`, optional per-task overrides `AI_MODEL_<TASK>`, `AI_TIMEOUT_MS`, `AI_MAX_CONCURRENCY`. Use the OpenAI-compatible chat/completions interface where the provider supports it, so a local server is a drop-in; if a provider-specific API is truly required, isolate it in the wrapper and say so in RELEASE.md.
- Use structured output (JSON schema or strict JSON with validation) for extraction and classification, validate the result, and reject or retry on malformed output. Small local models need short prompts and explicit formats, so keep prompts in versioned files or constants, one per task, not scattered in code.
- Keep each task's prompt and expected output testable: include a small fixture set (inputs with expected outputs, no real personal data) so James can compare a local model against the current one before switching.
- Timeouts, retries with backoff, and a concurrency cap (the VM is shared). One failing call must not crash the app or block the UI; log once per failure, not once per item.
- Core features work with `AI_ENABLED=false` or the provider down; AI features show a clear "unavailable" state.
- Minimize what is sent: only the fields the task needs, no credentials, no data of other users, and nothing from private areas unless the feature is about them.

**Log it.** One log line per call: `ai_call task=<name> model=<model> ok=<bool> ms=<n> tokens_in=<n> tokens_out=<n>`. Never log prompts, responses or personal data. Expose counts at `/healthz` or an admin page if useful, but `/healthz` itself never calls a model.

**Review.** Claude Code compares RELEASE.md with the registry at deploy time and checks AdGuard monthly for AI-provider traffic from clients with no registry row. Quarterly, James decides which Low and Medium rows to move to a local model.

## 15. Android app and F-Droid publishing (opt-in per app; DRAFT until the MaintEnhance pilot passes)

**Status (2026-11-04).** The server side (`fdroid` v0.1.0) is written and its index generation was tested in a sandbox; it is not deployed. The `android` job below has NOT been run anywhere. Until James says the pilot passed, an app chat does not build an APK: it records this as a **pending item** (what to do, which app) and carries on with normal releases. Once the draft status is lifted, an app chat adds Android only when James asks for it for that app.

**Goal.** James installs and updates his apps on his phone from his own F-Droid repo, `https://apps.hoffmanhouse.ca/repo`, instead of (or alongside) installing the PWA from Chrome. The APK is a Trusted Web Activity (TWA): a thin Android shell that opens the app's own `https://<sub>.hoffmanhouse.ca` site full-screen. It is the same PWA, so there is no second codebase and no second UI. The PWA remains the baseline and fallback.

**How a release flows.** Push to `main` with a new version -> `images` job builds and verifies the Docker image -> `release` job creates the GitHub release and the tag -> `android` job (runs after `release`, because a tag made by the workflow does not start other workflows) builds and signs `<app>-<version>.apk` and uploads it to that release -> the `fdroid-updater` container on the server polls the GitHub releases of every repo listed in its `apps.txt` (every 15 minutes), downloads new APKs, regenerates the signed index -> the phone's F-Droid client shows the update. App chats never push to the server; Claude Code only has to list the repo in `apps.txt` once.

**Requirements for an Android-enabled app (all required):**
1. The PWA requirements in section 7 are met and the app has a public hostname. A TWA needs a valid, HTTPS-served manifest.
2. **Package id** `ca.hoffmanhouse.<app>`: lowercase letters and digits only, no hyphens (`ca.hoffmanhouse.maintenhance`). It never changes after the first release.
3. **Signing key**: one key per app, created once with `keytool` (PKCS12, RSA 4096, validity 10000 days), stored only as the four GitHub secrets in section 2 and backed up by James (password manager plus offline copy). Android refuses to update an app signed with a different key, so a lost key means uninstall and reinstall on every phone. Never generate a second key for an app that has a released APK.
4. **Version mapping**: `versionName` = the release version; `versionCode` = `MAJOR * 100000000 + MINOR * 10000 + PATCH` (so 0.2.1 -> 20001, 0.10.0 -> 100000). It must strictly increase. The job fails if MINOR or PATCH exceed 9999 or MAJOR exceeds 20.
5. **`twa-manifest.json`** is committed at the repo root (generated once with `bubblewrap init --manifest=https://<sub>.hoffmanhouse.ca/manifest.webmanifest`, then reviewed). It sets `packageId`, `host`, `name`, `launcherName`, `startUrl`, colors, icon URLs (incl. maskable), `display: standalone`, `enableNotifications` only if the app uses push, and `fallbackType: customtabs`. The job overwrites the version fields and signing key path at build time; the keystore itself is never committed.
6. **Digital Asset Links**: the app serves `/.well-known/assetlinks.json` (no redirect, `application/json`) containing the package id and the SHA-256 fingerprint of the app's signing certificate (`keytool -list -v -keystore <file> -alias <alias>`). Without it the TWA falls back to a browser tab with an address bar. `RELEASE.md` says whether it is served, and the first Android release is checked on a real phone (no address bar visible).
7. **Service worker and caching** rules from section 7 still apply; the TWA uses the same site, so offline behavior is the PWA's.
8. **Notifications, share targets and other native features** are out of scope unless James asks; say so if the app needs them.
9. `docs/functional-spec.md` has an **Android** section (package id, current versionCode, key alias name, assetlinks status, known limits) and `deploy/RELEASE.md` has the Android line.

**`android` job** (add to the same `.github/workflows/release.yml`, after the `release` job; only runs when `twa-manifest.json` exists). UNTESTED; the first run is the pilot, expect to fix it with a patch release. Note: `fantasy-support-app` already has its own `android-apk.yml` (Gradle TWA project in `android/`, signed APK published on a rolling `android-latest` release); how it relates to this contract (versioned APK on each `vX.Y.Z` release) is a decision for the pilot:

```yaml
  android:
    needs: [validate, release]
    if: ${{ hashFiles('twa-manifest.json') != '' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "17"
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: Build signed APK
        shell: bash
        env:
          VERSION: ${{ needs.validate.outputs.version }}
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
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh release upload "v${{ needs.validate.outputs.version }}" "$APK"
```

**Rules for the job.** The APK name is exactly `<repo-name>-<version>.apk` (the server downloads by that pattern and skips files it already has). Do not echo secrets. If the `android` job fails after `release` succeeded, the Docker image and the tag are good: fix the job and ship a patch release; never move the tag. A failed APK must not block a server deploy.

**Server side and phone setup** are in `claude/handoff-fdroid-android.md`. In short: Claude Code lists `jameshoffman7667/<repo>` in the fdroid stack's `apps.txt` once; James adds `https://apps.hoffmanhouse.ca/repo` (with the repo fingerprint from the updater log) to the F-Droid client, Droid-ify or Neo Store, and installs the app. Silent background updates need Android 12 or later and the client set as the installer; test on James's phone.
