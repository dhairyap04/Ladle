const mongoose = require("mongoose");
const mongoUsers = require("../models/Users");
const mongoFoodPostings = require("../models/Postings");
const { notify } = require("../notify");
const { publicUser } = require("./UserController");
const reliability = require("../reliability");
const mongoDeliveries = require("../models/Deliveries");
const handoff = require("../handoff");

const REVIEW_DAYS = 30;
// Deliveries an admin should look at: open disputes, and recent ones whose
// location or timing looked wrong.
const reviewFilter = () => ({
  $or: [
    { "dispute.at": { $exists: true }, "dispute.resolution": { $exists: false } },
    {
      "flags.0": { $exists: true },
      flagsReviewedAt: { $exists: false },
      "dispute.at": { $exists: false },
      updatedAt: { $gte: new Date(Date.now() - REVIEW_DAYS * 864e5) },
    },
  ],
});

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
    deliveriesToReview: await mongoDeliveries.countDocuments(reviewFilter()),
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

// GET /admin/deliveries — disputed or flagged deliveries, oldest first.
const listDeliveries = async (req, res) => {
  const deliveries = await mongoDeliveries.find(reviewFilter()).sort({ updatedAt: 1 }).limit(100).lean();
  const people = await mongoUsers.find(
    { _id: { $in: deliveries.flatMap((d) => [d.driverId, d.dispute && d.dispute.byUserId]).filter(Boolean) } },
    "name email phoneNumber"
  );
  const byId = Object.fromEntries(people.map((p) => [String(p._id), { name: p.name, email: p.email, phoneNumber: p.phoneNumber || "" }]));
  const summaries = await reliability.summaries(deliveries.map((d) => d.driverId).filter(Boolean));
  return res.status(200).json(
    deliveries.map((d) => ({
      ...d,
      driver: byId[String(d.driverId)] || null,
      driverReliability: summaries[String(d.driverId)] || null,
      reportedBy: d.dispute && d.dispute.byUserId ? byId[String(d.dispute.byUserId)] || null : null,
    }))
  );
};

// POST /admin/deliveries/:id/resolve { outcome: "delivered" | "not_delivered", note }
const resolveDelivery = async (req, res) => {
  const { outcome } = req.body || {};
  const note = typeof req.body.note === "string" ? req.body.note.trim().slice(0, 500) : "";
  if (!["delivered", "not_delivered"].includes(outcome)) {
    return res.status(400).json({ msg: "Choose delivered or not delivered." });
  }
  const delivery = mongoose.Types.ObjectId.isValid(req.params.id) ? await mongoDeliveries.findById(req.params.id) : null;
  if (!delivery || !delivery.driverId) return res.status(404).json({ msg: "Delivery not found." });
  const now = new Date();
  const openDispute = delivery.dispute && delivery.dispute.at && !delivery.dispute.resolution;

  if (outcome === "delivered") {
    if (delivery.status === "picked_up") {
      delivery.status = "delivered";
      delivery.deliveredAt = now;
    }
    if (openDispute || delivery.receipt !== "confirmed") {
      delivery.receipt = "confirmed";
      delivery.receiptConfirmedBy = "admin";
      delivery.receiptAt = now;
    }
  } else {
    delivery.receipt = "disputed";
    if (!openDispute) delivery.dispute = { stage: "dropoff", byUserId: req.user.id, note: note || "Reviewed by a Ladle admin", at: now };
  }
  if (delivery.dispute && delivery.dispute.at) {
    delivery.dispute.resolution = outcome;
    delivery.dispute.resolvedAt = now;
  }
  delivery.flagsReviewedAt = now;
  await delivery.save();
  if (delivery.status === "delivered" || outcome === "not_delivered") {
    await handoff.setDriverCredit(delivery, outcome === "delivered" ? "completed" : "disputed");
  }

  const result = outcome === "delivered" ? "counted as delivered" : "counted as not delivered";
  const parties = [delivery.driverId, openDispute ? delivery.dispute.byUserId : null].filter(Boolean);
  await notify(parties, {
    type: "delivery",
    title: `Ladle reviewed the delivery from ${delivery.restaurantName}`,
    body: `It's been ${result}.${note ? ` ${note}` : ""}`,
    link: `/view_post/${delivery.postingId}`,
    postingId: delivery.postingId,
  });
  return res.status(200).json(delivery);
};

module.exports = { getOverview, listUsers, decideVerification, listDeliveries, resolveDelivery };
