// Core API behaviour: accounts, postings, permissions and the posting lifecycle.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { setup, teardown, pickupWindow: WINDOW } = require("./helpers");

let app, agent, guest, Users, Postings, legacyPost;
let donor, donor2, bank, bank2;

before(async () => {
  ({ app, agent, guest } = await setup({
    // Simulate legacy data: an old non-sparse unique index, a plaintext password
    // and a posting without a status. migrate() must cope with all of them.
    beforeMigrate: async () => {
      Users = require("../models/Users");
      Postings = require("../models/Postings");
      await Users.collection.createIndex({ charitableTaxNum: 1 }, { unique: true });
      await Users.collection.insertOne({ name: "Legacy Bank", email: "legacy@x.com", password: "plainpass1", isFoodbank: true });
      legacyPost = await Postings.collection.insertOne({ fromRestaurantName: "Old", fromRestaurantAddress: "1 St", pickupTimeBegin: 900, pickupTimeEnd: 1000, notes: "" });
    },
  }));
  donor = agent();
  donor2 = agent();
  bank = agent();
  bank2 = agent();
});

after(teardown);

test("restaurant (isFoodbank:false) can register", async () => {
  const r = await donor.post("/user/create").send({ name: "Cafe", email: "cafe@x.com", password: "password1", isFoodbank: false });
  assert.strictEqual(r.status, 201, JSON.stringify(r.body));
  assert.ok(!("password" in r.body.user));
  const cookie = r.headers["set-cookie"].find((c) => c.startsWith("refreshToken"));
  const maxAge = Number(/Max-Age=(\d+)/.exec(cookie)[1]);
  assert.ok(maxAge > 100 * 24 * 3600, `refresh max-age ${maxAge}s`);
});
test("second restaurant without tax number can register", async () => {
  const r = await donor2.post("/user/create").send({ name: "Diner", email: "diner@x.com", password: "password1", isFoodbank: false });
  assert.strictEqual(r.status, 201, JSON.stringify(r.body));
});
test("food bank can register", async () => {
  const r = await bank.post("/user/create").send({ name: "Bank", email: "bank@x.com", password: "password1", isFoodbank: true });
  assert.strictEqual(r.status, 201);
});
test("duplicate email -> 409", async () => {
  const r = await guest.post("/user/create").send({ name: "X", email: "cafe@x.com", password: "password1", isFoodbank: false });
  assert.strictEqual(r.status, 409);
});
test("password stored as bcrypt hash", async () => {
  const u = await Users.findOne({ email: "cafe@x.com" }).select("+password");
  assert.ok(/^\$2[aby]\$/.test(u.password));
});
test("legacy plaintext login works and gets rehashed", async () => {
  const r = await bank2.post("/user/login").send({ email: "legacy@x.com", password: "plainpass1" });
  assert.strictEqual(r.status, 200);
  const u = await Users.findOne({ email: "legacy@x.com" }).select("+password");
  assert.ok(/^\$2[aby]\$/.test(u.password));
  const again = await guest.post("/user/login").send({ email: "legacy@x.com", password: "plainpass1" });
  assert.strictEqual(again.status, 200);
});
test("wrong password -> 401 generic message", async () => {
  const r = await guest.post("/user/login").send({ email: "cafe@x.com", password: "nope12345" });
  assert.strictEqual(r.status, 401);
  const r2 = await guest.post("/user/login").send({ email: "nobody@x.com", password: "nope12345" });
  assert.strictEqual(r2.body.msg, r.body.msg);
});
test("/user/info hides password", async () => {
  const r = await donor.get("/user/info");
  assert.strictEqual(r.status, 200);
  assert.ok(!JSON.stringify(r.body).includes("$2"));
});
test("profile update is partial and ignores protected fields", async () => {
  const r = await donor.post("/user/update").send({ website: "cafe.ca", isFoodbank: true, password: "hacked", email: "evil@x.com" });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const u = await Users.findOne({ email: "cafe@x.com" }).select("+password");
  assert.strictEqual(u.name, "Cafe");
  assert.strictEqual(u.website, "cafe.ca");
  assert.strictEqual(u.isFoodbank, false);
  assert.ok(/^\$2/.test(u.password));
});

let postId;
test("guest cannot create posting", async () => {
  const r = await guest.post("/posting/create").send({ fromRestaurantAddress: "a", pickupTimeBegin: "10:00", pickupTimeEnd: "11:00", ...WINDOW() });
  assert.strictEqual(r.status, 401);
});
test("food bank cannot create posting", async () => {
  const r = await bank.post("/posting/create").send({ fromRestaurantAddress: "a", pickupTimeBegin: "10:00", pickupTimeEnd: "11:00", ...WINDOW() });
  assert.strictEqual(r.status, 403);
});
test("restaurant creates posting with HH:MM times", async () => {
  const r = await donor.post("/posting/create").send({ fromRestaurantAddress: "11023 23 Ave NW, Edmonton", pickupTimeBegin: "20:00", pickupTimeEnd: "23:30", notes: "burgers", ...WINDOW() });
  assert.strictEqual(r.status, 201, JSON.stringify(r.body));
  assert.strictEqual(r.body.pickupTimeBegin, 2000);
  assert.strictEqual(r.body.status, "open");
  postId = r.body._id;
});
test("bad times rejected with message", async () => {
  const r = await donor.post("/posting/create").send({ fromRestaurantAddress: "a", pickupTimeBegin: "11:00", pickupTimeEnd: "10:00", ...WINDOW() });
  assert.strictEqual(r.status, 400);
  const r2 = await donor.post("/posting/create").send({ fromRestaurantAddress: "a", pickupTimeBegin: "25:00", pickupTimeEnd: "26:00", ...WINDOW() });
  assert.strictEqual(r2.status, 400);
});
test("list shows new and legacy (status-less) postings", async () => {
  const r = await guest.get("/posting/all");
  const ids = r.body.map((p) => p._id);
  assert.ok(ids.includes(postId) && ids.includes(String(legacyPost.insertedId)), JSON.stringify(ids));
});
test("malformed id -> 404, not a hang", async () => {
  const r = await guest.get("/posting/one/not-an-id");
  assert.strictEqual(r.status, 404);
});
test("old unauthenticated delete route is gone", async () => {
  const r = await guest.post("/posting/delete").send({ id: postId });
  assert.strictEqual(r.status, 404);
  assert.ok(await Postings.exists({ _id: postId }));
});
test("restaurant cannot claim", async () => {
  const r = await donor.post(`/posting/${postId}/claim`);
  assert.strictEqual(r.status, 403);
});
test("other restaurant cannot withdraw", async () => {
  const r = await donor2.post(`/posting/${postId}/cancel`);
  assert.strictEqual(r.status, 403);
});
test("food bank claims; record kept; second claim -> 409", async () => {
  const r = await bank.post(`/posting/${postId}/claim`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.status, "claimed");
  assert.strictEqual(r.body.claimedByName, "Bank");
  const r2 = await bank2.post(`/posting/${postId}/claim`);
  assert.strictEqual(r2.status, 409);
  const list = await guest.get("/posting/all");
  assert.ok(!list.body.some((p) => p._id === postId));
});
test("owner withdraws an open posting", async () => {
  const c = await donor.post("/posting/create").send({ fromRestaurantAddress: "x", pickupTimeBegin: "0900", pickupTimeEnd: 1000, ...WINDOW() });
  assert.strictEqual(c.status, 201, JSON.stringify(c.body));
  const r = await donor.post(`/posting/${c.body._id}/cancel`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.status, "cancelled");
});
test("missing or past pickup window rejected", async () => {
  const base = { fromRestaurantAddress: "a", pickupTimeBegin: "10:00", pickupTimeEnd: "11:00" };
  const r = await donor.post("/posting/create").send(base);
  assert.strictEqual(r.status, 400);
  const r2 = await donor.post("/posting/create").send({ ...base, pickupDate: "2020-01-01", pickupEndsAt: "2020-01-01T11:00:00Z" });
  assert.strictEqual(r2.status, 400);
  assert.match(r2.body.msg, /already ended/);
});
test("stale open posting expires and can't be claimed", async () => {
  const c = await donor.post("/posting/create").send({ fromRestaurantAddress: "e", pickupTimeBegin: "10:00", pickupTimeEnd: "11:00", ...WINDOW() });
  await Postings.updateOne({ _id: c.body._id }, { pickupEndsAt: new Date(Date.now() - 1000) });
  const list = await guest.get("/posting/all");
  assert.ok(!list.body.some((p) => p._id === c.body._id));
  const one = await guest.get(`/posting/one/${c.body._id}`);
  assert.strictEqual(one.body.status, "expired");
  const claim = await bank.post(`/posting/${c.body._id}/claim`);
  assert.strictEqual(claim.status, 409);
});
test("only the claiming food bank can mark picked up", async () => {
  const r0 = await bank2.post(`/posting/${postId}/picked-up`);
  assert.strictEqual(r0.status, 403);
  const r = await bank.post(`/posting/${postId}/picked-up`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.status, "picked_up");
  assert.ok(r.body.pickedUpAt);
  const again = await bank.post(`/posting/${postId}/picked-up`);
  assert.strictEqual(again.status, 409);
});
test("/posting/mine: donor sees own, food bank sees claimed", async () => {
  const d = await donor.get("/posting/mine");
  assert.ok(d.body.length >= 3 && d.body.every((p) => p.fromRestaurantName === "Cafe"));
  const b = await bank.get("/posting/mine");
  assert.deepStrictEqual(b.body.map((p) => p._id), [postId]);
  const g = await guest.get("/posting/mine");
  assert.strictEqual(g.status, 401);
});
test("owner edits an open posting; others and closed postings can't", async () => {
  const c = await donor.post("/posting/create").send({ fromRestaurantAddress: "old addr", pickupTimeBegin: "10:00", pickupTimeEnd: "11:00", ...WINDOW() });
  const edit = { fromRestaurantAddress: "new addr", pickupTimeBegin: "12:00", pickupTimeEnd: "13:30", notes: "soup", ...WINDOW() };
  const other = await donor2.post(`/posting/${c.body._id}/edit`).send(edit);
  assert.strictEqual(other.status, 403);
  const bankTry = await bank.post(`/posting/${c.body._id}/edit`).send(edit);
  assert.strictEqual(bankTry.status, 403);
  const bad = await donor.post(`/posting/${c.body._id}/edit`).send({ ...edit, pickupTimeEnd: "11:00" });
  assert.strictEqual(bad.status, 400);
  const r = await donor.post(`/posting/${c.body._id}/edit`).send({ ...edit, status: "picked_up", donorId: "000000000000000000000000" });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(r.body.fromRestaurantAddress, "new addr");
  assert.strictEqual(r.body.pickupTimeEnd, 1330);
  assert.strictEqual(r.body.status, "open");
  assert.strictEqual(r.body.fromRestaurantName, "Cafe");
  const closed = await donor.post(`/posting/${postId}/edit`).send(edit);
  assert.strictEqual(closed.status, 409);
});
test("CORS only reflects allowed origin", async () => {
  const ok = await guest.get("/posting/all").set("Origin", "http://localhost:3000");
  assert.strictEqual(ok.headers["access-control-allow-origin"], "http://localhost:3000");
  const bad = await guest.get("/posting/all").set("Origin", "https://evil.example");
  assert.ok(!bad.headers["access-control-allow-origin"]);
});
test("logout clears cookies", async () => {
  const r = await donor.post("/user/logout");
  assert.strictEqual(r.status, 200);
  const after = await donor.get("/user/isAuth");
  assert.strictEqual(after.status, 401);
});

