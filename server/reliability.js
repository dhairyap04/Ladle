// Records reliability events and summarises them per account.
const mongoose = require("mongoose");
const mongoReliabilityEvents = require("./models/ReliabilityEvents");
const mongoRatings = require("./models/Ratings");

const WINDOW_DAYS = 180; // only recent behaviour counts
const LATE_RELEASE_HOURS = 2; // backing out closer than this to the pickup window is "late"
const MIN_FOR_RATE = 3; // fewer commitments than this shows "New" instead of a rate

const record = (userId, type, refs = {}) =>
  mongoReliabilityEvents.create({ userId, type, ...refs }).catch((err) => console.error("Reliability event failed:", err.message));

// Undoes a recorded event, e.g. when a no-show turns out to be a pickup.
const unrecord = (userId, type, refs = {}) => mongoReliabilityEvents.deleteMany({ userId, type, ...refs });

// Whether backing out now, before a window that starts at `startsAt`, is late.
const isLate = (startsAt) => startsAt && startsAt - Date.now() < LATE_RELEASE_HOURS * 3600e3;

// { completed, noShows, lateReleases, releases, pickupRate (0-1 or null), rating, ratingCount, flagged }
async function summaries(userIds) {
  const ids = [...new Set(userIds.map(String))].filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!ids.length) return {};
  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const since = new Date(Date.now() - WINDOW_DAYS * 864e5);
  const [events, ratings] = await Promise.all([
    mongoReliabilityEvents.aggregate([
      { $match: { userId: { $in: objectIds }, createdAt: { $gte: since } } },
      { $group: { _id: { user: "$userId", type: "$type" }, n: { $sum: 1 } } },
    ]),
    mongoRatings.aggregate([
      { $match: { toUserId: { $in: objectIds } } },
      { $group: { _id: "$toUserId", avg: { $avg: "$stars" }, n: { $sum: 1 } } },
    ]),
  ]);

  const out = Object.fromEntries(ids.map((id) => [id, { completed: 0, noShows: 0, lateReleases: 0, releases: 0 }]));
  for (const { _id, n } of events) {
    const s = out[String(_id.user)];
    if (["pickup_completed", "delivery_completed"].includes(_id.type)) s.completed += n;
    if (["no_show", "delivery_missed"].includes(_id.type)) s.noShows += n;
    if (["late_release", "delivery_late_release"].includes(_id.type)) s.lateReleases += n;
    if (["release", "delivery_release"].includes(_id.type)) s.releases += n;
  }
  const ratingBy = Object.fromEntries(ratings.map((r) => [String(r._id), r]));
  for (const [id, s] of Object.entries(out)) {
    // A late release counts like half a no-show against the rate.
    const commitments = s.completed + s.noShows + s.lateReleases * 0.5;
    s.pickupRate = commitments >= MIN_FOR_RATE ? Math.round((s.completed / commitments) * 100) / 100 : null;
    const r = ratingBy[id];
    s.rating = r ? Math.round(r.avg * 10) / 10 : null;
    s.ratingCount = r ? r.n : 0;
    // Flag for admins: repeated no-shows or a poor rate.
    s.flagged = s.noShows >= 3 || (s.pickupRate !== null && s.pickupRate < 0.7);
  }
  return out;
}

const summary = async (userId) => (await summaries([userId]))[String(userId)];

module.exports = { record, unrecord, isLate, summaries, summary, WINDOW_DAYS, LATE_RELEASE_HOURS };
