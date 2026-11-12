const mongoose = require("mongoose");
const { STORAGE } = require("../constants");

// requested -> accepted -> picked_up -> delivered
// requested -> expired (pickup window passed) or cancelled (by the food bank)
// accepted  -> requested (driver released it) or missed (driver never collected)
const DELIVERY_STATUSES = ["requested", "accepted", "picked_up", "delivered", "cancelled", "expired", "missed"];
const ACTIVE = ["requested", "accepted", "picked_up"];

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
module.exports = mongoDeliveries;
