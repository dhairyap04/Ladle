// Impact totals, CSV export and donation records.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { setup, teardown, pickupWindow, signUp } = require("./helpers");

let donor, bank, otherBank, first;
const donate = async (extra) => {
  const p = await donor.post("/posting/create").send({ fromRestaurantAddress: "1 Main", pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", ...pickupWindow(), ...extra });
  await bank.post(`/posting/${p.body._id}/claim`);
  await bank.post(`/posting/${p.body._id}/picked-up`);
  return p.body;
};

before(async () => {
  const ctx = await setup();
  donor = ctx.agent();
  bank = ctx.agent();
  otherBank = ctx.agent();
  await signUp(donor, { name: "Cafe", email: "cafe@x.com" });
  await signUp(bank, { name: "Bank", email: "bank@x.com", isFoodbank: true });
  await signUp(otherBank, { name: "Other", email: "o@x.com", isFoodbank: true });
  await bank.post("/user/update").send({ charitableTaxNum: "123456789RR0001" });
  first = await donate({ estimatedWeightKg: 10, foodTypes: ["bakery"], quantity: "=SUM(A1)" });
  await donate({ estimatedWeightKg: 5.5, foodTypes: ["bakery", "produce"] });
  await donate({ foodTypes: ["produce"] }); // no weight
  await donor.post("/posting/create").send({ fromRestaurantAddress: "1 Main", pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", ...pickupWindow(), estimatedWeightKg: 99 }); // never picked up
});
after(teardown);

test("totals count only picked-up donations, for both sides", async () => {
  for (const agent of [donor, bank]) {
    const r = await agent.get("/impact");
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.donations, 3);
    assert.strictEqual(r.body.totalKg, 15.5);
    assert.strictEqual(r.body.estimatedMeals, Math.round(15.5 / 0.544));
    assert.strictEqual(r.body.donationsWithoutWeight, 1);
    assert.deepStrictEqual(r.body.foodTypes, { bakery: 2, produce: 2 });
    assert.strictEqual(r.body.months.length, 12);
    assert.strictEqual(r.body.months[11].donations, 3);
    assert.strictEqual(r.body.partnerCount, 1);
  }
  assert.strictEqual((await donor.get("/impact")).body.topPartners[0].name, "Bank");
  assert.strictEqual((await otherBank.get("/impact")).body.donations, 0);
});

test("CSV export lists donations and neutralises formulas", async () => {
  const r = await donor.get("/impact/donations.csv");
  assert.strictEqual(r.status, 200);
  assert.match(r.headers["content-type"], /text\/csv/);
  const lines = r.text.split("\r\n");
  assert.strictEqual(lines.length, 4);
  assert.match(r.text, /123456789RR0001/);
  assert.match(r.text, /"'=SUM\(A1\)"/);
});

test("donation record: parties only, after pickup", async () => {
  const r = await donor.get(`/posting/${first._id}/receipt`);
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.receiptNumber, /^LD-[0-9A-F]{8}$/);
  assert.strictEqual(r.body.recipient.charitableTaxNum, "123456789RR0001");
  assert.strictEqual(r.body.food.estimatedWeightKg, 10);
  assert.strictEqual((await bank.get(`/posting/${first._id}/receipt`)).status, 200);
  assert.strictEqual((await otherBank.get(`/posting/${first._id}/receipt`)).status, 403);
  const open = await donor.post("/posting/create").send({ fromRestaurantAddress: "1 Main", pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", ...pickupWindow() });
  assert.strictEqual((await donor.get(`/posting/${open.body._id}/receipt`)).status, 409);
});
