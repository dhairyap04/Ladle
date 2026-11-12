const mongoose = require("mongoose");

// Things that make an account more or less dependable, recorded as they happen.
//   pickup_completed / delivery_completed  - did what they committed to
//   no_show / delivery_missed             - committed and didn't turn up
//   late_release / delivery_late_release  - backed out close to the pickup window
//   release / delivery_release            - backed out with plenty of notice (neutral)
//   delivery_disputed                     - the food bank reported the food never arrived (like a no-show)
const EVENT_TYPES = [
  "pickup_completed",
  "no_show",
  "late_release",
  "release",
  "delivery_completed",
  "delivery_missed",
  "delivery_late_release",
  "delivery_release",
  "delivery_disputed",
];

const ReliabilityEventsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    type: { type: String, enum: EVENT_TYPES, required: true },
    postingId: { type: mongoose.Schema.Types.ObjectId, ref: "FoodPostings" },
    deliveryId: { type: mongoose.Schema.Types.ObjectId, ref: "Deliveries" },
  },
  { timestamps: true }
);

ReliabilityEventsSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("ReliabilityEvents", ReliabilityEventsSchema, "ReliabilityEvents");
