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

const ICON = "/favicon.svg";
const DEFAULT_TITLE = "Office Market";

// Take over right away when a new version is deployed
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

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
      badge: ICON,
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
