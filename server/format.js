// Text formatting shared by notifications and receipts.

// 1430 -> "2:30 PM"
const formatTime = (hhmm) => {
  const hours24 = Math.floor(hhmm / 100) % 24;
  const minutes = hhmm % 100;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${hours24 >= 12 ? "PM" : "AM"}`;
};

// "2026-11-12" -> "Thu, Nov 12"
const formatDate = (ymd) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

// A posting's pickup window, e.g. "Thu, Nov 12, 4:00 PM – 6:00 PM".
const formatWindow = (posting) => {
  const times = `${formatTime(posting.pickupTimeBegin)} – ${formatTime(posting.pickupTimeEnd)}`;
  return posting.pickupDate ? `${formatDate(posting.pickupDate)}, ${times}` : times;
};

module.exports = { formatTime, formatDate, formatWindow };
