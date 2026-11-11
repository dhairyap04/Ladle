const mongoose = require("mongoose");
const mongoFoodPostings = require("../models/Postings");

// Postings created before the status field existed have no status and count as open.
const OPEN_FILTER = { $or: [{ status: "open" }, { status: { $exists: false } }] };

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

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const createPosting = async (req, res) => {
  const { fromRestaurantAddress, notes } = req.body || {};
  const pickupTimeBegin = parsePickupTime(req.body && req.body.pickupTimeBegin);
  const pickupTimeEnd = parsePickupTime(req.body && req.body.pickupTimeEnd);

  if (typeof fromRestaurantAddress !== "string" || !fromRestaurantAddress.trim()) {
    return res.status(400).json({ msg: "Please enter the pickup address." });
  }
  if (pickupTimeBegin === null || pickupTimeEnd === null) {
    return res.status(400).json({ msg: "Please enter a valid pickup start and end time." });
  }
  if (pickupTimeEnd <= pickupTimeBegin) {
    return res.status(400).json({ msg: "The pickup end time must be after the start time." });
  }

  const posting = await mongoFoodPostings.create({
    donorId: req.user.id,
    fromRestaurantName: req.user.name,
    fromRestaurantAddress: fromRestaurantAddress.trim(),
    pickupTimeBegin,
    pickupTimeEnd,
    notes: typeof notes === "string" ? notes.trim() : "",
    status: "open",
  });
  return res.status(201).json(posting);
};

const getPostings = async (req, res) => {
  const postings = await mongoFoodPostings.find(OPEN_FILTER).sort({ createdAt: -1 });
  return res.status(200).json(postings);
};

const getOnePost = async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ msg: "Posting not found." });
  }
  const posting = await mongoFoodPostings.findById(req.params.id);
  if (!posting) {
    return res.status(404).json({ msg: "Posting not found." });
  }
  return res.status(200).json(posting);
};

// A food bank reserves an open posting. The status check and update happen in
// one atomic operation, so two food banks can't claim the same posting.
const claimPosting = async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ msg: "Posting not found." });
  }
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
      ? res.status(409).json({ msg: "This posting has already been claimed or withdrawn." })
      : res.status(404).json({ msg: "Posting not found." });
  }
  return res.status(200).json(posting);
};

// The restaurant that created an open posting withdraws it.
const cancelPosting = async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ msg: "Posting not found." });
  }
  const posting = await mongoFoodPostings.findById(req.params.id);
  if (!posting) {
    return res.status(404).json({ msg: "Posting not found." });
  }
  if (!posting.donorId || String(posting.donorId) !== req.user.id) {
    return res.status(403).json({ msg: "You can only withdraw your own postings." });
  }
  if (posting.status && posting.status !== "open") {
    return res.status(409).json({ msg: "Only open postings can be withdrawn." });
  }
  posting.status = "cancelled";
  await posting.save();
  return res.status(200).json(posting);
};

module.exports = {
  createPosting,
  getPostings,
  getOnePost,
  claimPosting,
  cancelPosting,
  parsePickupTime,
};
