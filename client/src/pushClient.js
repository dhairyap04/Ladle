import api from "./api";

// Web push on this device. Needs the service worker, which only runs in
// production builds (see pwa.js), and VAPID keys on the server.

const urlBase64ToUint8Array = (base64) => {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

const registration = async () =>
  "serviceWorker" in navigator && "PushManager" in window ? navigator.serviceWorker.getRegistration() : null;

// { available, subscribed, blocked } for this device.
export async function pushStatus() {
  const reg = await registration();
  if (!reg) return { available: false, subscribed: false };
  try {
    const { data } = await api.get("push/key");
    if (!data.enabled || !data.publicKey) return { available: false, subscribed: false };
    const sub = await reg.pushManager.getSubscription();
    return { available: true, subscribed: Boolean(sub), blocked: Notification.permission === "denied", publicKey: data.publicKey };
  } catch {
    return { available: false, subscribed: false };
  }
}

export async function enablePush(publicKey) {
  const reg = await registration();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked for this site. Allow them in your browser settings.");
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
  await api.post("push/subscribe", { subscription: sub.toJSON() });
}

export async function disablePush() {
  const reg = await registration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) return;
  await api.post("push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}
