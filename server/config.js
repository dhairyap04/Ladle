// Central place for environment configuration. Fails fast when a required
// secret is missing instead of silently falling back to a hard-coded value.
require("dotenv").config();

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. See server/.env.example.`);
  }
  return value;
};

const isProduction = process.env.NODE_ENV === "production";

module.exports = {
  isProduction,
  port: process.env.PORT || 5000,
  mongoUri: required("MONGO_URI"),
  accessTokenSecret: required("JWT_ACCESS_SECRET"),
  refreshTokenSecret: required("JWT_REFRESH_SECRET"),
  // Optional server-side key for the Google Geocoding API (distance search).
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  // Optional SMTP connection for email alerts, e.g. smtps://user:pass@smtp.example.com:465.
  smtpUrl: process.env.SMTP_URL || "",
  emailFrom: process.env.EMAIL_FROM || "Ladle <no-reply@ladle.local>",
  // Emails of accounts that get the admin console (comma-separated).
  adminEmails: (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  // When "true", only verified food banks can claim postings.
  requireVerifiedToClaim: process.env.REQUIRE_VERIFIED_TO_CLAIM === "true",
  // Behind a load balancer or proxy (most hosts), set to the number of proxies
  // (usually 1) so rate limits see the real client IP.
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY : false,
  // Comma-separated list of front-end origins allowed to call the API with cookies.
  clientOrigins: (process.env.CLIENT_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
