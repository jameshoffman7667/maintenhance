const test = require("node:test");
const assert = require("node:assert");

test("changelog reader understands both entry formats", () => {
  const cl = require("../changelog");
  const all = cl.entries();
  const cur = all.find((e) => e.version === require("../package.json").version);
  assert.ok(cur && cur.title && cur.text, "current entry has a title and text");
  const old = all.find((e) => e.version === "2.7.0") || all[all.length - 1];
  assert.ok(old.title || old.text);
  const v281 = all.find((e) => e.version === "2.8.1");
  assert.ok(v281 && v281.title.startsWith("Release on push"), "Short line used as the title");
});
