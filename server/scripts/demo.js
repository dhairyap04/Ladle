// Demo mode: runs the real Ladle API against a throwaway in-memory MongoDB,
// filled with demo accounts and data for every role. Nothing touches your
// real database, and everything is gone when you stop it.
//
//   cd server && npm run demo
//   (then, in client/: REACT_APP_HOST_URL=http://localhost:5055/ npm start)
//
// Demo accounts (all use the password  demo-password ):
//   restaurant@demo.ladle   Harvest Table Bistro   restaurant with postings, a weekly donation, a completed pickup
//   cafe@demo.ladle         Sunrise Café           second restaurant
//   foodbank@demo.ladle     Northside Food Bank    food bank waiting for verification, with claims and a driver request
//   driver@demo.ladle       Sam Rivera             volunteer driver with a delivery in progress
//   admin@demo.ladle        Ladle Admin            admin console (verification queue, flags)
//
// Addresses are placed around Edmonton by a fake geocoder (no Google key needed),
// and emails are printed to the console instead of being sent (password reset
// emails include their link, so "Forgot password" works too).
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const PASSWORD = "demo-password";
const PORT = process.env.PORT || "5055";
const CLIENT_ORIGINS = process.env.CLIENT_ORIGINS || "http://localhost:3000";

// The demo's own addresses at their real places in Edmonton, so the map and
// distances look right; anything else typed gets stable made-up coordinates.
const DEMO_PLACES = {
  "10150 jasper ave, edmonton, ab": { lat: 53.5412, lng: -113.4946 },
  "8215 112 st nw, edmonton, ab": { lat: 53.5196, lng: -113.5167 },
  "10418 82 ave nw, edmonton, ab": { lat: 53.5182, lng: -113.4983 },
  "11420 98 ave nw, edmonton, ab": { lat: 53.5367, lng: -113.5187 },
  "10010 105 st nw, edmonton, ab": { lat: 53.5390, lng: -113.4994 },
};
const fakeGeocode = async (address) => {
  if (DEMO_PLACES[address.trim().toLowerCase()]) return DEMO_PLACES[address.trim().toLowerCase()];
  let h = 0;
  for (const c of address.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { lat: 53.48 + ((h % 1000) / 1000) * 0.14, lng: -113.6 + (((h >> 10) % 1000) / 1000) * 0.22 };
};

const ymd = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const windowOn = (day, begin, end) => ({
  pickupDate: day,
  pickupTimeBegin: begin,
  pickupTimeEnd: end,
  pickupEndsAt: new Date(`${day}T${end}`).toISOString(),
});

async function expectOk(promise, what) {
  const res = await promise;
  if (res.status >= 400) throw new Error(`Demo seeding failed at "${what}": ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

async function seed(app) {
  const as = () => request.agent(app);
  const signUp = (agent, name, email, role) =>
    expectOk(agent.post("/user/create").send({ name, email, password: PASSWORD, role }), `sign up ${email}`);

  const admin = as();
  await signUp(admin, "Ladle Admin", "admin@demo.ladle", "restaurant");

  const restaurant = as();
  await signUp(restaurant, "Harvest Table Bistro", "restaurant@demo.ladle", "restaurant");
  const profile = await expectOk(restaurant.post("/user/update").send({ address: "10150 Jasper Ave, Edmonton, AB", phoneNumber: "780-555-0142", website: "harvesttable.example", openHours: "11:00-22:00" }), "restaurant profile");
  // Two branches: the profile address became the first (main) location.
  const jasper = profile.user.locations[0].id;
  await expectOk(restaurant.patch(`/user/locations/${jasper}`).send({ name: "Jasper Ave", notes: "Back door off the alley. Ask for Maria." }), "name main location");
  const { locationId: university } = await expectOk(restaurant.post("/user/locations").send({ name: "University", address: "8215 112 St NW, Edmonton, AB", notes: "Loading bay on 82 Ave." }), "second location");

  const cafe = as();
  await signUp(cafe, "Sunrise Café", "cafe@demo.ladle", "restaurant");
  await expectOk(cafe.post("/user/update").send({ address: "10418 82 Ave NW, Edmonton, AB", phoneNumber: "780-555-0160" }), "cafe profile");

  const foodBank = as();
  await signUp(foodBank, "Northside Food Bank", "foodbank@demo.ladle", "foodbank");
  await expectOk(foodBank.post("/user/update").send({
    address: "11420 98 Ave NW, Edmonton, AB",
    phoneNumber: "780-555-0177",
    charitableTaxNum: "123456789RR0001",
    acceptedFoodTypes: ["bakery", "produce", "prepared_meals", "dairy_eggs"],
    coldStorage: ["refrigerated"],
    serviceRadiusKm: 25,
    openHours: "09:00-21:00",
  }), "food bank profile");

  const driver = as();
  await signUp(driver, "Sam Rivera", "driver@demo.ladle", "driver");
  await expectOk(driver.post("/user/update").send({ address: "10010 105 St NW, Edmonton, AB", phoneNumber: "780-555-0190", vehicle: "car", maxPickupKg: 60, serviceRadiusKm: 20, coldStorage: ["refrigerated"] }), "driver profile");

  const tomorrow = daysFromNow(1);
  const later = daysFromNow(2);
  const post = (agent, body, what) => expectOk(agent.post("/posting/create").send(body), what);

  // Open postings for food banks to browse.
  await post(restaurant, {
    locationId: university,
    ...windowOn(tomorrow, "20:00", "21:30"),
    foodTypes: ["prepared_meals"], allergens: ["none"], storage: "refrigerated",
    quantity: "20 boxed dinners", estimatedWeightKg: 12, notes: "Chicken and rice, packed this evening.",
  }, "dinners posting");
  await post(cafe, {
    fromRestaurantAddress: "10418 82 Ave NW, Edmonton, AB",
    ...windowOn(tomorrow, "13:00", "15:00"),
    foodTypes: ["produce"], allergens: ["none"], quantity: "2 crates of vegetables", estimatedWeightKg: 15,
  }, "vegetables posting");
  await post(cafe, {
    fromRestaurantAddress: "10418 82 Ave NW, Edmonton, AB",
    ...windowOn(later, "08:00", "10:00"),
    foodTypes: ["bakery", "dairy_eggs"], allergens: ["wheat", "milk", "eggs"], storage: "refrigerated",
    quantity: "Muffins and yogurt cups", estimatedWeightKg: 6,
  }, "breakfast posting");

  // Claimed by the food bank, with a driver on the way.
  const bread = await post(restaurant, {
    locationId: jasper,
    ...windowOn(tomorrow, "16:00", "18:00"),
    foodTypes: ["bakery"], allergens: ["wheat", "milk"], quantity: "3 trays of bread", estimatedWeightKg: 8,
    notes: "Ask at the back door.",
  }, "bread posting");
  await expectOk(foodBank.post(`/posting/${bread._id}/messages`).send({ body: "Hi! We don't have the van tomorrow, so we're sending a volunteer driver." }), "message");
  await expectOk(restaurant.post(`/posting/${bread._id}/messages`).send({ body: "No problem, ask for Maria at the back door.", foodBankId: (await foodBank.get("/user/info")).body.user.id }), "reply");
  await expectOk(foodBank.post(`/posting/${bread._id}/claim`), "claim bread");
  const breadDelivery = await expectOk(foodBank.post("/delivery").send({ postingId: bread._id, notes: "Loading dock at the back, ring the bell." }), "request driver");
  await expectOk(driver.post(`/delivery/${breadDelivery._id}/accept`), "driver accepts");

  // Claimed, with a driver still needed (shows up on the driver's home page).
  const soup = await post(cafe, {
    fromRestaurantAddress: "10418 82 Ave NW, Edmonton, AB",
    ...windowOn(later, "17:00", "19:00"),
    foodTypes: ["prepared_meals"], allergens: ["none"],
    storage: "hot", quantity: "Two pots of soup", estimatedWeightKg: 18,
  }, "soup posting");
  await expectOk(foodBank.post(`/posting/${soup._id}/claim`), "claim soup");
  await expectOk(foodBank.post("/delivery").send({ postingId: soup._id, notes: "Side door on 98 Ave." }), "request driver for soup");

  // A completed, rated pickup (shows on impact pages and the donation record).
  const salad = await post(restaurant, {
    locationId: jasper,
    ...windowOn(tomorrow, "12:00", "14:00"),
    foodTypes: ["produce", "prepared_meals"], allergens: ["none"], quantity: "Salad bar leftovers", estimatedWeightKg: 9,
  }, "salad posting");
  await expectOk(foodBank.post(`/posting/${salad._id}/claim`), "claim salad");
  await expectOk(foodBank.post(`/posting/${salad._id}/picked-up`), "salad picked up");
  const foodBankId = (await foodBank.get("/user/info")).body.user.id;
  const restaurantId = (await restaurant.get("/user/info")).body.user.id;
  await expectOk(restaurant.post(`/posting/${salad._id}/ratings`).send({ toUserId: foodBankId, stars: 5, comment: "On time and friendly." }), "rate food bank");
  await expectOk(foodBank.post(`/posting/${salad._id}/ratings`).send({ toUserId: restaurantId, stars: 5, comment: "Well packed." }), "rate restaurant");

  // A weekly donation.
  await expectOk(restaurant.post("/schedule").send({
    locationId: jasper,
    daysOfWeek: [1, 3, 5], pickupTimeBegin: "21:00", pickupTimeEnd: "22:00", startsOn: daysFromNow(0),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    foodTypes: ["bakery"], allergens: ["wheat"], quantity: "Day-old bread", estimatedWeightKg: 5,
  }), "weekly donation");

  // Past donations over the last ten months, so the impact pages, track records
  // and admin totals look like an account that has been in use for a while.
  const mongoFoodPostings = require("../models/Postings");
  const { geocodeToPoint } = require("../geocode");
  const HISTORY = [
    // [months ago, day of month, kg, food types, quantity, allergens]
    [10, 14, 6, ["bakery"], "Day-old bread", ["wheat"]],
    [9, 9, 8, ["bakery"], "Bread and rolls", ["wheat"]],
    [8, 3, 11, ["prepared_meals"], "Pasta trays", ["wheat", "milk"]],
    [8, 21, 5, ["bakery"], "Day-old bread", ["wheat"]],
    [7, 12, 14, ["prepared_meals", "produce"], "Catering leftovers", ["none"]],
    [6, 2, 7, ["bakery"], "Bread and pastries", ["wheat", "milk", "eggs"]],
    [6, 19, 9, ["produce"], "Salad bar vegetables", ["none"]],
    [5, 8, 12, ["prepared_meals"], "Rice and curry", ["none"]],
    [5, 23, 6, ["bakery"], "Day-old bread", ["wheat"]],
    [4, 5, 16, ["prepared_meals"], "Banquet leftovers", ["wheat", "milk"]],
    [4, 18, 8, ["bakery"], "Bread and rolls", ["wheat"]],
    [3, 7, 10, ["prepared_meals", "produce"], "Soup and salad", ["none"]],
    [3, 20, 7, ["bakery"], "Day-old bread", ["wheat"]],
    [2, 4, 13, ["prepared_meals"], "Lasagna trays", ["wheat", "milk"]],
    [2, 16, 9, ["dairy_eggs", "bakery"], "Muffins and yogurt", ["wheat", "milk", "eggs"]],
    [1, 6, 15, ["prepared_meals"], "Holiday party leftovers", ["wheat", "milk"]],
    [1, 15, 8, ["bakery"], "Day-old bread", ["wheat"]],
    [1, 27, 11, ["produce", "prepared_meals"], "Roasted vegetables", ["none"]],
  ];
  const jasperAddress = "10150 Jasper Ave, Edmonton, AB";
  const jasperPoint = await geocodeToPoint(jasperAddress);
  for (const [monthsAgo, day, kg, foodTypes, quantity, allergens] of HISTORY) {
    const at = new Date();
    at.setDate(1);
    at.setMonth(at.getMonth() - monthsAgo);
    at.setDate(day);
    at.setHours(21, 30, 0, 0);
    const past = await mongoFoodPostings.create({
      donorId: restaurantId,
      fromRestaurantName: "Harvest Table Bistro",
      fromRestaurantAddress: jasperAddress,
      pickupLocationName: "Jasper Ave",
      location: jasperPoint,
      pickupDate: ymd(at),
      pickupTimeBegin: 2100,
      pickupTimeEnd: 2200,
      pickupEndsAt: at,
      foodTypes, allergens, quantity, estimatedWeightKg: kg,
      storage: foodTypes.includes("prepared_meals") ? "refrigerated" : "ambient",
      status: "picked_up",
      claimedBy: foodBankId,
      claimedByName: "Northside Food Bank",
      claimedAt: at,
      pickedUpAt: at,
    });
    // Mongoose stamps "now" on create; backdate it like a real old posting.
    await mongoFoodPostings.collection.updateOne({ _id: past._id }, { $set: { createdAt: at, updatedAt: at } });
  }

  // The food bank asks to be verified, so the admin has something to review.
  await expectOk(foodBank.post("/user/verification/request"), "verification request");
}

(async () => {
  const mem = await MongoMemoryServer.create();
  Object.assign(process.env, {
    MONGO_URI: mem.getUri("ladle-demo"),
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "demo-access-secret",
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "demo-refresh-secret",
    CLIENT_ORIGINS,
    PORT,
    ADMIN_EMAILS: "admin@demo.ladle",
    GOOGLE_MAPS_API_KEY: "",
    SMTP_URL: "",
    PHOTO_STORAGE: "memory", // like the data, photos reset on restart
  });
  // Temporary push keys, so push notifications work in the demo (with a production
  // build of the client, where the service worker runs).
  if (!process.env.VAPID_PUBLIC_KEY) {
    const keys = require("web-push").generateVAPIDKeys();
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  }

  const mongoose = require("mongoose");
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  require("../geocode").setGeocoder(fakeGeocode);
  require("../notify").setTransport({
    sendMail: async (m) => {
      console.log(`[email] to ${m.to}: ${m.subject}`);
      // Show reset links so "Forgot password" can be tried without an inbox.
      const link = /https?:\/\/\S*reset-password\S*/.exec(m.text || "");
      if (link) console.log(`        ${link[0]}`);
    },
  });
  await require("../migrate").migrate();

  const app = require("../app");
  await seed(app);
  app.listen(PORT, () => {
    console.log(`\nLadle demo API on http://localhost:${PORT} (in-memory data, reset on restart)`);
    console.log(`Allowed app origin: ${CLIENT_ORIGINS}`);
    console.log("Demo accounts are listed at the top of server/scripts/demo.js.\n");
  });
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
