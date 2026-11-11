const mongoose = require("mongoose");
const mongoUsers = require("../models/Users");
const mongoFoodPostings = require("../models/Postings");
const { notify } = require("../notify");
const { publicUser } = require("./UserController");
const reliability = require("../reliability");

const adminView = (user) => ({
  ...publicUser(user),
  verificationNote: user.verificationNote || "",
  verificationRequestedAt: user.verificationRequestedAt || null,
  verifiedAt: user.verifiedAt || null,
  createdAt: user.createdAt,
});

// GET /admin/overview — headline numbers for the console.
const getOverview = async (req, res) => {
  const [restaurants, foodBanks, drivers, byVerification, byStatus, completed] = await Promise.all([
    mongoUsers.countDocuments({ role: "restaurant" }),
    mongoUsers.countDocuments({ role: "foodbank" }),
    mongoUsers.countDocuments({ role: "driver" }),
    mongoUsers.aggregate([{ $match: { isFoodbank: true } }, { $group: { _id: "$verificationStatus", n: { $sum: 1 } } }]),
    mongoFoodPostings.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    mongoFoodPostings.aggregate([{ $match: { status: "picked_up" } }, { $group: { _id: null, kg: { $sum: "$estimatedWeightKg" } } }]),
  ]);
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id || "unverified", r.n]));
  return res.status(200).json({
    restaurants,
    foodBanks,
    drivers,
    verification: toMap(byVerification),
    postings: toMap(byStatus),
    kgRescued: Math.round(((completed[0] && completed[0].kg) || 0) * 10) / 10,
    flagged: Object.values(await reliability.summaries((await mongoUsers.find({ role: { $ne: "restaurant" } }, "_id")).map((u) => u._id))).filter((s) => s.flagged).length,
  });
};

// GET /admin/users?q=&role=foodbank|restaurant&verification=pending
const listUsers = async (req, res) => {
  const { q, role, verification } = req.query;
  const filter = {};
  if (["restaurant", "foodbank", "driver"].includes(role)) filter.role = role;
  if (["unverified", "pending", "verified", "rejected"].includes(verification)) {
    filter.isFoodbank = true;
    filter.verificationStatus = verification;
  }
  if (typeof q === "string" && q.trim()) {
    const pattern = new RegExp(q.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: pattern }, { email: pattern }, { charitableTaxNum: pattern }];
  }
  const sort = verification === "pending" ? { verificationRequestedAt: 1 } : { createdAt: -1 };
  let users = await mongoUsers.find(filter).sort(sort).limit(req.query.flagged === "1" ? 1000 : 100);
  const summaries = await reliability.summaries(users.map((u) => u._id));
  if (req.query.flagged === "1") users = users.filter((u) => summaries[String(u._id)].flagged).slice(0, 100);
  return res.status(200).json(users.map((u) => ({ ...adminView(u), reliability: summaries[String(u._id)] })));
};

// POST /admin/users/:id/verification { decision: "verified" | "rejected" | "unverified", note }
const decideVerification = async (req, res) => {
  const { decision } = req.body || {};
  const note = typeof req.body.note === "string" ? req.body.note.trim().slice(0, 500) : "";
  if (!["verified", "rejected", "unverified"].includes(decision)) {
    return res.status(400).json({ msg: "Choose verified, rejected or unverified." });
  }
  if (decision === "rejected" && !note) {
    return res.status(400).json({ msg: "Please tell the food bank why, so they can fix it." });
  }
  const user = mongoose.Types.ObjectId.isValid(req.params.id) ? await mongoUsers.findById(req.params.id) : null;
  if (!user || !user.isFoodbank) return res.status(404).json({ msg: "Food bank not found." });

  user.verificationStatus = decision;
  user.verificationNote = note || undefined;
  user.verifiedAt = decision === "verified" ? new Date() : undefined;
  await user.save();

  const messages = {
    verified: { title: "Your food bank is verified", body: "Restaurants will now see a verified badge when you claim their food." },
    rejected: { title: "We couldn't verify your food bank", body: note },
    unverified: { title: "Your verification was removed", body: note || "Contact Ladle if you think this is a mistake." },
  };
  await notify([user._id], { type: "verification", ...messages[decision], link: "/view_profile" });
  return res.status(200).json(adminView(user));
};

module.exports = { getOverview, listUsers, decideVerification };
