// Release rules: version files, changelog, service worker and manifest.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const version = JSON.parse(read("backend/package.json")).version;

test("backend and frontend versions match", () => {
  assert.strictEqual(JSON.parse(read("frontend/package.json")).version, version);
});

test("CHANGELOG has an entry for this version with Short <= 50 and Long <= 250", () => {
  const cl = read("CHANGELOG.md");
  const m = new RegExp("^## v" + version.replace(/\./g, "\\.") + " .*\\n\\*\\*Short:\\*\\* (.*)\\n\\*\\*Long:\\*\\* (.*)$", "m").exec(cl);
  assert.ok(m, "no changelog entry for v" + version);
  assert.ok(m[1].length > 0 && m[1].length <= 50, "Short is " + m[1].length);
  assert.ok(m[2].length > 0 && m[2].length <= 250, "Long is " + m[2].length);
});

test("service worker cache name carries the app version", () => {
  assert.ok(read("frontend/public/service-worker.js").includes('"maintenhance-shell-v' + version + '"'));
});

test("deploy files pin this version", () => {
  assert.ok(read("deploy/compose.yaml").includes("mybadreligon/maintenhance:" + version));
  assert.ok(read("docker-compose.yml").includes("mybadreligon/maintenhance:" + version));
  const rel = read("deploy/RELEASE.md");
  assert.ok(/^# .*v?\d/m.test(rel) && rel.includes(version));
  assert.ok(/^Update: (now|later)\s*$/m.test(rel));
});

test("manifest is installable", () => {
  const m = JSON.parse(read("frontend/public/manifest.webmanifest"));
  for (const k of ["name", "short_name", "id", "start_url", "scope", "display", "background_color", "theme_color", "description"]) assert.ok(m[k], "manifest." + k);
  assert.strictEqual(m.display, "standalone");
  const has = (size, purpose) => m.icons.some((i) => i.sizes === size && i.type === "image/png" && (i.purpose || "any").includes(purpose));
  assert.ok(has("192x192", "any") && has("512x512", "any") && has("512x512", "maskable"));
  assert.ok(m.screenshots.some((s) => s.form_factor === "wide") && m.screenshots.some((s) => s.form_factor === "narrow"));
  for (const s of m.screenshots) assert.ok(fs.existsSync(path.join(root, "frontend/public", s.src)), s.src);
  assert.ok(fs.existsSync(path.join(root, "frontend/public/apple-touch-icon.png")));
  assert.ok(fs.existsSync(path.join(root, "frontend/public/offline.html")));
});

test("html head has the PWA tags and no inline script", () => {
  const h = read("frontend/index.html");
  assert.ok(h.includes('rel="manifest" href="/manifest.webmanifest"'));
  assert.ok(h.includes('name="theme-color"') && h.includes('name="viewport"'));
  assert.ok(h.includes('rel="apple-touch-icon" href="/apple-touch-icon.png"'));
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(h), "inline script found");
});

test("Dockerfile healthcheck needs the status body and the image runs under tini as non-root", () => {
  const d = read("Dockerfile");
  assert.ok(d.includes("status") && d.includes("HEALTHCHECK"));
  assert.ok(d.includes("j.status==='ok'"));
  for (const f of ["docker-compose.yml", "deploy/compose.yaml"]) assert.ok(read(f).includes("j.status==='ok'"), f + " healthcheck");
  assert.ok(d.includes("tini") && d.includes("USER 1000:100"));
  assert.ok(!/^# syntax=/m.test(d));
});

test("lockfiles are committed", () => {
  assert.ok(fs.existsSync(path.join(root, "backend/package-lock.json")));
  assert.ok(fs.existsSync(path.join(root, "frontend/package-lock.json")));
});
