// Food safety fields and posting photos.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { setup, teardown, pickupWindow, signUp } = require("./helpers");

// A 1x1 transparent PNG.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

let guest, donor;
const base = () => ({ fromRestaurantAddress: "1 Main St", pickupTimeBegin: "10:00", pickupTimeEnd: "11:00", ...pickupWindow() });

before(async () => {
  const ctx = await setup();
  guest = ctx.guest;
  donor = ctx.agent();
  await signUp(donor, { name: "Cafe", email: "cafe@x.com" });
});
after(teardown);

test("saves food types, allergens, storage, quantity and weight; drops unknown values", async () => {
  const preparedAt = new Date(Date.now() - 3600e3).toISOString();
  const r = await donor.post("/posting/create").send({
    ...base(),
    foodTypes: ["bakery", "produce", "bakery", "rocks"],
    allergens: ["wheat", "milk", "glitter"],
    storage: "refrigerated",
    preparedAt,
    quantity: "  3 trays  ",
    estimatedWeightKg: "4.25",
  });
  assert.strictEqual(r.status, 201, JSON.stringify(r.body));
  assert.deepStrictEqual(r.body.foodTypes, ["bakery", "produce"]);
  assert.deepStrictEqual(r.body.allergens, ["wheat", "milk"]);
  assert.strictEqual(r.body.storage, "refrigerated");
  assert.strictEqual(r.body.quantity, "3 trays");
  assert.strictEqual(r.body.estimatedWeightKg, 4.3);
  assert.strictEqual(new Date(r.body.preparedAt).toISOString(), preparedAt);
  assert.strictEqual(r.body.hasPhoto, false);
});

test("defaults storage to ambient and rejects bad values", async () => {
  const ok = await donor.post("/posting/create").send(base());
  assert.strictEqual(ok.body.storage, "ambient");
  for (const bad of [
    { storage: "lukewarm" },
    { estimatedWeightKg: -2 },
    { preparedAt: "not a date" },
    { preparedAt: new Date(Date.now() + 86400e3).toISOString() },
    { allergens: ["none", "milk"] },
  ]) {
    const r = await donor.post("/posting/create").send({ ...base(), ...bad });
    assert.strictEqual(r.status, 400, JSON.stringify(bad));
  }
});

test("stores a photo, serves it, and can replace or remove it", async () => {
  const r = await donor.post("/posting/create").send({ ...base(), photo: PNG });
  assert.strictEqual(r.status, 201, JSON.stringify(r.body));
  assert.strictEqual(r.body.hasPhoto, true);
  const img = await guest.get(`/posting/${r.body._id}/photo`);
  assert.strictEqual(img.status, 200);
  assert.strictEqual(img.headers["content-type"], "image/png");
  assert.ok(img.body.length > 0);

  const removed = await donor.post(`/posting/${r.body._id}/edit`).send({ ...base(), removePhoto: true });
  assert.strictEqual(removed.body.hasPhoto, false);
  assert.strictEqual((await guest.get(`/posting/${r.body._id}/photo`)).status, 404);
});

test("rejects non-image and oversized photos", async () => {
  const gif = await donor.post("/posting/create").send({ ...base(), photo: "data:text/html;base64,PGgxPg==" });
  assert.strictEqual(gif.status, 400);
  const big = "data:image/jpeg;base64," + Buffer.alloc(1.6 * 1024 * 1024).toString("base64");
  const r = await donor.post("/posting/create").send({ ...base(), photo: big });
  assert.strictEqual(r.status, 400);
  assert.match(r.body.msg, /too large/);
});
