// Service worker registration and the "Install app" prompt.

export function registerServiceWorker() {
  // Only in production builds: in development a cached shell would hide edits.
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.error("Service worker failed:", err));
  });
}

// Chrome and Edge fire beforeinstallprompt when the app can be installed.
// Keep the event so an "Install" button can show the prompt later.
let deferredPrompt = null;
const listeners = new Set();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    listeners.forEach((fn) => fn(true));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((fn) => fn(false));
  });
}

export const canInstall = () => Boolean(deferredPrompt);

export function onInstallAvailable(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  listeners.forEach((fn) => fn(false));
  return outcome === "accepted";
}

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

// iPhone and iPad (iPadOS reports itself as a Mac, so check for touch too).
// Safari there has no install prompt: people add the app from the Share menu.
export const isIos = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
};

// Whether Ladle can be added to the home screen, and how.
//   "prompt" - the browser's own install prompt (Chrome, Edge, Android)
//   "ios"    - the Share menu steps on iPhone and iPad
//   null     - already installed, or not possible here
export const installMethod = () => {
  if (typeof window === "undefined" || isStandalone()) return null;
  if (canInstall()) return "prompt";
  if (isIos()) return "ios";
  return null;
};
