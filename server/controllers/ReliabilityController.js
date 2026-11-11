const mongoose = require("mongoose");
const mongoFoodPostings = require("../models/Postings");
const mongoDeliveries = require("../models/Deliveries");
const mongoRatings = require("../models/Ratings");
const mongoUsers = require("../models/Users");
const { notify } = require("../notify");
const reliability = require("../reliability");
const { cancelForPosting } = require("./DeliveriesController");

const notFound = (res) => res.status(404).json({ msg: "Posting not found." });

const loadPosting = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    notFound(res);
    return null;
  }
  const posting = await mongoFoodPostings.findById(req.params.id);
  if (!posting) notFound(res);
  return posting;
};

// When the pickup window opens, from the end time and the window length.
const windowStart = (posting) =>
  posting.pickupEndsAt
    ? new Date(posting.pickupEndsAt - (Math.floor(posting.pickupTimeEnd / 100) * 60 + (posting.pickupTimeEnd % 100) - Math.floor(posting.pickupTimeBegin / 100) * 60 - (posting.pickupTimeBegin % 100)) * 60000)
    : null;

// POST /posting/:id/release — the claiming food bank can't make it after all.
const releaseClaim = async (req, res) => {
  const posting = await loadPosting(req, res);
  if (!posting) return undefined;
  if (!posting.claimedBy || String(posting.claimedBy) !== req.user.id) {
    return res.status(403).json({ msg: "Only the food bank that claimed this can release it." });
  }
  if (posting.status !== "claimed") return res.status(409).json({ msg: "Only claimed postings can be released." });
  if (posting.pickupEndsAt && posting.pickupEndsAt <= new Date()) {
    return res.status(409).json({ msg: "The pickup window has already ended." });
  }
  const late = reliability.isLate(windowStart(posting));
  await reliability.record(req.user.id, late ? "late_release" : "release", { postingId: posting._id });
  posting.set({ status: "open", claimedBy: undefined, claimedByName: undefined, claimedByVerified: undefined, claimedAt: undefined });
  await posting.save();
  await cancelForPosting(posting._id, `${req.user.name} released the pickup, so the delivery isn't needed.`);
  if (posting.donorId) {
    await notify([posting.donorId], {
      type: "posting_claimed",
      title: `${req.user.name} can't pick up your food after all`,
      body: "It's open again, so other food banks can claim it.",
      link: `/view_post/${posting._id}`,
      postingId: posting._id,
    });
  }
  return res.status(200).json(posting);
};

const loadOwnClaimed = async (req, res) => {
  const posting = await loadPosting(req, res);
  if (!posting) return null;
  if (!posting.donorId || String(posting.donorId) !== req.user.id) {
    res.status(403).json({ msg: "Only the restaurant that posted this can do that." });
    return null;
  }
  if (posting.status !== "claimed") {
    res.status(409).json({ msg: "This posting isn't waiting for a pickup." });
    return null;
  }
  return posting;
};

// POST /posting/:id/no-show — the restaurant says nobody came. Only after the window.
const reportNoShow = async (req, res) => {
  const posting = await loadOwnClaimed(req, res);
  if (!posting) return undefined;
  if (posting.pickupEndsAt && posting.pickupEndsAt > new Date()) {
    return res.status(409).json({ msg: "You can report a no-show once the pickup window has ended." });
  }
  const delivery = await mongoDeliveries.findOne({ postingId: posting._id, status: { $in: ["accepted", "picked_up"] } });
  if (delivery && delivery.status === "picked_up") {
    return res.status(409).json({ msg: "A driver has already marked this food as collected." });
  }
  posting.status = "no_show";
  await posting.save();
  await reliability.record(posting.claimedBy, "no_show", { postingId: posting._id });
  await notify([posting.claimedBy], {
    type: "reliability",
    title: `${req.user.name} reported that nobody picked up their food`,
    body: "If your food bank did collect it, mark it picked up within 48 hours and the report will be removed.",
    link: `/view_post/${posting._id}`,
    postingId: posting._id,
  });
  return res.status(200).json(posting);
};

// POST /posting/:id/confirm-pickup — the restaurant confirms the food was collected.
const confirmPickup = async (req, res) => {
  const posting = await loadOwnClaimed(req, res);
  if (!posting) return undefined;
  posting.status = "picked_up";
  posting.pickedUpAt = new Date();
  await posting.save();
  await reliability.record(posting.claimedBy, "pickup_completed", { postingId: posting._id });
  await cancelForPosting(posting._id, "The restaurant confirmed the food was already collected.");
  await notify([posting.claimedBy], {
    type: "posting_picked_up",
    title: `${req.user.name} confirmed you picked up their food`,
    body: "Thanks for collecting it!",
    link: `/view_post/${posting._id}`,
    postingId: posting._id,
  });
  return res.status(200).json(posting);
};

// The people on a completed posting: the restaurant, the food bank and any driver.
const partiesOf = async (posting) => {
  const delivery = await mongoDeliveries.findOne({ postingId: posting._id, status: { $in: ["picked_up", "delivered"] } });
  const ids = [posting.donorId, posting.claimedBy, delivery && delivery.driverId].filter(Boolean).map(String);
  const users = await mongoUsers.find({ _id: { $in: ids } }, "name role isFoodbank");
  return users.map((u) => ({ id: String(u._id), name: u.name, role: u.role || (u.isFoodbank ? "foodbank" : "restaurant") }));
};

// GET /posting/:id/ratings — who you can rate here, and the ratings you've given.
const listRatings = async (req, res) => {
  const posting = await loadPosting(req, res);
  if (!posting) return undefined;
  const parties = await partiesOf(posting);
  if (!parties.some((p) => p.id === req.user.id)) return res.status(403).json({ msg: "You weren't part of this pickup." });
  const mine = await mongoRatings.find({ postingId: posting._id, fromUserId: req.user.id });
  return res.status(200).json({
    canRate: posting.status === "picked_up",
    parties: parties.filter((p) => p.id !== req.user.id),
    mine,
  });
};

// POST /posting/:id/ratings { toUserId, stars, comment } — rate someone you worked with.
const rate = async (req, res) => {
  const posting = await loadPosting(req, res);
  if (!posting) return undefined;
  if (posting.status !== "picked_up") return res.status(409).json({ msg: "You can rate once the food has been picked up." });
  const parties = await partiesOf(posting);
  const { toUserId, comment } = req.body || {};
  const stars = Number(req.body && req.body.stars);
  if (!parties.some((p) => p.id === req.user.id)) return res.status(403).json({ msg: "You weren't part of this pickup." });
  if (toUserId === req.user.id || !parties.some((p) => p.id === toUserId)) {
    return res.status(400).json({ msg: "You can only rate the other people on this pickup." });
  }
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return res.status(400).json({ msg: "Choose 1 to 5 stars." });
  const rating = await mongoRatings.findOneAndUpdate(
    { postingId: posting._id, fromUserId: req.user.id, toUserId },
    { stars, comment: typeof comment === "string" ? comment.trim().slice(0, 500) : "", fromName: req.user.name },
    { upsert: true, new: true, runValidators: true }
  );
  return res.status(200).json(rating);
};

// GET /user/:id/reliability — a signed-in user can check anyone they might work with.
const getReliability = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ msg: "Account not found." });
  const user = await mongoUsers.findById(req.params.id, "name role isFoodbank verificationStatus");
  if (!user) return res.status(404).json({ msg: "Account not found." });
  const recent = await mongoRatings.find({ toUserId: user._id, comment: { $ne: "" } }).sort({ createdAt: -1 }).limit(5);
  return res.status(200).json({
    id: String(user._id),
    name: user.name,
    role: user.role || (user.isFoodbank ? "foodbank" : "restaurant"),
    verified: user.verificationStatus === "verified",
    ...(await reliability.summary(user._id)),
    recentComments: recent.map((r) => ({ stars: r.stars, comment: r.comment, fromName: r.fromName, createdAt: r.createdAt })),
  });
};

module.exports = { releaseClaim, reportNoShow, confirmPickup, listRatings, rate, getReliability };
