// Copies photos saved inside MongoDB (from before file storage) to the photo
// store set in .env (PHOTO_STORAGE / S3_BUCKET), checks each copy, then removes
// it from MongoDB. Safe to run again: anything already moved is skipped.
//
//   npm run photos:move              move everything
//   npm run photos:move -- --dry-run  only count what would move
const mongoose = require("mongoose");
const { mongoUri } = require("../config");
const mongoPostingPhotos = require("../models/PostingPhotos");
const mongoDeliveryPhotos = require("../models/DeliveryPhotos");
const photos = require("../photostore");

async function moveAll({ dryRun = false, log = console.log } = {}) {
  const store = photos.current();
  if (store.name === "database" || store.name === "memory") {
    throw new Error(`Photo storage is "${store.name}". Set S3_BUCKET (or PHOTO_STORAGE=disk) in .env first.`);
  }
  const counts = { moved: 0, failed: 0 };
  const sources = [
    { model: mongoPostingPhotos, key: (doc) => photos.postingKey(doc.postingId) },
    { model: mongoDeliveryPhotos, key: (doc) => photos.deliveryKey(doc.deliveryId, doc.stage) },
  ];
  for (const { model, key } of sources) {
    const total = await model.countDocuments();
    log(`${model.modelName}: ${total} to move${dryRun ? " (dry run)" : ""}`);
    if (dryRun) continue;
    for await (const doc of model.find().cursor()) {
      const k = key(doc);
      try {
        await store.put(k, doc.data, doc.contentType);
        const copy = await store.get(k);
        if (!copy || !Buffer.from(copy.data).equals(Buffer.from(doc.data))) throw new Error("the copy doesn't match");
        await model.deleteOne({ _id: doc._id });
        counts.moved += 1;
      } catch (err) {
        counts.failed += 1;
        log(`  couldn't move ${k}: ${err.message} (left in MongoDB)`);
      }
    }
  }
  log(`Moved ${counts.moved} photo${counts.moved === 1 ? "" : "s"} to ${store.name} storage${counts.failed ? `; ${counts.failed} failed and stayed in MongoDB` : ""}.`);
  return counts;
}

if (require.main === module) {
  (async () => {
    await mongoose.connect(mongoUri);
    try {
      const { failed } = await moveAll({ dryRun: process.argv.includes("--dry-run") });
      process.exitCode = failed ? 1 : 0;
    } finally {
      await mongoose.disconnect();
    }
  })().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { moveAll };
