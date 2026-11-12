// Restaurants' saved pickup locations, and postings and schedules that use them.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { setup, teardown, pickupWindow, signUp } = require("./helpers");

const PLACES = {
  "1 jasper ave, edmonton": { lat: 53.541, lng: -113.494 },
  "2 whyte ave, edmonton": { lat: 53.518, lng: -113.499 },
  "3 moved st, edmonton": { lat: 53.6, lng: -113.6 },
  "4 cargo rd, edmonton": { lat: 53.31, lng: -113.58 },
};

let ctx, donor, bank, Postings, Schedules, Users, geocodeCalls = 0;
const post = (extra = {}) =>
  donor.post("/posting/create").send({ pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", ...pickupWindow(), ...extra });

before(async () => {
  ctx = await setup({
    // An account from before saved locations: migrate() gives it one.
    beforeMigrate: async () => {
      const Users = require("../models/Users");
      await Users.collection.insertOne({
        name: "Old Diner", email: "old@x.com", password: "x", role: "restaurant",
        address: "9 Old Rd, Edmonton", location: { type: "Point", coordinates: [-113.5, 53.5] },
      });
    },
  });
  require("../geocode").setGeocoder(async (a) => {
    geocodeCalls += 1;
    return PLACES[a.toLowerCase()] || null;
  });
  donor = ctx.agent();
  bank = ctx.agent();
  await signUp(donor, { name: "Harvest Table", email: "harvest@x.com" });
  await signUp(bank, { name: "Bank", email: "bank@x.com", isFoodbank: true });
  Postings = require("../models/Postings");
  Schedules = require("../models/RecurringSchedules");
  Users = require("../models/Users");
});
after(teardown);

test("an existing restaurant's address becomes its first location", async () => {
  const old = await Users.findOne({ email: "old@x.com" });
  assert.strictEqual(old.locations.length, 1);
  assert.strictEqual(old.locations[0].name, "9 Old Rd");
  assert.strictEqual(old.locations[0].address, "9 Old Rd, Edmonton");
  assert.deepStrictEqual([...old.locations[0].location.coordinates], [-113.5, 53.5]);
  assert.strictEqual(String(old.defaultLocationId), String(old.locations[0]._id));
});

test("setting the profile address creates the first location", async () => {
  const r = await donor.post("/user/update").send({ address: "1 Jasper Ave, Edmonton" });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(r.body.user.locations.length, 1);
  assert.strictEqual(r.body.user.locations[0].name, "1 Jasper Ave");
  assert.strictEqual(r.body.user.address, "1 Jasper Ave, Edmonton");
  assert.strictEqual(r.body.user.hasLocation, true);
  assert.strictEqual(r.body.user.preferredLocationId, r.body.user.locations[0].id);
});

test("adding, renaming and choosing the default location", async () => {
  const bad = await donor.post("/user/locations").send({ name: "Nowhere" });
  assert.strictEqual(bad.status, 400);
  const added = await donor.post("/user/locations").send({ name: "Whyte Ave", address: "2 Whyte Ave, Edmonton", notes: "Back door on 104 St" });
  assert.strictEqual(added.status, 201, JSON.stringify(added.body));
  const { user } = added.body;
  assert.strictEqual(user.locations.length, 2);
  assert.strictEqual(user.defaultLocationId, user.locations[0].id); // unchanged
  const dup = await donor.post("/user/locations").send({ address: "2 whyte ave, edmonton" });
  assert.strictEqual(dup.status, 409);

  const made = await donor.patch(`/user/locations/${added.body.locationId}`).send({ makeDefault: true });
  assert.strictEqual(made.body.user.defaultLocationId, added.body.locationId);
  assert.strictEqual(made.body.user.address, "2 Whyte Ave, Edmonton"); // mirrors the default

  const renamed = await donor.patch(`/user/locations/${added.body.locationId}`).send({ name: "Old Strathcona" });
  assert.strictEqual(renamed.body.user.locations[1].name, "Old Strathcona");
  assert.strictEqual(renamed.body.user.locations[1].notes, "Back door on 104 St");

  assert.strictEqual((await bank.post("/user/locations").send({ address: "1 Jasper Ave, Edmonton" })).status, 403);
  assert.strictEqual((await donor.patch("/user/locations/nope").send({ name: "x" })).status, 404);
});

test("a posting from a saved location copies it without geocoding again", async () => {
  const me = (await donor.get("/user/info")).body.user;
  const whyte = me.locations.find((l) => l.name === "Old Strathcona");
  const before = geocodeCalls;
  const r = await post({ locationId: whyte.id });
  assert.strictEqual(r.status, 201, JSON.stringify(r.body));
  assert.strictEqual(geocodeCalls, before);
  assert.strictEqual(r.body.fromRestaurantAddress, "2 Whyte Ave, Edmonton");
  assert.strictEqual(r.body.pickupLocationName, "Old Strathcona");
  assert.strictEqual(r.body.pickupNotes, "Back door on 104 St");
  assert.deepStrictEqual(r.body.location.coordinates, [-113.499, 53.518]);

  // Next time, the last-used location is preselected.
  const jasper = me.locations.find((l) => l.name === "1 Jasper Ave");
  await post({ locationId: jasper.id });
  assert.strictEqual((await donor.get("/user/info")).body.user.preferredLocationId, jasper.id);

  assert.strictEqual((await post({ locationId: "64b000000000000000000000" })).status, 400);
});

test("a one-off address is used once, or saved when asked", async () => {
  const once = await post({ fromRestaurantAddress: "Community Hall, 5 Hall Rd", pickupNotes: "Side entrance" });
  assert.strictEqual(once.status, 201, JSON.stringify(once.body));
  assert.strictEqual(once.body.pickupLocationName, undefined);
  assert.strictEqual(once.body.pickupNotes, "Side entrance");
  assert.strictEqual((await donor.get("/user/info")).body.user.locations.length, 2);

  const saved = await post({ fromRestaurantAddress: "3 Moved St, Edmonton", saveLocation: true, locationName: "Airport" });
  assert.strictEqual(saved.status, 201);
  assert.strictEqual(saved.body.pickupLocationName, "Airport");
  const me = (await donor.get("/user/info")).body.user;
  assert.strictEqual(me.locations.length, 3);
  assert.strictEqual(me.preferredLocationId, me.locations[2].id);

  assert.strictEqual((await post({})).status, 400); // no location and no address
});

test("editing a posting can switch to another location", async () => {
  const me = (await donor.get("/user/info")).body.user;
  const [jasper, whyte] = me.locations;
  const created = await post({ locationId: whyte.id });
  const r = await donor.post(`/posting/${created.body._id}/edit`).send({ pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", ...pickupWindow(), locationId: jasper.id });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(r.body.pickupLocationName, "1 Jasper Ave");
  assert.strictEqual(r.body.pickupNotes, undefined);
  assert.strictEqual(r.body.fromRestaurantAddress, "1 Jasper Ave, Edmonton");
});

test("weekly donations follow their location's changes; postings keep theirs", async () => {
  const me = (await donor.get("/user/info")).body.user;
  const airport = me.locations.find((l) => l.name === "Airport");
  const s = await donor.post("/schedule").send({
    locationId: airport.id,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    pickupTimeBegin: "23:00",
    pickupTimeEnd: "23:59",
    startsOn: "2020-01-01",
    timeZone: "America/Edmonton",
  });
  assert.strictEqual(s.status, 201, JSON.stringify(s.body));
  assert.strictEqual(s.body.pickupLocationName, "Airport");
  const generated = await Postings.findOne({ scheduleId: s.body._id });
  assert.strictEqual(generated.pickupLocationName, "Airport");

  await donor.patch(`/user/locations/${airport.id}`).send({ name: "YEG", address: "4 Cargo Rd, Edmonton", notes: "Cargo door" });
  const schedule = await Schedules.findById(s.body._id);
  assert.strictEqual(schedule.pickupLocationName, "YEG");
  assert.strictEqual(schedule.fromRestaurantAddress, "4 Cargo Rd, Edmonton");
  assert.strictEqual(schedule.pickupNotes, "Cargo door");
  assert.deepStrictEqual([...schedule.location.coordinates], [-113.58, 53.31]);
  const clash = await donor.patch(`/user/locations/${airport.id}`).send({ address: "1 jasper ave, edmonton" });
  assert.strictEqual(clash.status, 409);
  // The posting already made keeps where it was.
  assert.strictEqual((await Postings.findById(generated._id)).pickupLocationName, "Airport");

  const removed = await donor.delete(`/user/locations/${airport.id}`);
  assert.strictEqual(removed.status, 200);
  assert.strictEqual((await Schedules.findById(s.body._id)).locationId, undefined);
  assert.strictEqual((await Schedules.findById(s.body._id)).pickupLocationName, "YEG");
});

test("deleting the default picks another, but the last one stays", async () => {
  let me = (await donor.get("/user/info")).body.user;
  const def = me.defaultLocationId;
  const r = await donor.delete(`/user/locations/${def}`);
  assert.strictEqual(r.status, 200);
  me = r.body.user;
  assert.notStrictEqual(me.defaultLocationId, def);
  assert.strictEqual(me.address, me.locations.find((l) => l.id === me.defaultLocationId).address);
  const last = await donor.delete(`/user/locations/${me.locations[0].id}`);
  assert.strictEqual(last.status, 409);
});

test("food banks see the location name and notes; drivers get them on deliveries", async () => {
  const all = await bank.get("/posting/all");
  const withNotes = all.body.find((p) => p.pickupNotes === "Back door on 104 St");
  assert.ok(withNotes, "posting with notes is listed");
  assert.strictEqual(withNotes.pickupLocationName, "Old Strathcona");
});
