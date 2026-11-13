// The in-app Back button layer (frontend/src/backNav.js) against a minimal fake browser history.
const test = require("node:test");
const assert = require("node:assert");

function fakeWindow() {
  const entries = [{ state: { me: "nav", tab: "dashboard" } }]; let i = 0; const ls = [];
  const w = {
    history: {
      pushState(state) { entries.splice(i + 1); entries.push({ state }); i++; },
      replaceState(state) { entries[i] = { state }; },
      back() { if (i > 0) { i--; setTimeout(() => ls.forEach((f) => f({ state: entries[i].state })), 0); } },
      get state() { return entries[i].state; },
    },
    addEventListener(t, f) { if (t === "popstate") ls.push(f); },
    pressBack() { w.history.back(); },
  };
  return w;
}
const tick = () => new Promise((r) => setTimeout(r, 10));

test("Back closes the top pop-up first, then restores the previous screen", async () => {
  global.window = fakeWindow();
  const nav = await import("../../frontend/src/backNav.js");
  const seen = [];
  nav.setNavHandler((st) => seen.push(st.tab));
  nav.pushNav({ tab: "orders" });
  let closed = 0; nav.pushLayer(() => closed++);
  window.pressBack(); await tick();
  assert.strictEqual(closed, 1); assert.deepStrictEqual(seen, []);       // pop-up closed, screen unchanged
  window.pressBack(); await tick();
  assert.deepStrictEqual(seen, ["dashboard"]);                           // then the screen before
});

test("closing a pop-up in the page removes its history entry without a screen change", async () => {
  global.window = fakeWindow();
  const nav = await import("../../frontend/src/backNav.js?b");
  const seen = []; nav.setNavHandler((st) => seen.push(st.tab));
  nav.pushNav({ tab: "assets" });
  const unpush = nav.pushLayer(() => {});
  unpush(); await tick();
  assert.deepStrictEqual(seen, []); assert.strictEqual(window.history.state.tab, "assets");
  assert.strictEqual(nav._layerCount(), 0);
});
