// Food bank receiving profiles and posting fit.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { setup, teardown, pickupWindow, signUp } = require("./helpers");
const { fitProblems } = require("../matching");

let guest, donor, bank;
const post = (extra) =>
  donor.post("/posting/create").send({ fromRestaurantAddress: "1 Main St", pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", ...pickupWindow(), ...extra });

before(async () => {
  const ctx = await setup();
  guest = ctx.guest;
  donor = ctx.agent();
  bank = ctx.agent();
  await signUp(donor, { name: "Cafe", email: "cafe@x.com" });
  await signUp(bank, { name: "Bank", email: "bank@x.com", isFoodbank: true });
});
after(teardown);

test("food bank saves its receiving profile; bad values rejected", async () => {
  const r = await bank.post("/user/update").send({
    acceptedFoodTypes: ["produce", "bakery", "gravel"],
    coldStorage: ["refrigerated"],
    receivingDays: [1, 2, 9, "3"],
    maxPickupKg: "50",
    serviceRadiusKm: 15,
    openHours: "09:00-17:00",
  });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.deepStrictEqual(r.body.user.acceptedFoodTypes, ["produce", "bakery"]);
  assert.deepStrictEqual(r.body.user.receivingDays, [1, 2, 3]);
  assert.strictEqual(r.body.user.maxPickupKg, 50);
  const bad = await bank.post("/user/update").send({ maxPickupKg: -4 });
  assert.strictEqual(bad.status, 400);
  const cleared = await bank.post("/user/update").send({ serviceRadiusKm: "" });
  assert.strictEqual(cleared.body.user.serviceRadiusKm, null);
});

test("restaurants can't set food bank fields", async () => {
  const r = await donor.post("/user/update").send({ name: "Cafe", acceptedFoodTypes: ["produce"] });
  assert.deepStrictEqual(r.body.user.acceptedFoodTypes, []);
});

test("posting list marks fit for food banks only", async () => {
  await bank.post("/user/update").send({ receivingDays: [], openHours: "" }); // any day, any time
  await post({ foodTypes: ["bakery"], storage: "ambient" });
  await post({ foodTypes: ["meat_fish"], storage: "frozen", estimatedWeightKg: 80 });
  const asBank = await bank.get("/posting/all");
  const problems = asBank.body.map((p) => p.fitProblems.sort().join(","));
  assert.ok(problems.includes(""), JSON.stringify(problems));
  assert.ok(problems.includes("food_type,needs_freezer,too_heavy"), JSON.stringify(problems));
  const asGuest = await guest.get("/posting/all");
  assert.ok(asGuest.body.every((p) => !("fitProblems" in p)));
});

test("fitProblems checks days and hours, and ignores missing info", () => {
  const bankProfile = { receivingDays: [1], openHours: "09:00-12:00" }; // Mondays, mornings
  // 2026-11-16 is a Monday.
  assert.deepStrictEqual(fitProblems({ pickupDate: "2026-11-16", pickupTimeBegin: 1000, pickupTimeEnd: 1100 }, bankProfile), []);
  assert.deepStrictEqual(fitProblems({ pickupDate: "2026-11-17", pickupTimeBegin: 1300, pickupTimeEnd: 1400 }, bankProfile), ["day", "hours"]);
  assert.deepStrictEqual(fitProblems({ storage: "refrigerated" }, {}), ["needs_fridge"]);
  assert.deepStrictEqual(fitProblems({}, {}), []);
});
