import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);

// Service worker registration with an "Update available" prompt (v2.10).
// A new worker waits until the person taps Reload, so an update never lands
// in the middle of a form. The page reloads on controllerchange only if it
// already had a controller (a first install must not wipe what was typed).
function showUpdatePrompt(worker) {
  if (document.getElementById("hk-update-prompt")) return;
  const bar = document.createElement("div");
  bar.id = "hk-update-prompt";
  bar.setAttribute("role", "status");
  bar.style.cssText =
    "position:fixed;left:12px;right:12px;bottom:calc(72px + env(safe-area-inset-bottom));max-width:420px;margin:0 auto;z-index:90;display:flex;align-items:center;gap:10px;" +
    "padding:10px 12px;border-radius:6px;background:#28415F;color:#fff;font:600 13px system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.3)";
  const msg = document.createElement("span");
  msg.style.flex = "1";
  msg.textContent = "Update available";
  const reload = document.createElement("button");
  reload.type = "button";
  reload.textContent = "Reload";
  reload.style.cssText = "min-height:36px;padding:0 14px;border:none;border-radius:4px;background:#fff;color:#28415F;font:700 13px system-ui,sans-serif;cursor:pointer";
  reload.addEventListener("click", () => worker.postMessage({ type: "SKIP_WAITING" }));
  const later = document.createElement("button");
  later.type = "button";
  later.textContent = "Later";
  later.setAttribute("aria-label", "Dismiss the update prompt");
  later.style.cssText = "min-height:36px;padding:0 8px;border:none;background:none;color:#fff;font:600 13px system-ui,sans-serif;cursor:pointer";
  later.addEventListener("click", () => bar.remove());
  bar.append(msg, reload, later);
  document.body.appendChild(bar);
}

if ("serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) showUpdatePrompt(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) showUpdatePrompt(nw);
          });
        });
      })
      .catch(() => {});
  });
}
