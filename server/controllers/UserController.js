const bcrypt = require("bcryptjs");

const mongoUsers = require("../models/Users");
const { setAuthCookies, clearAuthCookies } = require("./authHelper");
const { FOOD_TYPES, ROLES, VEHICLES } = require("../constants");
const { adminEmails } = require("../config");
const { notify } = require("../notify");

// CRA business number for a registered charity: 9 digits, "RR", 4 digits.
const CHARITY_NUMBER = /^\d{9}RR\d{4}$/;
const normalizeCharityNumber = (value) => String(value || "").replace(/[\s-]/g, "").toUpperCase();

// Grants or removes admin according to ADMIN_EMAILS. Returns true if it changed.
const syncAdmin = (user) => {
  const shouldBeAdmin = adminEmails.includes(String(user.email).toLowerCase());
  if (Boolean(user.isAdmin) === shouldBeAdmin) return false;
  user.isAdmin = shouldBeAdmin;
  return true;
};
const { geocodeToPoint } = require("../geocode");

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
  role: user.role || (user.isFoodbank ? "foodbank" : "restaurant"),
  vehicle: user.vehicle || "",
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
  notifyByEmail: user.notifyByEmail !== false,
  notifyNewPostings: user.notifyNewPostings !== false,
  isAdmin: Boolean(user.isAdmin),
  verificationStatus: user.isFoodbank ? user.verificationStatus || "unverified" : undefined,
  verificationNote: user.isFoodbank && user.verificationStatus === "rejected" ? user.verificationNote || "" : undefined,
  hasLocation: Boolean(user.location && user.location.coordinates && user.location.coordinates.length),
});

const registerUser = async (req, res) => {
  const { name, email, password } = req.body || {};
  // Newer clients send role; older ones send isFoodbank.
  const role = ROLES.includes(req.body && req.body.role)
    ? req.body.role
    : typeof (req.body || {}).isFoodbank === "boolean"
      ? (req.body.isFoodbank ? "foodbank" : "restaurant")
      : null;

  if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
    return res.status(400).json({ msg: "Name, email and password are all required." });
  }
  if (!role) {
    return res.status(400).json({ msg: "Please choose restaurant, food bank or volunteer driver." });
  }
  if (password.length < 8) {
    return res.status(400).json({ msg: "Password must be at least 8 characters." });
  }

  try {
    const user = new mongoUsers({
      name: name.trim(),
      email: email.trim(),
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
      isFoodbank: role === "foodbank",
      role,
    });
    syncAdmin(user);
    await user.save();
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

  if (syncAdmin(user)) await user.save();

  setAuthCookies(res, user, (req.body || {}).remember !== false);
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

  for (const field of ["notifyByEmail", ...(req.user.role !== "restaurant" ? ["notifyNewPostings"] : [])]) {
    if (typeof body[field] === "boolean") $set[field] = body[field];
  }

  if ("charitableTaxNum" in $set) {
    $set.charitableTaxNum = normalizeCharityNumber($set.charitableTaxNum);
    if (!CHARITY_NUMBER.test($set.charitableTaxNum)) {
      return res.status(400).json({ msg: "Charitable registration numbers look like 123456789RR0001." });
    }
  }
  // A changed charitable number or name has to be verified again.
  if (req.user.isFoodbank && ("charitableTaxNum" in $set || "charitableTaxNum" in $unset || "name" in $set)) {
    const current = await mongoUsers.findById(req.user.id, "name charitableTaxNum verificationStatus");
    const changed =
      (current && "name" in $set && $set.name !== current.name) ||
      (current && ("charitableTaxNum" in $set || "charitableTaxNum" in $unset) && $set.charitableTaxNum !== current.charitableTaxNum);
    if (changed && current && ["pending", "verified"].includes(current.verificationStatus)) {
      $set.verificationStatus = "unverified";
    }
  }

  if (req.user.role === "driver" && "vehicle" in body) {
    if (body.vehicle === "" || body.vehicle === null) $unset.vehicle = "";
    else if (VEHICLES.includes(body.vehicle)) $set.vehicle = body.vehicle;
    else return res.status(400).json({ msg: "Please choose a vehicle type." });
  }

  if (req.user.role === "foodbank" || req.user.role === "driver") {
    for (const [field, parse] of Object.entries(FOODBANK_FIELDS)) {
      if (!(field in body)) continue;
      if (field === "acceptedFoodTypes" && req.user.role !== "foodbank") continue;
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

  // Geocode a new address so distance search can measure from it.
  if ("address" in $set) {
    const location = await geocodeToPoint($set.address);
    if (location) $set.location = location;
    else $unset.location = "";
  } else if ("address" in $unset) {
    $unset.location = "";
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
    setAuthCookies(res, user, req.user.rm);
    return res.status(200).json({ user: publicUser(user) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ msg: "That charitable number is already registered." });
    }
    throw err;
  }
};

// A food bank asks an admin to verify it.
const requestVerification = async (req, res) => {
  const user = await mongoUsers.findById(req.user.id);
  if (!user) return res.status(404).json({ msg: "Account not found." });
  if (!user.isFoodbank) return res.status(403).json({ msg: "Only food banks can be verified." });
  if (user.verificationStatus === "verified") return res.status(409).json({ msg: "Your food bank is already verified." });
  if (!user.charitableTaxNum || !CHARITY_NUMBER.test(user.charitableTaxNum)) {
    return res.status(400).json({ msg: "Add your charitable registration number to your profile first." });
  }
  if (!user.address) return res.status(400).json({ msg: "Add your address to your profile first." });
  user.verificationStatus = "pending";
  user.verificationRequestedAt = new Date();
  user.verificationNote = undefined;
  await user.save();
  const admins = await mongoUsers.find({ isAdmin: true }, "_id");
  await notify(admins.map((a) => a._id), {
    type: "verification",
    title: `${user.name} asked to be verified`,
    body: `Charitable registration # ${user.charitableTaxNum}.`,
    link: "/admin",
  });
  return res.status(200).json({ user: publicUser(user) });
};

const getUserInfo_handler = async (req, res) => {
  const user = await mongoUsers.findById(req.user.id);
  if (!user) return res.status(404).json({ msg: "Account not found." });
  const { summary } = require("../reliability");
  return res.status(200).json({ user: publicUser(user), reliability: await summary(user._id) });
};

const logoutUser_handler = (req, res) => {
  clearAuthCookies(res);
  res.status(200).json({ msg: "Logged out." });
};

// POST /user/logout-others — signs out every other device (for example a lost
// phone or a shared tablet), keeping this one signed in. Other devices stop
// working within one access-token lifetime (15 minutes).
const logoutOthers_handler = async (req, res) => {
  const user = await mongoUsers.findById(req.user.id);
  if (!user) return res.status(404).json({ msg: "Account not found." });
  user.sessionVersion = (user.sessionVersion || 0) + 1;
  await user.save();
  setAuthCookies(res, user, req.user.rm);
  return res.status(200).json({ msg: "You've been signed out on your other devices." });
};

const isAuthUser_handler = (req, res) => {
  res.status(200).json(req.user);
};

module.exports = {
  logoutOthers_handler,
  requestVerification,
  publicUser,
  CHARITY_NUMBER,
  registerUser,
  updateUser,
  loginUser_handler,
  logoutUser_handler,
  isAuthUser_handler,
  getUserInfo_handler,
};
