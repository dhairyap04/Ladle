const mongoose = require("mongoose");
const { FOOD_TYPES, ROLES, VEHICLES } = require("../constants");

const UsersSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String },
    location: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] }, // [longitude, latitude]
    },
    openHours: { type: String },
    // Strings keep formatting such as leading zeros, dashes or "RR0001".
    phoneNumber: { type: String },
    email: { type: String, required: true, unique: true, trim: true },
    website: { type: String },
    // bcrypt hash; never returned from queries unless explicitly selected.
    password: { type: String, required: true, select: false },
    isFoodbank: { type: Boolean, default: false },
    role: { type: String, enum: ROLES, index: true }, // set from isFoodbank for older accounts by migrate()
    // sparse: many users (all restaurants) have no charitable number.
    charitableTaxNum: { type: String, unique: true, sparse: true },

    // Food bank receiving profile, used to match postings to what they can take.
    acceptedFoodTypes: [{ type: String, enum: FOOD_TYPES }], // empty: accepts anything
    coldStorage: [{ type: String, enum: ["refrigerated", "frozen"] }],
    maxPickupKg: { type: Number, min: 0, max: 5000 },
    receivingDays: [{ type: Number, min: 0, max: 6 }], // 0 = Sunday; empty: any day
    serviceRadiusKm: { type: Number, min: 1, max: 200 },
    // Volunteer drivers also use coldStorage (a cooler), maxPickupKg,
    // receivingDays/openHours (availability) and serviceRadiusKm.
    vehicle: { type: String, enum: VEHICLES },

    // Admins can review food bank verifications (granted via ADMIN_EMAILS).
    isAdmin: { type: Boolean, default: false },
    // Food bank verification, reviewed by an admin.
    verificationStatus: { type: String, enum: ["unverified", "pending", "verified", "rejected"], default: "unverified", index: true },
    verificationNote: { type: String }, // admin's reason, shown to the food bank
    verificationRequestedAt: { type: Date },
    verifiedAt: { type: Date },

    // Notification preferences.
    notifyByEmail: { type: Boolean, default: true },
    notifyNewPostings: { type: Boolean, default: true }, // food banks: alert on matching new food
  },
  { timestamps: true }
);

module.exports = mongoose.model("Users", UsersSchema, "Users");
