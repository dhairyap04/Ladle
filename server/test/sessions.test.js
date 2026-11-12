// Staying signed in on phones and shared tablets.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { setup, teardown, signUp } = require("./helpers");

let ctx, userId;
const cookie = (res, name) => (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${name}=`));
const value = (c) => c.split(";")[0];
const login = (body) => request(ctx.app).post("/user/login").send({ email: "cafe@x.com", password: "password1", ...body });
const withRefresh = (token) => request(ctx.app).get("/user/info").set("Cookie", `refreshToken=${token}`);
const refreshToken = (payload, ageSeconds) =>
  jwt.sign(
    { id: userId, email: "cafe@x.com", name: "Cafe", isFoodbank: false, role: "restaurant", isAdmin: false, sv: 0, ...payload, iat: Math.floor(Date.now() / 1000) - ageSeconds },
    "test-refresh",
    { expiresIn: 200 * 86400 }
  );

before(async () => {
  ctx = await setup();
  userId = (await signUp(ctx.agent(), { name: "Cafe", email: "cafe@x.com" })).id;
});
after(teardown);

test("signing in remembers the device by default", async () => {
  const res = await login({});
  assert.strictEqual(res.status, 200);
  assert.match(cookie(res, "refreshToken"), /Max-Age=\d+/);
});

test("without 'keep me signed in' the session ends when the browser closes", async () => {
  const res = await login({ remember: false });
  const c = cookie(res, "refreshToken");
  assert.ok(c);
  assert.doesNotMatch(c, /Max-Age|Expires/i);
  // The choice survives a refresh: the re-issued access token still says so.
  const info = await request(ctx.app).get("/user/isAuth").set("Cookie", value(c));
  assert.strictEqual(info.status, 200);
  assert.strictEqual(info.body.rm, false);
});

test("a remembered device in use gets a fresh refresh token, so it isn't signed out", async () => {
  const old = await withRefresh(refreshToken({ rm: true }, 2 * 86400));
  assert.strictEqual(old.status, 200);
  const rolled = cookie(old, "refreshToken");
  assert.ok(rolled, "older than a day: rolled");
  assert.match(rolled, /Max-Age=\d+/);
  const iat = jwt.decode(value(rolled).split("=")[1]).iat;
  assert.ok(Date.now() / 1000 - iat < 60);

  const fresh = await withRefresh(refreshToken({ rm: true }, 60));
  assert.strictEqual(fresh.status, 200);
  assert.strictEqual(cookie(fresh, "refreshToken"), undefined, "recent: left alone");

  const notRemembered = await withRefresh(refreshToken({ rm: false }, 2 * 86400));
  assert.strictEqual(notRemembered.status, 200);
  assert.strictEqual(cookie(notRemembered, "refreshToken"), undefined, "session-only sign-ins aren't extended");
});

test("signing out other devices keeps this one signed in", async () => {
  const here = ctx.agent();
  await here.post("/user/login").send({ email: "cafe@x.com", password: "password1" });
  const phone = await login({});
  const phoneRefresh = value(cookie(phone, "refreshToken")).split("=")[1];

  const r = await here.post("/user/logout-others");
  assert.strictEqual(r.status, 200);
  assert.strictEqual((await here.get("/user/info")).status, 200, "this device still works");
  assert.strictEqual((await withRefresh(phoneRefresh)).status, 401, "the other device is signed out");
});
