// Geocoding, distance search and posting filters.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { setup, teardown, pickupWindow, signUp } = require("./helpers");

// Fake geocoder: known Edmonton-area addresses only.
const PLACES = {
  "downtown": { lat: 53.5444, lng: -113.4909 },
  "whyte ave": { lat: 53.5183, lng: -113.4994 }, // ~3 km from downtown
  "st albert": { lat: 53.6305, lng: -113.6256 }, // ~13 km from downtown
};

let guest, donor, bank;
const create = (address, extra = {}) =>
  donor.post("/posting/create").send({ fromRestaurantAddress: address, pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", ...pickupWindow(), ...extra });

before(async () => {
  const ctx = await setup();
  require("../geocode").setGeocoder(async (address) => PLACES[address.toLowerCase()] || null);
  guest = ctx.guest;
  donor = ctx.agent();
  bank = ctx.agent();
  await signUp(donor, { name: "Cafe", email: "cafe@x.com" });
  await signUp(bank, { name: "Bank", email: "bank@x.com", isFoodbank: true });

  await create("Whyte Ave", { foodTypes: ["bakery"], allergens: ["wheat"], pickupTimeBegin: "08:00", pickupTimeEnd: "10:00", notes: "croissants" });
  await create("St Albert", { foodTypes: ["produce"], allergens: ["none"], storage: "refrigerated" });
  await create("Nowhere Rd", { foodTypes: ["prepared_meals"] }); // can't be geocoded
});
after(teardown);

const names = (res) => res.body.map((p) => p.fromRestaurantAddress).sort();

test("postings are geocoded when created; unknown addresses still post", async () => {
  const all = await guest.get("/posting/all");
  assert.strictEqual(all.body.length, 3);
  const byAddr = Object.fromEntries(all.body.map((p) => [p.fromRestaurantAddress, p]));
  assert.deepStrictEqual(byAddr["Whyte Ave"].location.coordinates, [-113.4994, 53.5183]);
  assert.strictEqual(byAddr["Nowhere Rd"].location, undefined);
});

test("distance from a given point, with radius and sort", async () => {
  const { lat, lng } = PLACES.downtown;
  const r = await guest.get("/posting/all").query({ lat, lng, sort: "distance" });
  assert.deepStrictEqual(r.body.map((p) => p.fromRestaurantAddress), ["Whyte Ave", "St Albert", "Nowhere Rd"]);
  assert.ok(r.body[0].distanceKm > 2 && r.body[0].distanceKm < 4, String(r.body[0].distanceKm));
  assert.strictEqual(r.headers["x-search-origin"], "device");
  const near = await guest.get("/posting/all").query({ lat, lng, radiusKm: 5 });
  assert.deepStrictEqual(names(near), ["Whyte Ave"]);
});

test("distance from the food bank's profile address", async () => {
  const u = await bank.post("/user/update").send({ address: "Downtown" });
  assert.strictEqual(u.body.user.hasLocation, true);
  const r = await bank.get("/posting/all").query({ radiusKm: 20 });
  assert.strictEqual(r.headers["x-search-origin"], "profile");
  assert.deepStrictEqual(names(r), ["St Albert", "Whyte Ave"]);
});

test("filters by food type, storage, allergens, time and text", async () => {
  assert.deepStrictEqual(names(await guest.get("/posting/all").query({ foodTypes: "bakery,produce" })), ["St Albert", "Whyte Ave"]);
  assert.deepStrictEqual(names(await guest.get("/posting/all").query({ storage: "refrigerated" })), ["St Albert"]);
  assert.deepStrictEqual(names(await guest.get("/posting/all").query({ excludeAllergens: "wheat" })), ["Nowhere Rd", "St Albert"]);
  assert.deepStrictEqual(names(await guest.get("/posting/all").query({ excludeAllergens: "wheat", allergenInfo: "1" })), ["St Albert"]);
  assert.deepStrictEqual(names(await guest.get("/posting/all").query({ pickupBefore: "12:00" })), ["Whyte Ave"]);
  assert.deepStrictEqual(names(await guest.get("/posting/all").query({ pickupAfter: "17:00" })), ["Nowhere Rd", "St Albert"]);
  assert.deepStrictEqual(names(await guest.get("/posting/all").query({ q: "CROISS" })), ["Whyte Ave"]);
  assert.strictEqual((await guest.get("/posting/all").query({ q: "(((" })).status, 200);
});

test("fitsMe keeps only postings that suit the food bank", async () => {
  await bank.post("/user/update").send({ coldStorage: [] });
  const r = await bank.get("/posting/all").query({ fitsMe: "1" });
  assert.deepStrictEqual(names(r), ["Nowhere Rd", "Whyte Ave"]);
});

test("editing the address re-geocodes the posting", async () => {
  const c = await create("Nowhere Rd");
  const e = await donor.post(`/posting/${c.body._id}/edit`).send({ fromRestaurantAddress: "Downtown", pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", ...pickupWindow() });
  assert.deepStrictEqual(e.body.location.coordinates, [-113.4909, 53.5444]);
});
