// In-app Back button (v2.12). The app keeps its screen in memory, so the browser's Back button used to
// leave the app. This module records screens and open pop-ups in the browser history so Back (and
// Forward) move inside the app, in the browser, the installed web app and the Android app alike.
//  - A "layer" is a pop-up or drawer: opening one adds a history entry, Back closes the top one.
//  - A "nav" entry is a screen (tab and open work order): Back restores the previous one.
// With nothing left to go back to, Back behaves as usual (leaves the page or closes the app).
const layers = [];
let seq = 0;
let suppress = 0;
let navHandler = null;
let installed = false;

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("popstate", (e) => {
    if (suppress > 0) { suppress--; return; } // a Back we triggered ourselves after a pop-up was closed in the page
    if (layers.length) { const l = layers.pop(); l.close(); return; }
    const st = e.state;
    if (st && st.me === "nav" && navHandler) navHandler(st);
  });
}

// Registers an open pop-up. Returns the function to call when the page closes it (not via Back).
export function pushLayer(close) {
  install();
  const id = ++seq;
  layers.push({ id, close });
  try { window.history.pushState({ me: "layer", id }, ""); } catch (e) { /* ignore */ }
  return () => {
    const i = layers.findIndex((l) => l.id === id);
    if (i < 0) return; // already closed by Back
    layers.splice(i, 1);
    suppress++;
    try { window.history.back(); } catch (e) { suppress--; }
  };
}
export function setNavHandler(fn) { install(); navHandler = fn; }
export function pushNav(state) { try { window.history.pushState({ me: "nav", ...state }, ""); } catch (e) { /* ignore */ } }
export function replaceNav(state) { try { window.history.replaceState({ me: "nav", ...state }, ""); } catch (e) { /* ignore */ } }
export const _layerCount = () => layers.length; // for tests
