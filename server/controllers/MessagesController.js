const mongoose = require("mongoose");
const mongoMessages = require("../models/Messages");
const mongoFoodPostings = require("../models/Postings");
const mongoUsers = require("../models/Users");
const { notify } = require("../notify");
const reliability = require("../reliability");

const MAX_LENGTH = 1000;
const notFound = (res) => res.status(404).json({ msg: "Posting not found." });

// Loads the posting and works out the caller's role in its conversations.
// Returns null after sending an error response when the caller has no access.
const loadContext = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    notFound(res);
    return null;
  }
  const posting = await mongoFoodPostings.findById(req.params.id);
  if (!posting) {
    notFound(res);
    return null;
  }
  const isDonor = posting.donorId && String(posting.donorId) === req.user.id;
  const claimedByOther = posting.claimedBy && String(posting.claimedBy) !== req.user.id;
  if (!isDonor && !req.user.isFoodbank) {
    res.status(403).json({ msg: "Only the restaurant and food banks can message about a posting." });
    return null;
  }
  if (!isDonor && claimedByOther) {
    res.status(403).json({ msg: "Another food bank has claimed this posting." });
    return null;
  }
  return { posting, isDonor };
};

// Name and phone number of the other side, shared once the posting is claimed.
const contactFor = async (posting, isDonor) => {
  if (!posting.claimedBy) return null;
  const other = await mongoUsers.findById(isDonor ? posting.claimedBy : posting.donorId, "name phoneNumber");
  return other ? { name: other.name, phoneNumber: other.phoneNumber || "" } : null;
};

// GET /posting/:id/messages
// A food bank gets its own thread; the restaurant gets every thread.
const listMessages = async (req, res) => {
  const ctx = await loadContext(req, res);
  if (!ctx) return undefined;
  const { posting, isDonor } = ctx;

  // Delivery group chats are separate (see DeliveriesController).
  const filter = isDonor
    ? { postingId: posting._id, deliveryId: { $exists: false } }
    : { postingId: posting._id, foodBankId: req.user.id, deliveryId: { $exists: false } };
  const messages = await mongoMessages.find(filter).sort({ createdAt: 1 }).limit(500);

  const threads = new Map();
  for (const m of messages) {
    const key = String(m.foodBankId);
    if (!threads.has(key)) threads.set(key, { foodBankId: key, messages: [] });
    threads.get(key).messages.push(m);
  }
  // The claiming food bank always has a thread, even before anyone writes.
  if (isDonor && posting.claimedBy && !threads.has(String(posting.claimedBy))) {
    threads.set(String(posting.claimedBy), { foodBankId: String(posting.claimedBy), messages: [] });
  }
  const names = await mongoUsers.find({ _id: { $in: [...threads.keys()] } }, "name");
  const nameById = Object.fromEntries(names.map((u) => [String(u._id), u.name]));
  // The restaurant sees how dependable each food bank asking has been.
  const summaries = isDonor ? await reliability.summaries([...threads.keys()]) : {};
  const list = [...threads.values()].map((t) => ({
    ...t,
    foodBankName: nameById[t.foodBankId] || "Food bank",
    reliability: summaries[t.foodBankId],
    isClaimer: Boolean(posting.claimedBy) && String(posting.claimedBy) === t.foodBankId,
  }));
  // Claimer first, then the most recently active thread.
  list.sort((a, b) =>
    (b.isClaimer - a.isClaimer) ||
    (new Date((b.messages.at(-1) || {}).createdAt || 0) - new Date((a.messages.at(-1) || {}).createdAt || 0))
  );

  return res.status(200).json({ threads: list, contact: await contactFor(posting, isDonor) });
};

// POST /posting/:id/messages { body, foodBankId? }
// Food banks write in their own thread; the restaurant names the thread.
const sendMessage = async (req, res) => {
  const ctx = await loadContext(req, res);
  if (!ctx) return undefined;
  const { posting, isDonor } = ctx;

  const body = typeof req.body.body === "string" ? req.body.body.trim() : "";
  if (!body) return res.status(400).json({ msg: "Please write a message." });
  if (body.length > MAX_LENGTH) return res.status(400).json({ msg: `Messages can be up to ${MAX_LENGTH} characters.` });

  let foodBankId = req.user.id;
  if (isDonor) {
    foodBankId = req.body.foodBankId;
    const isClaimer = posting.claimedBy && String(posting.claimedBy) === foodBankId;
    const hasThread = mongoose.Types.ObjectId.isValid(foodBankId) &&
      (await mongoMessages.exists({ postingId: posting._id, foodBankId, deliveryId: { $exists: false } }));
    if (!isClaimer && !hasThread) {
      return res.status(400).json({ msg: "You can reply to food banks that have messaged you or claimed this posting." });
    }
  }

  const message = await mongoMessages.create({
    postingId: posting._id,
    foodBankId,
    senderId: req.user.id,
    senderName: req.user.name,
    body,
  });

  await notify([isDonor ? foodBankId : posting.donorId].filter(Boolean), {
    type: "new_message",
    title: `Message from ${req.user.name}`,
    body: body.length > 140 ? `${body.slice(0, 137)}…` : body,
    link: `/view_post/${posting._id}#messages`,
    postingId: posting._id,
  });

  return res.status(201).json(message);
};

module.exports = { listMessages, sendMessage };
