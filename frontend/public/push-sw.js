/* Web Push handlers — imported into the generated service worker (workbox.importScripts). */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "FLOFER BRINKS", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "FLOFER BRINKS";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || "flofer",
      renotify: true,
      dir: "rtl",
      lang: "he",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      vibrate: [180, 80, 180],
      data: { url: data.url || "/app/live" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app/live";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.navigate(url).catch(() => undefined);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
