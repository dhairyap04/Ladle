const mongoose = require("mongoose");

// Photos a driver takes when collecting or dropping off food. One per stage.
const DeliveryPhotosSchema = new mongoose.Schema(
  {
    deliveryId: { type: mongoose.Schema.Types.ObjectId, ref: "Deliveries", required: true },
    stage: { type: String, enum: ["pickup", "dropoff"], required: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

DeliveryPhotosSchema.index({ deliveryId: 1, stage: 1 }, { unique: true });

module.exports = mongoose.model("DeliveryPhotos", DeliveryPhotosSchema, "DeliveryPhotos");
