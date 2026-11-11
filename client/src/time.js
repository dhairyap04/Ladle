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
