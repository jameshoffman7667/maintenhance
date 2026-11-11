// The ONLY module that talks to an AI model (app spec v1.10, section 14).
// Everything else calls ai.call({ task, ... }) with a task name and a prompt file.
//
// Configuration (environment):
//   AI_ENABLED          "false" turns every AI feature off. Unset: on when a provider is configured.
//   AI_BASE_URL         OpenAI-compatible base URL (for example http://ollama:11434/v1). Chat Completions API.
//   AI_API_KEY          key for that endpoint (optional for local servers).
//   AI_MODEL            model name for the endpoint (required with AI_BASE_URL).
//   AI_MODEL_<TASK>     optional per-task model, e.g. AI_MODEL_PAGE_PREFILL.
//   AI_TIMEOUT_MS       per-attempt timeout (default 60000; page prefill defaults to 15000).
//   AI_MAX_CONCURRENCY  calls in flight at once (default 2).
//   AI_JSON_MODE        "false" omits response_format (for servers that reject it).
// Legacy fallback (kept so existing installs keep working): with no AI_BASE_URL, GEMINI_API_KEY and
// GEMINI_MODEL select Google's native Gemini API.
// Each call logs ONE line, never the prompt or the reply:
//   ai_call task=<name> model=<model> ok=<bool> ms=<n> tokens_in=<n> tokens_out=<n>
const userError = (m) => Object.assign(new Error(m), { userFacing: true });
const env = (k) => String(process.env[k] || "").trim();
const flagOff = (v) => /^(false|0|no|off)$/i.test(v);

const TASKS = ["page_prefill", "build", "build_many", "refine", "email_draft"];
const GEMINI_BASE = () => env("GEMINI_BASE_URL") || "https://generativelanguage.googleapis.com/v1beta";

function provider() {
  if (flagOff(env("AI_ENABLED"))) return null;
  if (env("AI_BASE_URL")) return env("AI_MODEL") || Object.keys(process.env).some((k) => k.startsWith("AI_MODEL_") && env(k)) ? "openai" : null;
  if (env("GEMINI_API_KEY")) return "gemini";
  return null;
}
function available() { return !!provider(); }
function modelFor(task, p = provider()) {
  const t = env("AI_MODEL_" + String(task).toUpperCase());
  if (t) return t;
  if (env("AI_MODEL")) return env("AI_MODEL");
  return p === "gemini" ? env("GEMINI_MODEL") || "gemini-2.5-flash" : "";
}
function status() {
  const p = provider();
  return { available: !!p, provider: p || "none", enabled: !flagOff(env("AI_ENABLED")), model: p ? modelFor("build", p) : "" };
}

/* ---- concurrency cap ---- */
let active = 0; const waiting = [];
async function acquire() {
  const max = Math.max(1, parseInt(env("AI_MAX_CONCURRENCY"), 10) || 2);
  if (active < max) { active++; return; }
  await new Promise((r) => waiting.push(r));
}
function release() { const n = waiting.shift(); if (n) n(); else active--; }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const retryable = (status) => status === 429 || status >= 500;

/* ---- providers ---- */
// `parts` are { text } and/or { inlineData: { mimeType, data } }.
function openaiContent(parts) {
  return parts.map((p) => {
    if (p.text != null) return { type: "text", text: p.text };
    const m = p.inlineData.mimeType, d = p.inlineData.data;
    if (m === "application/pdf") return { type: "file", file: { filename: "attachment.pdf", file_data: `data:${m};base64,${d}` } };
    return { type: "image_url", image_url: { url: `data:${m};base64,${d}` } };
  });
}

async function once(p, model, parts, o, timeoutMs) {
  const signal = AbortSignal.timeout(timeoutMs);
  if (p === "gemini") {
    const res = await fetch(`${GEMINI_BASE()}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY") },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: o.temperature, maxOutputTokens: o.maxTokens } }),
      signal,
    });
    if (!res.ok) { const e = new Error("status " + res.status); e.status = res.status; throw e; }
    const b = await res.json();
    const rp = b && b.candidates && b.candidates[0] && b.candidates[0].content && b.candidates[0].content.parts;
    return { text: rp ? rp.map((x) => x.text || "").join("") : "", inTok: (b.usageMetadata || {}).promptTokenCount || 0, outTok: (b.usageMetadata || {}).candidatesTokenCount || 0 };
  }
  const headers = { "Content-Type": "application/json" };
  if (env("AI_API_KEY")) headers.Authorization = "Bearer " + env("AI_API_KEY");
  const body = { model, temperature: o.temperature, max_tokens: o.maxTokens, messages: [{ role: "user", content: openaiContent(parts) }] };
  if (!flagOff(env("AI_JSON_MODE"))) body.response_format = { type: "json_object" };
  const res = await fetch(env("AI_BASE_URL").replace(/\/+$/, "") + "/chat/completions", { method: "POST", headers, body: JSON.stringify(body), signal });
  if (!res.ok) { const e = new Error("status " + res.status); e.status = res.status; throw e; }
  const b = await res.json();
  const msg = b && b.choices && b.choices[0] && b.choices[0].message;
  return { text: (msg && msg.content) || "", inTok: (b.usage || {}).prompt_tokens || 0, outTok: (b.usage || {}).completion_tokens || 0 };
}

function parseJson(raw) {
  let s = String(raw || "").trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) s = fence[1];
  return JSON.parse(s);
}

// ai.call({ task, parts | prompt, extraParts, maxTokens, temperature, timeoutMs, validate })
// Returns the parsed JSON (validated). Throws a userFacing error on any failure.
async function call(opts) {
  const task = opts.task;
  if (!TASKS.includes(task)) throw new Error("Unknown AI task: " + task);
  const p = provider();
  if (!p) throw userError("The AI features aren't set up on this server. An administrator can set AI_BASE_URL, AI_API_KEY and AI_MODEL (or GEMINI_API_KEY).");
  const model = modelFor(task, p);
  const parts = opts.parts || [{ text: opts.prompt }, ...(opts.extraParts || [])];
  const o = { temperature: opts.temperature == null ? 0.3 : opts.temperature, maxTokens: opts.maxTokens || 8192 };
  const timeoutMs = parseInt(env("AI_TIMEOUT_MS"), 10) || opts.timeoutMs || 60000;
  const base = parseInt(env("AI_RETRY_BASE_MS"), 10); const backoff = Number.isFinite(base) ? base : 600;
  const t0 = Date.now(); let inTok = 0, outTok = 0, ok = false, failure = null;
  await acquire();
  try {
    let out;
    for (let attempt = 0; ; attempt++) {
      try { out = await once(p, model, parts, o, timeoutMs); break; }
      catch (e) {
        const again = attempt < 2 && (e.status ? retryable(e.status) : true);
        if (!again) { failure = e; throw userError(e.status ? `The AI service answered with an error (${e.status}). Try again in a moment.` : "The AI service didn't answer in time. Try again in a moment."); }
        await sleep(backoff * 2 ** attempt);
      }
    }
    inTok = out.inTok; outTok = out.outTok;
    let parsed;
    try { parsed = parseJson(out.text); if (opts.validate) parsed = opts.validate(parsed); }
    catch (e) { throw userError("The AI reply couldn't be read. Try again, perhaps with more detail."); }
    ok = true;
    return parsed;
  } finally {
    release();
    console.log(`ai_call task=${task} model=${model} ok=${ok} ms=${Date.now() - t0} tokens_in=${inTok} tokens_out=${outTok}`);
  }
}

module.exports = { call, available, status, provider, modelFor, TASKS, userError };
