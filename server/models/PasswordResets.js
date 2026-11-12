const mongoose = require("mongoose");

// One-time password reset links. Only a SHA-256 hash of the token is stored,
// so a database leak doesn't hand out working links.
const PasswordResetsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: true }
);

// MongoDB deletes expired links on its own.
PasswordResetsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PasswordResets", PasswordResetsSchema, "PasswordResets");
