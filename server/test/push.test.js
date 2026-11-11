// Web push subscriptions and delivery.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { setup, teardown, pickupWindow, signUp } = require("./helpers");

let ctx, donor, bank;
const pushed = [];
const sub = (n) => ({ endpoint: `https://push.example.com/send/${n}`, keys: { p256dh: "BPkey", auth: "authkey" } });

before(async () => {
  ctx = await setup();
  require("../push").setSender(async (subscription, payload) => {
    if (subscription.endpoint.endsWith("/gone")) {
      const err = new Error("gone");
      err.statusCode = 410;
      throw err;
    }
    pushed.push({ endpoint: subscription.endpoint, ...JSON.parse(payload) });
  });
  donor = ctx.agent();
  bank = ctx.agent();
  await signUp(donor, { name: "Cafe", email: "cafe@x.com" });
  await signUp(bank, { name: "Bank", email: "bank@x.com", isFoodbank: true });
});
after(teardown);

test("devices subscribe; bad subscriptions and guests are refused", async () => {
  assert.strictEqual((await ctx.guest.post("/push/subscribe").send({ subscription: sub(1) })).status, 401);
  assert.strictEqual((await donor.post("/push/subscribe").send({ subscription: { endpoint: "http://insecure" } })).status, 400);
  assert.strictEqual((await donor.post("/push/subscribe").send({ subscription: sub("phone") })).status, 201);
  assert.strictEqual((await donor.post("/push/subscribe").send({ subscription: sub("gone") })).status, 201);
  assert.strictEqual((await ctx.guest.get("/push/key")).body.enabled, true);
});

test("notifications are pushed to the user's devices; dead ones are removed", async () => {
  const p = await donor.post("/posting/create").send({ fromRestaurantAddress: "1 Main", pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", ...pickupWindow() });
  await bank.post(`/posting/${p.body._id}/claim`);
  const mine = pushed.filter((x) => x.endpoint.endsWith("/phone"));
  assert.strictEqual(mine.length, 1);
  assert.match(mine[0].title, /Bank claimed/);
  assert.match(mine[0].link, /^\/view_post\//);
  assert.strictEqual(await require("../models/PushSubscriptions").countDocuments({ endpoint: /gone$/ }), 0);
});

test("unsubscribe stops pushes to that device", async () => {
  await donor.post("/push/unsubscribe").send({ endpoint: sub("phone").endpoint });
  const before = pushed.length;
  const p = await donor.post("/posting/create").send({ fromRestaurantAddress: "1 Main", pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", ...pickupWindow() });
  await bank.post(`/posting/${p.body._id}/claim`);
  assert.strictEqual(pushed.filter((x) => x.endpoint.endsWith("/phone")).length, before ? 1 : 0);
});
