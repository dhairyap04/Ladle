// Per-posting message threads.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { setup, teardown, pickupWindow, signUp } = require("./helpers");

let ctx, donor, otherDonor, bankA, bankB, postingId, bankAId, bankBId;

before(async () => {
  ctx = await setup();
  donor = ctx.agent();
  otherDonor = ctx.agent();
  bankA = ctx.agent();
  bankB = ctx.agent();
  await signUp(donor, { name: "Cafe", email: "cafe@x.com" });
  await signUp(otherDonor, { name: "Diner", email: "diner@x.com" });
  bankAId = (await signUp(bankA, { name: "Bank A", email: "a@x.com", isFoodbank: true })).id;
  bankBId = (await signUp(bankB, { name: "Bank B", email: "b@x.com", isFoodbank: true })).id;
  await donor.post("/user/update").send({ phoneNumber: "780-555-0100" });
  await bankA.post("/user/update").send({ phoneNumber: "780-555-0199" });
  const p = await donor.post("/posting/create").send({ fromRestaurantAddress: "1 Main", pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", ...pickupWindow() });
  postingId = p.body._id;
});
after(teardown);

const threads = async (agent) => (await agent.get(`/posting/${postingId}/messages`)).body;

test("food banks ask questions in private threads before claiming", async () => {
  assert.strictEqual((await bankA.post(`/posting/${postingId}/messages`).send({ body: "Is it vegetarian?" })).status, 201);
  await bankB.post(`/posting/${postingId}/messages`).send({ body: "Any dairy?" });
  const a = await threads(bankA);
  assert.strictEqual(a.threads.length, 1);
  assert.deepStrictEqual(a.threads[0].messages.map((m) => m.body), ["Is it vegetarian?"]);
  assert.strictEqual(a.contact, null, "no phone numbers before a claim");
  const d = await threads(donor);
  assert.strictEqual(d.threads.length, 2);
});

test("the restaurant replies in a thread and the food bank is notified", async () => {
  const r = await donor.post(`/posting/${postingId}/messages`).send({ body: "Yes, all veg.", foodBankId: bankAId });
  assert.strictEqual(r.status, 201);
  const a = await threads(bankA);
  assert.deepStrictEqual(a.threads[0].messages.map((m) => m.senderName), ["Bank A", "Cafe"]);
  const box = (await bankA.get("/notification")).body;
  assert.ok(box.items.some((n) => n.type === "new_message" && /Cafe/.test(n.title)));
});

test("rules: no empty or huge messages, no strangers, no new threads by the restaurant", async () => {
  assert.strictEqual((await bankA.post(`/posting/${postingId}/messages`).send({ body: "  " })).status, 400);
  assert.strictEqual((await bankA.post(`/posting/${postingId}/messages`).send({ body: "x".repeat(1001) })).status, 400);
  assert.strictEqual((await otherDonor.get(`/posting/${postingId}/messages`)).status, 403);
  const stranger = await signUp(ctx.agent(), { name: "C", email: "c@x.com", isFoodbank: true });
  assert.strictEqual((await donor.post(`/posting/${postingId}/messages`).send({ body: "hi", foodBankId: stranger.id })).status, 400);
});

test("after a claim, other food banks are shut out and phone numbers are shared", async () => {
  await bankA.post(`/posting/${postingId}/claim`);
  assert.strictEqual((await bankB.get(`/posting/${postingId}/messages`)).status, 403);
  assert.strictEqual((await bankB.post(`/posting/${postingId}/messages`).send({ body: "still there?" })).status, 403);
  const a = await threads(bankA);
  assert.deepStrictEqual(a.contact, { name: "Cafe", phoneNumber: "780-555-0100" });
  const d = await threads(donor);
  assert.strictEqual(d.threads[0].foodBankId, bankAId, "claimer's thread first");
  assert.strictEqual(d.threads[0].isClaimer, true);
  assert.deepStrictEqual(d.contact, { name: "Bank A", phoneNumber: "780-555-0199" });
  assert.ok(d.threads.some((t) => t.foodBankId === bankBId));
});
