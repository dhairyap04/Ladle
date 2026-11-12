const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const mongoUsers = require("../models/Users");
const mongoPasswordResets = require("../models/PasswordResets");
const { sendEmail, appUrl } = require("../notify");
const { isProduction } = require("../config");
const { setAuthCookies } = require("./authHelper");

const BCRYPT_ROUNDS = 12;
const RESET_TTL_MS = 60 * 60 * 1000; // links work for one hour
const MIN_LENGTH = 8;

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// Stores a new password and signs out every other session (see authHelper).
async function setPassword(user, password) {
  user.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
  user.sessionVersion = (user.sessionVersion || 0) + 1;
  await user.save();
}

// POST /user/password/forgot { email }
// Always answers the same way, so it can't be used to find out who has an account.
const forgotPassword = async (req, res) => {
  const email = typeof (req.body || {}).email === "string" ? req.body.email.trim() : "";
  const done = () =>
    res.status(200).json({ msg: "If there's an account for that email, we've sent a link to reset the password. It works for one hour." });
  if (!email) return res.status(400).json({ msg: "Please enter your email address." });

  const user = await mongoUsers.findOne({ email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
  if (!user) return done();

  // Only the newest link works.
  await mongoPasswordResets.deleteMany({ userId: user._id });
  const token = crypto.randomBytes(32).toString("hex");
  await mongoPasswordResets.create({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) });

  const link = appUrl(`/reset-password?token=${token}`);
  const sent = await sendEmail(
    user.email,
    "Ladle: reset your password",
    `Someone (hopefully you) asked to reset the password for your Ladle account.\n\nReset it here: ${link}\n\nThe link works for one hour. If you didn't ask for this, you can ignore this email; your password hasn't changed.`
  );
  if (!sent && !isProduction) {
    // Without email set up, print the link so local testing still works.
    console.log(`[password reset] ${user.email}: ${link}`);
  }
  return done();
};

// POST /user/password/reset { token, password }
const resetPassword = async (req, res) => {
  const { token, password } = req.body || {};
  if (typeof password !== "string" || password.length < MIN_LENGTH) {
    return res.status(400).json({ msg: `Password must be at least ${MIN_LENGTH} characters.` });
  }
  const invalid = () => res.status(400).json({ msg: "This reset link is invalid or has expired. Please ask for a new one." });
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return invalid();

  // Claim the link atomically so it can only be used once.
  const reset = await mongoPasswordResets.findOneAndUpdate(
    { tokenHash: hashToken(token), usedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } }
  );
  if (!reset) return invalid();
  const user = await mongoUsers.findById(reset.userId).select("+password");
  if (!user) return invalid();

  await setPassword(user, password);
  await mongoPasswordResets.deleteMany({ userId: user._id });
  await sendEmail(user.email, "Ladle: your password was changed", "The password for your Ladle account was just reset, and other devices were signed out. If this wasn't you, reset it again right away.");
  return res.status(200).json({ msg: "Your password has been reset. You can log in with it now." });
};

// POST /user/password/change { currentPassword, newPassword } — while logged in.
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== "string" || newPassword.length < MIN_LENGTH) {
    return res.status(400).json({ msg: `New password must be at least ${MIN_LENGTH} characters.` });
  }
  const user = await mongoUsers.findById(req.user.id).select("+password");
  if (!user) return res.status(404).json({ msg: "Account not found." });
  if (typeof currentPassword !== "string" || !(await bcrypt.compare(currentPassword, user.password))) {
    return res.status(400).json({ msg: "Your current password isn't right." });
  }
  await setPassword(user, newPassword);
  // Keep this device signed in with fresh tokens; other devices are signed out.
  setAuthCookies(res, user, req.user.rm);
  return res.status(200).json({ msg: "Password changed. Other devices have been signed out." });
};

module.exports = { forgotPassword, resetPassword, changePassword };
