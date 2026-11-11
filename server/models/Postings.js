const mongoose = require("mongoose");
const { FOOD_TYPES, ALLERGENS, STORAGE } = require("../constants");

// open -> claimed -> picked_up; open -> expired (pickup window passed) or cancelled (withdrawn by donor).
const POSTING_STATUSES = ["open", "claimed", "picked_up", "expired", "cancelled"];

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
    // Calendar day of the pickup in the restaurant's local time, "YYYY-MM-DD".
    pickupDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    // Absolute end of the pickup window, used to expire stale postings.
    // Postings created before this field existed never expire automatically.
    pickupEndsAt: { type: Date, index: true },
    notes: { type: String, default: "" },
    // Food safety and description.
    foodTypes: [{ type: String, enum: FOOD_TYPES }],
    allergens: [{ type: String, enum: [...ALLERGENS, "none"] }],
    storage: { type: String, enum: STORAGE, default: "ambient" },
    preparedAt: { type: Date },
    quantity: { type: String, default: "" }, // free text, e.g. "3 trays"
    estimatedWeightKg: { type: Number, min: 0, max: 5000 },
    hasPhoto: { type: Boolean, default: false },
    // Postings created before the status field existed have no status and are treated as open.
    status: { type: String, enum: POSTING_STATUSES, default: "open", index: true },
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    claimedByName: { type: String },
    claimedAt: { type: Date },
    pickedUpAt: { type: Date },
  },
  { timestamps: true }
);

const mongoFoodPostings = mongoose.model("FoodPostings", FoodPostingsSchema, "FoodPostings");
mongoFoodPostings.POSTING_STATUSES = POSTING_STATUSES;
module.exports = mongoFoodPostings;
