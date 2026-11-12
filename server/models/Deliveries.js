const mongoose = require("mongoose");
const { STORAGE } = require("../constants");

// requested -> accepted -> picked_up -> delivered
// requested -> expired (pickup window passed) or cancelled (by the food bank)
// accepted  -> requested (driver released it) or missed (driver never collected)
const DELIVERY_STATUSES = ["requested", "accepted", "picked_up", "delivered", "cancelled", "expired", "missed"];
const ACTIVE = ["requested", "accepted", "picked_up"];

// How the food bank's receipt of a delivery was established:
//   confirmed - the driver entered the food bank's code, or the food bank confirmed it
//   pending   - the driver marked it delivered without the code; waiting on the food bank
//   assumed   - nobody answered within RECEIPT_ASSUME_HOURS, so it counts as delivered
//   disputed  - the food bank (or restaurant, for pickup) reported a problem
const RECEIPT_STATUSES = ["pending", "confirmed", "assumed", "disputed"];

// Evidence recorded when the driver collects or drops off the food. Only the
// result of the location check is kept, never the driver's coordinates.
const proof = {
  at: { type: Date },
  method: { type: String, enum: ["code", "photo"] },
  location: { type: String, enum: ["near", "far", "unknown"] },
  distanceM: { type: Number },
  hasPhoto: { type: Boolean, default: false },
};

const point = {
  type: { type: String, enum: ["Point"] },
  coordinates: { type: [Number] },
};

// A food bank's request for a volunteer driver to bring a claimed posting
// from the restaurant to the food bank. Copies what a driver needs to decide,
// so the list of available deliveries doesn't have to join postings.
const DeliveriesSchema = new mongoose.Schema(
  {
    postingId: { type: mongoose.Schema.Types.ObjectId, ref: "FoodPostings", required: true, index: true },
    foodBankId: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true, index: true },
    foodBankName: { type: String, required: true },
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    restaurantName: { type: String, required: true },

    pickupAddress: { type: String, required: true },
    pickupLocationName: { type: String }, // e.g. "Jasper Ave", for a restaurant with several
    pickupNotes: { type: String }, // the restaurant's directions for drivers
    pickupLocation: point,
    dropoffAddress: { type: String, required: true },
    dropoffLocation: point,
    pickupDate: { type: String },
    pickupTimeBegin: { type: Number, required: true },
    pickupTimeEnd: { type: Number, required: true },
    pickupEndsAt: { type: Date, index: true },
    estimatedWeightKg: { type: Number },
    storage: { type: String, enum: STORAGE, default: "ambient" },
    quantity: { type: String, default: "" },
    notes: { type: String, default: "" }, // from the food bank, e.g. where to drop off

    status: { type: String, enum: DELIVERY_STATUSES, default: "requested", index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Users", index: true },
    driverName: { type: String },
    acceptedAt: { type: Date },
    pickedUpAt: { type: Date },
    deliveredAt: { type: Date },

    // Handoff codes: the restaurant gives the driver pickupCode, the food bank
    // gives dropoffCode. Never sent to the driver.
    pickupCode: { type: String, select: false },
    dropoffCode: { type: String, select: false },
    pickupCodeTries: { type: Number, default: 0, select: false },
    dropoffCodeTries: { type: Number, default: 0, select: false },
    pickupProof: proof,
    dropoffProof: proof,
    // Things an admin may want to look at: pickup_far, dropoff_far, too_fast.
    flags: { type: [String], default: undefined },
    flagsReviewedAt: { type: Date },

    receipt: { type: String, enum: RECEIPT_STATUSES, index: true },
    receiptConfirmedBy: { type: String, enum: ["code", "foodbank", "admin"] },
    receiptAt: { type: Date },
    receiptReminderAt: { type: Date },
    dispute: {
      stage: { type: String, enum: ["pickup", "dropoff"] },
      byUserId: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
      note: { type: String },
      at: { type: Date },
      resolution: { type: String, enum: ["delivered", "not_delivered"] },
      resolvedAt: { type: Date },
    },
  },
  { timestamps: true }
);

// At most one active delivery per posting.
DeliveriesSchema.index(
  { postingId: 1 },
  { unique: true, name: "one_active_delivery", partialFilterExpression: { status: { $in: ACTIVE } } }
);

const mongoDeliveries = mongoose.model("Deliveries", DeliveriesSchema, "Deliveries");
mongoDeliveries.ACTIVE = ACTIVE;
mongoDeliveries.RECEIPT_STATUSES = RECEIPT_STATUSES;
module.exports = mongoDeliveries;
