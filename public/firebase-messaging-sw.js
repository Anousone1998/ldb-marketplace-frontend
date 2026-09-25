// The app's only service worker (scope "/"): FCM push + offline app shell for the PWA.
// Registered by src/services/sw.ts, which passes settings in the URL (public/ files can't read
// import.meta.env): the Firebase config, and offline=1 in production builds.
importScripts(
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js",
);

// FCM only: just the fields Cloud Messaging needs. No other Firebase product is loaded.
const params = new URL(self.location.href).searchParams;
const config = {
  apiKey: params.get("apiKey"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
};

const ICON = "/icons/icon-192.png";
const BADGE = "/icons/badge-96.png"; // Android status bar: white on transparent
const DEFAULT_TITLE = "Office Market";

// ---------------------------------------------------------------- offline app shell (PWA)
const OFFLINE = params.get("offline") === "1";
const SHELL_CACHE = "om-shell-v2"; // index.html, manifest, icons
const ASSET_CACHE = "om-assets-v2"; // Vite's hashed /assets/* files (immutable)
const MAX_ASSETS = 80; // this file doesn't change per deploy, so trim old builds' files
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/badge-96.png",
];

// Take over right away when a new version is deployed
self.addEventListener("install", (event) => {
  self.skipWaiting();
  if (OFFLINE)
    event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const keep = OFFLINE ? [SHELL_CACHE, ASSET_CACHE] : [];
      for (const key of await caches.keys())
        if (key.startsWith("om-") && !keep.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);

async function trim(cache) {
  const keys = await cache.keys();
  for (const req of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)))
    await cache.delete(req);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (!OFFLINE || req.method !== "GET") return;
  const url = new URL(req.url);
  // API, chat socket, Supabase images, Google fonts…: always live, never cached here
  if (url.origin !== self.location.origin) return;

  // Pages (every route is the SPA's index.html): network first so a deploy shows up at once,
  // cached shell when offline
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        try {
          // no-cache: always revalidate with the server, never the browser's HTTP cache,
          // or a stale index.html would keep pointing at the previous build
          const res = await fetch(req, { cache: "no-cache" });
          if (res.ok) cache.put("/", res.clone());
          return res;
        } catch {
          return (await cache.match("/")) ?? Response.error();
        }
      })(),
    );
    return;
  }

  // Hashed build files never change: cache first
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        // A file from an older build no longer exists; the SPA fallback then answers with
        // index.html (200). Never cache that as JS/CSS.
        const isHtml = res.headers.get("content-type")?.includes("text/html");
        if (res.ok && !isHtml) {
          await cache.put(req, res.clone());
          trim(cache);
        }
        return res;
      })(),
    );
    return;
  }

  // Manifest and icons: cached copy first, refreshed in the background
  if (SHELL.includes(url.pathname) && url.pathname !== "/") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const hit = await cache.match(url.pathname);
        const fresh = fetch(req)
          .then((res) => (res.ok && cache.put(url.pathname, res.clone()), res))
          .catch(() => hit);
        return hit ?? fresh;
      })(),
    );
  }
});

// ---------------------------------------------------------------- push (FCM)

if (
  config.apiKey &&
  config.projectId &&
  config.messagingSenderId &&
  config.appId
) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  // Messages sent with a `notification` block are displayed by the FCM SDK itself; showing
  // them again here would duplicate them. Only data-only messages are rendered here.
  // Expected data keys: title, body, link (app path, e.g. /chats/12), image, tag.
  messaging.onBackgroundMessage((payload) => {
    if (payload.notification) return;
    const data = payload.data ?? {};
    return self.registration.showNotification(data.title || DEFAULT_TITLE, {
      body: data.body || "",
      icon: ICON,
      badge: BADGE,
      image: data.image || undefined,
      tag: data.tag || undefined, // same tag replaces the previous notification (e.g. one per chat)
      renotify: Boolean(data.tag),
      data: { link: data.link || payload.fcmOptions?.link || "/" },
    });
  });
} else {
  console.warn(
    "[firebase-messaging-sw] missing Firebase config in the registration URL; push is disabled",
  );
}

// Open (or focus) the app at the notification's link
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data ?? {};
  // FCM-displayed notifications keep their payload under data.FCM_MSG
  const link =
    data.link ||
    data.FCM_MSG?.fcmOptions?.link ||
    data.FCM_MSG?.data?.link ||
    "/";
  const target = new URL(link, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const sameOrigin = windows.find(
        (w) => new URL(w.url).origin === self.location.origin,
      );
      if (sameOrigin) {
        await sameOrigin.focus();
        return sameOrigin.navigate(target);
      }
      return clients.openWindow(target);
    })(),
  );
});
