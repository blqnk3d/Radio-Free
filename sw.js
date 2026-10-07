/* Radio Österreich — service worker.
   Caches the app shell so the installed app opens offline.
   Live audio + the ORF programme API are NEVER cached. */
const VERSION = "radio-v2";
const CORE = [
  "./", "./index.html", "./app.css", "./app.js", "./manifest.webmanifest",
  "./assets/icon-192.png", "./assets/icon-512.png", "./assets/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION)
    .then((c) => Promise.allSettled(CORE.map((u) => c.add(u))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((k) => Promise.all(k.filter((x) => x !== VERSION).map((x) => caches.delete(x))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;   /* streams & API: network only */

  if (req.mode === "navigate") {                                   /* fresh HTML, cache when offline */
    e.respondWith(fetch(req)
      .then((r) => { const c = r.clone(); caches.open(VERSION).then((k) => k.put("./index.html", c)); return r; })
      .catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req)
        .then((r) => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then((k) => k.put(req, c)); } return r; })
        .catch(() => hit || new Response("offline", { status: 504 }))
    )
  );
});
