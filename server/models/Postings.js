const mongoose = require("mongoose");
const FoodPostings = mongoose.Schema;

const FoodPostingsSchema = new FoodPostings({
  fromRestaurantName: {
    type: String,
    required: true,
    unqiue: false,
  },
  fromRestaurantAddress: {
    type: String,
    required: true,
    unqiue: false,
  },
  toFoodbankName: {
    type: String,
    required: false,
  },
  toFoodbankAddress: {
    type: String,
    required: false,
  },
  pickupTimeBegin: {
    type: Number,
    required: true,
    min: 0,
    max: 2400,
  },
  pickupTimeEnd: {
    type: Number,
    required: true,
    min: 0,
    max: 2400,
  },
  deliveryMethod: {
    type: String,
    required: false,
  },
  notes: {
    type: String,
    required: false,
    default: "",
  },
  // date info
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

var mongoFoodPostings = mongoose.model("FoodPostings", FoodPostingsSchema, "FoodPostings");
module.exports = mongoFoodPostings;

