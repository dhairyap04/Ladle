const mongoose = require("mongoose");
const mongoFoodPostings = require("../models/Postings");
const mongoPostingPhotos = require("../models/PostingPhotos");
const { FOOD_TYPES, ALLERGENS, STORAGE } = require("../constants");

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
  await applyPhotoChange(posting, req.body);
  await posting.save();
  return res.status(201).json(posting);
};

const getPostings = async (req, res) => {
  await expireStalePostings();
  const postings = await mongoFoodPostings.find(OPEN_FILTER).sort({ createdAt: -1 });
  return res.status(200).json(postings);
};

// A donor's own postings, or the pickups a food bank has claimed.
const getMyPostings = async (req, res) => {
  await expireStalePostings();
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
  const posting = await mongoFoodPostings.findOneAndUpdate(
    { _id: req.params.id, ...OPEN_FILTER },
    {
      $set: {
        status: "claimed",
        claimedBy: req.user.id,
        claimedByName: req.user.name,
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
  if (posting.status !== "claimed") {
    return res.status(409).json({ msg: "Only claimed postings can be marked picked up." });
  }
  posting.status = "picked_up";
  posting.pickedUpAt = new Date();
  await posting.save();
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
  posting.set(values);
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
  parsePickupTime,
  parsePostingInput,
  expireStalePostings,
};
