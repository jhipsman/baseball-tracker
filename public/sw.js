/* 9D service worker: shows web push notifications and opens their link. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "9D";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || "/notifications";
  const target = new URL(raw, self.location.origin);
  // Only ever open pages on this site.
  const url = target.origin === self.location.origin ? target.href : self.location.origin + "/";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const exact = windows.find((w) => w.url === url);
      if (exact) return exact.focus();
      const same = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (same && "navigate" in same) {
        await same.focus();
        return same.navigate(url);
      }
      return self.clients.openWindow(url);
    })(),
  );
});
