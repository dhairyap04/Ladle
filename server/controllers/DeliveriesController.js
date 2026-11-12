const mongoose = require("mongoose");
const mongoDeliveries = require("../models/Deliveries");
const mongoFoodPostings = require("../models/Postings");
const mongoUsers = require("../models/Users");
const { notify } = require("../notify");
const { formatWindow } = require("../format");
const { distanceKm } = require("../geocode");
const { driverProblems } = require("../matching");
const reliability = require("../reliability");
const mongoMessages = require("../models/Messages");
const mongoDeliveryPhotos = require("../models/DeliveryPhotos");
const handoff = require("../handoff");
const { parsePhoto } = require("../photo");

const MISSED_AFTER_HOURS = 2; // accepted but not collected this long after the window -> missed
const MAX_DRIVER_ALERTS = 100;

const hasPoint = (p) => p && Array.isArray(p.coordinates) && p.coordinates.length === 2;
const notFound = (res) => res.status(404).json({ msg: "Delivery not found." });

// Requested deliveries whose window has passed expire; accepted ones that were
// never collected become missed (and count against the driver).
async function expireDeliveries() {
  const now = new Date();
  await mongoDeliveries.updateMany({ status: "requested", pickupEndsAt: { $lte: now } }, { $set: { status: "expired" } });
  const missed = await mongoDeliveries.find({
    status: "accepted",
    pickupEndsAt: { $lte: new Date(now - MISSED_AFTER_HOURS * 3600e3) },
  });
  for (const d of missed) {
    const updated = await mongoDeliveries.findOneAndUpdate({ _id: d._id, status: "accepted" }, { $set: { status: "missed" } });
    if (updated) {
      await reliability.record(d.driverId, "delivery_missed", { deliveryId: d._id, postingId: d.postingId });
      await notify([d.foodBankId], {
        type: "delivery",
        title: `${d.driverName} didn't collect the food from ${d.restaurantName}`,
        body: "The delivery was marked as missed. Contact the restaurant if you still need the food.",
        link: `/view_post/${d.postingId}`,
        postingId: d.postingId,
      });
    }
  }
  await handoff.processReceipts(now);
}

// What a viewer may see: everyone sees the job; contact details only go to
// the people involved once a driver has accepted.
async function view(delivery, viewer) {
  const json = delivery.toJSON();
  for (const key of ["pickupCode", "dropoffCode", "pickupCodeTries", "dropoffCodeTries"]) delete json[key];
  const ids = [delivery.foodBankId, delivery.donorId, delivery.driverId].filter(Boolean);
  const people = await mongoUsers.find({ _id: { $in: ids } }, "name phoneNumber vehicle");
  const byId = Object.fromEntries(people.map((p) => [String(p._id), p]));
  const viewerId = viewer && viewer.id;
  const isParty = ids.some((id) => String(id) === viewerId);
  if (isParty && delivery.driverId && delivery.status !== "requested") {
    const contact = (id) => {
      const p = byId[String(id)];
      return p ? { name: p.name, phoneNumber: p.phoneNumber || "", vehicle: p.vehicle || undefined } : null;
    };
    json.contacts = {
      restaurant: delivery.donorId ? contact(delivery.donorId) : null,
      foodBank: contact(delivery.foodBankId),
      driver: contact(delivery.driverId),
    };
    if (String(delivery.foodBankId) === viewerId || String(delivery.donorId) === viewerId) {
      json.driverReliability = await reliability.summary(delivery.driverId);
    }
    // The code the viewer hands to the driver: the restaurant's at pickup,
    // the food bank's at drop-off.
    const isDonor = delivery.donorId && String(delivery.donorId) === viewerId;
    const isFoodBank = String(delivery.foodBankId) === viewerId;
    if ((isDonor && delivery.status === "accepted") || (isFoodBank && ["accepted", "picked_up"].includes(delivery.status))) {
      const codes = await mongoDeliveries.findById(delivery._id).select("+pickupCode +dropoffCode");
      const code = codes && (isDonor ? codes.pickupCode : codes.dropoffCode);
      if (code) json.handoffCode = code;
    }
  }
  if (isParty) Object.assign(json, handoff.verificationActions(delivery, viewerId));
  return json;
}

// Alerts volunteer drivers the delivery suits, nearest coverage first.
async function alertDrivers(delivery) {
  const drivers = await mongoUsers.find({ role: "driver", notifyNewPostings: { $ne: false } });
  const suitable = drivers.filter((driver) => {
    const km = hasPoint(driver.location) && hasPoint(delivery.pickupLocation)
      ? distanceKm(driver.location.coordinates, delivery.pickupLocation.coordinates)
      : undefined;
    return driverProblems(delivery, driver, km).length === 0;
  });
  await notify(suitable.slice(0, MAX_DRIVER_ALERTS).map((d) => d._id), {
    type: "delivery",
    title: `Delivery needed: ${delivery.restaurantName} → ${delivery.foodBankName}`,
    body: `Pickup ${formatWindow(delivery)}${delivery.estimatedWeightKg ? `, about ${delivery.estimatedWeightKg} kg` : ""}.`,
    link: "/main",
  });
}

// POST /delivery { postingId, notes } — the food bank that claimed a posting asks for a driver.
const requestDelivery = async (req, res) => {
  await expireDeliveries();
  const { postingId } = req.body || {};
  const posting = mongoose.Types.ObjectId.isValid(postingId) ? await mongoFoodPostings.findById(postingId) : null;
  if (!posting) return res.status(404).json({ msg: "Posting not found." });
  if (!posting.claimedBy || String(posting.claimedBy) !== req.user.id || posting.status !== "claimed") {
    return res.status(403).json({ msg: "You can only request a driver for food your food bank has claimed." });
  }
  if (posting.pickupEndsAt && posting.pickupEndsAt <= new Date()) {
    return res.status(409).json({ msg: "The pickup window has already ended." });
  }
  const foodBank = await mongoUsers.findById(req.user.id);
  if (!foodBank.address) {
    return res.status(400).json({ msg: "Add your food bank's address to your profile so drivers know where to deliver." });
  }

  try {
    const delivery = await mongoDeliveries.create({
      postingId: posting._id,
      foodBankId: foodBank._id,
      foodBankName: foodBank.name,
      donorId: posting.donorId,
      restaurantName: posting.fromRestaurantName,
      pickupAddress: posting.fromRestaurantAddress,
      pickupLocationName: posting.pickupLocationName || undefined,
      pickupNotes: posting.pickupNotes || undefined,
      pickupLocation: hasPoint(posting.location) ? posting.location : undefined,
      dropoffAddress: foodBank.address,
      dropoffLocation: hasPoint(foodBank.location) ? foodBank.location : undefined,
      pickupDate: posting.pickupDate,
      pickupTimeBegin: posting.pickupTimeBegin,
      pickupTimeEnd: posting.pickupTimeEnd,
      pickupEndsAt: posting.pickupEndsAt,
      estimatedWeightKg: posting.estimatedWeightKg,
      storage: posting.storage,
      quantity: posting.quantity,
      notes: typeof req.body.notes === "string" ? req.body.notes.trim().slice(0, 500) : "",
    });
    await alertDrivers(delivery);
    return res.status(201).json(await view(delivery, req.user));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ msg: "A driver has already been requested for this pickup." });
    throw err;
  }
};

// GET /delivery/available — open requests for a driver, with distance and fit.
const listAvailable = async (req, res) => {
  await expireDeliveries();
  const driver = await mongoUsers.findById(req.user.id);
  const deliveries = await mongoDeliveries.find({ status: "requested" }).sort({ pickupEndsAt: 1 }).limit(200);
  const results = deliveries.map((d) => {
    const json = d.toJSON();
    if (hasPoint(driver.location) && hasPoint(d.pickupLocation)) {
      json.distanceKm = Math.round(distanceKm(driver.location.coordinates, d.pickupLocation.coordinates) * 10) / 10;
    }
    if (hasPoint(d.pickupLocation) && hasPoint(d.dropoffLocation)) {
      json.tripKm = Math.round(distanceKm(d.pickupLocation.coordinates, d.dropoffLocation.coordinates) * 10) / 10;
    }
    json.fitProblems = driverProblems(d, driver, json.distanceKm);
    return json;
  });
  // Ones that suit the driver first, then by pickup deadline.
  results.sort((a, b) => a.fitProblems.length - b.fitProblems.length);
  return res.status(200).json(results);
};

// GET /delivery/mine — a driver's jobs, or a food bank's requests.
const listMine = async (req, res) => {
  await expireDeliveries();
  const filter = req.user.role === "driver" ? { driverId: req.user.id } : { foodBankId: req.user.id };
  const deliveries = await mongoDeliveries.find(filter).sort({ updatedAt: -1 }).limit(50);
  return res.status(200).json(await Promise.all(deliveries.map((d) => view(d, req.user))));
};

// GET /delivery/for-posting/:postingId — the latest delivery for a posting, for the people involved.
const getForPosting = async (req, res) => {
  await expireDeliveries();
  if (!mongoose.Types.ObjectId.isValid(req.params.postingId)) return notFound(res);
  const delivery = await mongoDeliveries.findOne({ postingId: req.params.postingId }).sort({ createdAt: -1 });
  if (!delivery) return res.status(200).json(null);
  const isParty = [delivery.foodBankId, delivery.donorId, delivery.driverId].some((id) => id && String(id) === req.user.id);
  if (!isParty) return res.status(200).json(null);
  return res.status(200).json(await view(delivery, req.user));
};

const load = async (req, res, select) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    notFound(res);
    return null;
  }
  await expireDeliveries();
  const query = mongoDeliveries.findById(req.params.id);
  const delivery = await (select ? query.select(select) : query);
  if (!delivery) notFound(res);
  return delivery;
};

const tellParties = (delivery, title, body) =>
  notify([delivery.foodBankId, delivery.donorId].filter(Boolean), {
    type: "delivery",
    title,
    body,
    link: `/view_post/${delivery.postingId}`,
    postingId: delivery.postingId,
  });

// POST /delivery/:id/accept — atomic, so two drivers can't take the same job.
const acceptDelivery = async (req, res) => {
  const existing = await load(req, res);
  if (!existing) return undefined;
  const delivery = await mongoDeliveries.findOneAndUpdate(
    { _id: existing._id, status: "requested" },
    {
      $set: {
        status: "accepted",
        driverId: req.user.id,
        driverName: req.user.name,
        acceptedAt: new Date(),
        // Fresh codes for each driver, so one read out to a driver who later
        // gave the job back can't be reused.
        pickupCode: handoff.newCode(),
        dropoffCode: handoff.newCode(),
        pickupCodeTries: 0,
        dropoffCodeTries: 0,
      },
    },
    { new: true }
  );
  if (!delivery) return res.status(409).json({ msg: "Another driver has already taken this delivery, or it's no longer needed." });
  await tellParties(delivery, `${req.user.name} will deliver the food from ${delivery.restaurantName}`, `Pickup ${formatWindow(delivery)}.`);
  return res.status(200).json(await view(delivery, req.user));
};

const loadOwnJob = async (req, res, allowed, select) => {
  const delivery = await load(req, res, select);
  if (!delivery) return null;
  if (!delivery.driverId || String(delivery.driverId) !== req.user.id) {
    res.status(403).json({ msg: "This isn't your delivery." });
    return null;
  }
  if (!allowed.includes(delivery.status)) {
    res.status(409).json({ msg: `This delivery is ${delivery.status.replace("_", " ")}.` });
    return null;
  }
  return delivery;
};

// POST /delivery/:id/release — the driver can't make it after all.
const releaseDelivery = async (req, res) => {
  const delivery = await loadOwnJob(req, res, ["accepted"]);
  if (!delivery) return undefined;
  const startsAt = delivery.pickupEndsAt
    ? new Date(delivery.pickupEndsAt - ((delivery.pickupTimeEnd - delivery.pickupTimeBegin) / 100) * 3600e3)
    : null;
  await reliability.record(req.user.id, reliability.isLate(startsAt) ? "delivery_late_release" : "delivery_release", {
    deliveryId: delivery._id,
    postingId: delivery.postingId,
  });
  delivery.set({ status: "requested", driverId: undefined, driverName: undefined, acceptedAt: undefined });
  await delivery.save();
  await notify([delivery.foodBankId], {
    type: "delivery",
    title: `${req.user.name} can no longer deliver from ${delivery.restaurantName}`,
    body: "We've asked other drivers to take it.",
    link: `/view_post/${delivery.postingId}`,
    postingId: delivery.postingId,
  });
  await alertDrivers(delivery);
  return res.status(200).json(await view(delivery, req.user));
};

// Checks the driver's proof for a handoff ({ code } or { photo }, plus an
// optional { location }) and records it on the delivery. Sends the error itself
// and returns null when the proof isn't good enough.
async function takeHandoff(req, res, stage) {
  const delivery = await loadOwnJob(
    req,
    res,
    stage === "pickup" ? ["accepted"] : ["picked_up"],
    `+${stage}Code +${stage}CodeTries`
  );
  if (!delivery) return null;
  const body = req.body || {};
  const code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";
  const who = stage === "pickup" ? "the restaurant" : "the food bank";

  let method = "photo";
  if (code) {
    if (delivery[`${stage}CodeTries`] >= handoff.MAX_CODE_TRIES) {
      res.status(429).json({ msg: "Too many wrong codes. Add a photo of the food instead." });
      return null;
    }
    if (!handoff.codesMatch(delivery[`${stage}Code`], code)) {
      const after = await mongoDeliveries.findOneAndUpdate(
        { _id: delivery._id },
        { $inc: { [`${stage}CodeTries`]: 1 } },
        { new: true, projection: { [`${stage}CodeTries`]: 1 } }
      );
      const left = handoff.MAX_CODE_TRIES - after[`${stage}CodeTries`];
      res.status(400).json({
        msg: left > 0
          ? `That code doesn't match. Check it with ${who} (${left} ${left === 1 ? "try" : "tries"} left).`
          : "That code doesn't match. Add a photo of the food instead.",
        triesLeft: Math.max(0, left),
      });
      return null;
    }
    method = "code";
  } else if (!body.photo) {
    res.status(400).json({ msg: `Enter the code from ${who}, or add a photo of the food.` });
    return null;
  }

  let photo = null;
  if (body.photo) {
    photo = parsePhoto(body.photo);
    if (photo.error) {
      res.status(400).json({ msg: photo.error });
      return null;
    }
    await mongoDeliveryPhotos.findOneAndUpdate(
      { deliveryId: delivery._id, stage },
      { contentType: photo.contentType, data: photo.data },
      { upsert: true }
    );
  }

  const now = handoff.handoffTime(body.clientAt, stage === "pickup" ? delivery.acceptedAt : delivery.pickedUpAt);
  const place = handoff.checkLocation(body.location, stage === "pickup" ? delivery.pickupLocation : delivery.dropoffLocation);
  delivery[`${stage}Proof`] = { at: now, method, ...place, hasPhoto: Boolean(photo) };
  const flags = new Set(delivery.flags || []);
  if (place.location === "far") flags.add(`${stage}_far`);
  if (stage === "dropoff" && handoff.tooFast(delivery, now)) flags.add("too_fast");
  if (flags.size) delivery.flags = [...flags];
  return { delivery, method, now };
}

// POST /delivery/:id/picked-up { code | photo, location? } — the driver has
// the food. The posting counts as picked up from the restaurant.
const markCollected = async (req, res) => {
  const taken = await takeHandoff(req, res, "pickup");
  if (!taken) return undefined;
  const { delivery, method, now } = taken;
  delivery.status = "picked_up";
  delivery.pickedUpAt = now;
  await delivery.save();
  await mongoFoodPostings.updateOne(
    { _id: delivery.postingId, status: "claimed" },
    { $set: { status: "picked_up", pickedUpAt: delivery.pickedUpAt } }
  );
  await reliability.record(delivery.foodBankId, "pickup_completed", { postingId: delivery.postingId });
  await notify([delivery.foodBankId], {
    type: "delivery",
    title: `${req.user.name} collected the food from ${delivery.restaurantName}`,
    body: `On the way to you. Have your drop-off code ready.`,
    link: `/view_post/${delivery.postingId}`,
    postingId: delivery.postingId,
  });
  if (delivery.donorId) {
    await notify([delivery.donorId], {
      type: "delivery",
      title: `${req.user.name} collected the food`,
      body: method === "code"
        ? `Confirmed with your handoff code. On the way to ${delivery.foodBankName}.`
        : `They didn't use your handoff code, so they added a photo. If they didn't collect it, report it on the posting.`,
      link: `/view_post/${delivery.postingId}`,
      postingId: delivery.postingId,
    });
  }
  return res.status(200).json(await view(delivery, req.user));
};

// POST /delivery/:id/delivered { code | photo, location? }
// With the food bank's code the delivery is confirmed straight away; with a
// photo it waits for the food bank to confirm.
const markDelivered = async (req, res) => {
  const taken = await takeHandoff(req, res, "dropoff");
  if (!taken) return undefined;
  const { delivery, method, now } = taken;
  delivery.status = "delivered";
  delivery.deliveredAt = now;
  if (method === "code") {
    delivery.receipt = "confirmed";
    delivery.receiptConfirmedBy = "code";
    delivery.receiptAt = now;
  } else {
    delivery.receipt = "pending";
  }
  await delivery.save();
  if (method === "code") {
    await handoff.setDriverCredit(delivery, "completed");
    await tellParties(delivery, `Food from ${delivery.restaurantName} was delivered`, `${req.user.name} dropped it off at ${delivery.foodBankName}, confirmed with the drop-off code. Thank you!`);
  } else {
    await notify([delivery.foodBankId], {
      type: "delivery",
      title: `Did the food from ${delivery.restaurantName} arrive?`,
      body: `${req.user.name} marked it delivered without your drop-off code. Please confirm you received it.`,
      link: `/view_post/${delivery.postingId}`,
      postingId: delivery.postingId,
    });
    if (delivery.donorId) {
      await notify([delivery.donorId], {
        type: "delivery",
        title: `Food from ${delivery.restaurantName} was delivered`,
        body: `${req.user.name} dropped it off at ${delivery.foodBankName}. Thank you!`,
        link: `/view_post/${delivery.postingId}`,
        postingId: delivery.postingId,
      });
    }
  }
  return res.status(200).json(await view(delivery, req.user));
};

// POST /delivery/:id/confirm — the food bank received it.
const confirmReceipt = async (req, res) => {
  const delivery = await load(req, res);
  if (!delivery) return undefined;
  if (!handoff.verificationActions(delivery, req.user.id).canConfirm) {
    return res.status(409).json({ msg: "There's nothing to confirm for this delivery." });
  }
  const now = new Date();
  if (delivery.status === "picked_up") {
    delivery.status = "delivered";
    delivery.deliveredAt = now;
  }
  delivery.receipt = "confirmed";
  delivery.receiptConfirmedBy = "foodbank";
  delivery.receiptAt = now;
  if (delivery.dispute && delivery.dispute.at && !delivery.dispute.resolution) {
    delivery.dispute.resolution = "delivered";
    delivery.dispute.resolvedAt = now;
  }
  await delivery.save();
  await handoff.setDriverCredit(delivery, "completed");
  await notify([delivery.driverId], {
    type: "delivery",
    title: `${delivery.foodBankName} confirmed your delivery`,
    body: `The food from ${delivery.restaurantName} arrived. Thank you!`,
    link: "/main",
  });
  return res.status(200).json(await view(delivery, req.user));
};

// POST /delivery/:id/report { stage: "pickup" | "dropoff", note }
// The food bank says the food never arrived, or the restaurant says the driver
// never collected it. Counts against the driver until an admin decides.
const reportProblem = async (req, res) => {
  const delivery = await load(req, res);
  if (!delivery) return undefined;
  const { stage } = req.body || {};
  const note = typeof req.body.note === "string" ? req.body.note.trim().slice(0, 500) : "";
  const allowed = handoff.verificationActions(delivery, req.user.id);
  if (!(stage === "dropoff" ? allowed.canReportDropoff : stage === "pickup" ? allowed.canReportPickup : false)) {
    return res.status(409).json({ msg: "You can't report a problem with this delivery." });
  }
  delivery.dispute = { stage, byUserId: req.user.id, note, at: new Date() };
  delivery.receipt = "disputed";
  await delivery.save();
  await handoff.setDriverCredit(delivery, "disputed");

  const what = stage === "dropoff" ? `the food from ${delivery.restaurantName} never arrived` : `you didn't collect the food`;
  await notify([delivery.driverId], {
    type: "delivery",
    title: `${req.user.name} reported a problem with your delivery`,
    body: `They say ${what}${note ? `: "${note}"` : "."} A Ladle admin will look into it. Reply in the delivery chat if there's been a mix-up.`,
    link: "/main",
  });
  const admins = await mongoUsers.find({ isAdmin: true }, "_id");
  await notify(admins.map((a) => a._id), {
    type: "delivery",
    title: `Delivery problem reported by ${req.user.name}`,
    body: `${delivery.restaurantName} → ${delivery.foodBankName}, driver ${delivery.driverName}.`,
    link: "/admin",
  });
  return res.status(200).json(await view(delivery, req.user));
};

// GET /delivery/:id/photo/:stage — for the people involved and admins.
const getHandoffPhoto = async (req, res) => {
  const delivery = await load(req, res);
  if (!delivery) return undefined;
  const isParty = [delivery.foodBankId, delivery.donorId, delivery.driverId].some((id) => id && String(id) === req.user.id);
  if (!isParty && !req.user.isAdmin) return res.status(403).json({ msg: "Only the people on this delivery can see its photos." });
  if (!["pickup", "dropoff"].includes(req.params.stage)) return notFound(res);
  const photo = await mongoDeliveryPhotos.findOne({ deliveryId: delivery._id, stage: req.params.stage });
  if (!photo) return res.status(404).json({ msg: "No photo." });
  res.set("Content-Type", photo.contentType);
  res.set("Cache-Control", "private, max-age=86400");
  return res.send(photo.data);
};

// POST /delivery/:id/cancel — the food bank no longer needs a driver.
const cancelDelivery = async (req, res) => {
  const delivery = await load(req, res);
  if (!delivery) return undefined;
  if (String(delivery.foodBankId) !== req.user.id) return res.status(403).json({ msg: "Only the food bank that asked can cancel this." });
  if (!["requested", "accepted"].includes(delivery.status)) {
    return res.status(409).json({ msg: "This delivery can't be cancelled now." });
  }
  const driverId = delivery.driverId;
  delivery.status = "cancelled";
  await delivery.save();
  if (driverId) {
    await notify([driverId], {
      type: "delivery",
      title: `${delivery.foodBankName} cancelled the delivery from ${delivery.restaurantName}`,
      body: "You don't need to collect it. Thanks for offering!",
      link: "/main",
    });
  }
  return res.status(200).json(await view(delivery, req.user));
};

// The people in a delivery's group chat: the food bank, the restaurant and,
// once one has accepted, the driver. Sends the error itself and returns null
// when the caller isn't one of them.
const loadChat = async (req, res) => {
  const delivery = await load(req, res);
  if (!delivery) return null;
  const members = [delivery.foodBankId, delivery.donorId, delivery.driverId].filter(Boolean).map(String);
  if (!members.includes(req.user.id)) {
    res.status(403).json({ msg: "Only the restaurant, food bank and driver can see this chat." });
    return null;
  }
  return { delivery, members };
};

// GET /delivery/:id/messages
const listDeliveryMessages = async (req, res) => {
  const chat = await loadChat(req, res);
  if (!chat) return undefined;
  const messages = await mongoMessages.find({ deliveryId: chat.delivery._id }).sort({ createdAt: 1 }).limit(500);
  return res.status(200).json(messages);
};

// POST /delivery/:id/messages { body } — once a driver is on the job.
const sendDeliveryMessage = async (req, res) => {
  const chat = await loadChat(req, res);
  if (!chat) return undefined;
  const { delivery, members } = chat;
  if (!delivery.driverId) {
    return res.status(409).json({ msg: "The chat opens once a driver accepts the delivery." });
  }
  const body = typeof (req.body || {}).body === "string" ? req.body.body.trim() : "";
  if (!body) return res.status(400).json({ msg: "Please write a message." });
  if (body.length > 1000) return res.status(400).json({ msg: "Messages can be up to 1000 characters." });
  const message = await mongoMessages.create({
    postingId: delivery.postingId,
    foodBankId: delivery.foodBankId,
    deliveryId: delivery._id,
    senderId: req.user.id,
    senderName: req.user.name,
    body,
  });
  await notify(members.filter((id) => id !== req.user.id), {
    type: "new_message",
    title: `${req.user.name} (delivery from ${delivery.restaurantName})`,
    body: body.length > 140 ? `${body.slice(0, 137)}…` : body,
    link: `/view_post/${delivery.postingId}#delivery-chat`,
    postingId: delivery.postingId,
  });
  return res.status(201).json(message);
};

// Cancels any open delivery for a posting, e.g. when the food bank releases its claim.
async function cancelForPosting(postingId, reason) {
  const active = await mongoDeliveries.find({ postingId, status: { $in: ["requested", "accepted"] } });
  for (const d of active) {
    d.status = "cancelled";
    await d.save();
    if (d.driverId) {
      await notify([d.driverId], { type: "delivery", title: `Delivery from ${d.restaurantName} cancelled`, body: reason, link: "/main" });
    }
  }
}

module.exports = {
  requestDelivery,
  listAvailable,
  listMine,
  getForPosting,
  acceptDelivery,
  releaseDelivery,
  markCollected,
  markDelivered,
  confirmReceipt,
  reportProblem,
  getHandoffPhoto,
  view,
  cancelDelivery,
  expireDeliveries,
  cancelForPosting,
  listDeliveryMessages,
  sendDeliveryMessage,
};
