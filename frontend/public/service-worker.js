// MaintEnhance service worker (v2.10).
//
// - Precaches the app shell only (the page, manifest, icons and the offline
//   page). It never caches API responses, sign-in pages or anything
//   user-specific.
// - Page loads (navigations) are network-first; if the network fails the
//   cached shell is used, and if that is missing the offline page.
// - The cache name carries the app version; old caches are deleted on
//   activate.
// - Shows push notifications and focuses/opens the app when one is tapped (v2.12).
// - A new worker waits until the person taps "Reload" in the update prompt
//   (the page sends SKIP_WAITING); it never takes over in the middle of a form.
//
// Paths are computed from the worker's scope so this also works under a
// subpath (for example /maintenhance/).
const SCOPE = self.registration.scope;
const CACHE_NAME = "maintenhance-shell-v2.12.0";
const SHELL_URLS = ["", "index.html", "offline.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"].map(
  (p) => new URL(p, SCOPE).toString()
);
const OFFLINE_URL = new URL("offline.html", SCOPE).toString();
const API_PATH_PREFIX = new URL("api/", SCOPE).pathname;
const NEVER_CACHE = ["healthz", "manifest.webmanifest", "manifest.json", "service-worker.js"].map((p) => new URL(p, SCOPE).pathname);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// Push notifications (v2.12). A push always shows a notification; tapping it focuses the app or opens it.
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = {}; }
  event.waitUntil(
    self.registration.showNotification(d.title || "MaintEnhance", {
      body: d.body || "",
      tag: d.tag || undefined,
      icon: new URL("icon-192.png", SCOPE).toString(),
      badge: new URL("icon-192.png", SCOPE).toString(),
      data: { url: d.url || SCOPE },
    })
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || SCOPE;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url.startsWith(SCOPE) && "focus" in c) return c.focus();
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // API calls, the health probe, the manifest and the worker itself always go to the network.
  if (url.pathname.startsWith(API_PATH_PREFIX) || NEVER_CACHE.includes(url.pathname)) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(new URL("index.html", SCOPE).toString()).then((r) => r || caches.match(OFFLINE_URL))
      ).then((r) => r || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } }))
    );
    return;
  }

  // Static files (built scripts, styles, icons): serve from cache when present, refresh in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
