// Tests for the provider-agnostic AI wrapper, against a mock provider (no real model, no real data).
const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const fs = require("fs");
const path = require("path");

const FIX = path.join(__dirname, "fixtures", "ai");
const fixtures = fs.readdirSync(FIX).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(FIX, f), "utf8")));

let server, base, mode = "ok", seen = [], reply = "{}", inflight = 0, maxInflight = 0, failures = 0;
test.before(async () => {
  server = http.createServer((req, res) => {
    let body = ""; req.on("data", (d) => (body += d));
    req.on("end", async () => {
      seen.push({ url: req.url, auth: req.headers.authorization, key: req.headers["x-goog-api-key"], body: body ? JSON.parse(body) : null });
      inflight++; maxInflight = Math.max(maxInflight, inflight);
      if (mode === "slow") await new Promise((r) => setTimeout(r, 120));
      inflight--;
      if (mode === "flaky" && failures > 0) { failures--; res.statusCode = 503; return res.end("no"); }
      if (mode === "down") { res.statusCode = 500; return res.end("no"); }
      if (mode === "badauth") { res.statusCode = 401; return res.end("no"); }
      res.setHeader("Content-Type", "application/json");
      if (req.url.includes(":generateContent")) res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: reply }] } }], usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7 } }));
      else res.end(JSON.stringify({ choices: [{ message: { content: reply } }], usage: { prompt_tokens: 21, completion_tokens: 9 } }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = "http://127.0.0.1:" + server.address().port;
});
test.after(() => server.close());

const KEYS = ["AI_ENABLED", "AI_BASE_URL", "AI_API_KEY", "AI_MODEL", "AI_TIMEOUT_MS", "AI_MAX_CONCURRENCY", "AI_JSON_MODE", "AI_RETRY_BASE_MS", "GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_BASE_URL"];
test.beforeEach(() => { for (const k of Object.keys(process.env)) if (KEYS.includes(k) || k.startsWith("AI_MODEL_")) delete process.env[k]; seen = []; mode = "ok"; process.env.AI_RETRY_BASE_MS = "1"; });
const openai = () => Object.assign(process.env, { AI_BASE_URL: base + "/v1", AI_API_KEY: "k-test", AI_MODEL: "local-model" });
const gemini = () => Object.assign(process.env, { GEMINI_API_KEY: "g-test", GEMINI_BASE_URL: base + "/v1beta" });
const ai = () => require("../ai");

async function logs(fn) {
  const lines = []; const orig = console.log; console.log = (...a) => lines.push(a.join(" "));
  try { return { out: await fn(), lines }; } catch (e) { return { err: e, lines }; } finally { console.log = orig; }
}

test("off when nothing is configured, and when AI_ENABLED=false", async () => {
  assert.equal(ai().available(), false);
  openai(); assert.equal(ai().available(), true);
  process.env.AI_ENABLED = "false"; assert.equal(ai().available(), false);
  await assert.rejects(ai().call({ task: "build", prompt: "x" }), /aren't set up/);
});

test("AI_BASE_URL needs a model; GEMINI_API_KEY alone selects native Gemini", () => {
  process.env.AI_BASE_URL = base; assert.equal(ai().available(), false);
  process.env.AI_MODEL = "m"; assert.equal(ai().status().provider, "openai");
  delete process.env.AI_BASE_URL; delete process.env.AI_MODEL;
  process.env.GEMINI_API_KEY = "x"; assert.equal(ai().status().provider, "gemini");
  assert.equal(ai().modelFor("build"), "gemini-2.5-flash");
  process.env.GEMINI_MODEL = "gemini-x"; assert.equal(ai().modelFor("build"), "gemini-x");
});

test("per-task model overrides AI_MODEL", () => {
  openai(); process.env.AI_MODEL_PAGE_PREFILL = "small-model";
  assert.equal(ai().modelFor("page_prefill"), "small-model");
  assert.equal(ai().modelFor("build"), "local-model");
});

for (const fx of fixtures) {
  test(`fixture ${fx.task} works through an OpenAI-compatible endpoint and through native Gemini`, async () => {
    const aibuild = require("../aibuild");
    const run = async () => {
      reply = fx.reply;
      if (fx.task === "page_prefill") {
        const ai2 = ai();
        const j = await ai2.call({ task: "page_prefill", prompt: "p", validate: (v) => v });
        return j;
      }
      if (fx.task === "build" || fx.task === "email_draft") return (await aibuild.build(fx.kind, fx.prompt, "", [], fx.task)).draft;
      if (fx.task === "build_many") return (await aibuild.buildMany(fx.kind, fx.prompt, "", [])).items;
      return (await aibuild.refine(fx.kind, fx.item, fx.answers, "")).item;
    };
    for (const setup of [openai, gemini]) {
      for (const k of KEYS) delete process.env[k];
      setup(); seen = [];
      const { out, lines } = await logs(run);
      if (fx.expect.count) assert.equal(out.length, fx.expect.count);
      else for (const [k, v] of Object.entries(fx.expect)) assert.equal(out[k], v);
      assert.equal(lines.filter((l) => l.startsWith("ai_call ")).length, 1);
      assert.match(lines.find((l) => l.startsWith("ai_call ")), new RegExp(`^ai_call task=${fx.task} model=\\S+ ok=true ms=\\d+ tokens_in=\\d+ tokens_out=\\d+$`));
    }
  });
}

test("OpenAI request shape: bearer key, model, JSON mode, image and PDF parts", async () => {
  openai(); reply = '{"a":1}';
  await ai().call({ task: "build", parts: [{ text: "hi" }, { inlineData: { mimeType: "image/png", data: "AAAA" } }, { inlineData: { mimeType: "application/pdf", data: "BBBB" } }] });
  const r = seen[0];
  assert.equal(r.url, "/v1/chat/completions"); assert.equal(r.auth, "Bearer k-test");
  assert.equal(r.body.model, "local-model"); assert.deepEqual(r.body.response_format, { type: "json_object" });
  const c = r.body.messages[0].content;
  assert.equal(c[0].type, "text"); assert.match(c[1].image_url.url, /^data:image\/png;base64,AAAA/); assert.equal(c[2].type, "file");
  process.env.AI_JSON_MODE = "false"; seen = [];
  await ai().call({ task: "build", prompt: "x" }); assert.equal(seen[0].body.response_format, undefined);
});

test("the log line has no prompt or reply, and reports tokens", async () => {
  openai(); reply = '{"secret_reply":"zzz"}';
  const { lines } = await logs(() => ai().call({ task: "refine", prompt: "my private prompt text" }));
  const l = lines.join("\n");
  assert.match(l, /tokens_in=21 tokens_out=9/); assert.ok(!/private|zzz/.test(l));
});

test("retries 503 with backoff, then succeeds; gives up after 3 attempts", async () => {
  openai(); reply = '{"ok":true}'; mode = "flaky"; failures = 2;
  assert.deepEqual(await ai().call({ task: "build", prompt: "x" }), { ok: true }); assert.equal(seen.length, 3);
  seen = []; mode = "down";
  const r = await logs(() => ai().call({ task: "build", prompt: "x" }));
  assert.match(r.err.message, /error \(500\)/); assert.equal(seen.length, 3);
  assert.match(r.lines[0], /ok=false/);
});

test("does not retry a 401", async () => {
  openai(); mode = "badauth";
  await assert.rejects(ai().call({ task: "build", prompt: "x" }), /error \(401\)/); assert.equal(seen.length, 1);
});

test("times out and retries, then reports a friendly error", async () => {
  openai(); mode = "slow"; process.env.AI_TIMEOUT_MS = "30";
  await assert.rejects(ai().call({ task: "build", prompt: "x" }), /didn't answer in time/);
});

test("bad JSON and failed validation are friendly errors", async () => {
  openai(); reply = "not json";
  await assert.rejects(ai().call({ task: "build", prompt: "x" }), /couldn't be read/);
  reply = '{"a":1}';
  await assert.rejects(ai().call({ task: "build", prompt: "x", validate: () => { throw new Error("bad"); } }), /couldn't be read/);
});

test("concurrency cap", async () => {
  await new Promise((r) => setTimeout(r, 300)); // let requests left over from the timeout test finish
  openai(); reply = '{"a":1}'; mode = "slow"; process.env.AI_MAX_CONCURRENCY = "2"; maxInflight = 0;
  await Promise.all([1, 2, 3, 4, 5].map(() => ai().call({ task: "build", prompt: "x" })));
  assert.equal(maxInflight, 2);
});

test("unknown task is refused", async () => {
  openai(); await assert.rejects(ai().call({ task: "nope", prompt: "x" }), /Unknown AI task/);
});
