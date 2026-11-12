const mongoose = require("mongoose");
const mongoDeliveries = require("../models/Deliveries");
const mongoFoodPostings = require("../models/Postings");
const mongoUsers = require("../models/Users");
const { notify } = require("../notify");
const { formatWindow } = require("../format");
const { distanceKm } = require("../geocode");
const { driverProblems } = require("../matching");
const reliability = require("../reliability");

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
}

// What a viewer may see: everyone sees the job; contact details only go to
// the people involved once a driver has accepted.
async function view(delivery, viewer) {
  const json = delivery.toJSON();
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
  }
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

const load = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    notFound(res);
    return null;
  }
  await expireDeliveries();
  const delivery = await mongoDeliveries.findById(req.params.id);
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
    { $set: { status: "accepted", driverId: req.user.id, driverName: req.user.name, acceptedAt: new Date() } },
    { new: true }
  );
  if (!delivery) return res.status(409).json({ msg: "Another driver has already taken this delivery, or it's no longer needed." });
  await tellParties(delivery, `${req.user.name} will deliver the food from ${delivery.restaurantName}`, `Pickup ${formatWindow(delivery)}.`);
  return res.status(200).json(await view(delivery, req.user));
};

const loadOwnJob = async (req, res, allowed) => {
  const delivery = await load(req, res);
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

// POST /delivery/:id/picked-up — the driver has the food. The posting counts
// as picked up from the restaurant.
const markCollected = async (req, res) => {
  const delivery = await loadOwnJob(req, res, ["accepted"]);
  if (!delivery) return undefined;
  delivery.status = "picked_up";
  delivery.pickedUpAt = new Date();
  await delivery.save();
  await mongoFoodPostings.updateOne(
    { _id: delivery.postingId, status: "claimed" },
    { $set: { status: "picked_up", pickedUpAt: delivery.pickedUpAt } }
  );
  await reliability.record(delivery.foodBankId, "pickup_completed", { postingId: delivery.postingId });
  await tellParties(delivery, `${req.user.name} collected the food from ${delivery.restaurantName}`, `On the way to ${delivery.foodBankName}.`);
  return res.status(200).json(await view(delivery, req.user));
};

// POST /delivery/:id/delivered
const markDelivered = async (req, res) => {
  const delivery = await loadOwnJob(req, res, ["picked_up"]);
  if (!delivery) return undefined;
  delivery.status = "delivered";
  delivery.deliveredAt = new Date();
  await delivery.save();
  await reliability.record(req.user.id, "delivery_completed", { deliveryId: delivery._id, postingId: delivery.postingId });
  await tellParties(delivery, `Food from ${delivery.restaurantName} was delivered`, `${req.user.name} dropped it off at ${delivery.foodBankName}. Thank you!`);
  return res.status(200).json(await view(delivery, req.user));
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
  cancelDelivery,
  expireDeliveries,
  cancelForPosting,
};
