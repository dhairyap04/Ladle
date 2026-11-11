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

// Authenticates the request from the access token, falling back to the refresh
// token (and issuing a new access token) when the access token has expired.
const verify = (req, res, next) => {
  const { accessToken, refreshToken } = req.cookies || {};

  const fromAccess = accessToken && decode(accessToken, accessTokenSecret);
  if (fromAccess) {
    req.user = fromAccess;
    return next();
  }

  const fromRefresh = refreshToken && decode(refreshToken, refreshTokenSecret);
  if (fromRefresh) {
    req.user = fromRefresh;
    res.cookie("accessToken", generateAccessToken(fromRefresh), cookieOptions(ACCESS_TOKEN_MS));
    return next();
  }

  return res.status(401).json({ msg: "Please log in to continue." });
};

const requireDonor = (req, res, next) => {
  if (req.user.isFoodbank) {
    return res.status(403).json({ msg: "Only restaurant accounts can do this." });
  }
  return next();
};

const requireFoodbank = (req, res, next) => {
  if (!req.user.isFoodbank) {
    return res.status(403).json({ msg: "Only food bank accounts can do this." });
  }
  return next();
};

module.exports = {
  verify,
  requireDonor,
  requireFoodbank,
  setAuthCookies,
  clearAuthCookies,
};
