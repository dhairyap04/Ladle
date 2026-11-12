// Photo storage: backends, the switch away from MongoDB, and moving old photos.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const os = require("os");
const path = require("path");
const fs = require("fs/promises");
const { setup, teardown, pickupWindow, signUp } = require("./helpers");

// A 1x1 PNG.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";
const PNG_BYTES = Buffer.from(PNG.split(",")[1], "base64");
const ID = "64b0000000000000000000aa";

let ctx, donor, guest, photos, PostingPhotos, tmp;

before(async () => {
  ctx = await setup();
  donor = ctx.agent();
  guest = ctx.guest;
  await signUp(donor, { name: "Bakery", email: "bakery@x.com" });
  photos = require("../photostore");
  PostingPhotos = require("../models/PostingPhotos");
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ladle-photos-"));
});
after(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
  await teardown();
});

const post = (extra = {}) =>
  donor.post("/posting/create").send({ fromRestaurantAddress: "1 Main St", pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", ...pickupWindow(), ...extra });

test("the right backend is chosen from the environment", () => {
  assert.strictEqual(photos.storeFromEnv({ PHOTO_STORAGE: "memory" }).name, "memory");
  assert.strictEqual(photos.storeFromEnv({}).name, "disk");
  assert.strictEqual(photos.storeFromEnv({ NODE_ENV: "production", PHOTO_STORAGE: "database" }).name, "database");
  assert.strictEqual(photos.storeFromEnv({ S3_BUCKET: "b", S3_ACCESS_KEY_ID: "k", S3_SECRET_ACCESS_KEY: "s" }).name, "s3");
  assert.throws(() => photos.storeFromEnv({ PHOTO_STORAGE: "s3" }), /S3_BUCKET/);
  assert.throws(() => photos.storeFromEnv({ PHOTO_STORAGE: "ftp" }), /Unknown/);
});

test("keys can't point outside the photo folders", async () => {
  await assert.rejects(() => photos.save("../../etc/passwd", { data: PNG_BYTES, contentType: "image/png" }), /Bad photo key/);
  await assert.rejects(() => photos.load("postings/../x"), /Bad photo key/);
});

test("disk storage round-trips a photo and removes it", async () => {
  const disk = photos.diskStore(tmp);
  await disk.put(`postings/${ID}`, PNG_BYTES, "image/png");
  const got = await disk.get(`postings/${ID}`);
  assert.ok(got.data.equals(PNG_BYTES));
  assert.strictEqual(got.contentType, "image/png");
  await disk.remove(`postings/${ID}`);
  assert.strictEqual(await disk.get(`postings/${ID}`), null);
});

test("S3 storage sends the right requests", async () => {
  const objects = new Map();
  const sent = [];
  const client = {
    async send(cmd) {
      const { Bucket, Key } = cmd.input;
      sent.push([cmd.constructor.name, Bucket, Key]);
      if (cmd.constructor.name === "PutObjectCommand") objects.set(Key, { body: cmd.input.Body, type: cmd.input.ContentType });
      if (cmd.constructor.name === "DeleteObjectCommand") objects.delete(Key);
      if (cmd.constructor.name === "GetObjectCommand") {
        const o = objects.get(Key);
        if (!o) throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
        return { ContentType: o.type, Body: { transformToByteArray: async () => new Uint8Array(o.body) } };
      }
      return {};
    },
  };
  const s3 = photos.s3Store({ client, bucket: "ladle-photos", prefix: "prod/" });
  await s3.put(`deliveries/${ID}/pickup`, PNG_BYTES, "image/png");
  const got = await s3.get(`deliveries/${ID}/pickup`);
  assert.ok(got.data.equals(PNG_BYTES));
  assert.strictEqual(got.contentType, "image/png");
  await s3.remove(`deliveries/${ID}/pickup`);
  assert.strictEqual(await s3.get(`deliveries/${ID}/pickup`), null);
  assert.deepStrictEqual(sent[0], ["PutObjectCommand", "ladle-photos", `prod/deliveries/${ID}/pickup`]);
});

test("new posting photos go to file storage, not MongoDB", async () => {
  const created = await post({ photo: PNG });
  assert.strictEqual(created.status, 201, JSON.stringify(created.body));
  assert.strictEqual(await PostingPhotos.countDocuments(), 0);
  const stored = await photos.load(photos.postingKey(created.body._id));
  assert.ok(stored.data.equals(PNG_BYTES));

  const res = await guest.get(`/posting/${created.body._id}/photo`).buffer(true).parse((r, cb) => {
    const chunks = [];
    r.on("data", (c) => chunks.push(c));
    r.on("end", () => cb(null, Buffer.concat(chunks)));
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers["content-type"], "image/png");
  assert.ok(res.body.equals(PNG_BYTES));

  const removed = await donor.post(`/posting/${created.body._id}/edit`).send({ fromRestaurantAddress: "1 Main St", pickupTimeBegin: "18:00", pickupTimeEnd: "20:00", ...pickupWindow(), removePhoto: true });
  assert.strictEqual(removed.status, 200);
  assert.strictEqual(await photos.load(photos.postingKey(created.body._id)), null);
});

test("photos still in MongoDB keep working, and move to file storage", async () => {
  const created = await post();
  const id = created.body._id;
  await PostingPhotos.create({ postingId: id, contentType: "image/png", data: PNG_BYTES });
  await ctx.mongoose.model("FoodPostings").updateOne({ _id: id }, { hasPhoto: true });
  assert.strictEqual((await guest.get(`/posting/${id}/photo`)).status, 200); // read from MongoDB

  const previous = photos.current();
  photos.setStore(photos.diskStore(tmp));
  try {
    const { moveAll } = require("../scripts/move-photos");
    const counts = await moveAll({ log: () => {} });
    assert.deepStrictEqual(counts, { moved: 1, failed: 0 });
    assert.strictEqual(await PostingPhotos.countDocuments(), 0);
    assert.ok((await photos.load(photos.postingKey(id))).data.equals(PNG_BYTES));
    assert.strictEqual((await guest.get(`/posting/${id}/photo`)).status, 200); // now from disk
    assert.deepStrictEqual(await moveAll({ log: () => {} }), { moved: 0, failed: 0 }); // nothing left
  } finally {
    photos.setStore(previous);
  }
});

test("moving refuses to run without real file storage", async () => {
  const { moveAll } = require("../scripts/move-photos");
  await assert.rejects(() => moveAll({ log: () => {} }), /S3_BUCKET/); // tests use memory storage
});
