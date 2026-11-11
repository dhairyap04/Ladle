// Volunteer drivers and delivery dispatch.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { setup, teardown, pickupWindow, signUp } = require("./helpers");

const PLACES = {
  "restaurant st": { lat: 53.54, lng: -113.49 },
  "food bank ave": { lat: 53.52, lng: -113.5 },
  "driver home": { lat: 53.55, lng: -113.47 },
  "far away": { lat: 51.05, lng: -114.07 },
};

let ctx, donor, bank, driver, driver2, farDriver, postingId, Postings;
const create = (extra = {}) =>
  donor.post("/posting/create").send({ fromRestaurantAddress: "Restaurant St", pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", estimatedWeightKg: 20, ...pickupWindow(), ...extra });
const inbox = async (agent) => (await agent.get("/notification")).body.items;

before(async () => {
  ctx = await setup();
  require("../geocode").setGeocoder(async (a) => PLACES[a.toLowerCase()] || null);
  donor = ctx.agent();
  bank = ctx.agent();
  driver = ctx.agent();
  driver2 = ctx.agent();
  farDriver = ctx.agent();
  await signUp(donor, { name: "Cafe", email: "cafe@x.com" });
  await signUp(bank, { name: "Bank", email: "bank@x.com", isFoodbank: true });
  for (const [agent, name, email] of [[driver, "Sam", "sam@x.com"], [driver2, "Ana", "ana@x.com"], [farDriver, "Far", "far@x.com"]]) {
    const r = await agent.post("/user/create").send({ name, email, password: "password1", role: "driver" });
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.body.user.role, "driver");
  }
  await driver.post("/user/update").send({ address: "Driver Home", vehicle: "car", maxPickupKg: 50, serviceRadiusKm: 10, phoneNumber: "780-555-0101" });
  await driver2.post("/user/update").send({ vehicle: "bike", maxPickupKg: 10 });
  await farDriver.post("/user/update").send({ address: "Far away", serviceRadiusKm: 10 });
  await bank.post("/user/update").send({ phoneNumber: "780-555-0200" });
  Postings = require("../models/Postings");
  const p = await create();
  postingId = p.body._id;
});
after(teardown);

test("drivers can't post food, claim, or use the food bank's actions", async () => {
  assert.strictEqual((await create()).status, 201); // sanity: the restaurant can
  assert.strictEqual((await driver.post("/posting/create").send({ fromRestaurantAddress: "x", pickupTimeBegin: "10:00", pickupTimeEnd: "11:00", ...pickupWindow() })).status, 403);
  assert.strictEqual((await driver.post(`/posting/${postingId}/claim`)).status, 403);
  assert.strictEqual((await driver.post("/delivery").send({ postingId })).status, 403);
  assert.strictEqual((await bank.get("/delivery/available")).status, 403);
});

test("only the claiming food bank, with an address, can request a driver", async () => {
  assert.strictEqual((await bank.post("/delivery").send({ postingId })).status, 403, "not claimed yet");
  await bank.post(`/posting/${postingId}/claim`);
  const noAddress = await bank.post("/delivery").send({ postingId });
  assert.strictEqual(noAddress.status, 400);
  await bank.post("/user/update").send({ address: "Food Bank Ave" });
  const r = await bank.post("/delivery").send({ postingId, notes: "Loading dock at the back" });
  assert.strictEqual(r.status, 201, JSON.stringify(r.body));
  assert.strictEqual(r.body.status, "requested");
  assert.strictEqual(r.body.restaurantName, "Cafe");
  assert.strictEqual((await bank.post("/delivery").send({ postingId })).status, 409, "only one at a time");
});

test("suitable nearby drivers are alerted; available list shows distance and fit", async () => {
  assert.ok((await inbox(driver)).some((n) => n.type === "delivery" && /Cafe → Bank/.test(n.title)));
  assert.strictEqual((await inbox(driver2)).length, 0, "bike can't carry 20 kg");
  assert.strictEqual((await inbox(farDriver)).length, 0, "outside 10 km");
  const list = await driver.get("/delivery/available");
  assert.strictEqual(list.body.length, 1);
  assert.ok(list.body[0].distanceKm > 0 && list.body[0].distanceKm < 5);
  assert.ok(list.body[0].tripKm > 0);
  assert.deepStrictEqual(list.body[0].fitProblems, []);
  assert.ok(!("contacts" in list.body[0]), "no contact details before accepting");
  const bike = await driver2.get("/delivery/available");
  assert.deepStrictEqual(bike.body[0].fitProblems, ["too_heavy"]);
});

test("accepting is first-come; contacts are shared with the people involved", async () => {
  const [{ _id }] = (await driver.get("/delivery/available")).body;
  const ok = await driver.post(`/delivery/${_id}/accept`);
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.body.contacts.foodBank.phoneNumber, "780-555-0200");
  assert.strictEqual((await driver2.post(`/delivery/${_id}/accept`)).status, 409);
  const fb = await bank.get(`/delivery/for-posting/${postingId}`);
  assert.strictEqual(fb.body.contacts.driver.name, "Sam");
  assert.strictEqual(fb.body.contacts.driver.vehicle, "car");
  assert.ok(fb.body.driverReliability);
  assert.strictEqual((await driver2.get(`/delivery/for-posting/${postingId}`)).body, null, "not involved");
  assert.ok((await inbox(donor)).some((n) => /Sam will deliver/.test(n.title)));
});

test("collect then deliver; the posting becomes picked up and reliability is recorded", async () => {
  const [{ _id }] = (await driver.get("/delivery/mine")).body;
  assert.strictEqual((await driver.post(`/delivery/${_id}/delivered`)).status, 409, "must collect first");
  assert.strictEqual((await driver2.post(`/delivery/${_id}/picked-up`)).status, 403);
  assert.strictEqual((await driver.post(`/delivery/${_id}/picked-up`)).body.status, "picked_up");
  assert.strictEqual((await Postings.findById(postingId)).status, "picked_up");
  assert.strictEqual((await driver.post(`/delivery/${_id}/delivered`)).body.status, "delivered");
  const rel = await require("../reliability").summary((await driver.get("/user/info")).body.user.id);
  assert.strictEqual(rel.completed, 1);
});

test("release puts the job back and alerts others; late releases count", async () => {
  const p = await create({ estimatedWeightKg: 5 });
  await bank.post(`/posting/${p.body._id}/claim`);
  const d = await bank.post("/delivery").send({ postingId: p.body._id });
  await driver2.post(`/delivery/${d.body._id}/accept`);
  const r = await driver2.post(`/delivery/${d.body._id}/release`);
  assert.strictEqual(r.body.status, "requested");
  assert.ok(!r.body.driverId);
  const ana = await require("../reliability").summary((await driver2.get("/user/info")).body.user.id);
  assert.strictEqual(ana.lateReleases + ana.releases, 1);
  assert.ok((await inbox(bank)).some((n) => /Ana can no longer deliver/.test(n.title)));
});

test("the food bank can cancel; accepted jobs never collected become missed", async () => {
  const p = await create({ estimatedWeightKg: 5 });
  await bank.post(`/posting/${p.body._id}/claim`);
  const d = await bank.post("/delivery").send({ postingId: p.body._id });
  await driver.post(`/delivery/${d.body._id}/accept`);
  const Deliveries = require("../models/Deliveries");
  await Deliveries.updateOne({ _id: d.body._id }, { pickupEndsAt: new Date(Date.now() - 3 * 3600e3) });
  const mine = await driver.get("/delivery/mine");
  assert.strictEqual(mine.body.find((x) => x._id === d.body._id).status, "missed");
  const sam = await require("../reliability").summary((await driver.get("/user/info")).body.user.id);
  assert.strictEqual(sam.noShows, 1);

  const p2 = await create({ estimatedWeightKg: 5 });
  await bank.post(`/posting/${p2.body._id}/claim`);
  const d2 = await bank.post("/delivery").send({ postingId: p2.body._id });
  assert.strictEqual((await bank.post(`/delivery/${d2.body._id}/cancel`)).body.status, "cancelled");
  assert.strictEqual((await bank.post("/delivery").send({ postingId: p2.body._id })).status, 201, "can ask again after cancelling");
});

test("drivers' impact counts their deliveries", async () => {
  const r = await driver.get("/impact");
  assert.strictEqual(r.body.role, "driver");
  assert.strictEqual(r.body.donations, 1);
  assert.strictEqual(r.body.totalKg, 20);
  assert.strictEqual(r.body.topPartners[0].name, "Bank");
});
