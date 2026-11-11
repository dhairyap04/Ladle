// Releases, no-shows, disputes, confirmations, ratings and reliability summaries.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { setup, teardown, pickupWindow, signUp } = require("./helpers");

let ctx, donor, bank, otherBank, admin, Postings, bankId, donorId;
const create = (extra = {}) =>
  donor.post("/posting/create").send({ fromRestaurantAddress: "1 Main", pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", ...pickupWindow(), ...extra });
const claimed = async () => {
  const p = await create();
  await bank.post(`/posting/${p.body._id}/claim`);
  return p.body._id;
};
const endWindow = (id, hoursAgo = 1) => Postings.updateOne({ _id: id }, { pickupEndsAt: new Date(Date.now() - hoursAgo * 3600e3) });
const rel = async (id) => (await donor.get(`/user/${id}/reliability`)).body;

before(async () => {
  ctx = await setup({ env: { ADMIN_EMAILS: "admin@x.com" } });
  donor = ctx.agent();
  bank = ctx.agent();
  otherBank = ctx.agent();
  admin = ctx.agent();
  donorId = (await signUp(donor, { name: "Cafe", email: "cafe@x.com" })).id;
  bankId = (await signUp(bank, { name: "Bank", email: "bank@x.com", isFoodbank: true })).id;
  await signUp(otherBank, { name: "Other", email: "other@x.com", isFoodbank: true });
  await signUp(admin, { name: "Admin", email: "admin@x.com" });
  Postings = require("../models/Postings");
});
after(teardown);

test("a new account shows as New, with no rate", async () => {
  const r = await rel(bankId);
  assert.strictEqual(r.pickupRate, null);
  assert.strictEqual(r.completed, 0);
  assert.strictEqual(r.name, "Bank");
  assert.strictEqual((await ctx.guest.get(`/user/${bankId}/reliability`)).status, 401);
});

test("releasing early reopens the posting and is neutral; late releases count", async () => {
  const early = await create({ pickupDate: "2099-01-01", pickupEndsAt: new Date(Date.now() + 30 * 3600e3).toISOString() });
  await bank.post(`/posting/${early.body._id}/claim`);
  const id = early.body._id;
  assert.strictEqual((await otherBank.post(`/posting/${id}/release`)).status, 403);
  const r = await bank.post(`/posting/${id}/release`);
  assert.strictEqual(r.body.status, "open");
  assert.ok(!r.body.claimedBy);
  assert.ok((await donor.get("/notification")).body.items.some((n) => /can't pick up/.test(n.title)));
  // A window starting in 30 minutes: releasing now is late.
  const soon = await create({ pickupDate: "2099-01-01", pickupEndsAt: new Date(Date.now() + 2.5 * 3600e3).toISOString() });
  await bank.post(`/posting/${soon.body._id}/claim`);
  await bank.post(`/posting/${soon.body._id}/release`);
  const s = await rel(bankId);
  assert.strictEqual(s.releases, 1);
  assert.strictEqual(s.lateReleases, 1);
});

test("no-show only after the window, by the restaurant; the food bank can dispute it", async () => {
  const id = await claimed();
  assert.strictEqual((await donor.post(`/posting/${id}/no-show`)).status, 409, "window still open");
  await endWindow(id);
  assert.strictEqual((await bank.post(`/posting/${id}/no-show`)).status, 403);
  const r = await donor.post(`/posting/${id}/no-show`);
  assert.strictEqual(r.body.status, "no_show");
  assert.strictEqual((await rel(bankId)).noShows, 1);
  assert.ok((await bank.get("/notification")).body.items.some((n) => n.type === "reliability"));
  const dispute = await bank.post(`/posting/${id}/picked-up`);
  assert.strictEqual(dispute.body.status, "picked_up");
  const s = await rel(bankId);
  assert.strictEqual(s.noShows, 0);
  assert.strictEqual(s.completed, 1);
});

test("disputes close after 48 hours", async () => {
  const id = await claimed();
  await endWindow(id, 50);
  await donor.post(`/posting/${id}/no-show`);
  assert.strictEqual((await bank.post(`/posting/${id}/picked-up`)).status, 409);
});

test("the restaurant can confirm a pickup; stale claims become unconfirmed", async () => {
  const id = await claimed();
  const r = await donor.post(`/posting/${id}/confirm-pickup`);
  assert.strictEqual(r.body.status, "picked_up");
  const stale = await claimed();
  await endWindow(stale, 73);
  await donor.get("/posting/all");
  assert.strictEqual((await Postings.findById(stale)).status, "unconfirmed");
});

test("pickup rate needs 3 commitments; late releases weigh half", async () => {
  const s = await rel(bankId);
  // completed 2 (dispute + confirm), no-shows 1 (the 48h one), late releases 1 -> 2 / (2 + 1 + 0.5)
  assert.strictEqual(s.completed, 2);
  assert.strictEqual(s.noShows, 1);
  assert.strictEqual(s.pickupRate, Math.round((2 / 3.5) * 100) / 100);
  assert.strictEqual(s.flagged, true, "below 70%");
});

test("ratings: only people on a completed pickup, 1-5, one each (editable)", async () => {
  const id = await claimed();
  assert.strictEqual((await donor.post(`/posting/${id}/ratings`).send({ toUserId: bankId, stars: 5 })).status, 409, "not picked up yet");
  await bank.post(`/posting/${id}/picked-up`);
  const list = await donor.get(`/posting/${id}/ratings`);
  assert.strictEqual(list.body.canRate, true);
  assert.deepStrictEqual(list.body.parties.map((p) => p.name), ["Bank"]);
  assert.strictEqual((await donor.post(`/posting/${id}/ratings`).send({ toUserId: bankId, stars: 9 })).status, 400);
  assert.strictEqual((await donor.post(`/posting/${id}/ratings`).send({ toUserId: donorId, stars: 5 })).status, 400, "can't rate yourself");
  assert.strictEqual((await otherBank.post(`/posting/${id}/ratings`).send({ toUserId: bankId, stars: 1 })).status, 403);
  await donor.post(`/posting/${id}/ratings`).send({ toUserId: bankId, stars: 3 });
  await donor.post(`/posting/${id}/ratings`).send({ toUserId: bankId, stars: 5, comment: "Friendly and on time" });
  await bank.post(`/posting/${id}/ratings`).send({ toUserId: donorId, stars: 4 });
  const s = await rel(bankId);
  assert.strictEqual(s.rating, 5);
  assert.strictEqual(s.ratingCount, 1);
  assert.strictEqual(s.recentComments[0].comment, "Friendly and on time");
  assert.strictEqual((await rel(donorId)).rating, 4);
});

test("restaurants see each food bank's reliability on message threads; admins see flags", async () => {
  const p = await create();
  await bank.post(`/posting/${p.body._id}/messages`).send({ body: "Still available?" });
  const threads = (await donor.get(`/posting/${p.body._id}/messages`)).body.threads;
  assert.strictEqual(threads[0].reliability.completed, 3);
  assert.strictEqual((await bank.get(`/posting/${p.body._id}/messages`)).body.threads[0].reliability, undefined);
  const flagged = await admin.get("/admin/users").query({ flagged: "1" });
  assert.deepStrictEqual(flagged.body.map((u) => u.name), ["Bank"]);
  assert.strictEqual((await admin.get("/admin/overview")).body.flagged, 1);
  assert.ok((await bank.get("/user/info")).body.reliability);
});
