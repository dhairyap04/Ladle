const mongoose = require("mongoose");
const mongoRecurringSchedules = require("../models/RecurringSchedules");
const { parseFoodDetails, parsePickupTime, refreshPostings } = require("./PostingsController");
const { geocodeToPoint } = require("../geocode");
const { isValidTimeZone } = require("../recurring");
const mongoUsers = require("../models/Users");
const { resolvePickup } = require("../locations");

// Validates a schedule from the request body. Returns { values } or { error }.
// The pickup address is worked out separately (see pickupFor).
const parseSchedule = (body = {}) => {
  const { startsOn, endsOn, timeZone } = body;
  const daysOfWeek = Array.isArray(body.daysOfWeek)
    ? [...new Set(body.daysOfWeek.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : [];
  if (!daysOfWeek.length) return { error: "Please choose at least one day of the week." };

  const pickupTimeBegin = parsePickupTime(body.pickupTimeBegin);
  const pickupTimeEnd = parsePickupTime(body.pickupTimeEnd);
  if (pickupTimeBegin === null || pickupTimeEnd === null) {
    return { error: "Please enter a valid pickup start and end time." };
  }
  if (pickupTimeEnd <= pickupTimeBegin) return { error: "The pickup end time must be after the start time." };

  const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!isDate(startsOn)) return { error: "Please enter the first pickup date." };
  if (endsOn && !isDate(endsOn)) return { error: "Please enter a valid end date." };
  if (endsOn && endsOn < startsOn) return { error: "The end date must be after the start date." };
  if (!isValidTimeZone(timeZone)) return { error: "Your browser didn't send a valid time zone." };

  const food = parseFoodDetails(body);
  if (food.error) return { error: food.error };
  const { preparedAt, ...foodValues } = food.values; // not meaningful for a repeating donation

  return {
    values: {
      ...foodValues,
      daysOfWeek,
      pickupTimeBegin,
      pickupTimeEnd,
      startsOn,
      endsOn: endsOn || undefined,
      timeZone,
      notes: typeof body.notes === "string" ? body.notes.trim() : "",
    },
  };
};

const loadOwn = async (req, res) => {
  const schedule = mongoose.Types.ObjectId.isValid(req.params.id)
    ? await mongoRecurringSchedules.findById(req.params.id)
    : null;
  if (!schedule || String(schedule.donorId) !== req.user.id) {
    res.status(404).json({ msg: "Schedule not found." });
    return null;
  }
  return schedule;
};

// Where a schedule's pickups happen: a saved location it then follows, or a
// typed address. Returns the fields to store, or sends a 400 and returns null.
const pickupFor = async (req, res) => {
  const donor = await mongoUsers.findById(req.user.id);
  const pickup = await resolvePickup(donor, req.body);
  if (pickup.error) {
    res.status(400).json({ msg: pickup.error });
    return null;
  }
  if (pickup.userChanged) await donor.save();
  const fields = { pickupLocationName: undefined, pickupNotes: undefined, location: undefined, ...pickup.fields, locationId: pickup.locationId };
  if (!fields.location) fields.location = await geocodeToPoint(fields.fromRestaurantAddress);
  return fields;
};

const createSchedule = async (req, res) => {
  const { values, error } = parseSchedule(req.body);
  if (error) return res.status(400).json({ msg: error });
  const pickup = await pickupFor(req, res);
  if (!pickup) return undefined;
  const schedule = await mongoRecurringSchedules.create({
    ...values,
    ...pickup,
    donorId: req.user.id,
  });
  await refreshPostings(); // create today's/tomorrow's posting right away
  return res.status(201).json(schedule);
};

const listSchedules = async (req, res) => {
  const schedules = await mongoRecurringSchedules.find({ donorId: req.user.id }).sort({ createdAt: -1 });
  return res.status(200).json(schedules);
};

// Changes apply to postings generated from now on; existing ones are untouched.
const editSchedule = async (req, res) => {
  const schedule = await loadOwn(req, res);
  if (!schedule) return undefined;
  const { values, error } = parseSchedule(req.body);
  if (error) return res.status(400).json({ msg: error });
  const pickup = await pickupFor(req, res);
  if (!pickup) return undefined;
  schedule.set({ ...values, ...pickup });
  await schedule.save();
  await refreshPostings();
  return res.status(200).json(schedule);
};

const setActive = (active) => async (req, res) => {
  const schedule = await loadOwn(req, res);
  if (!schedule) return undefined;
  schedule.active = active;
  await schedule.save();
  if (active) await refreshPostings();
  return res.status(200).json(schedule);
};

// Deleting a schedule keeps the postings it already created.
const deleteSchedule = async (req, res) => {
  const schedule = await loadOwn(req, res);
  if (!schedule) return undefined;
  await schedule.deleteOne();
  return res.status(204).end();
};

module.exports = {
  createSchedule,
  listSchedules,
  editSchedule,
  pauseSchedule: setActive(false),
  resumeSchedule: setActive(true),
  deleteSchedule,
};
