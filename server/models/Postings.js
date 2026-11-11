const mongoose = require("mongoose");

const POSTING_STATUSES = ["open", "claimed", "cancelled"];

// Times are stored as HHMM integers (e.g. 1430 for 2:30 PM); 2400 means midnight at the end of the day.
const pickupTime = {
  type: Number,
  required: true,
  min: 0,
  max: 2400,
  validate: {
    validator: (value) => Number.isInteger(value) && value % 100 < 60,
    message: "Pickup times must be valid HH:MM times.",
  },
};

const FoodPostingsSchema = new mongoose.Schema(
  {
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: "Users", index: true },
    fromRestaurantName: { type: String, required: true },
    fromRestaurantAddress: { type: String, required: true, trim: true },
    pickupTimeBegin: pickupTime,
    pickupTimeEnd: pickupTime,
    notes: { type: String, default: "" },
    // Postings created before the status field existed have no status and are treated as open.
    status: { type: String, enum: POSTING_STATUSES, default: "open", index: true },
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    claimedByName: { type: String },
    claimedAt: { type: Date },
  },
  { timestamps: true }
);

const mongoFoodPostings = mongoose.model("FoodPostings", FoodPostingsSchema, "FoodPostings");
mongoFoodPostings.POSTING_STATUSES = POSTING_STATUSES;
module.exports = mongoFoodPostings;
