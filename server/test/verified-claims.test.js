// REQUIRE_VERIFIED_TO_CLAIM=true: only verified food banks can claim.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { setup, teardown, pickupWindow, signUp } = require("./helpers");

let bank, donor, Users;
before(async () => {
  const ctx = await setup({ env: { REQUIRE_VERIFIED_TO_CLAIM: "true" } });
  bank = ctx.agent();
  donor = ctx.agent();
  await signUp(bank, { name: "Bank", email: "bank@x.com", isFoodbank: true });
  await signUp(donor, { name: "Cafe", email: "cafe@x.com" });
  Users = require("../models/Users");
});
after(teardown);

test("unverified food banks can't claim; verified ones can", async () => {
  const p = await donor.post("/posting/create").send({ fromRestaurantAddress: "1 Main", pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", ...pickupWindow() });
  const refused = await bank.post(`/posting/${p.body._id}/claim`);
  assert.strictEqual(refused.status, 403);
  assert.match(refused.body.msg, /verified/);
  await Users.updateOne({ email: "bank@x.com" }, { verificationStatus: "verified" });
  assert.strictEqual((await bank.post(`/posting/${p.body._id}/claim`)).status, 200);
});
