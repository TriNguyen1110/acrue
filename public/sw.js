/**
 * Acrue Service Worker — handles Web Push notifications.
 *
 * Registered by PushNotificationToggle.tsx when the user opts in.
 * Listens for push events sent by the server via the Web Push protocol
 * and shows a browser notification. On click, opens (or focuses) the
 * /alerts page.
 */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: "Acrue Alert", body: event.data?.text() ?? "" };
  }

  const title   = data.title ?? "Acrue Alert";
  const options = {
    body:    data.body   ?? "",
    icon:    "/favicon.ico",
    badge:   "/favicon.ico",
    tag:     data.tag    ?? "acrue-alert",   // replaces older notif with same tag
    renotify: true,
    data:    { url: data.url ?? "/alerts" },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? "/alerts";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If the app is already open in a tab, focus it and navigate
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(targetUrl);
            return;
          }
        }
        // Otherwise open a new tab
        return clients.openWindow(targetUrl);
      })
  );
});
