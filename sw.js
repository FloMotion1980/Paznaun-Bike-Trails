// Paznaun Bike Trails — Service Worker
// Caches the app shell (this page + Leaflet library) so the app itself opens offline,
// and caches map tiles as they are viewed (or explicitly preloaded) so the map background
// keeps working without a connection.

const CACHE_NAME = "paznaun-bike-v1";
const APP_SHELL = [
  "./",
  "./index.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // App shell / navigation: network-first, so updates (new trails etc.) are picked up
  // when online, but it still opens from cache when there's no connection at all.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          return resp;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  // Everything else (Leaflet JS/CSS, map tiles from OSM/CARTO/OpenTopoMap/Esri):
  // cache-first, and fill the cache in the background for next time.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((resp) => {
          if (resp && (resp.ok || resp.type === "opaque")) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return resp;
        })
        .catch(() => cached);
    })
  );
});
