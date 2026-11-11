// Ladle service worker: makes the app installable and lets the app shell
// open offline. API requests (a different origin) are never cached, so data
// is always live; offline, the app shows its usual "can't reach the server".
const VERSION = "v3";
const SHELL = `ladle-shell-${VERSION}`;
const ASSETS = `ladle-assets-${VERSION}`;
const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/images/logo-mark.svg",
  "/images/icon-192.png",
  "/images/hero.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, ASSETS].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Pages: network first so deploys show up at once; offline, the cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Hashed build files never change: cache first.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(ASSETS).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
    return;
  }

  // Images: serve the cached copy and refresh it in the background.
  if (url.pathname.startsWith("/images/")) {
    event.respondWith(
      caches.open(ASSETS).then((cache) =>
        cache.match(request).then((hit) => {
          const fresh = fetch(request)
            .then((response) => {
              cache.put(request, response.clone());
              return response;
            })
            .catch(() => hit);
          return hit || fresh;
        })
      )
    );
  }
});

// Push notifications sent by the server (see server/push.js).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Ladle", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Ladle", {
      body: data.body || "",
      icon: "/images/icon-192.png",
      badge: "/images/icon-192.png",
      data: { link: data.link || "/main" },
    })
  );
});

// Tapping a notification focuses an open Ladle tab (or opens one) at its link.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data.link || "/main", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      const tab = tabs.find((t) => t.url.startsWith(self.location.origin));
      if (tab) return tab.navigate(url).then((t) => (t || tab).focus());
      return self.clients.openWindow(url);
    })
  );
});
