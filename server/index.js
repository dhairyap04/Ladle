const mongoose = require("mongoose");

const { mongoUri, port } = require("./config");
const app = require("./app");
const { migrate } = require("./migrate");
const { refreshPostings } = require("./controllers/PostingsController");

const REFRESH_MS = 15 * 60 * 1000;

// Postings are also refreshed whenever they're listed; this timer makes sure
// recurring postings (and their alerts) appear even when nobody is browsing.
const startRefreshTimer = () =>
  setInterval(() => refreshPostings().catch((err) => console.error("Refresh failed:", err.message)), REFRESH_MS).unref();

mongoose
  .connect(mongoUri, { autoIndex: false })
  .then(migrate)
  .then(startRefreshTimer)
  .then(() => app.listen(port, () => console.log(`Server running on port ${port}; MongoDB connected`)))
  .catch((error) => {
    console.error(`Error on server start: ${error.message}`);
    process.exit(1);
  });
