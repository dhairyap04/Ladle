const mongoose = require("mongoose");

// One person's 1-5 star rating of another after a completed pickup or delivery.
const RatingsSchema = new mongoose.Schema(
  {
    postingId: { type: mongoose.Schema.Types.ObjectId, ref: "FoodPostings", required: true },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    fromName: { type: String, required: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true, index: true },
    stars: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true }
);

RatingsSchema.index({ postingId: 1, fromUserId: 1, toUserId: 1 }, { unique: true });

module.exports = mongoose.model("Ratings", RatingsSchema, "Ratings");
