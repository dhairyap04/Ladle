const mongoose = require("mongoose");
const Users = mongoose.Schema;

const UsersSchema = new Users({
  name: {
    type: String,
    required: true,
    unique: false,
  },
  address: {
    type: String,
    required: false,
  },
  openHours: {
    type: String,
    required: false,
  },
  phoneNumber: {
    type: Number,
    required: false,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  website: {
    type: String,
    required: false,
    unique: false,
  },
  password: {
    type: String,
    required: true,
  },
  isFoodbank: {
    type: Boolean,
    default: false,
  },
  charitableTaxNum: {
    type: Number,
    required: false,
    unique: true,
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

var mongoUsers = mongoose.model('Users', UsersSchema, 'Users');
module.exports = mongoUsers;