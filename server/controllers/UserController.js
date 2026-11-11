const bcrypt = require("bcryptjs");

const mongoUsers = require("../models/Users");
const { setAuthCookies, clearAuthCookies } = require("./authHelper");
const { FOOD_TYPES } = require("../constants");

const BCRYPT_ROUNDS = 12;
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$/;
// Profile fields a user may change; anything else in the body is ignored.
const EDITABLE_FIELDS = ["name", "address", "openHours", "phoneNumber", "website", "charitableTaxNum"];

// Food bank receiving-profile fields, each with a parser that returns the value
// to store, undefined to clear the field, or throws a user-facing message.
const pickKnown = (list, allowed) =>
  Array.isArray(list) ? [...new Set(list.filter((item) => allowed.includes(item)))] : [];
const optionalNumber = (label, min, max) => (value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} must be between ${min} and ${max}.`);
  return n;
};
const FOODBANK_FIELDS = {
  acceptedFoodTypes: (value) => pickKnown(value, FOOD_TYPES),
  coldStorage: (value) => pickKnown(value, ["refrigerated", "frozen"]),
  receivingDays: (value) =>
    Array.isArray(value) ? [...new Set(value.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [],
  maxPickupKg: optionalNumber("Maximum pickup weight", 1, 5000),
  serviceRadiusKm: optionalNumber("Service radius", 1, 200),
};

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const publicUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  isFoodbank: user.isFoodbank,
  address: user.address || "",
  openHours: user.openHours || "",
  phoneNumber: user.phoneNumber || "",
  website: user.website || "",
  charitableTaxNum: user.charitableTaxNum || "",
  acceptedFoodTypes: user.acceptedFoodTypes || [],
  coldStorage: user.coldStorage || [],
  receivingDays: user.receivingDays || [],
  maxPickupKg: user.maxPickupKg ?? null,
  serviceRadiusKm: user.serviceRadiusKm ?? null,
});

const registerUser = async (req, res) => {
  const { name, email, password, isFoodbank } = req.body || {};

  if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
    return res.status(400).json({ msg: "Name, email and password are all required." });
  }
  if (typeof isFoodbank !== "boolean") {
    return res.status(400).json({ msg: "Please say whether you are a food bank." });
  }
  if (password.length < 8) {
    return res.status(400).json({ msg: "Password must be at least 8 characters." });
  }

  try {
    const user = await mongoUsers.create({
      name: name.trim(),
      email: email.trim(),
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
      isFoodbank,
    });
    setAuthCookies(res, user);
    return res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ msg: "An account with that email already exists." });
    }
    throw err;
  }
};

const loginUser_handler = async (req, res) => {
  const { email, password } = req.body || {};
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    return res.status(400).json({ msg: "Email and password are required." });
  }

  const user = await mongoUsers.findOne({ email: email.trim() }).select("+password");
  const invalid = () => res.status(401).json({ msg: "Invalid email or password." });
  if (!user) return invalid();

  if (BCRYPT_HASH.test(user.password)) {
    if (!(await bcrypt.compare(password, user.password))) return invalid();
  } else {
    // Accounts created before hashing was added store the password as plain text:
    // accept it once, then replace it with a hash.
    if (user.password !== password) return invalid();
    user.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await user.save();
  }

  setAuthCookies(res, user);
  return res.status(200).json({ user: publicUser(user) });
};

const updateUser = async (req, res) => {
  const body = req.body || {};
  const $set = {};
  const $unset = {};

  for (const field of EDITABLE_FIELDS) {
    if (!(field in body)) continue;
    const value = body[field] == null ? "" : String(body[field]).trim();
    if (value === "") {
      if (field === "name") {
        return res.status(400).json({ msg: "Name cannot be empty." });
      }
      $unset[field] = "";
    } else {
      $set[field] = value;
    }
  }

  if (req.user.isFoodbank) {
    for (const [field, parse] of Object.entries(FOODBANK_FIELDS)) {
      if (!(field in body)) continue;
      let value;
      try {
        value = parse(body[field]);
      } catch (err) {
        return res.status(400).json({ msg: err.message });
      }
      if (value === undefined) $unset[field] = "";
      else $set[field] = value;
    }
  }

  const update = {};
  if (Object.keys($set).length) update.$set = $set;
  if (Object.keys($unset).length) update.$unset = $unset;
  if (!Object.keys(update).length) {
    return res.status(400).json({ msg: "Nothing to update." });
  }

  try {
    const user = await mongoUsers.findByIdAndUpdate(req.user.id, update, {
      new: true,
      runValidators: true,
    });
    if (!user) return res.status(404).json({ msg: "Account not found." });

    // Re-issue tokens so a changed name shows up on new postings right away.
    setAuthCookies(res, user);
    return res.status(200).json({ user: publicUser(user) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ msg: "That charitable number is already registered." });
    }
    throw err;
  }
};

const getUserInfo_handler = async (req, res) => {
  const user = await mongoUsers.findById(req.user.id);
  if (!user) return res.status(404).json({ msg: "Account not found." });
  return res.status(200).json({ user: publicUser(user) });
};

const logoutUser_handler = (req, res) => {
  clearAuthCookies(res);
  res.status(200).json({ msg: "Logged out." });
};

const isAuthUser_handler = (req, res) => {
  res.status(200).json(req.user);
};

module.exports = {
  registerUser,
  updateUser,
  loginUser_handler,
  logoutUser_handler,
  isAuthUser_handler,
  getUserInfo_handler,
};
