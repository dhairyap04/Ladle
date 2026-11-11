const mongoose = require("mongoose");

// A browser/device that asked for push notifications for an account.
const PushSubscriptionsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PushSubscriptions", PushSubscriptionsSchema, "PushSubscriptions");
