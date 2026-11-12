import api, { errorMessage } from "./api";

// Pickups and drop-offs a driver records with no signal (a basement loading
// dock, a rural road). They're kept on this device and sent, in order, as
// soon as the connection is back. Each carries the time it happened, which
// the server uses instead of the time it arrived.
//
// Item: { id, deliveryId, path ("picked-up" | "delivered"), body, savedAt,
//         status ("waiting" | "failed"), error }

const KEY = "ladle.outbox";
const RETRY_MS = 30000;
const listeners = new Set();
let flushing = false;
let started = false;

const read = () => {
  try {
    const items = JSON.parse(window.localStorage.getItem(KEY));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};

const write = (items) => {
  try {
    if (items.length) window.localStorage.setItem(KEY, JSON.stringify(items));
    else window.localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
};

const emit = (sent) => listeners.forEach((fn) => fn(read(), sent));

// fn(items, sentItem?) runs whenever the outbox changes; sentItem is set when
// an item has just reached the server.
export const subscribeOutbox = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const outboxItems = () => read();
export const outboxFor = (deliveryId) => read().filter((i) => i.deliveryId === deliveryId);
export const hasUnsent = () => read().length > 0;

// No response at all: offline or the server couldn't be reached.
export const isNetworkError = (err) => Boolean(err) && !err.response;

// Returns false when the device has no room to save it.
export function enqueue({ deliveryId, path, body }) {
  const items = read().filter((i) => !(i.deliveryId === deliveryId && i.path === path));
  items.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, deliveryId, path, body, savedAt: new Date().toISOString(), status: "waiting" });
  const ok = write(items);
  emit();
  return ok;
}

export function discard(id) {
  write(read().filter((i) => i.id !== id));
  emit();
}

export function clearOutbox() {
  write([]);
  emit();
}

// Sends waiting items in the order they were saved. Stops at the first
// network error; a refusal from the server marks that item failed (and holds
// back later items for the same delivery, which depend on it).
export async function flushOutbox() {
  if (flushing || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
  flushing = true;
  try {
    const blocked = new Set(read().filter((i) => i.status === "failed").map((i) => i.deliveryId));
    for (const item of read()) {
      if (item.status !== "waiting" || blocked.has(item.deliveryId)) continue;
      try {
        await api.post(`delivery/${item.deliveryId}/${item.path}`, item.body);
        write(read().filter((i) => i.id !== item.id));
        emit(item);
      } catch (err) {
        if (isNetworkError(err)) break;
        if (err.response.status === 409) {
          // Already recorded (the first try got through but its answer didn't),
          // or the delivery has moved on. The card reloads and shows which.
          write(read().filter((i) => i.id !== item.id));
          emit(item);
        } else {
          write(read().map((i) => (i.id === item.id ? { ...i, status: "failed", error: errorMessage(err) } : i)));
          blocked.add(item.deliveryId);
          emit();
        }
      }
    }
  } finally {
    flushing = false;
  }
}

// Called once when the app starts.
export function startOutbox() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", flushOutbox);
  window.addEventListener("storage", (e) => e.key === KEY && emit());
  setInterval(() => read().length && flushOutbox(), RETRY_MS);
  flushOutbox();
}
