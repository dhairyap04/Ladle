const mongoose = require("mongoose");
const mongoRecurringSchedules = require("../models/RecurringSchedules");
const { parseFoodDetails, parsePickupTime, refreshPostings } = require("./PostingsController");
const { geocodeToPoint } = require("../geocode");
const { isValidTimeZone } = require("../recurring");

// Validates a schedule from the request body. Returns { values } or { error }.
const parseSchedule = (body = {}) => {
  const { fromRestaurantAddress, startsOn, endsOn, timeZone } = body;
  if (typeof fromRestaurantAddress !== "string" || !fromRestaurantAddress.trim()) {
    return { error: "Please enter the pickup address." };
  }
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
      fromRestaurantAddress: fromRestaurantAddress.trim(),
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

const createSchedule = async (req, res) => {
  const { values, error } = parseSchedule(req.body);
  if (error) return res.status(400).json({ msg: error });
  const schedule = await mongoRecurringSchedules.create({
    ...values,
    donorId: req.user.id,
    location: await geocodeToPoint(values.fromRestaurantAddress),
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
  const addressChanged = values.fromRestaurantAddress !== schedule.fromRestaurantAddress;
  schedule.set(values);
  if (addressChanged) schedule.location = await geocodeToPoint(values.fromRestaurantAddress);
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
