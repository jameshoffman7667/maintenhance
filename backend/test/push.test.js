// Web Push (v2.12): subscriptions, preferences, who gets which event, the due sweep, encryption.
// Runs in-process on a temporary database with a fake sender (no network).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "me-push-"));
process.env.DATA_DIR = dir; process.env.FILES_DIR = dir; process.env.JWT_SECRET = "test-secret-0123456789abcdef"; process.env.NODE_ENV = "test";
const db = require("../db");
const push = require("../push");
test.after(() => { fs.rmSync(dir, { recursive: true, force: true }); });

const now = new Date().toISOString();
for (const [id, role] of [["o1", "Owner"], ["m1", "Manager"], ["e1", "Executor"], ["e2", "Executor"], ["g1", "Guest"]]) {
  db.prepare("INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?,?,?,?,?)").run(id, id, "x", role, now);
}
function sub(uid, n = 1) {
  const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
  db.prepare("INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at) VALUES (?,?,?,?,?)")
    .run(uid, `https://push.example/${uid}/${n}`, ecdh.getPublicKey("base64url"), crypto.randomBytes(16).toString("base64url"), now);
}
let sent = [];
function fake(failWith) { push.setSender(async (s, payload) => { if (failWith && failWith[s.endpoint]) { const e = new Error("x"); e.statusCode = failWith[s.endpoint]; throw e; } sent.push({ endpoint: s.endpoint, ...JSON.parse(payload) }); }); }
const wait = () => new Promise((r) => setTimeout(r, 30));
const wo = (id, extra = {}) => ({ id, number: 1, title: "Fix sink", type: "Corrective", status: "Active", executorIds: [], ...extra });
test.beforeEach(() => { sent = []; db.prepare("DELETE FROM push_subscriptions").run(); db.prepare("DELETE FROM push_sent").run(); db.prepare("UPDATE users SET push_assigned=1, push_due=1, push_alarm=1, push_request=1").run(); fake(); });

test("schema is at 11 with the push tables and per-user columns defaulting on", () => {
  assert.ok(db.prepare("SELECT version FROM schema_version").get().version >= 11);
  const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  for (const c of ["push_assigned", "push_due", "push_alarm", "push_request"]) assert.ok(cols.includes(c));
  assert.strictEqual(db.prepare("SELECT push_assigned FROM users WHERE id='e1'").get().push_assigned, 1);
});

test("VAPID keys are generated once and kept", () => {
  const k = push.publicKey();
  assert.ok(k.length > 60);
  assert.strictEqual(push.publicKey(), k);
  assert.strictEqual(db.prepare("SELECT value FROM app_settings WHERE key='vapid_public'").get().value, k);
});

test("a newly assigned executor is told, the person who assigned is not", async () => {
  sub("e1"); sub("o1");
  push.diffAndNotify({ workOrders: [wo("w1")] }, { workOrders: [wo("w1", { executorIds: ["e1", "o1"] })] }, "o1");
  await wait();
  assert.strictEqual(sent.length, 1);
  assert.ok(sent[0].endpoint.includes("/e1/")); assert.strictEqual(sent[0].title, "Assigned to you"); assert.match(sent[0].body, /#1 Fix sink/);
});

test("already-assigned people and closed work orders are not re-notified", async () => {
  sub("e1");
  push.diffAndNotify({ workOrders: [wo("w1", { executorIds: ["e1"] })] }, { workOrders: [wo("w1", { executorIds: ["e1"], title: "Renamed" })] }, "o1");
  push.diffAndNotify({ workOrders: [wo("w2")] }, { workOrders: [wo("w2", { executorIds: ["e1"], status: "Closed" })] }, "o1");
  await wait(); assert.strictEqual(sent.length, 0);
});

test("a new work request goes to Owners and Managers (not the sender, not Executors)", async () => {
  sub("o1"); sub("m1"); sub("e1");
  push.diffAndNotify({ workOrders: [], workRequests: [] }, { workOrders: [], workRequests: [{ id: "r1", title: "Leaky tap" }] }, "o1");
  await wait();
  assert.deepStrictEqual(sent.map((s) => s.endpoint.split("/")[3]), ["m1"]);
  assert.strictEqual(sent[0].title, "New work request");
});

test("alarms go to Owners and Managers", async () => {
  sub("o1"); sub("m1"); sub("e1");
  push.notifyAlarm({ id: "a1", message: "Sump pump high water", severity: "critical" });
  await wait();
  assert.deepStrictEqual(sent.map((s) => s.endpoint.split("/")[3]).sort(), ["m1", "o1"]);
  assert.strictEqual(sent[0].title, "Critical alarm");
});

test("a person who switched an event off does not get it", async () => {
  sub("e1"); db.prepare("UPDATE users SET push_assigned = 0 WHERE id='e1'").run();
  push.diffAndNotify({ workOrders: [wo("w1")] }, { workOrders: [wo("w1", { executorIds: ["e1"] })] }, "o1");
  await wait(); assert.strictEqual(sent.length, 0);
});

test("an expired subscription (410) is removed; other errors keep it", async () => {
  sub("e1", 1); sub("e1", 2);
  fake({ "https://push.example/e1/1": 410, "https://push.example/e1/2": 500 });
  const n = await push.notify(["e1"], "assigned", { title: "t", body: "b" });
  assert.strictEqual(n, 0);
  assert.strictEqual(db.prepare("SELECT COUNT(*) c FROM push_subscriptions").get().c, 1);
  assert.ok(db.prepare("SELECT endpoint FROM push_subscriptions").get().endpoint.endsWith("/2"));
});

test("due sweep: once per work order and state, none overnight, only open work orders", async () => {
  sub("e1");
  const data = { workOrders: [wo("w1", { executorIds: ["e1"], requiredByDate: "2026-11-12" }), wo("w2", { executorIds: ["e1"], requiredByDate: "2026-12-30" }), wo("w3", { executorIds: ["e1"], requiredByDate: "2026-11-01", status: "Completed" })] };
  const at = (h) => new Date(2026, 10, 13, h, 0, 0);
  assert.strictEqual(await push.dueSweep(at(3), data), 0);        // overnight
  assert.strictEqual(await push.dueSweep(at(9), data), 1);        // w1 is overdue
  assert.strictEqual(sent[0].title, "Overdue");
  assert.strictEqual(await push.dueSweep(at(10), data), 0);       // already told
  data.workOrders[1].requiredByDate = "2026-11-14";               // now due tomorrow
  assert.strictEqual(await push.dueSweep(at(11), data), 1);
  assert.strictEqual(sent[1].title, "Due tomorrow");
});

test("a real push request can be built and encrypted for a subscription", () => {
  const webpush = require("web-push");
  const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
  const k = webpush.generateVAPIDKeys();
  const d = webpush.generateRequestDetails({ endpoint: "https://push.example/abc", keys: { p256dh: ecdh.getPublicKey("base64url"), auth: crypto.randomBytes(16).toString("base64url") } },
    JSON.stringify({ title: "t", body: "b" }), { vapidDetails: { subject: "mailto:a@b.co", publicKey: k.publicKey, privateKey: k.privateKey }, TTL: 60 });
  assert.strictEqual(d.method, "POST"); assert.ok(d.headers.Authorization.startsWith("vapid ")); assert.ok(Buffer.isBuffer(d.body) && d.body.length > 20);
});
