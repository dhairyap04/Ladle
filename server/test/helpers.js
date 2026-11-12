// Shared setup for API tests: an in-memory MongoDB and the Express app.
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const request = require("supertest");

let mem;

// Starts MongoDB, sets the env the app needs, and returns the app and models.
// Must run before anything requires ../config.
async function setup({ env: extraEnv = {}, beforeMigrate } = {}) {
  mem = await MongoMemoryServer.create();
  Object.assign(process.env, {
    MONGO_URI: mem.getUri(),
    JWT_ACCESS_SECRET: "test-access",
    JWT_REFRESH_SECRET: "test-refresh",
    CLIENT_ORIGINS: "http://localhost:3000",
    PHOTO_STORAGE: "memory",
    ...extraEnv,
  });
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  if (beforeMigrate) await beforeMigrate();
  const { migrate } = require("../migrate");
  await migrate();
  const app = require("../app");
  return { app, agent: () => request.agent(app), guest: request(app), mongoose };
}

async function teardown() {
  await mongoose.disconnect();
  if (mem) await mem.stop();
}

// A pickup window a few hours from now, far enough out not to expire mid-test.
const pickupWindow = () => ({
  pickupDate: "2099-01-01",
  pickupEndsAt: new Date(Date.now() + 3 * 3600e3).toISOString(),
});

// Registers an account on `agent` and returns the response body's user.
async function signUp(agent, { name, email, isFoodbank = false, password = "password1" }) {
  const res = await agent.post("/user/create").send({ name, email, password, isFoodbank });
  if (res.status !== 201) throw new Error(`sign-up failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.user;
}

module.exports = { setup, teardown, pickupWindow, signUp };
