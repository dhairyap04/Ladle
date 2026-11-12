const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const mongoUsers = require("../models/Users");
const mongoFoodPostings = require("../models/Postings");
const photos = require("../photostore");
const mongoMessages = require("../models/Messages");
const mongoNotifications = require("../models/Notifications");
const mongoRecurringSchedules = require("../models/RecurringSchedules");
const mongoDeliveries = require("../models/Deliveries");
const mongoRatings = require("../models/Ratings");
const mongoReliabilityEvents = require("../models/ReliabilityEvents");
const mongoPasswordResets = require("../models/PasswordResets");
const mongoPushSubscriptions = require("../models/PushSubscriptions");
const { clearAuthCookies } = require("./authHelper");
const { publicUser } = require("./UserController");
const reliability = require("../reliability");

const FORMER = "Former Ladle member";

// GET /user/export — everything Ladle holds about the signed-in user, as JSON.
const exportData = async (req, res) => {
  const id = new mongoose.Types.ObjectId(req.user.id);
  const user = await mongoUsers.findById(id);
  if (!user) return res.status(404).json({ msg: "Account not found." });
  const [postings, claimed, schedules, sent, notifications, deliveries, ratingsGiven, ratingsReceived, pushDevices] = await Promise.all([
    mongoFoodPostings.find({ donorId: id }).lean(),
    mongoFoodPostings.find({ claimedBy: id }).lean(),
    mongoRecurringSchedules.find({ donorId: id }).lean(),
    mongoMessages.find({ senderId: id }).lean(),
    mongoNotifications.find({ userId: id }).lean(),
    mongoDeliveries.find({ $or: [{ driverId: id }, { foodBankId: id }] }).lean(),
    mongoRatings.find({ fromUserId: id }).lean(),
    mongoRatings.find({ toUserId: id }).lean(),
    mongoPushSubscriptions.find({ userId: id }, "userAgent createdAt").lean(),
  ]);
  const data = {
    exportedAt: new Date().toISOString(),
    account: { ...publicUser(user), createdAt: user.createdAt, location: user.location },
    reliability: await reliability.summary(id),
    postingsYouMade: postings,
    pickupsYouClaimed: claimed,
    weeklyDonations: schedules,
    messagesYouSent: sent,
    notifications,
    deliveries,
    ratingsYouGave: ratingsGiven,
    ratingsAboutYou: ratingsReceived,
    pushNotificationDevices: pushDevices,
  };
  res.set("Content-Disposition", 'attachment; filename="ladle-my-data.json"');
  return res.status(200).json(data);
};

// POST /user/delete { password } — permanently deletes the account.
// Personal details are removed. Completed pickups stay in the other side's
// history with the name replaced, so their records still add up.
const deleteAccount = async (req, res) => {
  const id = new mongoose.Types.ObjectId(req.user.id);
  const user = await mongoUsers.findById(id).select("+password");
  if (!user) return res.status(404).json({ msg: "Account not found." });
  const { password } = req.body || {};
  if (typeof password !== "string" || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ msg: "Your password isn't right." });
  }

  // Don't leave someone waiting on food or a delivery that will never come.
  const [openClaims, claimedFromMe, activeJobs] = await Promise.all([
    mongoFoodPostings.countDocuments({ claimedBy: id, status: "claimed" }),
    mongoFoodPostings.countDocuments({ donorId: id, status: "claimed" }),
    mongoDeliveries.countDocuments({ driverId: id, status: { $in: ["accepted", "picked_up"] } }),
  ]);
  if (openClaims || claimedFromMe || activeJobs) {
    return res.status(409).json({
      msg: "You have pickups or deliveries in progress. Finish or release them first, so nobody is left waiting.",
    });
  }

  // Their open postings are withdrawn; photos go with the account.
  await mongoFoodPostings.updateMany({ donorId: id, status: "open" }, { $set: { status: "cancelled" } });
  const withPhotos = await mongoFoodPostings.find({ donorId: id, hasPhoto: true }, "_id");
  for (const p of withPhotos) await photos.remove(photos.postingKey(p._id));
  await mongoFoodPostings.updateMany({ donorId: id }, { $set: { fromRestaurantName: FORMER, hasPhoto: false, notes: "" } });
  await mongoFoodPostings.updateMany({ claimedBy: id }, { $set: { claimedByName: FORMER } });
  // Handoff photos the driver took go with their account.
  const driven = await mongoDeliveries.find(
    { driverId: id, $or: [{ "pickupProof.hasPhoto": true }, { "dropoffProof.hasPhoto": true }] },
    "pickupProof dropoffProof"
  );
  for (const d of driven) {
    if (d.pickupProof && d.pickupProof.hasPhoto) await photos.remove(photos.deliveryKey(d._id, "pickup"));
    if (d.dropoffProof && d.dropoffProof.hasPhoto) await photos.remove(photos.deliveryKey(d._id, "dropoff"));
  }
  await mongoDeliveries.updateMany({ driverId: id }, { $set: { driverName: FORMER, "pickupProof.hasPhoto": false, "dropoffProof.hasPhoto": false } });
  await mongoDeliveries.updateMany({ foodBankId: id }, { $set: { foodBankName: FORMER } });
  await mongoDeliveries.updateMany({ donorId: id }, { $set: { restaurantName: FORMER } });
  await mongoDeliveries.updateMany({ foodBankId: id, status: "requested" }, { $set: { status: "cancelled" } });
  // Their messages are removed from conversations.
  await mongoMessages.updateMany({ senderId: id }, { $set: { senderName: FORMER, body: "(message deleted)" } });

  await Promise.all([
    mongoRecurringSchedules.deleteMany({ donorId: id }),
    mongoNotifications.deleteMany({ userId: id }),
    mongoRatings.deleteMany({ $or: [{ fromUserId: id }, { toUserId: id }] }),
    mongoReliabilityEvents.deleteMany({ userId: id }),
    mongoPasswordResets.deleteMany({ userId: id }),
    mongoPushSubscriptions.deleteMany({ userId: id }),
  ]);
  await user.deleteOne();

  clearAuthCookies(res);
  return res.status(200).json({ msg: "Your account has been deleted." });
};

module.exports = { exportData, deleteAccount };
