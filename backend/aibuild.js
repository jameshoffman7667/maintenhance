// v2.7: "Build with AI". The user describes what they want (and may paste links);
// the AI model returns a structured DRAFT that the browser shows for review. Nothing is
// saved here. All model access goes through ai.js (provider-agnostic, v2.11).
const prefill = require("./prefill");
const ai = require("./ai");
const P = {
  build: require("./prompts/build.v1"), buildMany: require("./prompts/build-many.v1"),
  refine: require("./prompts/refine.v1"),
};

const userError = (m) => Object.assign(new Error(m), { userFacing: true });
const NEEDS_AI = "The AI builder isn't set up on this server (an administrator sets AI_BASE_URL, AI_API_KEY and AI_MODEL, or GEMINI_API_KEY)";

const SHAPES = {
  workOrder: {
    what: "a single work order (a job to be done) for a home or small facility",
    shape: `{"title": string, "type": "Corrective"|"Unplanned"|"Benchmark"|"PM", "priority": "High"|"Medium"|"Low", "description": string (what, why, steps, safety notes), "locationId": string|null (one of the supplied location ids), "assetId": string|null (one of the supplied asset ids), "requiredByDate": "YYYY-MM-DD"|null, "estHours": number|null (hours per person), "crewRequired": number|null, "failureCode": "Wear"|"Leak"|"Electrical"|"Mechanical"|"User Error"|"Install Defect"|"Unknown"|"Other"|null, "rootCause": string|null}`,
  },
  workRequest: {
    what: "a single work request (someone asking for maintenance to be looked at)",
    shape: `{"title": string, "description": string, "priority": "High"|"Medium"|"Low", "locationId": string|null (one of the supplied location ids), "assetId": string|null (one of the supplied asset ids), "requiredByDate": "YYYY-MM-DD"|null, "suggestedType": "Corrective"|"PM"|"Benchmark"}`,
  },
  asset: {
    what: "a piece of equipment (an asset) with its details and a suggested bill of materials",
    shape: `{"name": string, "category": string (e.g. HVAC, Plumbing, Appliance, Vehicle, Grounds), "manufacturer": string|null, "model": string|null, "serial": string|null, "isMajor": boolean, "notes": string|null, "manualUrl": string|null, "locationId": string|null (one of the supplied location ids), "bom": [{"name": string, "level": "Component"|"Sub-component"|"Part", "parent": number|null (index of the parent entry in this same list; null for top level), "manufacturer": string|null, "model": string|null, "notes": string|null}]}`,
  },
  bom: {
    what: "a suggested bill of materials (components, sub-components and parts) for one asset",
    shape: `{"nodes": [{"name": string, "level": "Component"|"Sub-component"|"Part", "parent": number|null (index of the parent entry in this same list; null for top level; a Part's parent is a Component or Sub-component), "manufacturer": string|null, "model": string|null, "notes": string|null}]}`,
  },
  vendor: {
    what: "a vendor (a contractor, supplier or service company)",
    shape: `{"name": string, "specialty": string|null, "contact": string|null (phone/email/address only if stated), "link": string|null, "notes": string|null}`,
  },
  part: {
    what: "a spare or replacement part for the parts catalogue",
    shape: `{"name": string, "description": string|null, "manufacturer": string|null, "manufacturerPartNumber": string|null, "cost": number|null, "link": string|null}`,
  },
  location: {
    what: "a location structure (a tree of places such as property, building, floor, room, area)",
    shape: `{"nodes": [{"name": string, "parent": number|null (index of the parent entry in this same list; null attaches to the place the user chose)}]}. Parents must appear before their children. At most 60 nodes.`,
  },
  pmProgram: {
    what: "a preventive maintenance (PM) program: several recurring PM Bases",
    shape: `{"items": [{"title": string, "description": string (what to inspect or do), "frequencyValue": number, "frequencyUnit": "days"|"weeks"|"months"|"years", "assetId": string|null (one of the supplied asset ids), "locationId": string|null (one of the supplied location ids), "estHours": number|null, "crewRequired": number|null}]}. At most 25 items.`,
  },
  pmTemplate: {
    what: "new starter-catalogue PM templates for the PM setup wizard",
    shape: `{"items": [{"type": string (e.g. Home or Facilities), "category": string (e.g. HVAC & Heating, Plumbing & Water), "title": string, "description": string, "frequencyValue": number, "frequencyUnit": "days"|"weeks"|"months"|"years", "crewRequired": number|null, "estHours": number|null}]}. At most 25 items.`,
  },
};

const URL_RE = /https?:\/\/[^\s<>"')]+/gi;

async function linkText(prompt) {
  const urls = [...new Set((prompt.match(URL_RE) || []).map((u) => u.replace(/[.,;]+$/, "")))].slice(0, 3);
  const out = [];
  for (const u of urls) {
    try {
      const { html, finalUrl } = await prefill.fetchPage(u);
      out.push(`LINK ${finalUrl}:\n${prefill.visibleText(html, 6000)}`);
    } catch (e) {
      out.push(`LINK ${u}: (could not be read)`);
    }
  }
  return out.join("\n\n");
}


async function build(kind, prompt, context, extraParts, task) {
  const spec = SHAPES[kind];
  if (!spec) throw userError("Unknown kind of item to build");
  if (!ai.available()) throw userError(NEEDS_AI);
  const text = String(prompt || "").trim().slice(0, 6000);
  if (!text) throw userError("Describe what you want first");
  const links = await linkText(text);
  const ctx = String(context || "").slice(0, 12000);
  const today = new Date().toISOString().slice(0, 10);
  const full = P.build.render({ spec, text, ctx, links, today });
  let draft = await ai.call({ task: task || "build", parts: [{ text: full }, ...(extraParts || [])], temperature: P.build.temperature, validate: (v) => (v && typeof v === "object" ? v : (() => { throw new Error("shape"); })()) });
  if (Array.isArray(draft)) draft = kind === "location" || kind === "bom" ? { nodes: draft } : { items: draft };
  return { draft, usedLinks: !!links };
}

/* ---- v2.9: lists, attachments and clarifying questions ---- */
// Kinds that can be created several at a time from a list.
const MANY_KINDS = ["workRequest", "workOrder", "asset", "vendor", "part"];
const FILE_TYPES = ["text/plain", "text/csv", "text/markdown", "application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_FILES = 3;
const MAX_FILE_BYTES = 4 * 1024 * 1024;

// Validates uploaded files and turns them into model parts. Text-like files are
// inlined as text; PDFs and images are sent as inline data.
function filesToParts(files) {
  const list = Array.isArray(files) ? files : [];
  if (list.length > MAX_FILES) throw userError(`Attach at most ${MAX_FILES} files`);
  const parts = []; let text = "";
  for (const f of list) {
    const mime = String((f && f.mime) || "").toLowerCase();
    if (!FILE_TYPES.includes(mime)) throw userError("Attachments can be text, CSV, PDF or image (PNG, JPEG, WebP) files");
    const b64 = String((f && f.data) || "");
    const bytes = Buffer.from(b64, "base64");
    if (!bytes.length) throw userError("An attachment was empty");
    if (bytes.length > MAX_FILE_BYTES) throw userError("Each attachment must be 4 MB or smaller");
    if (mime.startsWith("text/")) text += `\nATTACHED FILE ${String(f.name || "").slice(0, 80)}:\n${bytes.toString("utf8").slice(0, 20000)}\n`;
    else parts.push({ inlineData: { mimeType: mime, data: bytes.toString("base64") } });
  }
  return { parts, text };
}

async function buildMany(kind, prompt, context, files) {
  const spec = SHAPES[kind];
  if (!spec || !MANY_KINDS.includes(kind)) throw userError("That kind of item can't be built from a list");
  if (!ai.available()) throw userError(NEEDS_AI);
  const text = String(prompt || "").trim().slice(0, 12000);
  const att = filesToParts(files);
  if (!text && !att.parts.length && !att.text) throw userError("Paste a list or attach a file first");
  const links = await linkText(text);
  const ctx = String(context || "").slice(0, 12000);
  const today = new Date().toISOString().slice(0, 10);
  const full = P.buildMany.render({ spec, text, attText: att.text, ctx, links, today });
  let out = await ai.call({ task: "build_many", parts: [{ text: full }, ...att.parts], temperature: P.buildMany.temperature, validate: (v) => (v && typeof v === "object" ? v : (() => { throw new Error("shape"); })()) });
  if (Array.isArray(out)) out = { items: out };
  const items = Array.isArray(out && out.items) ? out.items.slice(0, 25) : [];
  return { items: items.map(cleanItem), usedLinks: !!links };
}

// Keeps clarifications well-formed (the browser also validates everything).
function cleanItem(item) {
  const it = item && typeof item === "object" ? item : {};
  const qs = Array.isArray(it.clarifications) ? it.clarifications : [];
  it.clarifications = qs.slice(0, 3).map((q, i) => {
    const type = q && q.type === "choice" && Array.isArray(q.options) && q.options.length >= 2 ? "choice" : "text";
    return {
      id: String((q && q.id) || "q" + (i + 1)).slice(0, 40),
      question: String((q && q.question) || "").slice(0, 300),
      type,
      options: type === "choice" ? q.options.slice(0, 5).map((o) => String(o).slice(0, 80)) : [],
    };
  }).filter((q) => q.question);
  return it;
}

// Re-drafts ONE item using the person's answers to its clarifying questions.
async function refine(kind, item, answers, context) {
  const spec = SHAPES[kind];
  if (!spec || !MANY_KINDS.includes(kind)) throw userError("That kind of item can't be refined");
  if (!ai.available()) throw userError(NEEDS_AI);
  const qa = (Array.isArray(answers) ? answers : []).slice(0, 5)
    .map((a) => `Q: ${String((a && a.question) || "").slice(0, 300)}\nA: ${String((a && a.answer) || "").slice(0, 500)}`).join("\n\n");
  if (!qa) throw userError("Answer at least one question first");
  const ctx = String(context || "").slice(0, 12000);
  const today = new Date().toISOString().slice(0, 10);
  const full = P.refine.render({ spec, item: JSON.stringify(item || {}).slice(0, 6000), qa, ctx, today });
  const out = await ai.call({ task: "refine", parts: [{ text: full }], temperature: P.refine.temperature, validate: (v) => (v && typeof v === "object" ? v : (() => { throw new Error("shape"); })()) });
  return { item: cleanItem(Array.isArray(out) ? out[0] : out) };
}

module.exports = { build, buildMany, refine, filesToParts, userError, SHAPES, MANY_KINDS, KINDS: Object.keys(SHAPES) };
