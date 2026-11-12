// Generates postings from recurring schedules, in each restaurant's own time zone.
const mongoRecurringSchedules = require("./models/RecurringSchedules");
const mongoFoodPostings = require("./models/Postings");
const mongoUsers = require("./models/Users");

const DAYS_AHEAD = 1; // create today's and tomorrow's postings

const isValidTimeZone = (tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return typeof tz === "string" && tz.length > 0;
  } catch {
    return false;
  }
};

// The calendar date ("YYYY-MM-DD") it is at `date` in `timeZone`.
const localDate = (date, timeZone) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

// How far `timeZone` is ahead of UTC at `date`, in milliseconds.
const offsetMs = (date, timeZone) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
};

// The instant at which it is `ymd` `hhmm` (e.g. "2026-11-12", 1830) in `timeZone`.
// 2400 means midnight at the end of that day.
const zonedTime = (ymd, hhmm, timeZone) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, Math.floor(hhmm / 100), hhmm % 100);
  let guess = naive - offsetMs(new Date(naive), timeZone);
  guess = naive - offsetMs(new Date(guess), timeZone); // settle across DST changes
  return new Date(guess);
};

const addDays = (ymd, days) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const weekday = (ymd) => new Date(`${ymd}T12:00:00Z`).getUTCDay();

// Creates any missing postings for active schedules over the next day or so.
// Safe to run concurrently: a unique index on (scheduleId, pickupDate) stops
// duplicates. Calls onCreated(posting) for each new posting.
async function generateRecurringPostings({ now = new Date(), onCreated = async () => {} } = {}) {
  const schedules = await mongoRecurringSchedules.find({ active: true });
  if (!schedules.length) return [];
  const donors = await mongoUsers.find({ _id: { $in: schedules.map((s) => s.donorId) } }, "name");
  const nameById = Object.fromEntries(donors.map((d) => [String(d._id), d.name]));
  const created = [];

  for (const schedule of schedules) {
    const today = localDate(now, schedule.timeZone);
    for (let i = 0; i <= DAYS_AHEAD; i += 1) {
      const day = addDays(today, i);
      if (!schedule.daysOfWeek.includes(weekday(day))) continue;
      if (day < schedule.startsOn || (schedule.endsOn && day > schedule.endsOn)) continue;
      const pickupEndsAt = zonedTime(day, schedule.pickupTimeEnd, schedule.timeZone);
      if (pickupEndsAt <= now) continue;

      try {
        const posting = await mongoFoodPostings.create({
          donorId: schedule.donorId,
          fromRestaurantName: nameById[String(schedule.donorId)] || "Restaurant",
          fromRestaurantAddress: schedule.fromRestaurantAddress,
          pickupLocationName: schedule.pickupLocationName || undefined,
          pickupNotes: schedule.pickupNotes || undefined,
          location: schedule.location && schedule.location.coordinates && schedule.location.coordinates.length ? schedule.location : undefined,
          pickupDate: day,
          pickupTimeBegin: schedule.pickupTimeBegin,
          pickupTimeEnd: schedule.pickupTimeEnd,
          pickupEndsAt,
          notes: schedule.notes,
          foodTypes: schedule.foodTypes,
          allergens: schedule.allergens,
          storage: schedule.storage,
          quantity: schedule.quantity,
          estimatedWeightKg: schedule.estimatedWeightKg,
          status: "open",
          scheduleId: schedule._id,
        });
        created.push(posting);
        await onCreated(posting);
      } catch (err) {
        if (err.code !== 11000) throw err; // 11000: already generated
      }
    }
  }
  return created;
}

module.exports = { generateRecurringPostings, zonedTime, localDate, isValidTimeZone, addDays };
