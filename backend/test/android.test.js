// Android pilot (v2.11): versionCode rule, twa-manifest.json, and the public assetlinks route.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { start, get, cleanup } = require("./helpers");
const { versionCode } = require("../../scripts/android-version");

const root = path.join(__dirname, "..", "..");
const twa = JSON.parse(fs.readFileSync(path.join(root, "twa-manifest.json"), "utf8"));

test("versionCode = MAJOR*100000000 + MINOR*10000 + PATCH, with the limits", () => {
  assert.strictEqual(versionCode("2.11.0"), 200110000);
  assert.strictEqual(versionCode("2.11.1"), 200110001);
  assert.strictEqual(versionCode("0.1.0"), 10000);
  assert.strictEqual(versionCode("20.9999.9999"), 2000000000 + 99990000 + 9999);
  assert.ok(versionCode("2.12.0") > versionCode("2.11.9999"));
  assert.throws(() => versionCode("2.10000.0"), /9999 or less/);
  assert.throws(() => versionCode("2.0.10000"), /9999 or less/);
  assert.throws(() => versionCode("21.0.0"), /20 or less/);
  assert.throws(() => versionCode("2.1"), /MAJOR\.MINOR\.PATCH/);
});

test("twa-manifest.json has the required fields", () => {
  assert.strictEqual(twa.packageId, "ca.hoffmanhouse.maintenhance");
  assert.strictEqual(twa.host, "maintenhance.hoffmanhouse.ca");
  assert.strictEqual(twa.display, "standalone");
  assert.strictEqual(twa.fallbackType, "customtabs");
  assert.strictEqual(twa.startUrl, "/");
  assert.ok(twa.iconUrl.startsWith("https://" + twa.host + "/") && twa.maskableIconUrl.includes("maskable"));
  assert.ok(!JSON.stringify(twa).match(/password/i), "no passwords in twa-manifest.json");
});

test("twa-manifest.json uses Bubblewrap's version fields (appVersion = name, appVersionCode = number)", () => {
  assert.strictEqual(typeof twa.appVersion, "string"); assert.strictEqual(typeof twa.appVersionCode, "number");
  assert.strictEqual(twa.appVersionName, undefined);
});

test("minSdkVersion is at least 24 (androidbrowserhelper 2.7 needs it)", () => {
  assert.ok(twa.minSdkVersion >= 24);
});

test("enableSiteSettingsShortcut stays true (the browser helper library toggles ManageDataLauncherActivity at start and crashes if it is missing)", () => {
  assert.strictEqual(twa.enableSiteSettingsShortcut, true);
});

test("the manifest colours match the web manifest", () => {
  const web = JSON.parse(fs.readFileSync(path.join(root, "frontend/public/manifest.webmanifest"), "utf8"));
  assert.strictEqual(twa.themeColor.toLowerCase(), web.theme_color.toLowerCase());
  assert.strictEqual(twa.backgroundColor.toLowerCase(), web.background_color.toLowerCase());
});

test("assetlinks.json is public, JSON, not redirected and names the package", async () => {
  const srv = await start();
  try {
    const r = await get(srv.port, "/.well-known/assetlinks.json");
    assert.strictEqual(r.status, 200);
    assert.match(r.headers["content-type"], /application\/json/);
    const j = JSON.parse(r.body);
    assert.strictEqual(j[0].target.package_name, twa.packageId);
    assert.ok(Array.isArray(j[0].target.sha256_cert_fingerprints));
    assert.ok(j[0].relation.includes("delegate_permission/common.handle_all_urls"));
  } finally { cleanup(srv); }
});

test("release workflow has prepare, image and android jobs in order", () => {
  const w = fs.readFileSync(path.join(root, ".github/workflows/release.yml"), "utf8");
  assert.match(w, /\n  prepare:/); assert.match(w, /\n  image:\n    needs: prepare/); assert.match(w, /\n  android:\n    needs: \[prepare, image\]/);
  assert.match(w, /twa-manifest\.json/); assert.match(w, /gh release upload/);
});

test("release workflow has the manual rebuild path and the overwrite guard (workflow-only change after v2.13)", () => {
  const w = fs.readFileSync(path.join(root, ".github/workflows/release.yml"), "utf8");
  assert.match(w, /\n  workflow_dispatch:/); assert.match(w, /overwrite/);
  assert.ok(w.includes("github.event_name != 'workflow_dispatch'"));
  assert.ok((w.match(/github\.event_name != 'workflow_dispatch'/g) || []).length >= 2, "prepare and image are skipped on a manual run");
  assert.match(w, /already attached/); assert.match(w, /--clobber/);
  assert.match(w, /Missing secrets:/); assert.match(w, /assetlinks\.json/); assert.match(w, /androguard/);
  assert.match(w, /ref: \$\{\{ steps\.ver\.outputs\.tag \}\}/);
});

test("assetlinks.json fingerprints look like real SHA-256 fingerprints (32 hex pairs, 31 colons)", () => {
  const j = JSON.parse(fs.readFileSync(path.join(root, "backend/assetlinks.json"), "utf8"));
  const fps = j[0].target.sha256_cert_fingerprints;
  assert.ok(fps.length >= 1);
  for (const fp of fps) {
    assert.strictEqual((fp.match(/:/g) || []).length, 31, fp);
    assert.match(fp, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  }
});
