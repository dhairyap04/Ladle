// Data export and account deletion.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { setup, teardown, pickupWindow, signUp } = require("./helpers");

let ctx, donor, bank, donorId, bankId, Users, Postings, Messages;
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const create = (extra = {}) =>
  donor.post("/posting/create").send({ fromRestaurantAddress: "1 Main", pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", ...pickupWindow(), ...extra });

before(async () => {
  ctx = await setup();
  donor = ctx.agent();
  bank = ctx.agent();
  donorId = (await signUp(donor, { name: "Cafe", email: "cafe@x.com" })).id;
  bankId = (await signUp(bank, { name: "Bank", email: "bank@x.com", isFoodbank: true })).id;
  ({ Users, Postings, Messages } = { Users: require("../models/Users"), Postings: require("../models/Postings"), Messages: require("../models/Messages") });
});
after(teardown);

test("export includes the account and its activity, without the password", async () => {
  const p = await create();
  await bank.post(`/posting/${p.body._id}/messages`).send({ body: "Hi" });
  const r = await bank.get("/user/export");
  assert.strictEqual(r.status, 200);
  assert.match(r.headers["content-disposition"], /ladle-my-data\.json/);
  assert.strictEqual(r.body.account.email, "bank@x.com");
  assert.strictEqual(r.body.messagesYouSent[0].body, "Hi");
  assert.ok(!JSON.stringify(r.body).includes("$2"), "no password hash");
  assert.strictEqual((await ctx.guest.get("/user/export")).status, 401);
});

test("deletion needs the password and is blocked while someone is waiting", async () => {
  const p = await create();
  await bank.post(`/posting/${p.body._id}/claim`);
  assert.strictEqual((await donor.post("/user/delete").send({ password: "nope12345" })).status, 400);
  assert.strictEqual((await donor.post("/user/delete").send({ password: "password1" })).status, 409, "a claimed pickup is in progress");
  assert.strictEqual((await bank.post("/user/delete").send({ password: "password1" })).status, 409, "the food bank has an open claim");
  await bank.post(`/posting/${p.body._id}/picked-up`);
  await donor.post(`/posting/${p.body._id}/ratings`).send({ toUserId: bankId, stars: 5 });
});

test("deleting removes personal data and keeps the other side's records anonymised", async () => {
  const open = await create({ photo: PNG, notes: "Back door" });
  const r = await donor.post("/user/delete").send({ password: "password1" });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(await Users.countDocuments({ _id: donorId }), 0);
  assert.strictEqual((await donor.get("/user/isAuth")).status, 401, "signed out");
  assert.strictEqual((await ctx.agent().post("/user/login").send({ email: "cafe@x.com", password: "password1" })).status, 401);

  const withdrawn = await Postings.findById(open.body._id);
  assert.strictEqual(withdrawn.status, "cancelled");
  assert.strictEqual(withdrawn.hasPhoto, false);
  assert.strictEqual(withdrawn.fromRestaurantName, "Former Ladle member");
  assert.strictEqual((await ctx.guest.get(`/posting/${open.body._id}/photo`)).status, 404);

  // The food bank still has its completed pickup, with the name replaced.
  const impact = (await bank.get("/impact")).body;
  assert.strictEqual(impact.donations, 1);
  assert.strictEqual(impact.topPartners[0].name, "Former Ladle member");
  assert.strictEqual((await bank.get(`/user/${bankId}/reliability`)).body.ratingCount, 0, "ratings from the deleted account are gone");
  assert.strictEqual(await Messages.countDocuments({ senderId: donorId, body: { $ne: "(message deleted)" } }), 0);
});
