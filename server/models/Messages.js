const mongoose = require("mongoose");

// Messages about a posting. Each food bank has its own thread with the
// restaurant (keyed by foodBankId), so questions before a claim stay private.
const MessagesSchema = new mongoose.Schema(
  {
    postingId: { type: mongoose.Schema.Types.ObjectId, ref: "FoodPostings", required: true },
    foodBankId: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    senderName: { type: String, required: true },
    body: { type: String, required: true, maxlength: 1000 },
  },
  { timestamps: true }
);

MessagesSchema.index({ postingId: 1, foodBankId: 1, createdAt: 1 });

module.exports = mongoose.model("Messages", MessagesSchema, "Messages");
