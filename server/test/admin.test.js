// Food bank verification and the admin console.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { setup, teardown, pickupWindow, signUp } = require("./helpers");

let admin, bank, donor, bankId;

before(async () => {
  const ctx = await setup({ env: { ADMIN_EMAILS: "Boss@MealDrop.test" } });
  admin = ctx.agent();
  bank = ctx.agent();
  donor = ctx.agent();
  await signUp(admin, { name: "Admin", email: "boss@mealdrop.test" });
  bankId = (await signUp(bank, { name: "Bank", email: "bank@x.com", isFoodbank: true })).id;
  await signUp(donor, { name: "Cafe", email: "cafe@x.com" });
});
after(teardown);

test("admin is granted from ADMIN_EMAILS; others are refused", async () => {
  assert.strictEqual((await admin.get("/user/info")).body.user.isAdmin, true);
  assert.strictEqual((await admin.get("/admin/overview")).status, 200);
  assert.strictEqual((await bank.get("/admin/overview")).status, 403);
  assert.strictEqual((await donor.get("/admin/users")).status, 403);
});

test("charitable number format is checked and normalised", async () => {
  assert.strictEqual((await bank.post("/user/update").send({ charitableTaxNum: "12345" })).status, 400);
  const r = await bank.post("/user/update").send({ charitableTaxNum: "123456789 rr 0001" });
  assert.strictEqual(r.body.user.charitableTaxNum, "123456789RR0001");
});

test("requesting verification needs a number and address, then notifies admins", async () => {
  const noAddress = await bank.post("/user/verification/request");
  assert.strictEqual(noAddress.status, 400);
  await bank.post("/user/update").send({ address: "1 Bank St" });
  const r = await bank.post("/user/verification/request");
  assert.strictEqual(r.body.user.verificationStatus, "pending");
  assert.strictEqual((await donor.post("/user/verification/request")).status, 403);
  const box = (await admin.get("/notification")).body;
  assert.ok(box.items.some((n) => n.type === "verification" && n.link === "/admin"));
  const queue = await admin.get("/admin/users").query({ verification: "pending" });
  assert.deepStrictEqual(queue.body.map((u) => u.id), [bankId]);
});

test("rejecting needs a reason; approving notifies and badges claims", async () => {
  assert.strictEqual((await admin.post(`/admin/users/${bankId}/verification`).send({ decision: "rejected" })).status, 400);
  const rej = await admin.post(`/admin/users/${bankId}/verification`).send({ decision: "rejected", note: "Number doesn't match the CRA listing." });
  assert.strictEqual(rej.body.verificationStatus, "rejected");
  assert.strictEqual((await bank.get("/user/info")).body.user.verificationNote, "Number doesn't match the CRA listing.");

  await bank.post("/user/verification/request");
  const ok = await admin.post(`/admin/users/${bankId}/verification`).send({ decision: "verified" });
  assert.strictEqual(ok.body.verificationStatus, "verified");
  const box = (await bank.get("/notification")).body;
  assert.match(box.items[0].title, /verified/);

  const p = await donor.post("/posting/create").send({ fromRestaurantAddress: "1 Main", pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", ...pickupWindow() });
  const claim = await bank.post(`/posting/${p.body._id}/claim`);
  assert.strictEqual(claim.body.claimedByVerified, true);
});

test("changing the charitable number resets verification", async () => {
  const r = await bank.post("/user/update").send({ charitableTaxNum: "987654321RR0001" });
  assert.strictEqual(r.body.user.verificationStatus, "unverified");
  const same = await bank.post("/user/update").send({ address: "2 Bank St" });
  assert.strictEqual(same.body.user.verificationStatus, "unverified");
});

test("overview and search", async () => {
  const o = await admin.get("/admin/overview");
  assert.strictEqual(o.body.foodBanks, 1);
  assert.strictEqual(o.body.restaurants, 2);
  assert.strictEqual(o.body.postings.claimed, 1);
  const s = await admin.get("/admin/users").query({ q: "cafe" });
  assert.deepStrictEqual(s.body.map((u) => u.name), ["Cafe"]);
});
