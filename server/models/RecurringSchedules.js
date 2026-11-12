const mongoose = require("mongoose");
const { FOOD_TYPES, ALLERGENS, STORAGE } = require("../constants");

// A weekly donation a restaurant makes on set days. Postings are generated
// from it shortly before each pickup day (see recurring.js).
const RecurringSchedulesSchema = new mongoose.Schema(
  {
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true, index: true },
    fromRestaurantAddress: { type: String, required: true, trim: true },
    location: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] },
    },
    daysOfWeek: [{ type: Number, min: 0, max: 6 }], // 0 = Sunday
    pickupTimeBegin: { type: Number, required: true },
    pickupTimeEnd: { type: Number, required: true },
    timeZone: { type: String, required: true }, // IANA name, e.g. America/Edmonton
    startsOn: { type: String, required: true }, // YYYY-MM-DD
    endsOn: { type: String }, // optional, inclusive
    active: { type: Boolean, default: true },

    notes: { type: String, default: "" },
    foodTypes: [{ type: String, enum: FOOD_TYPES }],
    allergens: [{ type: String, enum: [...ALLERGENS, "none"] }],
    storage: { type: String, enum: STORAGE, default: "ambient" },
    quantity: { type: String, default: "" },
    estimatedWeightKg: { type: Number, min: 0, max: 5000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RecurringSchedules", RecurringSchedulesSchema, "RecurringSchedules");
