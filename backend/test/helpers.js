// Starts the real server in a child process on a temporary data folder.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");

const SERVER = path.join(__dirname, "..", "server.js");

function freePort() {
  return new Promise((resolve, reject) => {
    const s = require("net").createServer();
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on("error", reject);
  });
}

function get(port, p, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: p, headers }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
  });
}

async function start(env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "me-test-"));
  const port = await freePort();
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dir, FILES_DIR: dir, JWT_SECRET: "test-secret-0123456789abcdef", NODE_ENV: "production", BACKUP_SNAPSHOTS: "false", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const exited = new Promise((r) => child.on("exit", (code, sig) => r({ code, sig })));
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    try { const r = await get(port, "/healthz"); if (r.status) break; } catch (e) { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  return { child, port, dir, exited, log: () => log };
}

function cleanup(srv) {
  try { srv.child.kill("SIGKILL"); } catch (e) { /* gone */ }
  fs.rmSync(srv.dir, { recursive: true, force: true });
}

module.exports = { start, get, cleanup, freePort };
