// Runs the real server: /healthz, security headers, fail-fast secret,
// same-origin check, schema versioning and clean SIGTERM shutdown.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { start, get, cleanup } = require("./helpers");
const version = require("../package.json").version;

test("/healthz returns exactly {status, version}, needs no login and sets no cookie", async () => {
  const s = await start();
  try {
    const r = await get(s.port, "/healthz");
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(JSON.parse(r.body), { status: "ok", version });
    assert.strictEqual(r.headers["set-cookie"], undefined);
  } finally { cleanup(s); }
});

test("security headers are present", async () => {
  const s = await start();
  try {
    const r = await get(s.port, "/api/config");
    assert.ok(/script-src 'self'/.test(r.headers["content-security-policy"]));
    assert.ok(/frame-ancestors 'none'/.test(r.headers["content-security-policy"]));
    assert.strictEqual(r.headers["x-frame-options"], "DENY");
    assert.strictEqual(r.headers["referrer-policy"], "no-referrer");
    assert.strictEqual(r.headers["x-content-type-options"], "nosniff");
  } finally { cleanup(s); }
});

test("manifest.webmanifest is served as application/manifest+json", async () => {
  const s = await start();
  try {
    const r = await get(s.port, "/manifest.webmanifest");
    // No built frontend in the test tree: the route still answers with JSON.
    assert.ok(/application\/manifest\+json/.test(r.headers["content-type"]));
    assert.ok(/no-cache/.test(r.headers["cache-control"]));
  } finally { cleanup(s); }
});

test("a write with a foreign Origin is refused", async () => {
  const s = await start();
  try {
    const status = await new Promise((resolve, reject) => {
      const req = require("http").request({ host: "127.0.0.1", port: s.port, path: "/api/auth/login", method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" } }, (res) => { res.resume(); resolve(res.statusCode); });
      req.on("error", reject); req.end("{}");
    });
    assert.strictEqual(status, 403);
  } finally { cleanup(s); }
});

test("a write whose Origin matches X-Forwarded-Host or APP_URL is allowed", async () => {
  const s = await start({ APP_URL: "https://maint.example.com" });
  try {
    const post = (origin, extra = {}) => new Promise((resolve, reject) => {
      const req = require("http").request({ host: "127.0.0.1", port: s.port, path: "/api/auth/login", method: "POST", headers: { "content-type": "application/json", origin, ...extra } }, (res) => { res.resume(); resolve(res.statusCode); });
      req.on("error", reject); req.end("{}");
    });
    assert.notStrictEqual(await post("https://app.example.org", { "x-forwarded-host": "app.example.org" }), 403);
    assert.notStrictEqual(await post("https://maint.example.com"), 403);
    assert.strictEqual(await post("https://evil.example"), 403);
  } finally { cleanup(s); }
});

test("missing JWT_SECRET stops the app with a clear message", async () => {
  const dir = fs.mkdtempSync(path.join(require("os").tmpdir(), "me-test-"));
  const env = { ...process.env, DATA_DIR: dir, FILES_DIR: dir, PORT: "0", NODE_ENV: "production" };
  delete env.JWT_SECRET;
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], { env, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", (d) => (out += d)); child.stderr.on("data", (d) => (out += d));
  const code = await new Promise((r) => child.on("exit", r));
  fs.rmSync(dir, { recursive: true, force: true });
  assert.notStrictEqual(code, 0);
  assert.ok(/JWT_SECRET/.test(out));
});

test("a new database is versioned and an old one is copied before migrating", async () => {
  // Build an "old" database: a users table and no schema_version.
  const Database = require("better-sqlite3");
  const dir = fs.mkdtempSync(path.join(require("os").tmpdir(), "me-test-"));
  const old = new Database(path.join(dir, "maintenhance.db"));
  old.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT)");
  old.close();
  const s = await start({ DATA_DIR: dir, FILES_DIR: dir });
  try {
    const copies = fs.readdirSync(path.join(dir, "backups")).filter((f) => /^pre-migrate-0-to-\d+-\d{14}\.db$/.test(f));
    assert.strictEqual(copies.length, 1, s.log());
    const d = new Database(path.join(dir, "maintenhance.db"), { readonly: true });
    assert.ok(d.prepare("SELECT version FROM schema_version").get().version >= 10);
    d.close();
  } finally { cleanup(s); }
});

test("SIGTERM shuts the app down cleanly and fast", async () => {
  const s = await start();
  const t0 = Date.now();
  s.child.kill("SIGTERM");
  const r = await s.exited;
  const ms = Date.now() - t0;
  try {
    assert.strictEqual(r.code, 0, s.log());
    assert.ok(ms < 10000, "took " + ms + " ms");
    assert.ok(/SIGTERM received/.test(s.log()) && /shutdown complete/.test(s.log()));
  } finally { cleanup(s); }
});

test("an unwritable data folder stops the app with a clear message", { skip: typeof process.getuid === "function" && process.getuid() === 0 ? "root ignores folder permissions" : false }, async () => {
  const dir = fs.mkdtempSync(path.join(require("os").tmpdir(), "me-test-"));
  fs.chmodSync(dir, 0o555);
  const env = { ...process.env, DATA_DIR: dir, FILES_DIR: dir, PORT: "0", NODE_ENV: "production", JWT_SECRET: "test-secret-0123456789abcdef" };
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], { env, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", (d) => (out += d)); child.stderr.on("data", (d) => (out += d));
  const code = await new Promise((r) => child.on("exit", r));
  fs.chmodSync(dir, 0o755); fs.rmSync(dir, { recursive: true, force: true });
  assert.notStrictEqual(code, 0);
  assert.ok(/cannot write to the data folder/.test(out) && /chown -R 1000:100/.test(out), out);
});
