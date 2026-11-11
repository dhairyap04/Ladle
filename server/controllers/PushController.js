const mongoPushSubscriptions = require("../models/PushSubscriptions");
const { pushEnabled, publicKey } = require("../push");

// GET /push/key — the public key the browser needs to subscribe, if push is on.
const getKey = (req, res) => res.status(200).json({ enabled: pushEnabled(), publicKey: publicKey() || null });

const isSubscription = (s) =>
  s && typeof s.endpoint === "string" && /^https:\/\//.test(s.endpoint) && s.endpoint.length < 1000 &&
  s.keys && typeof s.keys.p256dh === "string" && typeof s.keys.auth === "string";

// POST /push/subscribe { subscription } — this device wants push for the signed-in account.
const subscribe = async (req, res) => {
  if (!pushEnabled()) return res.status(409).json({ msg: "Push notifications aren't set up on this server." });
  const { subscription } = req.body || {};
  if (!isSubscription(subscription)) return res.status(400).json({ msg: "That isn't a valid push subscription." });
  // An endpoint belongs to one browser; if someone else signs in on it, it moves to them.
  await mongoPushSubscriptions.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    { userId: req.user.id, keys: subscription.keys, userAgent: String(req.get("user-agent") || "").slice(0, 200) },
    { upsert: true }
  );
  return res.status(201).json({ msg: "Push notifications are on for this device." });
};

// POST /push/unsubscribe { endpoint }
const unsubscribe = async (req, res) => {
  const endpoint = (req.body || {}).endpoint;
  await mongoPushSubscriptions.deleteOne({ endpoint, userId: req.user.id });
  return res.status(204).end();
};

module.exports = { getKey, subscribe, unsubscribe };
