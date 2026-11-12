// Pickup times are stored as HHMM integers (1430 = 2:30 PM, 2400 = midnight).

// 1430 -> "2:30 PM", 0 -> "12:00 AM", 1200 -> "12:00 PM", 2400 -> "12:00 AM"
export function formatPickupTime(hhmm) {
  const value = Number(hhmm);
  if (!Number.isFinite(value)) return "";
  const hours24 = Math.floor(value / 100) % 24;
  const minutes = value % 100;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

// HHMM integer -> "HH:MM" for <input type="time">.
export function toTimeInput(hhmm) {
  const value = Number(hhmm);
  if (!Number.isFinite(value)) return "";
  const hours = Math.floor(value / 100) % 24;
  return `${String(hours).padStart(2, "0")}:${String(value % 100).padStart(2, "0")}`;
}

// Today's date in the user's time zone as "YYYY-MM-DD".
export function todayDateInput() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// "2026-11-10" + "21:30" -> ISO timestamp of that local date and time.
export function localDateTimeToIso(date, time) {
  return new Date(`${date}T${time}`).toISOString();
}

// "2026-11-10" -> "Tue Nov 10 2026" (parsed as a local date, not UTC).
export function formatPickupDate(date) {
  if (!date) return "";
  return new Date(`${date}T00:00`).toDateString();
}

export const STATUS_LABELS = {
  open: "Open",
  claimed: "Claimed",
  picked_up: "Picked up",
  expired: "Expired",
  cancelled: "Withdrawn",
};

// "2026-11-10" -> "Today", "Tomorrow", or "Thu, Nov 12" (with the year if it isn't this year).
export function friendlyPickupDate(date) {
  if (!date) return "";
  const day = new Date(`${date}T00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((day - today) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return day.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(day.getFullYear() !== today.getFullYear() && { year: "numeric" }),
  });
}

// A posting's pickup window, e.g. "Today · 4:00 PM – 6:00 PM".
export function formatPickupWindow(posting) {
  const times = `${formatPickupTime(posting.pickupTimeBegin)} – ${formatPickupTime(posting.pickupTimeEnd)}`;
  return posting.pickupDate ? `${friendlyPickupDate(posting.pickupDate)} · ${times}` : times;
}
