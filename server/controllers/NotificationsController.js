const mongoose = require("mongoose");
const mongoNotifications = require("../models/Notifications");

// The latest notifications for the signed-in user, plus how many are unread.
const listNotifications = async (req, res) => {
  const [items, unread] = await Promise.all([
    mongoNotifications.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(30),
    mongoNotifications.countDocuments({ userId: req.user.id, readAt: { $exists: false } }),
  ]);
  return res.status(200).json({ items, unread });
};

const markRead = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ msg: "Not found." });
  await mongoNotifications.updateOne(
    { _id: req.params.id, userId: req.user.id, readAt: { $exists: false } },
    { $set: { readAt: new Date() } }
  );
  return res.status(204).end();
};

const markAllRead = async (req, res) => {
  await mongoNotifications.updateMany(
    { userId: req.user.id, readAt: { $exists: false } },
    { $set: { readAt: new Date() } }
  );
  return res.status(204).end();
};

module.exports = { listNotifications, markRead, markAllRead };
