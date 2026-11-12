// A restaurant's saved pickup locations (one per branch), and how a posting or
// weekly donation picks one. The default location is mirrored into the user's
// address/location, which distance search and the profile still read.
const mongoose = require("mongoose");
const mongoRecurringSchedules = require("./models/RecurringSchedules");
const { geocodeToPoint } = require("./geocode");

const MAX_LOCATIONS = 20;

const hasPoint = (loc) => Boolean(loc && loc.coordinates && loc.coordinates.length === 2);
const sameId = (a, b) => Boolean(a && b && String(a) === String(b));

// "10150 Jasper Ave, Edmonton, AB" -> "10150 Jasper Ave"
const nameFromAddress = (address) => (address.split(",")[0] || address).trim().slice(0, 60);

const publicLocation = (loc) => ({
  id: String(loc._id),
  name: loc.name,
  address: loc.address,
  notes: loc.notes || "",
  hasLocation: hasPoint(loc.location),
});

// What the client needs to show and preselect locations.
const publicLocations = (user) => {
  const list = (user.locations || []).map(publicLocation);
  const has = (id) => id && list.some((l) => l.id === String(id));
  const defaultId = has(user.defaultLocationId) ? String(user.defaultLocationId) : list[0] ? list[0].id : null;
  return {
    locations: list,
    defaultLocationId: defaultId,
    // The one to preselect on the next posting: last used, else the default.
    preferredLocationId: has(user.lastLocationId) ? String(user.lastLocationId) : defaultId,
  };
};

const findLocation = (user, id) =>
  mongoose.Types.ObjectId.isValid(id) ? (user.locations || []).find((l) => sameId(l._id, id)) : undefined;

// Keeps defaultLocationId pointing at a real location and copies it into the
// user's own address. Call before saving after any change to locations.
const syncDefault = (user) => {
  const list = user.locations || [];
  if (!list.length) {
    user.defaultLocationId = undefined;
    return;
  }
  let def = findLocation(user, user.defaultLocationId);
  if (!def) {
    def = list[0];
    user.defaultLocationId = def._id;
  }
  user.address = def.address;
  user.location = hasPoint(def.location) ? def.location : undefined;
  if (user.lastLocationId && !findLocation(user, user.lastLocationId)) user.lastLocationId = undefined;
};

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : undefined);

// Validates name/address/notes from a request. With `partial`, missing fields
// are left out rather than required.
const parseLocationInput = (body = {}, { partial = false } = {}) => {
  const values = {};
  const address = text(body.address, 200);
  if (address !== undefined) {
    if (!address) return { error: "Please enter the address." };
    values.address = address;
  } else if (!partial) {
    return { error: "Please enter the address." };
  }
  const name = text(body.name, 60);
  if (name !== undefined) values.name = name || (values.address ? nameFromAddress(values.address) : undefined);
  else if (!partial) values.name = nameFromAddress(values.address);
  if (values.name === undefined) delete values.name;
  const notes = text(body.notes, 300);
  if (notes !== undefined) values.notes = notes;
  return { values };
};

// Copies a location's details into a schedule (or anything shaped like one).
const pickupFields = (loc) => ({
  fromRestaurantAddress: loc.address,
  pickupLocationName: loc.name,
  pickupNotes: loc.notes || undefined,
  location: hasPoint(loc.location) ? loc.location : undefined,
});

// Adds a location to `user` (not saved). Returns { location } or { error }.
const addLocation = async (user, values, { makeDefault = false } = {}) => {
  if (!user.locations) user.locations = [];
  if (user.locations.length >= MAX_LOCATIONS) {
    return { error: `You can save up to ${MAX_LOCATIONS} locations.` };
  }
  const duplicate = user.locations.find((l) => l.address.toLowerCase() === values.address.toLowerCase());
  if (duplicate) return { location: duplicate, existing: true };
  user.locations.push({ ...values, location: await geocodeToPoint(values.address) });
  const location = user.locations[user.locations.length - 1];
  if (makeDefault || user.locations.length === 1) user.defaultLocationId = location._id;
  syncDefault(user);
  return { location };
};

// Changes a saved location (not saved) and updates the weekly donations that
// follow it. Returns { location } or { error }.
const updateLocation = async (user, id, values, { makeDefault = false } = {}) => {
  const location = findLocation(user, id);
  if (!location) return { error: "Location not found.", status: 404 };
  if (values.address && values.address !== location.address) {
    location.location = await geocodeToPoint(values.address);
  }
  Object.assign(location, values);
  if (makeDefault) user.defaultLocationId = location._id;
  syncDefault(user);
  const { location: point, pickupNotes, ...rest } = pickupFields(location);
  const $set = { ...rest }, $unset = {};
  if (point) $set.location = point;
  else $unset.location = "";
  if (pickupNotes) $set.pickupNotes = pickupNotes;
  else $unset.pickupNotes = "";
  await mongoRecurringSchedules.updateMany({ donorId: user._id, locationId: location._id }, { $set, $unset });
  return { location };
};

// Removes a saved location (not saved). Weekly donations that followed it keep
// its last address but stop following it.
const removeLocation = async (user, id) => {
  const location = findLocation(user, id);
  if (!location) return { error: "Location not found.", status: 404 };
  if (user.locations.length === 1) {
    return { error: "You need at least one pickup location. Edit this one instead.", status: 409 };
  }
  user.locations.pull(location._id);
  syncDefault(user);
  await mongoRecurringSchedules.updateMany({ donorId: user._id, locationId: location._id }, { $unset: { locationId: "" } });
  return { location };
};

// Works out where a new posting or schedule is collected from: a saved
// `locationId`, or a typed `fromRestaurantAddress` (one-off, optionally saved
// with `saveLocation`). Returns { fields, locationId } or { error }. May add a
// location to `user`; the caller saves the user when `userChanged` is set.
const resolvePickup = async (user, body = {}) => {
  if (body.locationId) {
    const location = user && findLocation(user, body.locationId);
    if (!location) return { error: "That pickup location no longer exists. Please choose another." };
    return { fields: pickupFields(location), locationId: location._id };
  }
  const address = text(body.fromRestaurantAddress, 200);
  if (!address) return { error: "Please enter the pickup address." };
  if (user && body.saveLocation === true) {
    const { values, error } = parseLocationInput({ address, name: body.locationName, notes: body.pickupNotes });
    if (error) return { error };
    const added = await addLocation(user, values);
    if (added.error) return { error: added.error };
    return { fields: pickupFields(added.location), locationId: added.location._id, userChanged: true };
  }
  const pickupNotes = text(body.pickupNotes, 300);
  return { fields: { fromRestaurantAddress: address, pickupNotes: pickupNotes || undefined } };
};

module.exports = {
  MAX_LOCATIONS,
  nameFromAddress,
  publicLocations,
  findLocation,
  syncDefault,
  parseLocationInput,
  pickupFields,
  addLocation,
  updateLocation,
  removeLocation,
  resolvePickup,
};
