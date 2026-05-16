/* KMS service worker — minimal, hand-rolled, no Workbox.
 *
 * Strategy:
 *  - HTML navigations: network-first → fall back to /offline.html
 *  - /assets/*, /icons/*, manifest, icon.svg: stale-while-revalidate
 *  - /_serverFn/* (API): always network — do not cache, balances must be fresh
 *
 * Bump CACHE_NAME when changing this file or shipping a new build to force
 * clients to invalidate.
 */
const CACHE_NAME = "kms-v1";
const STATIC_PRECACHE = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) =>
      c.addAll(STATIC_PRECACHE).catch((err) => {
        console.warn("[sw] precache failed (non-fatal)", err);
      }),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API: always network, no cache.
  if (url.pathname.startsWith("/_serverFn/")) return;

  // HTML navigations: network-first with offline fallback
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirstHtml(req));
    return;
  }

  // Static assets: stale-while-revalidate
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/icon.svg" ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirstHtml(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    const offline = await caches.match("/offline.html");
    if (offline) return offline;
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

// Allow the client to nudge an immediate skipWaiting (used by the
// "Nová verzia" reload prompt in sw-register.ts)
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
