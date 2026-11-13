// Push notification API routes on the real server (v2.12).
const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const { start, cleanup } = require("./helpers");

function call(port, method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({ host: "127.0.0.1", port, path: p, method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) } }, (res) => {
      let b = ""; res.on("data", (d) => (b += d)); res.on("end", () => { let j = null; try { j = JSON.parse(b); } catch (e) { /* not json */ } resolve({ status: res.statusCode, json: j, cookie: (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ") }); });
    });
    req.on("error", reject); if (data) req.write(data); req.end();
  });
}
async function owner(port) {
  const r = await call(port, "POST", "/api/auth/setup", { username: "boss", password: "Correct-Horse-1234" });
  assert.ok(r.status === 200, "setup: " + r.status + JSON.stringify(r.json));
  return r.cookie || (await call(port, "POST", "/api/auth/login", { username: "boss", password: "Correct-Horse-1234" })).cookie;
}
const SUB = { endpoint: "https://fcm.example/send/abc123", keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } };

test("push routes need a signed-in user", async () => {
  const s = await start();
  try { assert.strictEqual((await call(s.port, "GET", "/api/push/config")).status, 401); } finally { cleanup(s); }
});

test("config, subscribe, preferences, unsubscribe", async () => {
  const s = await start();
  try {
    const c = await owner(s.port);
    const cfg = await call(s.port, "GET", "/api/push/config", null, c);
    assert.strictEqual(cfg.json.enabled, true); assert.ok(cfg.json.publicKey.length > 60);
    assert.deepStrictEqual(cfg.json.prefs, { assigned: true, due: true, alarm: true, request: true });
    assert.strictEqual((await call(s.port, "POST", "/api/push/subscribe", { subscription: { endpoint: "http://insecure.example/x", keys: SUB.keys } }, c)).status, 400);
    assert.strictEqual((await call(s.port, "POST", "/api/push/subscribe", { subscription: SUB }, c)).status, 200);
    assert.strictEqual((await call(s.port, "POST", "/api/push/subscribe", { subscription: SUB }, c)).status, 200); // same device again
    assert.strictEqual((await call(s.port, "GET", "/api/push/config", null, c)).json.devices.length, 1);
    const p = await call(s.port, "PUT", "/api/push/prefs", { alarm: false }, c);
    assert.strictEqual(p.json.prefs.alarm, false); assert.strictEqual(p.json.prefs.assigned, true);
    assert.strictEqual((await call(s.port, "POST", "/api/push/unsubscribe", { endpoint: SUB.endpoint }, c)).status, 200);
    assert.strictEqual((await call(s.port, "GET", "/api/push/config", null, c)).json.devices.length, 0);
    assert.strictEqual((await call(s.port, "POST", "/api/push/test", {}, c)).status, 400); // no device yet
  } finally { cleanup(s); }
});

test("PUSH_ENABLED=false turns it off", async () => {
  const s = await start({ PUSH_ENABLED: "false" });
  try {
    const c = await owner(s.port);
    const cfg = await call(s.port, "GET", "/api/push/config", null, c);
    assert.strictEqual(cfg.json.enabled, false); assert.strictEqual(cfg.json.publicKey, "");
    assert.strictEqual((await call(s.port, "POST", "/api/push/subscribe", { subscription: SUB }, c)).status, 400);
  } finally { cleanup(s); }
});
