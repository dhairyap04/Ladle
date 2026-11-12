// Forgot/reset password, change password, session sign-out and rate limits.
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const { setup, teardown, signUp } = require("./helpers");

let ctx, user, otherDevice, otherRefresh;
// A request carrying only a refresh token, as if the 15-minute access token had expired.
const refreshCookie = (res) => res.headers["set-cookie"].find((c) => c.startsWith("refreshToken=")).split(";")[0];
const sent = [];
const lastLink = () => {
  const mail = sent.filter((m) => /reset your password/.test(m.subject)).at(-1);
  return mail && /reset-password\?token=([a-f0-9]{64})/.exec(mail.text)[1];
};
const login = (agent, password) => agent.post("/user/login").send({ email: "cafe@x.com", password });

before(async () => {
  ctx = await setup();
  require("../notify").setTransport({ sendMail: async (m) => sent.push(m) });
  user = ctx.agent();
  otherDevice = ctx.agent();
  await signUp(user, { name: "Cafe", email: "cafe@x.com" });
  const r = await login(otherDevice, "password1");
  assert.strictEqual(r.status, 200);
  otherRefresh = refreshCookie(r);
  assert.strictEqual((await ctx.guest.get("/user/isAuth").set("Cookie", otherRefresh)).status, 200, "refresh alone works before");
});
beforeEach(() => require("../rateLimit").resetRateLimits());
after(teardown);

test("forgot password gives the same answer whether or not the account exists", async () => {
  const known = await ctx.guest.post("/user/password/forgot").send({ email: "CAFE@x.com" });
  const unknown = await ctx.guest.post("/user/password/forgot").send({ email: "nobody@x.com" });
  assert.strictEqual(known.status, 200);
  assert.deepStrictEqual(known.body, unknown.body);
  assert.strictEqual(sent.filter((m) => m.to === "nobody@x.com").length, 0);
  assert.ok(lastLink(), "reset email with a link was sent");
  const Resets = require("../models/PasswordResets");
  const stored = await Resets.findOne();
  assert.notStrictEqual(stored.tokenHash, lastLink(), "only a hash is stored");
});

test("a reset link works once, needs a valid password, and only the newest link works", async () => {
  await ctx.guest.post("/user/password/forgot").send({ email: "cafe@x.com" });
  const old = lastLink();
  await ctx.guest.post("/user/password/forgot").send({ email: "cafe@x.com" });
  const token = lastLink();
  assert.strictEqual((await ctx.guest.post("/user/password/reset").send({ token: old, password: "newpass99" })).status, 400, "older link revoked");
  assert.strictEqual((await ctx.guest.post("/user/password/reset").send({ token, password: "short" })).status, 400);
  assert.strictEqual((await ctx.guest.post("/user/password/reset").send({ token: "nope", password: "newpass99" })).status, 400);
  const ok = await ctx.guest.post("/user/password/reset").send({ token, password: "newpass99" });
  assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
  assert.strictEqual((await ctx.guest.post("/user/password/reset").send({ token, password: "another99" })).status, 400, "used once");
  assert.strictEqual((await login(ctx.agent(), "password1")).status, 401);
  assert.strictEqual((await login(ctx.agent(), "newpass99")).status, 200);
  assert.ok(sent.some((m) => /password was changed/.test(m.subject)));
});

test("expired links don't work", async () => {
  await ctx.guest.post("/user/password/forgot").send({ email: "cafe@x.com" });
  const token = lastLink();
  await require("../models/PasswordResets").updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
  assert.strictEqual((await ctx.guest.post("/user/password/reset").send({ token, password: "newpass77" })).status, 400);
});

test("a reset signs out other devices once their access token runs out", async () => {
  const res = await ctx.guest.get("/user/isAuth").set("Cookie", otherRefresh);
  assert.strictEqual(res.status, 401, "refresh token from before the reset is refused");
});

test("change password needs the current one and keeps this device signed in", async () => {
  const me = ctx.agent();
  assert.strictEqual((await login(me, "newpass99")).status, 200);
  const wrong = await me.post("/user/password/change").send({ currentPassword: "guess1234", newPassword: "changed123" });
  assert.strictEqual(wrong.status, 400);
  const before = refreshCookie(await login(ctx.agent(), "newpass99"));
  const ok = await me.post("/user/password/change").send({ currentPassword: "newpass99", newPassword: "changed123" });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual((await ctx.guest.get("/user/isAuth").set("Cookie", refreshCookie(ok))).status, 200, "this device gets a fresh session");
  assert.strictEqual((await ctx.guest.get("/user/isAuth").set("Cookie", before)).status, 401, "other sessions end");
  assert.strictEqual((await ctx.guest.post("/user/password/change").send({})).status, 401);
});

test("rate limits: logins per account, reset emails per address", async () => {
  const guesser = ctx.agent();
  for (let i = 0; i < 10; i += 1) await login(guesser, `wrong${i}xyz`);
  const blocked = await login(guesser, "changed123");
  assert.strictEqual(blocked.status, 429);
  assert.ok(blocked.headers["retry-after"]);
  require("../rateLimit").resetRateLimits();
  for (let i = 0; i < 3; i += 1) await ctx.guest.post("/user/password/forgot").send({ email: "cafe@x.com" });
  assert.strictEqual((await ctx.guest.post("/user/password/forgot").send({ email: "cafe@x.com" })).status, 429);
});
