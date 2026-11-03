// Service worker for the installable attendance apps (see app/attendance/RegisterServiceWorker.tsx).
// It caches nothing but the offline page: pages and passes are per-user and must
// come fresh from the server. When a page can't load, it shows /offline.html
// instead of the browser's own error screen.

const CACHE = "soe-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" }))),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      // Start page requests while the worker boots, so it never slows navigation down.
      await self.registration.navigationPreload?.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  // Only page loads; data requests and server actions go straight to the network.
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        return (await event.preloadResponse) || (await fetch(event.request));
      } catch {
        return (await caches.match(OFFLINE_URL)) || Response.error();
      }
    })(),
  );
});
