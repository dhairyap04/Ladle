const mongoose = require("mongoose");
const mongoFoodPostings = require("../models/Postings");
const mongoPostingPhotos = require("../models/PostingPhotos");
const mongoUsers = require("../models/Users");
const { FOOD_TYPES, ALLERGENS, STORAGE } = require("../constants");
const { fitProblems } = require("../matching");
const { geocodeToPoint, distanceKm } = require("../geocode");
const { notify } = require("../notify");
const { formatWindow } = require("../format");
const { generateRecurringPostings } = require("../recurring");
const reliability = require("../reliability");
const { cancelForPosting } = require("./DeliveriesController");

const DISPUTE_HOURS = 48; // a food bank can contest a no-show this long after the window
const UNCONFIRMED_AFTER_HOURS = 72;

const { requireVerifiedToClaim } = require("../config");

const MAX_NEW_POSTING_ALERTS = 200;

// Tells food banks about a new posting that suits their profile and, when both
// have coordinates and the food bank set a service radius, is within it.
const alertFoodBanks = async (posting) => {
  const foodBanks = await mongoUsers.find({ isFoodbank: true, notifyNewPostings: { $ne: false } });
  const recipients = foodBanks.filter((bank) => {
    if (fitProblems(posting, bank).length) return false;
    const a = posting.location && posting.location.coordinates;
    const b = bank.location && bank.location.coordinates;
    if (bank.serviceRadiusKm && a && a.length === 2 && b && b.length === 2) {
      return distanceKm(a, b) <= bank.serviceRadiusKm;
    }
    return true;
  });
  await notify(recipients.slice(0, MAX_NEW_POSTING_ALERTS).map((b) => b._id), {
    type: "new_posting",
    title: `New food from ${posting.fromRestaurantName}`,
    body: `Pickup ${formatWindow(posting)} at ${posting.fromRestaurantAddress}.`,
    link: `/view_post/${posting._id}`,
    postingId: posting._id,
  });
};

// Postings created before the status field existed have no status and count as open.
const OPEN_FILTER = { $or: [{ status: "open" }, { status: { $exists: false } }] };
const MAX_DAYS_AHEAD = 60;
const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Keeps only known values from a list, without duplicates.
const pickKnown = (list, allowed) =>
  Array.isArray(list) ? [...new Set(list.filter((item) => allowed.includes(item)))] : [];

// Food description and safety fields. Returns { values } or { error }.
const parseFoodDetails = (body) => {
  const foodTypes = pickKnown(body.foodTypes, FOOD_TYPES);
  let allergens = pickKnown(body.allergens, [...ALLERGENS, "none"]);
  if (allergens.includes("none") && allergens.length > 1) {
    return { error: "Choose either specific allergens or \"None of these\", not both." };
  }

  const storage = body.storage === undefined || body.storage === "" ? "ambient" : body.storage;
  if (!STORAGE.includes(storage)) return { error: "Please choose how the food is stored." };

  let preparedAt;
  if (body.preparedAt) {
    preparedAt = new Date(body.preparedAt);
    if (Number.isNaN(preparedAt.getTime())) return { error: "Please enter a valid preparation time." };
    if (preparedAt - Date.now() > 10 * 60 * 1000) return { error: "The preparation time can't be in the future." };
  }

  let estimatedWeightKg;
  if (body.estimatedWeightKg !== undefined && body.estimatedWeightKg !== null && body.estimatedWeightKg !== "") {
    estimatedWeightKg = Number(body.estimatedWeightKg);
    if (!Number.isFinite(estimatedWeightKg) || estimatedWeightKg <= 0 || estimatedWeightKg > 5000) {
      return { error: "The estimated weight must be between 0 and 5000 kg." };
    }
    estimatedWeightKg = Math.round(estimatedWeightKg * 10) / 10;
  }

  const quantity = typeof body.quantity === "string" ? body.quantity.trim().slice(0, 120) : "";
  return { values: { foodTypes, allergens, storage, preparedAt, quantity, estimatedWeightKg } };
};

// "data:image/jpeg;base64,..." -> { contentType, data } or { error }.
const parsePhoto = (dataUrl) => {
  const match = typeof dataUrl === "string" && /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match || !PHOTO_TYPES.includes(match[1])) {
    return { error: "Photos must be JPEG, PNG or WebP images." };
  }
  const data = Buffer.from(match[2], "base64");
  if (data.length > MAX_PHOTO_BYTES) return { error: "That photo is too large. Please use one under 1.5 MB." };
  return { contentType: match[1], data };
};

// Saves, replaces or removes a posting's photo according to the request body.
const applyPhotoChange = async (posting, body) => {
  if (body.photo) {
    const { contentType, data } = parsePhoto(body.photo);
    await mongoPostingPhotos.findOneAndUpdate(
      { postingId: posting._id },
      { contentType, data },
      { upsert: true }
    );
    posting.hasPhoto = true;
  } else if (body.removePhoto) {
    await mongoPostingPhotos.deleteOne({ postingId: posting._id });
    posting.hasPhoto = false;
  }
};

// Accepts "HH:MM" (what <input type="time"> produces) or an HHMM number such as 1430.
// Returns the HHMM integer, or null when the value isn't a valid time.
const parsePickupTime = (value) => {
  let hours;
  let minutes;
  if (typeof value === "string" && /^\d{1,2}:\d{2}$/.test(value.trim())) {
    [hours, minutes] = value.trim().split(":").map(Number);
  } else if (
    (typeof value === "number" || (typeof value === "string" && /^\d{1,4}$/.test(value.trim()))) &&
    Number.isInteger(Number(value)) &&
    Number(value) >= 0
  ) {
    const hhmm = Number(value);
    hours = Math.floor(hhmm / 100);
    minutes = hhmm % 100;
  } else {
    return null;
  }
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) return null;
  return hours * 100 + minutes;
};

// Validates the fields a donor sends when creating or editing a posting.
// Returns { values } on success or { error } with a user-facing message.
// The client computes pickupEndsAt from the pickup date and end time in the
// restaurant's own time zone, which the server has no other way to know.
const parsePostingInput = (body = {}) => {
  const { fromRestaurantAddress, notes, pickupDate } = body;
  const pickupTimeBegin = parsePickupTime(body.pickupTimeBegin);
  const pickupTimeEnd = parsePickupTime(body.pickupTimeEnd);
  const pickupEndsAt = new Date(body.pickupEndsAt);

  if (typeof fromRestaurantAddress !== "string" || !fromRestaurantAddress.trim()) {
    return { error: "Please enter the pickup address." };
  }
  if (typeof pickupDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)) {
    return { error: "Please enter the pickup date." };
  }
  if (pickupTimeBegin === null || pickupTimeEnd === null) {
    return { error: "Please enter a valid pickup start and end time." };
  }
  if (pickupTimeEnd <= pickupTimeBegin) {
    return { error: "The pickup end time must be after the start time." };
  }
  if (!body.pickupEndsAt || Number.isNaN(pickupEndsAt.getTime())) {
    return { error: "Please enter a valid pickup date and time." };
  }
  if (pickupEndsAt <= new Date()) {
    return { error: "The pickup window has already ended. Please choose a later date or time." };
  }
  if (pickupEndsAt - Date.now() > MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
    return { error: `Pickups can be scheduled up to ${MAX_DAYS_AHEAD} days ahead.` };
  }

  const food = parseFoodDetails(body);
  if (food.error) return { error: food.error };
  if (body.photo) {
    const photo = parsePhoto(body.photo);
    if (photo.error) return { error: photo.error };
  }

  return {
    values: {
      ...food.values,
      fromRestaurantAddress: fromRestaurantAddress.trim(),
      pickupDate,
      pickupTimeBegin,
      pickupTimeEnd,
      pickupEndsAt,
      notes: typeof notes === "string" ? notes.trim() : "",
    },
  };
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Open postings whose pickup window has passed become expired. Run before reads
// and status changes so nobody sees or claims food that is no longer available.
const expireStalePostings = () =>
  mongoFoodPostings.updateMany(
    { ...OPEN_FILTER, pickupEndsAt: { $lte: new Date() } },
    { $set: { status: "expired" } }
  );

// Brings postings up to date before they're listed: creates today's and
// tomorrow's postings from recurring schedules, then expires stale ones.
const refreshPostings = async () => {
  await generateRecurringPostings({ onCreated: (posting) => alertFoodBanks(posting) });
  await expireStalePostings();
  // Claims nobody resolved: close them without counting against anyone.
  await mongoFoodPostings.updateMany(
    { status: "claimed", pickupEndsAt: { $lte: new Date(Date.now() - UNCONFIRMED_AFTER_HOURS * 3600e3) } },
    { $set: { status: "unconfirmed" } }
  );
};

const notFound = (res) => res.status(404).json({ msg: "Posting not found." });

const createPosting = async (req, res) => {
  const { values, error } = parsePostingInput(req.body);
  if (error) return res.status(400).json({ msg: error });

  const posting = new mongoFoodPostings({
    ...values,
    donorId: req.user.id,
    fromRestaurantName: req.user.name,
    status: "open",
  });
  posting.location = await geocodeToPoint(posting.fromRestaurantAddress);
  await applyPhotoChange(posting, req.body);
  await posting.save();
  await alertFoodBanks(posting);
  return res.status(201).json(posting);
};

const csv = (value) => (typeof value === "string" && value ? value.split(",").map((v) => v.trim()).filter(Boolean) : []);

// Builds the MongoDB filter for GET /posting/all from its query string.
// Distance, fit and sorting are applied afterwards in JavaScript.
const searchFilter = (query) => {
  const and = [OPEN_FILTER];
  const foodTypes = csv(query.foodTypes).filter((t) => FOOD_TYPES.includes(t));
  if (foodTypes.length) and.push({ foodTypes: { $in: foodTypes } });
  const storage = csv(query.storage).filter((t) => STORAGE.includes(t));
  if (storage.length) {
    // Postings saved before storage existed count as room temperature.
    and.push(storage.includes("ambient")
      ? { $or: [{ storage: { $in: storage } }, { storage: { $exists: false } }] }
      : { storage: { $in: storage } });
  }
  const avoid = csv(query.excludeAllergens).filter((a) => ALLERGENS.includes(a));
  if (avoid.length) and.push({ allergens: { $nin: avoid } });
  if (query.allergenInfo === "1") and.push({ "allergens.0": { $exists: true } });
  if (/^\d{4}-\d{2}-\d{2}$/.test(query.date || "")) and.push({ pickupDate: query.date });
  const after = parsePickupTime(query.pickupAfter);
  if (after !== null && query.pickupAfter !== undefined) and.push({ pickupTimeEnd: { $gt: after } });
  const before = parsePickupTime(query.pickupBefore);
  if (before !== null && query.pickupBefore !== undefined) and.push({ pickupTimeBegin: { $lt: before } });
  if (typeof query.q === "string" && query.q.trim()) {
    const pattern = new RegExp(query.q.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    and.push({ $or: [{ fromRestaurantName: pattern }, { notes: pattern }, { quantity: pattern }, { fromRestaurantAddress: pattern }] });
  }
  return { $and: and };
};

// Where distances are measured from: ?lat=&lng= (e.g. the browser's location),
// otherwise the signed-in user's geocoded profile address.
const searchOrigin = (query, profile) => {
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  if (query.lat !== undefined && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    return { coordinates: [lng, lat], source: "device" };
  }
  if (profile && profile.location && profile.location.coordinates && profile.location.coordinates.length === 2) {
    return { coordinates: profile.location.coordinates, source: "profile" };
  }
  return null;
};

// GET /posting/all — open postings, with optional filters:
//   lat, lng, radiusKm        distance from a point (or the profile address)
//   date=YYYY-MM-DD           pickup date
//   pickupAfter, pickupBefore pickup window overlaps these times (HH:MM)
//   foodTypes, storage, excludeAllergens   comma-separated lists
//   allergenInfo=1            only postings that list their allergens
//   fitsMe=1                  only postings that suit the food bank's profile
//   q                         text search
//   sort=newest|soonest|distance
// Each posting gets distanceKm when both ends have coordinates, and, for a
// signed-in food bank, fitProblems (empty when it suits their profile).
const getPostings = async (req, res) => {
  await refreshPostings();
  const query = req.query || {};
  const profile = req.user ? await mongoUsers.findById(req.user.id) : null;
  const origin = searchOrigin(query, profile);
  const radiusKm = Number(query.radiusKm);

  const postings = await mongoFoodPostings.find(searchFilter(query)).sort({ createdAt: -1 });
  let results = postings.map((p) => {
    const json = p.toJSON();
    if (origin && p.location && p.location.coordinates && p.location.coordinates.length === 2) {
      json.distanceKm = Math.round(distanceKm(origin.coordinates, p.location.coordinates) * 10) / 10;
    }
    if (profile && profile.isFoodbank) json.fitProblems = fitProblems(p, profile);
    return json;
  });

  if (origin && radiusKm > 0) {
    results = results.filter((p) => p.distanceKm !== undefined && p.distanceKm <= radiusKm);
  }
  if (query.fitsMe === "1" && profile && profile.isFoodbank) {
    results = results.filter((p) => p.fitProblems.length === 0);
  }
  if (query.sort === "distance") {
    results.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  } else if (query.sort === "soonest") {
    results.sort((a, b) => new Date(a.pickupEndsAt || 8.64e15) - new Date(b.pickupEndsAt || 8.64e15));
  }

  res.set("X-Search-Origin", origin ? origin.source : "none");
  return res.status(200).json(results);
};

// A donor's own postings, or the pickups a food bank has claimed.
const getMyPostings = async (req, res) => {
  await refreshPostings();
  const filter = req.user.isFoodbank ? { claimedBy: req.user.id } : { donorId: req.user.id };
  const postings = await mongoFoodPostings.find(filter).sort({ createdAt: -1 }).limit(50);
  return res.status(200).json(postings);
};

const getOnePost = async (req, res) => {
  if (!isValidId(req.params.id)) return notFound(res);
  await expireStalePostings();
  const posting = await mongoFoodPostings.findById(req.params.id);
  if (!posting) return notFound(res);
  return res.status(200).json(posting);
};

// A food bank reserves an open posting. The status check and update happen in
// one atomic operation, so two food banks can't claim the same posting.
const claimPosting = async (req, res) => {
  if (!isValidId(req.params.id)) return notFound(res);
  await expireStalePostings();
  const foodBank = await mongoUsers.findById(req.user.id, "verificationStatus");
  const verified = Boolean(foodBank && foodBank.verificationStatus === "verified");
  if (requireVerifiedToClaim && !verified) {
    return res.status(403).json({ msg: "Your food bank needs to be verified before it can claim food. You can request verification on your profile." });
  }
  const posting = await mongoFoodPostings.findOneAndUpdate(
    { _id: req.params.id, ...OPEN_FILTER },
    {
      $set: {
        status: "claimed",
        claimedBy: req.user.id,
        claimedByName: req.user.name,
        claimedByVerified: verified,
        claimedAt: new Date(),
      },
    },
    { new: true }
  );
  if (!posting) {
    const exists = await mongoFoodPostings.exists({ _id: req.params.id });
    return exists
      ? res.status(409).json({ msg: "This posting is no longer available." })
      : notFound(res);
  }
  if (posting.donorId) {
    await notify([posting.donorId], {
      type: "posting_claimed",
      title: `${req.user.name} claimed your food`,
      body: `They'll pick it up ${formatWindow(posting)}.`,
      link: `/view_post/${posting._id}`,
      postingId: posting._id,
    });
  }
  return res.status(200).json(posting);
};

// The food bank that claimed a posting confirms it collected the food.
const markPickedUp = async (req, res) => {
  if (!isValidId(req.params.id)) return notFound(res);
  const posting = await mongoFoodPostings.findById(req.params.id);
  if (!posting) return notFound(res);
  if (!posting.claimedBy || String(posting.claimedBy) !== req.user.id) {
    return res.status(403).json({ msg: "Only the food bank that claimed this posting can mark it picked up." });
  }
  // A food bank can contest a no-show by confirming it did collect the food.
  const disputing = posting.status === "no_show" &&
    posting.pickupEndsAt && Date.now() - posting.pickupEndsAt < DISPUTE_HOURS * 3600e3;
  if (posting.status !== "claimed" && !disputing) {
    return res.status(409).json({ msg: "Only claimed postings can be marked picked up." });
  }
  posting.status = "picked_up";
  posting.pickedUpAt = new Date();
  await posting.save();
  if (disputing) await reliability.unrecord(posting.claimedBy, "no_show", { postingId: posting._id });
  await reliability.record(posting.claimedBy, "pickup_completed", { postingId: posting._id });
  await cancelForPosting(posting._id, `${req.user.name} collected the food themselves, so no driver is needed.`);
  if (posting.donorId) {
    await notify([posting.donorId], {
      type: "posting_picked_up",
      title: `${req.user.name} picked up your food`,
      body: "Thank you for donating! It's now counted in your impact.",
      link: `/view_post/${posting._id}`,
      postingId: posting._id,
    });
  }
  return res.status(200).json(posting);
};

// Loads a posting the requesting donor owns and that is still open.
// Sends the error response itself and returns null when that isn't the case.
const loadOwnOpenPosting = async (req, res, verb) => {
  if (!isValidId(req.params.id)) {
    notFound(res);
    return null;
  }
  await expireStalePostings();
  const posting = await mongoFoodPostings.findById(req.params.id);
  if (!posting) {
    notFound(res);
    return null;
  }
  if (!posting.donorId || String(posting.donorId) !== req.user.id) {
    res.status(403).json({ msg: `You can only ${verb} your own postings.` });
    return null;
  }
  if (posting.status && posting.status !== "open") {
    res.status(409).json({ msg: `Only open postings can be ${verb === "edit" ? "edited" : "withdrawn"}.` });
    return null;
  }
  return posting;
};

// The restaurant that created an open posting changes its details.
const editPosting = async (req, res) => {
  const posting = await loadOwnOpenPosting(req, res, "edit");
  if (!posting) return undefined;
  const { values, error } = parsePostingInput(req.body);
  if (error) return res.status(400).json({ msg: error });
  const addressChanged = values.fromRestaurantAddress !== posting.fromRestaurantAddress;
  posting.set(values);
  if (addressChanged || !posting.location) {
    posting.location = await geocodeToPoint(posting.fromRestaurantAddress);
  }
  await applyPhotoChange(posting, req.body);
  await posting.save();
  return res.status(200).json(posting);
};

const getPhoto = async (req, res) => {
  if (!isValidId(req.params.id)) return notFound(res);
  const photo = await mongoPostingPhotos.findOne({ postingId: req.params.id });
  if (!photo) return res.status(404).json({ msg: "No photo." });
  res.set("Content-Type", photo.contentType);
  // Clients add ?v=<updatedAt>, so a cached copy is replaced when the photo changes.
  res.set("Cache-Control", "public, max-age=86400");
  return res.send(photo.data);
};

// The restaurant that created an open posting withdraws it.
const cancelPosting = async (req, res) => {
  const posting = await loadOwnOpenPosting(req, res, "withdraw");
  if (!posting) return undefined;
  posting.status = "cancelled";
  await posting.save();
  return res.status(200).json(posting);
};

module.exports = {
  createPosting,
  getPostings,
  getMyPostings,
  getOnePost,
  claimPosting,
  markPickedUp,
  editPosting,
  cancelPosting,
  getPhoto,
  refreshPostings,
  parseFoodDetails,
  parsePickupTime,
  parsePostingInput,
  expireStalePostings,
};
