// Web Push notifications (v2.12). Works in the browser, the installed web app and the Android app.
// - VAPID keys: env VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY, or generated once and kept in app_settings.
// - Each device subscribes itself (Settings -> Push notifications). Each person picks which events they get.
// - Events: assigned (a work order is assigned to you), due (one of yours is due within a day or overdue),
//   alarm (an alarm is raised; Owners and Managers), request (a new work request; Owners and Managers).
// - A push carries only a short title and text. Nothing about a notification is logged except one count line.
// - PUSH_ENABLED=false turns it all off. Failures never affect saving data.
const webpush = require("web-push");
const db = require("./db");

const EVENTS = { assigned: "push_assigned", due: "push_due", alarm: "push_alarm", request: "push_request" };
const enabled = () => !/^(false|0|no|off)$/i.test(String(process.env.PUSH_ENABLED || ""));

const getSetting = (k) => { const r = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(k); return r ? r.value : null; };
const setSetting = (k, v) => db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(k, v);

let keys = null;
function vapidKeys() {
  if (keys) return keys;
  const envPub = (process.env.VAPID_PUBLIC_KEY || "").trim(), envPriv = (process.env.VAPID_PRIVATE_KEY || "").trim();
  if (envPub && envPriv) keys = { publicKey: envPub, privateKey: envPriv };
  else {
    const pub = getSetting("vapid_public"), priv = getSetting("vapid_private");
    if (pub && priv) keys = { publicKey: pub, privateKey: priv };
    else { keys = webpush.generateVAPIDKeys(); setSetting("vapid_public", keys.publicKey); setSetting("vapid_private", keys.privateKey); }
  }
  return keys;
}
function subject() {
  const s = (process.env.VAPID_SUBJECT || "").trim();
  if (s) return s;
  const app = (process.env.APP_URL || "").trim();
  return /^https:\/\//.test(app) ? app : "mailto:admin@example.com";
}
function publicKey() { return enabled() ? vapidKeys().publicKey : ""; }

// The sender is replaceable so tests never touch the network.
let sender = (sub, payload) => {
  const k = vapidKeys();
  return webpush.sendNotification(sub, payload, { TTL: 86400, timeout: 8000, vapidDetails: { subject: subject(), publicKey: k.publicKey, privateKey: k.privateKey } });
};
function setSender(fn) { sender = fn || sender; }

function wants(userId, event) {
  const col = EVENTS[event];
  const u = db.prepare(`SELECT ${col} AS on_ FROM users WHERE id = ?`).get(userId);
  return !!(u && u.on_);
}
// Sends one notification to every device of each listed user who has this event switched on.
async function notify(userIds, event, payload) {
  if (!enabled() || !EVENTS[event]) return 0;
  let sent = 0, gone = 0, failed = 0;
  const body = JSON.stringify({ title: String(payload.title || "").slice(0, 80), body: String(payload.body || "").slice(0, 160), tag: payload.tag || event, url: payload.url || "" });
  for (const uid of [...new Set(userIds.map(String))]) {
    if (!wants(uid, event)) continue;
    for (const s of db.prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?").all(uid)) {
      try {
        await sender({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
        sent++; db.prepare("UPDATE push_subscriptions SET last_ok_at = ? WHERE id = ?").run(new Date().toISOString(), s.id);
      } catch (e) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) { db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(s.id); gone++; }
        else failed++;
      }
    }
  }
  if (sent || gone || failed) console.log(`push_sent event=${event} sent=${sent} expired=${gone} failed=${failed}`);
  return sent;
}
function fire(userIds, event, payload) { notify(userIds, event, payload).catch(() => {}); }

/* ---- who gets what ---- */
const adminIds = () => db.prepare("SELECT id FROM users WHERE role IN ('Owner','Manager')").all().map((r) => r.id);
const execIds = (w) => [...new Set([...(w.executorIds || []), w.executorId].filter(Boolean).map(String))];
const isOpenWo = (w) => w && w.type !== "PM Base" && (w.status === "Active" || w.status === "Scheduled");

// Compares the data before and after a save and pushes what is new. `actorId` (the person who saved) is skipped.
function diffAndNotify(oldData, newData, actorId) {
  if (!enabled() || !newData || !Array.isArray(newData.workOrders)) return;
  const actor = String(actorId);
  const oldWos = new Map(((oldData && oldData.workOrders) || []).map((w) => [w.id, w]));
  for (const w of newData.workOrders) {
    if (!isOpenWo(w)) continue;
    const before = new Set(oldWos.has(w.id) ? execIds(oldWos.get(w.id)) : []);
    const fresh = execIds(w).filter((id) => !before.has(id) && id !== actor);
    if (fresh.length) fire(fresh, "assigned", { title: "Assigned to you", body: `#${w.number} ${w.title}`, tag: `wo-${w.id}`, url: `#open/wo/${w.id}` });
  }
  const oldReq = new Set(((oldData && oldData.workRequests) || []).map((r) => r.id));
  const newReqs = (newData.workRequests || []).filter((r) => !oldReq.has(r.id));
  if (newReqs.length && oldData) {
    const to = adminIds().filter((id) => String(id) !== actor);
    for (const r of newReqs.slice(0, 3)) fire(to, "request", { title: "New work request", body: String(r.title || r.description || "A new request was submitted"), tag: `req-${r.id}`, url: `#open/req/${r.id}` });
  }
}
function notifyAlarm(alarm) {
  fire(adminIds(), "alarm", { title: alarm.severity === "critical" ? "Critical alarm" : "Alarm", body: String(alarm.message || "An alarm was raised"), tag: `alarm-${alarm.id}`, url: "#open/alarms" });
}

/* ---- due / overdue sweep: each work order tells each assignee once per state ---- */
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
async function dueSweep(now = new Date(), data = null) {
  if (!enabled()) return 0;
  const hour = now.getHours();
  if (hour < 7 || hour >= 21) return 0; // no pushes overnight
  if (!data) { const row = db.prepare("SELECT data FROM app_data WHERE id = 1").get(); if (!row) return 0; data = JSON.parse(row.data); }
  const today = iso(now), tomorrow = iso(new Date(now.getTime() + 86400000));
  let n = 0;
  for (const w of data.workOrders || []) {
    if (!isOpenWo(w)) continue;
    const day = w.scheduledDate || w.requiredByDate;
    if (!day) continue;
    const state = day < today ? "overdue" : day <= tomorrow ? "soon" : null;
    if (!state) continue;
    for (const uid of execIds(w)) {
      const key = `${state}:${w.id}:${uid}`;
      if (db.prepare("SELECT 1 FROM push_sent WHERE key = ?").get(key)) continue;
      db.prepare("INSERT OR IGNORE INTO push_sent (key, sent_at) VALUES (?, ?)").run(key, now.toISOString());
      n += await notify([uid], "due", { title: state === "overdue" ? "Overdue" : day === today ? "Due today" : "Due tomorrow", body: `#${w.number} ${w.title}`, tag: `due-${w.id}`, url: `#open/wo/${w.id}` });
    }
  }
  db.prepare("DELETE FROM push_sent WHERE sent_at < ?").run(new Date(now.getTime() - 90 * 86400000).toISOString());
  return n;
}
let timer = null;
function startSweep() {
  if (timer || !enabled()) return;
  timer = setInterval(() => { dueSweep().catch(() => {}); }, 5 * 60 * 1000);
  timer.unref();
}

module.exports = { EVENTS, enabled, publicKey, notify, fire, setSender, diffAndNotify, notifyAlarm, dueSweep, startSweep };
