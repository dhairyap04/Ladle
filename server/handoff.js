// Checks that a volunteer driver really collected and dropped off food.
//
// The restaurant and the food bank each get a 4-digit code that only they can
// see. The driver enters the restaurant's code when collecting and the food
// bank's code when dropping off, which shows the two met in person. Without a
// code the driver adds a photo instead, and the food bank is asked to confirm.
const crypto = require("crypto");
const mongoDeliveries = require("./models/Deliveries");
const { distanceKm } = require("./geocode");
const { notify } = require("./notify");
const reliability = require("./reliability");

const MAX_CODE_TRIES = 5;
const NEAR_M = 300; // within this of the address counts as "at the location"
const MAX_ACCURACY_ALLOWANCE_M = 500;
const RECEIPT_REMIND_HOURS = 24; // ask the food bank again after this
const RECEIPT_ASSUME_HOURS = 72; // then count it as delivered
const DISPUTE_DAYS = 7; // how long after a handoff a problem can be reported
const MAX_KMH = 110; // faster than this between pickup and drop-off looks wrong
const MIN_TRIP_KM_FOR_SPEED = 3;
const MAX_OFFLINE_DELAY_MS = 12 * 3600e3; // a handoff saved offline must arrive within this

const hasPoint = (p) => p && Array.isArray(p.coordinates) && p.coordinates.length === 2;
const newCode = () => String(crypto.randomInt(0, 10000)).padStart(4, "0");

const codesMatch = (expected, given) => {
  if (typeof expected !== "string" || typeof given !== "string" || expected.length !== given.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given));
};

// { lat, lng, accuracy } from the driver's phone, compared with the address.
// Returns the result only; the coordinates are not kept.
function checkLocation(loc, target) {
  const lat = loc && Number(loc.lat);
  const lng = loc && Number(loc.lng);
  if (!loc || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !hasPoint(target)) {
    return { location: "unknown" };
  }
  const distanceM = Math.round(distanceKm([lng, lat], target.coordinates) * 1000);
  const accuracy = Number.isFinite(Number(loc.accuracy)) ? Math.max(0, Number(loc.accuracy)) : 0;
  const allowance = NEAR_M + Math.min(accuracy, MAX_ACCURACY_ALLOWANCE_M);
  return { location: distanceM <= allowance ? "near" : "far", distanceM };
}

// When the handoff happened. A driver with no signal saves the handoff on
// their phone and it's sent later with the time it happened (clientAt). That
// time is used if it's plausible: not in the future, not too old, and not
// before the previous step.
function handoffTime(clientAt, notBefore, now = new Date()) {
  const at = clientAt ? new Date(clientAt) : null;
  if (!at || Number.isNaN(at.getTime()) || at > now || now - at > MAX_OFFLINE_DELAY_MS) return now;
  if (notBefore && at < notBefore) return new Date(notBefore);
  return at;
}

// Whether the drop-off came implausibly soon after the pickup.
function tooFast(delivery, now = new Date()) {
  if (!delivery.pickedUpAt || !hasPoint(delivery.pickupLocation) || !hasPoint(delivery.dropoffLocation)) return false;
  const km = distanceKm(delivery.pickupLocation.coordinates, delivery.dropoffLocation.coordinates);
  if (km < MIN_TRIP_KM_FOR_SPEED) return false;
  const hours = Math.max((now - delivery.pickedUpAt) / 3600e3, 1 / 3600);
  return km / hours > MAX_KMH;
}

// Sets what the delivery counts as on the driver's record: "completed",
// "disputed" (like a no-show), or null for nothing yet. Safe to call again.
async function setDriverCredit(delivery, outcome) {
  if (!delivery.driverId) return;
  const refs = { deliveryId: delivery._id };
  await reliability.unrecord(delivery.driverId, "delivery_completed", refs);
  await reliability.unrecord(delivery.driverId, "delivery_disputed", refs);
  if (outcome) {
    await reliability.record(delivery.driverId, outcome === "completed" ? "delivery_completed" : "delivery_disputed", {
      ...refs,
      postingId: delivery.postingId,
    });
  }
}

// Reminds food banks about deliveries they haven't confirmed, and counts ones
// nobody answered about as delivered.
async function processReceipts(now = new Date()) {
  const remindBefore = new Date(now - RECEIPT_REMIND_HOURS * 3600e3);
  const assumeBefore = new Date(now - RECEIPT_ASSUME_HOURS * 3600e3);

  const toAssume = await mongoDeliveries.find({ status: "delivered", receipt: "pending", deliveredAt: { $lte: assumeBefore } });
  for (const d of toAssume) {
    const updated = await mongoDeliveries.findOneAndUpdate(
      { _id: d._id, receipt: "pending" },
      { $set: { receipt: "assumed", receiptAt: now } },
      { new: true }
    );
    if (updated) await setDriverCredit(updated, "completed");
  }

  const toRemind = await mongoDeliveries.find({
    status: "delivered",
    receipt: "pending",
    deliveredAt: { $lte: remindBefore },
    receiptReminderAt: { $exists: false },
  });
  for (const d of toRemind) {
    const updated = await mongoDeliveries.findOneAndUpdate(
      { _id: d._id, receiptReminderAt: { $exists: false } },
      { $set: { receiptReminderAt: now } }
    );
    if (updated) {
      await notify([d.foodBankId], {
        type: "delivery",
        title: `Did the food from ${d.restaurantName} arrive?`,
        body: `${d.driverName} marked it delivered. Please confirm, or report a problem if it didn't arrive.`,
        link: `/view_post/${d.postingId}`,
        postingId: d.postingId,
      });
    }
  }
}

const withinDisputeWindow = (at, now = new Date()) => Boolean(at) && now - at <= DISPUTE_DAYS * 864e5;

// What the viewer can do about the delivery's verification, so the client
// doesn't have to repeat these rules.
function verificationActions(delivery, viewerId, now = new Date()) {
  const isFoodBank = String(delivery.foodBankId) === viewerId;
  const isDonor = delivery.donorId && String(delivery.donorId) === viewerId;
  const openDispute = delivery.dispute && delivery.dispute.at && !delivery.dispute.resolution;
  const out = { canConfirm: false, canReportDropoff: false, canReportPickup: false };
  if (isFoodBank && delivery.status === "delivered" && ["pending", "assumed"].includes(delivery.receipt)) {
    out.canConfirm = true;
  }
  if (isFoodBank && openDispute && delivery.dispute.stage === "dropoff" && String(delivery.dispute.byUserId) === viewerId) {
    out.canConfirm = true; // it turned up after all
  }
  if (isFoodBank && !openDispute) {
    if (delivery.status === "delivered" && ["pending", "assumed"].includes(delivery.receipt) && withinDisputeWindow(delivery.deliveredAt, now)) {
      out.canReportDropoff = true;
    }
    // Collected a while ago and still not here.
    if (delivery.status === "picked_up" && delivery.pickedUpAt && now - delivery.pickedUpAt > 2 * 3600e3) out.canReportDropoff = true;
  }
  if (isDonor && !openDispute && ["picked_up", "delivered"].includes(delivery.status) && delivery.receipt !== "confirmed") {
    if (delivery.pickupProof && delivery.pickupProof.method === "photo" && withinDisputeWindow(delivery.pickedUpAt, now)) {
      out.canReportPickup = true;
    }
  }
  return out;
}

module.exports = {
  MAX_CODE_TRIES,
  NEAR_M,
  RECEIPT_REMIND_HOURS,
  RECEIPT_ASSUME_HOURS,
  DISPUTE_DAYS,
  newCode,
  codesMatch,
  checkLocation,
  handoffTime,
  tooFast,
  setDriverCredit,
  processReceipts,
  verificationActions,
};
