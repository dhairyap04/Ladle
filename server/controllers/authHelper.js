const jwt = require("jsonwebtoken");
const { accessTokenSecret, refreshTokenSecret, isProduction } = require("../config");

const ACCESS_TOKEN_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_MS = 200 * 24 * 60 * 60 * 1000; // 200 days

// Express's cookie maxAge is in milliseconds. In production the client and API
// are on different sites, so cookies must be SameSite=None and Secure.
const cookieOptions = (maxAge) => ({
  maxAge,
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
});

const tokenPayload = (user) => ({
  id: String(user._id || user.id),
  email: user.email,
  name: user.name,
  isFoodbank: Boolean(user.isFoodbank),
  role: user.role || (user.isFoodbank ? "foodbank" : "restaurant"),
  isAdmin: Boolean(user.isAdmin),
});

const generateAccessToken = (user) =>
  jwt.sign(tokenPayload(user), accessTokenSecret, { expiresIn: ACCESS_TOKEN_MS / 1000 });

const generateRefreshToken = (user) =>
  jwt.sign(tokenPayload(user), refreshTokenSecret, { expiresIn: REFRESH_TOKEN_MS / 1000 });

const setAuthCookies = (res, user) => {
  res.cookie("accessToken", generateAccessToken(user), cookieOptions(ACCESS_TOKEN_MS));
  res.cookie("refreshToken", generateRefreshToken(user), cookieOptions(REFRESH_TOKEN_MS));
};

const clearAuthCookies = (res) => {
  const { maxAge, ...options } = cookieOptions(0);
  res.clearCookie("accessToken", options);
  res.clearCookie("refreshToken", options);
};

const decode = (token, secret) => {
  try {
    const decoded = jwt.verify(token, secret);
    // Tokens issued before user ids were added to the payload are not accepted.
    return decoded.id ? tokenPayload(decoded) : null;
  } catch (err) {
    return null;
  }
};

// Reads the user from the access token, falling back to the refresh token (and
// issuing a new access token) when the access token has expired.
const authenticate = (req, res) => {
  const { accessToken, refreshToken } = req.cookies || {};

  const fromAccess = accessToken && decode(accessToken, accessTokenSecret);
  if (fromAccess) return fromAccess;

  const fromRefresh = refreshToken && decode(refreshToken, refreshTokenSecret);
  if (fromRefresh) {
    res.cookie("accessToken", generateAccessToken(fromRefresh), cookieOptions(ACCESS_TOKEN_MS));
    return fromRefresh;
  }
  return null;
};

const verify = (req, res, next) => {
  req.user = authenticate(req, res);
  if (req.user) return next();
  return res.status(401).json({ msg: "Please log in to continue." });
};

// Like verify, but lets guests through with req.user = null.
const optionalAuth = (req, res, next) => {
  req.user = authenticate(req, res);
  next();
};

const requireDonor = (req, res, next) => {
  if (req.user.role !== "restaurant") {
    return res.status(403).json({ msg: "Only restaurant accounts can do this." });
  }
  return next();
};

const requireDriver = (req, res, next) => {
  if (req.user.role !== "driver") {
    return res.status(403).json({ msg: "Only volunteer driver accounts can do this." });
  }
  return next();
};

const requireFoodbank = (req, res, next) => {
  if (req.user.role !== "foodbank") {
    return res.status(403).json({ msg: "Only food bank accounts can do this." });
  }
  return next();
};

// Checks the database, not the token, so revoking admin takes effect at once.
const requireAdmin = async (req, res, next) => {
  try {
    const user = await require("../models/Users").findById(req.user.id, "isAdmin");
    if (!user || !user.isAdmin) return res.status(403).json({ msg: "Only Ladle admins can do this." });
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  verify,
  requireAdmin,
  optionalAuth,
  requireDonor,
  requireFoodbank,
  requireDriver,
  setAuthCookies,
  clearAuthCookies,
};
