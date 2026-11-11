const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { clientOrigins } = require("./config");
const mainRouter = require("./routes/RouteController");

const app = express();

// Postings can carry a resized photo as a data URL.
app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true }));
// Only the configured front-end origins may send credentialed requests.
app.use(cors({ origin: clientOrigins, credentials: true, exposedHeaders: ["X-Search-Origin"] }));
app.use(cookieParser());

app.use("/", mainRouter);

app.use((req, res) => res.status(404).json({ msg: "Not found." }));

// Last-resort handler so async errors return a response instead of hanging.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ msg: "Something went wrong. Please try again." });
});

module.exports = app;
