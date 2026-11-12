// Checking that volunteer drivers really collect and deliver: handoff codes,
// photos, location checks, food bank confirmation, problem reports and admin review.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { setup, teardown, pickupWindow, signUp } = require("./helpers");

const PLACES = {
  "restaurant st": { lat: 53.54, lng: -113.49 },
  "food bank ave": { lat: 53.52, lng: -113.5 },
};
const AT_RESTAURANT = { lat: 53.5401, lng: -113.4901, accuracy: 20 };
const AT_FOOD_BANK = { lat: 53.5201, lng: -113.5001, accuracy: 20 };
const FAR = { lat: 53.6, lng: -113.3, accuracy: 20 };
// 1x1 PNG.
const PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

let ctx, donor, bank, driver, other, admin, Deliveries, reliability, driverId;
const inbox = async (agent) => (await agent.get("/notification")).body.items;

// A claimed posting with a delivery the driver has accepted.
async function acceptedJob(extra = {}) {
  const p = await donor.post("/posting/create").send({
    fromRestaurantAddress: "Restaurant St", pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", estimatedWeightKg: 5, ...pickupWindow(), ...extra,
  });
  await bank.post(`/posting/${p.body._id}/claim`);
  const d = (await bank.post("/delivery").send({ postingId: p.body._id })).body;
  assert.strictEqual((await driver.post(`/delivery/${d._id}/accept`)).status, 200);
  return { postingId: p.body._id, id: d._id };
}
const codeFor = async (agent, postingId) => (await agent.get(`/delivery/for-posting/${postingId}`)).body.handoffCode;

before(async () => {
  ctx = await setup({ env: { ADMIN_EMAILS: "admin@x.com" } });
  require("../geocode").setGeocoder(async (a) => PLACES[a.toLowerCase()] || null);
  donor = ctx.agent();
  bank = ctx.agent();
  driver = ctx.agent();
  other = ctx.agent();
  admin = ctx.agent();
  await signUp(donor, { name: "Cafe", email: "cafe@x.com" });
  await signUp(bank, { name: "Bank", email: "bank@x.com", isFoodbank: true });
  await bank.post("/user/update").send({ address: "Food Bank Ave" });
  await driver.post("/user/create").send({ name: "Sam", email: "sam@x.com", password: "password1", role: "driver" });
  await driver.post("/user/update").send({ vehicle: "car", maxPickupKg: 50 });
  await other.post("/user/create").send({ name: "Ana", email: "ana@x.com", password: "password1", role: "driver" });
  await signUp(admin, { name: "Admin", email: "admin@x.com" });
  Deliveries = require("../models/Deliveries");
  reliability = require("../reliability");
  driverId = (await driver.get("/user/info")).body.user.id;
});
after(teardown);

test("codes are shown only to the person who hands them over, never to the driver", async () => {
  const { postingId, id } = await acceptedJob();
  const pickup = await codeFor(donor, postingId);
  const dropoff = await codeFor(bank, postingId);
  assert.match(pickup, /^\d{4}$/);
  assert.match(dropoff, /^\d{4}$/);
  const forDriver = (await driver.get("/delivery/mine")).body.find((d) => d._id === id);
  assert.ok(!("handoffCode" in forDriver) && !("pickupCode" in forDriver) && !("dropoffCode" in forDriver));
  const available = await other.get("/delivery/available");
  assert.ok(available.body.every((d) => !("pickupCode" in d)));
  const exported = await driver.get("/user/export");
  assert.ok(!JSON.stringify(exported.body).includes('"pickupCode"'));
});

test("collecting needs the restaurant's code or a photo; wrong codes are limited", async () => {
  const { postingId, id } = await acceptedJob();
  const none = await driver.post(`/delivery/${id}/picked-up`);
  assert.strictEqual(none.status, 400);
  assert.match(none.body.msg, /code from the restaurant, or add a photo/);

  const right = await codeFor(donor, postingId);
  const wrong = right === "0000" ? "1111" : "0000";
  const bad = await driver.post(`/delivery/${id}/picked-up`).send({ code: wrong });
  assert.strictEqual(bad.status, 400);
  assert.strictEqual(bad.body.triesLeft, 4);
  for (let i = 0; i < 4; i++) await driver.post(`/delivery/${id}/picked-up`).send({ code: wrong });
  assert.strictEqual((await driver.post(`/delivery/${id}/picked-up`).send({ code: right })).status, 429, "locked after 5 wrong codes");

  const withPhoto = await driver.post(`/delivery/${id}/picked-up`).send({ photo: PHOTO, location: AT_RESTAURANT });
  assert.strictEqual(withPhoto.status, 200);
  assert.strictEqual(withPhoto.body.pickupProof.method, "photo");
  assert.strictEqual(withPhoto.body.pickupProof.location, "near");
  assert.strictEqual(withPhoto.body.pickupProof.hasPhoto, true);
  assert.ok(!("lat" in withPhoto.body.pickupProof), "coordinates aren't stored");
  assert.ok((await inbox(donor)).some((n) => /didn't use your handoff code/.test(n.body)));

  // The photo is visible to the people involved and admins only.
  assert.strictEqual((await donor.get(`/delivery/${id}/photo/pickup`)).status, 200);
  assert.strictEqual((await admin.get(`/delivery/${id}/photo/pickup`)).status, 200);
  assert.strictEqual((await other.get(`/delivery/${id}/photo/pickup`)).status, 403);
  assert.strictEqual((await donor.get(`/delivery/${id}/photo/dropoff`)).status, 404);
});

test("the food bank's code confirms the delivery straight away and credits the driver", async () => {
  const before = (await reliability.summary(driverId)).completed;
  const { postingId, id } = await acceptedJob();
  await driver.post(`/delivery/${id}/picked-up`).send({ code: await codeFor(donor, postingId), location: AT_RESTAURANT });
  const forBank = (await bank.get(`/delivery/for-posting/${postingId}`)).body;
  assert.match(forBank.handoffCode, /^\d{4}$/, "food bank still sees its code while the food is on the way");
  assert.strictEqual((await codeFor(donor, postingId)), undefined, "restaurant's code is done with");
  const done = await driver.post(`/delivery/${id}/delivered`).send({ code: forBank.handoffCode, location: AT_FOOD_BANK });
  assert.strictEqual(done.body.receipt, "confirmed");
  assert.strictEqual(done.body.receiptConfirmedBy, "code");
  assert.strictEqual(done.body.dropoffProof.location, "near");
  assert.strictEqual((await reliability.summary(driverId)).completed, before + 1);
  const after = (await bank.get(`/delivery/for-posting/${postingId}`)).body;
  assert.strictEqual(after.handoffCode, undefined);
  assert.strictEqual(after.canConfirm, false);
  assert.strictEqual(after.canReportDropoff, false, "nothing to dispute once the code was used");
});

test("without the code, the food bank is asked to confirm; the driver is credited when it does", async () => {
  const before = (await reliability.summary(driverId)).completed;
  const { postingId, id } = await acceptedJob();
  await driver.post(`/delivery/${id}/picked-up`).send({ code: await codeFor(donor, postingId) });
  const done = await driver.post(`/delivery/${id}/delivered`).send({ photo: PHOTO });
  assert.strictEqual(done.body.receipt, "pending");
  assert.strictEqual(done.body.dropoffProof.location, "unknown", "no location shared");
  assert.strictEqual((await reliability.summary(driverId)).completed, before, "not counted until confirmed");
  assert.ok((await inbox(bank)).some((n) => /Did the food from Cafe arrive/.test(n.title)));

  assert.strictEqual((await other.post(`/delivery/${id}/confirm`)).status, 403);
  assert.strictEqual((await donor.post(`/delivery/${id}/confirm`)).status, 403);
  const view = (await bank.get(`/delivery/for-posting/${postingId}`)).body;
  assert.strictEqual(view.canConfirm, true);
  assert.strictEqual(view.canReportDropoff, true);
  const ok = await bank.post(`/delivery/${id}/confirm`);
  assert.strictEqual(ok.body.receipt, "confirmed");
  assert.strictEqual(ok.body.receiptConfirmedBy, "foodbank");
  assert.strictEqual((await reliability.summary(driverId)).completed, before + 1);
  assert.strictEqual((await bank.post(`/delivery/${id}/confirm`)).status, 409, "only once");
});

test("unconfirmed deliveries get a reminder after a day and count as delivered after three", async () => {
  const before = (await reliability.summary(driverId)).completed;
  const { postingId, id } = await acceptedJob();
  await driver.post(`/delivery/${id}/picked-up`).send({ code: await codeFor(donor, postingId) });
  await driver.post(`/delivery/${id}/delivered`).send({ photo: PHOTO });

  await Deliveries.updateOne({ _id: id }, { deliveredAt: new Date(Date.now() - 25 * 3600e3) });
  await bank.get("/delivery/mine");
  const reminders = (await inbox(bank)).filter((n) => /Did the food from Cafe arrive/.test(n.title) && n.postingId === postingId);
  assert.strictEqual(reminders.length, 2, "first ask plus one reminder");
  await bank.get("/delivery/mine");
  assert.strictEqual((await inbox(bank)).filter((n) => /arrive/.test(n.title) && n.postingId === postingId).length, 2, "only one reminder");

  await Deliveries.updateOne({ _id: id }, { deliveredAt: new Date(Date.now() - 73 * 3600e3) });
  const view = (await bank.get(`/delivery/for-posting/${postingId}`)).body;
  assert.strictEqual(view.receipt, "assumed");
  assert.strictEqual(view.canReportDropoff, true, "can still report within a week");
  assert.strictEqual((await reliability.summary(driverId)).completed, before + 1);
});

test("a food bank report counts against the driver until an admin resolves it", async () => {
  const start = await reliability.summary(driverId);
  const { postingId, id } = await acceptedJob();
  await driver.post(`/delivery/${id}/picked-up`).send({ code: await codeFor(donor, postingId) });
  await driver.post(`/delivery/${id}/delivered`).send({ photo: PHOTO, location: FAR });
  assert.strictEqual((await donor.post(`/delivery/${id}/report`).send({ stage: "dropoff" })).status, 409, "restaurant can't report a drop-off");
  const r = await bank.post(`/delivery/${id}/report`).send({ stage: "dropoff", note: "Nothing arrived" });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.receipt, "disputed");
  assert.strictEqual((await bank.post(`/delivery/${id}/report`).send({ stage: "dropoff" })).status, 409, "only once");
  assert.strictEqual((await reliability.summary(driverId)).noShows, start.noShows + 1);
  assert.ok((await inbox(driver)).some((n) => /reported a problem/.test(n.title) && /Nothing arrived/.test(n.body)));
  assert.ok((await inbox(admin)).some((n) => /Delivery problem reported/.test(n.title)));

  assert.strictEqual((await bank.get("/admin/deliveries")).status, 403);
  const queue = await admin.get("/admin/deliveries");
  const item = queue.body.find((d) => d._id === id);
  assert.ok(item, "in the review queue");
  assert.strictEqual(item.dispute.note, "Nothing arrived");
  assert.deepStrictEqual(item.flags, ["dropoff_far"]);
  assert.strictEqual(item.driver.name, "Sam");
  assert.ok((await admin.get("/admin/overview")).body.deliveriesToReview >= 1);

  const resolved = await admin.post(`/admin/deliveries/${id}/resolve`).send({ outcome: "delivered", note: "Left with the neighbour by mistake, since found." });
  assert.strictEqual(resolved.status, 200);
  assert.strictEqual(resolved.body.receiptConfirmedBy, "admin");
  const end = await reliability.summary(driverId);
  assert.strictEqual(end.noShows, start.noShows, "dispute removed");
  assert.strictEqual(end.completed, start.completed + 1);
  assert.ok(!(await admin.get("/admin/deliveries")).body.some((d) => d._id === id), "out of the queue");
});

test("a food bank that reported a problem can confirm when the food turns up", async () => {
  const start = await reliability.summary(driverId);
  const { postingId, id } = await acceptedJob();
  await driver.post(`/delivery/${id}/picked-up`).send({ code: await codeFor(donor, postingId) });
  await driver.post(`/delivery/${id}/delivered`).send({ photo: PHOTO });
  await bank.post(`/delivery/${id}/report`).send({ stage: "dropoff" });
  const ok = await bank.post(`/delivery/${id}/confirm`);
  assert.strictEqual(ok.body.receipt, "confirmed");
  assert.strictEqual(ok.body.dispute.resolution, "delivered");
  const end = await reliability.summary(driverId);
  assert.strictEqual(end.noShows, start.noShows);
  assert.strictEqual(end.completed, start.completed + 1);
});

test("food collected long ago that never arrived can be reported before it's marked delivered", async () => {
  const { postingId, id } = await acceptedJob();
  await driver.post(`/delivery/${id}/picked-up`).send({ code: await codeFor(donor, postingId) });
  assert.strictEqual((await bank.get(`/delivery/for-posting/${postingId}`)).body.canReportDropoff, false, "too soon");
  await Deliveries.updateOne({ _id: id }, { pickedUpAt: new Date(Date.now() - 3 * 3600e3) });
  assert.strictEqual((await bank.post(`/delivery/${id}/report`).send({ stage: "dropoff", note: "Never arrived" })).status, 200);
  const resolved = await admin.post(`/admin/deliveries/${id}/resolve`).send({ outcome: "not_delivered" });
  assert.strictEqual(resolved.body.dispute.resolution, "not_delivered");
  assert.strictEqual(resolved.body.status, "picked_up");
});

test("the restaurant can report a photo-only pickup that didn't happen", async () => {
  const { postingId, id } = await acceptedJob();
  await driver.post(`/delivery/${id}/picked-up`).send({ photo: PHOTO });
  assert.strictEqual((await donor.get(`/delivery/for-posting/${postingId}`)).body.canReportPickup, true);
  const r = await donor.post(`/delivery/${id}/report`).send({ stage: "pickup", note: "Nobody came" });
  assert.strictEqual(r.body.dispute.stage, "pickup");

  // With the restaurant's code there's nothing to dispute.
  const second = await acceptedJob();
  await driver.post(`/delivery/${second.id}/picked-up`).send({ code: await codeFor(donor, second.postingId) });
  assert.strictEqual((await donor.post(`/delivery/${second.id}/report`).send({ stage: "pickup" })).status, 409);
});

test("location and timing that look wrong are flagged for review, without blocking the driver", async () => {
  const { postingId, id } = await acceptedJob();
  const collected = await driver.post(`/delivery/${id}/picked-up`).send({ code: await codeFor(donor, postingId), location: FAR });
  assert.strictEqual(collected.status, 200);
  assert.strictEqual(collected.body.pickupProof.location, "far");
  assert.ok(collected.body.pickupProof.distanceM > 1000);
  // Delivered seconds later over a ~2.2 km trip is fine (under the 3 km minimum); fake a longer trip.
  await Deliveries.updateOne({ _id: id }, { dropoffLocation: { type: "Point", coordinates: [-113.3, 53.7] } });
  const done = await driver.post(`/delivery/${id}/delivered`).send({ code: await codeFor(bank, postingId) });
  assert.deepStrictEqual(done.body.flags.sort(), ["pickup_far", "too_fast"]);
  const queue = (await admin.get("/admin/deliveries")).body;
  assert.ok(queue.some((d) => d._id === id));
  await admin.post(`/admin/deliveries/${id}/resolve`).send({ outcome: "delivered" });
  assert.ok(!(await admin.get("/admin/deliveries")).body.some((d) => d._id === id));
});

test("a released job gets new codes for the next driver", async () => {
  const { postingId, id } = await acceptedJob();
  const first = await codeFor(donor, postingId);
  const codes = async () => Deliveries.findById(id).select("+pickupCode +dropoffCode");
  const before = await codes();
  await driver.post(`/delivery/${id}/release`);
  await other.post("/user/update").send({ vehicle: "car", maxPickupKg: 50 });
  await other.post(`/delivery/${id}/accept`);
  const after = await codes();
  assert.match(first, /^\d{4}$/);
  // Random 4-digit codes can collide by chance, so check both didn't stay the same.
  assert.ok(after.pickupCode !== before.pickupCode || after.dropoffCode !== before.dropoffCode);
});
