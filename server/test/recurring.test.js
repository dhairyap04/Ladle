// Recurring schedules and the postings generated from them.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { setup, teardown, signUp } = require("./helpers");

let donor, bank, Postings, recurring;
const TZ = "America/Edmonton";

const everyDay = (extra = {}) => ({
  fromRestaurantAddress: "1 Main St",
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  pickupTimeBegin: "23:00",
  pickupTimeEnd: "23:59",
  startsOn: "2020-01-01",
  timeZone: TZ,
  foodTypes: ["bakery"],
  allergens: ["wheat"],
  quantity: "2 bags",
  ...extra,
});

before(async () => {
  const ctx = await setup();
  donor = ctx.agent();
  bank = ctx.agent();
  await signUp(donor, { name: "Bakery", email: "bakery@x.com" });
  await signUp(bank, { name: "Bank", email: "bank@x.com", isFoodbank: true });
  Postings = require("../models/Postings");
  recurring = require("../recurring");
});
after(teardown);

test("zonedTime converts local times across daylight saving", () => {
  // Edmonton is UTC-6 in summer (MDT) and UTC-7 in winter (MST).
  assert.strictEqual(recurring.zonedTime("2026-07-01", 1800, TZ).toISOString(), "2026-07-02T00:00:00.000Z");
  assert.strictEqual(recurring.zonedTime("2026-12-01", 1800, TZ).toISOString(), "2026-12-02T01:00:00.000Z");
  assert.strictEqual(recurring.zonedTime("2026-12-01", 2400, TZ).toISOString(), "2026-12-02T07:00:00.000Z");
});

test("validation", async () => {
  for (const bad of [{ daysOfWeek: [] }, { timeZone: "Mars/Olympus" }, { pickupTimeEnd: "22:00" }, { startsOn: "soon" }, { endsOn: "2019-01-01" }]) {
    const r = await donor.post("/schedule").send(everyDay(bad));
    assert.strictEqual(r.status, 400, JSON.stringify(bad));
  }
  assert.strictEqual((await bank.post("/schedule").send(everyDay())).status, 403);
});

test("creating a schedule generates upcoming postings once, with the food details", async () => {
  const r = await donor.post("/schedule").send(everyDay());
  assert.strictEqual(r.status, 201, JSON.stringify(r.body));
  const generated = await Postings.find({ scheduleId: r.body._id });
  assert.ok(generated.length >= 1 && generated.length <= 2, String(generated.length));
  const p = generated[0];
  assert.strictEqual(p.fromRestaurantName, "Bakery");
  assert.strictEqual(p.quantity, "2 bags");
  assert.deepStrictEqual([...p.foodTypes], ["bakery"]);
  assert.strictEqual(p.pickupTimeBegin, 2300);
  assert.strictEqual(recurring.localDate(p.pickupEndsAt, TZ), p.pickupDate);

  // Listing again (and running the generator again) doesn't duplicate.
  await bank.get("/posting/all");
  await recurring.generateRecurringPostings();
  assert.strictEqual(await Postings.countDocuments({ scheduleId: r.body._id }), generated.length);

  const box = (await bank.get("/notification")).body;
  assert.ok(box.items.some((n) => n.type === "new_posting"), "food banks alerted");
});

test("only scheduled weekdays and dates within range get postings", async () => {
  const now = new Date("2026-11-11T15:00:00Z"); // Wednesday morning in Edmonton
  const r = await donor.post("/schedule").send(everyDay({ daysOfWeek: [4], startsOn: "2026-11-01", pickupTimeBegin: "10:00", pickupTimeEnd: "12:00" }));
  await Postings.deleteMany({ scheduleId: r.body._id });
  const created = await recurring.generateRecurringPostings({ now });
  const mine = created.filter((p) => String(p.scheduleId) === r.body._id);
  assert.deepStrictEqual(mine.map((p) => p.pickupDate), ["2026-11-12"]); // Thursday only

  await donor.post(`/schedule/${r.body._id}/edit`).send(everyDay({ daysOfWeek: [4], startsOn: "2026-11-20", pickupTimeBegin: "10:00", pickupTimeEnd: "12:00" }));
  await Postings.deleteMany({ scheduleId: r.body._id });
  const later = await recurring.generateRecurringPostings({ now });
  assert.strictEqual(later.filter((p) => String(p.scheduleId) === r.body._id).length, 0, "not started yet");
});

test("pause, resume, delete; only the owner", async () => {
  const r = await donor.post("/schedule").send(everyDay({ pickupTimeBegin: "23:30" }));
  const other = await bank.post(`/schedule/${r.body._id}/pause`);
  assert.strictEqual(other.status, 403);
  const paused = await donor.post(`/schedule/${r.body._id}/pause`);
  assert.strictEqual(paused.body.active, false);
  await Postings.deleteMany({ scheduleId: r.body._id });
  await recurring.generateRecurringPostings();
  assert.strictEqual(await Postings.countDocuments({ scheduleId: r.body._id }), 0);
  const resumed = await donor.post(`/schedule/${r.body._id}/resume`);
  assert.strictEqual(resumed.body.active, true);
  assert.ok((await Postings.countDocuments({ scheduleId: r.body._id })) >= 1);
  const list = await donor.get("/schedule/mine");
  assert.ok(list.body.some((s) => s._id === r.body._id));
  assert.strictEqual((await donor.post(`/schedule/${r.body._id}/delete`)).status, 204);
  assert.ok((await Postings.countDocuments({ scheduleId: r.body._id })) >= 1, "existing postings kept");
});
