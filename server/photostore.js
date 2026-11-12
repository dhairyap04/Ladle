// Where photo bytes live: food photos on postings and drivers' handoff photos.
// The database only records whether a photo exists; the bytes go to file
// storage, which is cheaper and keeps the database small and quick to back up.
//
// PHOTO_STORAGE picks the backend:
//   s3        Amazon S3 or anything S3-compatible (Cloudflare R2, Backblaze B2,
//             MinIO). Needs S3_BUCKET and credentials; see .env.example.
//   disk      A local folder (PHOTO_DIR, default server/uploads). Fine for
//             development; most hosts wipe their disk on every deploy.
//   memory    Lost on restart. Used by tests and the demo.
//   database  The old behaviour: photos inside MongoDB.
// Unset: s3 when S3_BUCKET is set, database in production (with a warning,
// so an existing deployment keeps working), disk otherwise.
//
// Photos saved before file storage are still read from MongoDB until
// `npm run photos:move` copies them across.
const fs = require("fs/promises");
const path = require("path");
const mongoPostingPhotos = require("./models/PostingPhotos");
const mongoDeliveryPhotos = require("./models/DeliveryPhotos");

// Keys: "postings/<postingId>" and "deliveries/<deliveryId>/<pickup|dropoff>".
const postingKey = (postingId) => `postings/${postingId}`;
const deliveryKey = (deliveryId, stage) => `deliveries/${deliveryId}/${stage}`;
const SAFE_KEY = /^(postings\/[a-f0-9]{24}|deliveries\/[a-f0-9]{24}\/(pickup|dropoff))$/;
const checkKey = (key) => {
  if (!SAFE_KEY.test(key)) throw new Error(`Bad photo key: ${key}`);
  return key;
};

// --- Backends: put(key, data, contentType), get(key) -> { data, contentType } | null, remove(key)

function memoryStore() {
  const files = new Map();
  return {
    name: "memory",
    async put(key, data, contentType) {
      files.set(key, { data: Buffer.from(data), contentType });
    },
    async get(key) {
      return files.get(key) || null;
    },
    async remove(key) {
      files.delete(key);
    },
  };
}

// Each photo is two files: the image, and "<name>.type" holding its content type.
function diskStore(dir) {
  const file = (key) => path.join(dir, ...checkKey(key).split("/"));
  return {
    name: "disk",
    dir,
    async put(key, data, contentType) {
      await fs.mkdir(path.dirname(file(key)), { recursive: true });
      await fs.writeFile(file(key), data);
      await fs.writeFile(`${file(key)}.type`, contentType);
    },
    async get(key) {
      try {
        const [data, contentType] = await Promise.all([fs.readFile(file(key)), fs.readFile(`${file(key)}.type`, "utf8")]);
        return { data, contentType };
      } catch (err) {
        if (err.code === "ENOENT") return null;
        throw err;
      }
    },
    async remove(key) {
      await fs.rm(file(key), { force: true });
      await fs.rm(`${file(key)}.type`, { force: true });
    },
  };
}

// `client` is an S3Client (or a stand-in with the same send()).
function s3Store({ client, bucket, prefix = "" }) {
  const sdk = require("@aws-sdk/client-s3");
  const Key = (key) => `${prefix}${checkKey(key)}`;
  return {
    name: "s3",
    async put(key, data, contentType) {
      await client.send(new sdk.PutObjectCommand({ Bucket: bucket, Key: Key(key), Body: data, ContentType: contentType }));
    },
    async get(key) {
      try {
        const res = await client.send(new sdk.GetObjectCommand({ Bucket: bucket, Key: Key(key) }));
        return { data: Buffer.from(await res.Body.transformToByteArray()), contentType: res.ContentType || "image/jpeg" };
      } catch (err) {
        if (err.name === "NoSuchKey" || (err.$metadata && err.$metadata.httpStatusCode === 404)) return null;
        throw err;
      }
    },
    async remove(key) {
      await client.send(new sdk.DeleteObjectCommand({ Bucket: bucket, Key: Key(key) }));
    },
  };
}

// The old collections, by key.
const legacy = {
  find(key) {
    const [kind, id, stage] = checkKey(key).split("/");
    return kind === "postings" ? mongoPostingPhotos.findOne({ postingId: id }) : mongoDeliveryPhotos.findOne({ deliveryId: id, stage });
  },
  remove(key) {
    const [kind, id, stage] = checkKey(key).split("/");
    return kind === "postings" ? mongoPostingPhotos.deleteOne({ postingId: id }) : mongoDeliveryPhotos.deleteOne({ deliveryId: id, stage });
  },
};

function databaseStore() {
  return {
    name: "database",
    async put(key, data, contentType) {
      const [kind, id, stage] = checkKey(key).split("/");
      if (kind === "postings") await mongoPostingPhotos.findOneAndUpdate({ postingId: id }, { contentType, data }, { upsert: true });
      else await mongoDeliveryPhotos.findOneAndUpdate({ deliveryId: id, stage }, { contentType, data }, { upsert: true });
    },
    async get(key) {
      const doc = await legacy.find(key);
      return doc ? { data: doc.data, contentType: doc.contentType } : null;
    },
    async remove(key) {
      await legacy.remove(key);
    },
  };
}

function storeFromEnv(env = process.env) {
  const kind = env.PHOTO_STORAGE || (env.S3_BUCKET ? "s3" : env.NODE_ENV === "production" ? "database" : "disk");
  if (kind === "memory") return memoryStore();
  if (kind === "database") {
    if (env.NODE_ENV === "production" && !env.PHOTO_STORAGE) {
      console.warn("Photos are being stored in MongoDB. Set S3_BUCKET (see .env.example) to keep them in file storage instead.");
    }
    return databaseStore();
  }
  if (kind === "disk") return diskStore(path.resolve(env.PHOTO_DIR || path.join(__dirname, "uploads")));
  if (kind === "s3") {
    if (!env.S3_BUCKET) throw new Error("PHOTO_STORAGE=s3 needs S3_BUCKET. See server/.env.example.");
    const { S3Client } = require("@aws-sdk/client-s3");
    const client = new S3Client({
      region: env.S3_REGION || "auto",
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT, forcePathStyle: env.S3_FORCE_PATH_STYLE === "true" } : {}),
      ...(env.S3_ACCESS_KEY_ID ? { credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } } : {}),
    });
    return s3Store({ client, bucket: env.S3_BUCKET, prefix: env.S3_PREFIX || "" });
  }
  throw new Error(`Unknown PHOTO_STORAGE "${kind}". Use s3, disk, memory or database.`);
}

let store = null;
const current = () => {
  if (!store) store = storeFromEnv();
  return store;
};

// Tests and scripts can swap the backend.
const setStore = (s) => {
  store = s;
};

const save = async (key, { data, contentType }) => current().put(checkKey(key), data, contentType);

// Reads from file storage, then from MongoDB for photos not moved yet.
const load = async (key) => {
  const found = await current().get(checkKey(key));
  if (found || current().name === "database") return found;
  const old = await legacy.find(key);
  return old ? { data: old.data, contentType: old.contentType } : null;
};

const remove = async (key) => {
  await current().remove(checkKey(key));
  if (current().name !== "database") await legacy.remove(key);
};

module.exports = {
  postingKey,
  deliveryKey,
  save,
  load,
  remove,
  setStore,
  current,
  storeFromEnv,
  memoryStore,
  diskStore,
  s3Store,
  databaseStore,
};
