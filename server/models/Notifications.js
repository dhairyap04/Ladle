const mongoose = require("mongoose");

const NOTIFICATION_TYPES = [
  "posting_claimed",
  "posting_picked_up",
  "new_posting",
  "new_message",
  "verification",
];

const NotificationsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    link: { type: String, default: "" }, // client path, e.g. /view_post/<id>
    postingId: { type: mongoose.Schema.Types.ObjectId, ref: "FoodPostings" },
    readAt: { type: Date },
  },
  { timestamps: true }
);

NotificationsSchema.index({ userId: 1, createdAt: -1 });
// Old notifications are deleted after 90 days.
NotificationsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model("Notifications", NotificationsSchema, "Notifications");
