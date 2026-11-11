// In-app and email notifications.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { setup, teardown, pickupWindow, signUp } = require("./helpers");

const PLACES = { "near": { lat: 53.54, lng: -113.49 }, "far": { lat: 51.05, lng: -114.07 } }; // Edmonton, Calgary
const sent = [];

let donor, bank, pickyBank, farBank, quietBank;
const create = (extra = {}) =>
  donor.post("/posting/create").send({ fromRestaurantAddress: "Near", pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", foodTypes: ["bakery"], ...pickupWindow(), ...extra });
const inbox = async (agent) => (await agent.get("/notification")).body;

before(async () => {
  const ctx = await setup();
  require("../geocode").setGeocoder(async (a) => PLACES[a.toLowerCase()] || null);
  require("../notify").setTransport({ sendMail: async (mail) => sent.push(mail) });
  donor = ctx.agent();
  bank = ctx.agent();
  pickyBank = ctx.agent();
  farBank = ctx.agent();
  quietBank = ctx.agent();
  await signUp(donor, { name: "Cafe", email: "cafe@x.com" });
  await signUp(bank, { name: "Bank", email: "bank@x.com", isFoodbank: true });
  await signUp(pickyBank, { name: "Picky", email: "picky@x.com", isFoodbank: true });
  await signUp(farBank, { name: "Far", email: "far@x.com", isFoodbank: true });
  await signUp(quietBank, { name: "Quiet", email: "quiet@x.com", isFoodbank: true });
  await pickyBank.post("/user/update").send({ acceptedFoodTypes: ["produce"] });
  await farBank.post("/user/update").send({ address: "Far", serviceRadiusKm: 25 });
  await quietBank.post("/user/update").send({ notifyNewPostings: false, notifyByEmail: false });
});
after(teardown);

test("new posting alerts only food banks it suits, nearby, who want alerts", async () => {
  await create();
  assert.strictEqual((await inbox(bank)).unread, 1);
  assert.strictEqual((await inbox(pickyBank)).unread, 0, "doesn't accept bakery");
  assert.strictEqual((await inbox(farBank)).unread, 0, "outside its 25 km radius");
  assert.strictEqual((await inbox(quietBank)).unread, 0, "turned alerts off");
  const [n] = (await inbox(bank)).items;
  assert.strictEqual(n.type, "new_posting");
  assert.match(n.title, /Cafe/);
  assert.match(n.link, /^\/view_post\//);
  assert.ok(sent.some((m) => m.to === "bank@x.com" && /New food from Cafe/.test(m.subject)));
});

test("claim and pickup notify the restaurant", async () => {
  const p = await create({ foodTypes: ["produce"] });
  await bank.post(`/posting/${p.body._id}/claim`);
  let box = await inbox(donor);
  assert.strictEqual(box.items[0].type, "posting_claimed");
  assert.match(box.items[0].title, /Bank claimed/);
  await bank.post(`/posting/${p.body._id}/picked-up`);
  box = await inbox(donor);
  assert.strictEqual(box.items[0].type, "posting_picked_up");
  assert.strictEqual(box.unread, 2);
});

test("mark one and all as read; can't touch someone else's", async () => {
  const box = await inbox(donor);
  const other = (await inbox(bank)).items[0];
  assert.strictEqual((await donor.post(`/notification/${other._id}/read`)).status, 204);
  assert.ok(!(await inbox(bank)).items.find((n) => n._id === other._id).readAt);
  await donor.post(`/notification/${box.items[0]._id}/read`);
  assert.strictEqual((await inbox(donor)).unread, 1);
  await donor.post("/notification/read-all");
  assert.strictEqual((await inbox(donor)).unread, 0);
});

test("email preference is respected", async () => {
  const before = sent.filter((m) => m.to === "quiet@x.com").length;
  await quietBank.post("/user/update").send({ notifyNewPostings: true });
  await create();
  assert.strictEqual((await inbox(quietBank)).unread, 1);
  assert.strictEqual(sent.filter((m) => m.to === "quiet@x.com").length, before);
});
