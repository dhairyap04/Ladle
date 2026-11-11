const mongoose = require("mongoose");

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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Users", UsersSchema, "Users");
