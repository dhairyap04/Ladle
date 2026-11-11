const mongoose = require("mongoose");
const { FOOD_TYPES } = require("../constants");

const UsersSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String },
    openHours: { type: String },
    // Strings keep formatting such as leading zeros, dashes or "RR0001".
    phoneNumber: { type: String },
    email: { type: String, required: true, unique: true, trim: true },
    website: { type: String },
    // bcrypt hash; never returned from queries unless explicitly selected.
    password: { type: String, required: true, select: false },
    isFoodbank: { type: Boolean, default: false },
    // sparse: many users (all restaurants) have no charitable number.
    charitableTaxNum: { type: String, unique: true, sparse: true },

    // Food bank receiving profile, used to match postings to what they can take.
    acceptedFoodTypes: [{ type: String, enum: FOOD_TYPES }], // empty: accepts anything
    coldStorage: [{ type: String, enum: ["refrigerated", "frozen"] }],
    maxPickupKg: { type: Number, min: 0, max: 5000 },
    receivingDays: [{ type: Number, min: 0, max: 6 }], // 0 = Sunday; empty: any day
    serviceRadiusKm: { type: Number, min: 1, max: 200 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Users", UsersSchema, "Users");
