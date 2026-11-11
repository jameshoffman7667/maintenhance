// MaintEnhance service worker (v2.10).
//
// - Precaches the app shell only (the page, manifest, icons and the offline
//   page). It never caches API responses, sign-in pages or anything
//   user-specific.
// - Page loads (navigations) are network-first; if the network fails the
//   cached shell is used, and if that is missing the offline page.
// - The cache name carries the app version; old caches are deleted on
//   activate.
// - A new worker waits until the person taps "Reload" in the update prompt
//   (the page sends SKIP_WAITING); it never takes over in the middle of a form.
//
// Paths are computed from the worker's scope so this also works under a
// subpath (for example /maintenhance/).
const SCOPE = self.registration.scope;
const CACHE_NAME = "maintenhance-shell-v2.11.0";
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
