const { verify } = require("../controllers/authHelper");
const asyncHandler = require("../controllers/asyncHandler");
const {
  registerUser,
  updateUser,
  loginUser_handler,
  logoutUser_handler,
  isAuthUser_handler,
  getUserInfo_handler,
  requestVerification,
} = require("../controllers/UserController");

const { getReliability } = require("../controllers/ReliabilityController");
const { forgotPassword, resetPassword, changePassword } = require("../controllers/PasswordController");
const { rateLimit } = require("../rateLimit");
const { exportData, deleteAccount } = require("../controllers/AccountController");

const MIN = 60 * 1000;
const emailKey = (req) => (req.body && typeof req.body.email === "string" ? req.body.email.trim() : "");

// Slow down password guessing and email spamming.
const loginLimit = rateLimit({ name: "login", limit: 10, windowMs: 15 * MIN, keyFn: (req) => [`${req.ip}|${emailKey(req)}`], message: "Too many login attempts. Please wait 15 minutes and try again." });
const loginIpLimit = rateLimit({ name: "login-ip", limit: 50, windowMs: 15 * MIN });
const signupLimit = rateLimit({ name: "signup", limit: 20, windowMs: 60 * MIN });
const forgotLimit = rateLimit({ name: "forgot", limit: 3, windowMs: 60 * MIN, keyFn: (req) => [emailKey(req)], message: "We've already sent a few reset emails. Please check your inbox or try again in an hour." });
const forgotIpLimit = rateLimit({ name: "forgot-ip", limit: 10, windowMs: 60 * MIN });
const resetLimit = rateLimit({ name: "reset", limit: 10, windowMs: 15 * MIN });
const changeLimit = rateLimit({ name: "change", limit: 10, windowMs: 15 * MIN, keyFn: (req) => [req.user && req.user.id] });

const userRouter = require("express").Router();

userRouter.post("/create", signupLimit, asyncHandler(registerUser));
userRouter.post("/login", loginIpLimit, loginLimit, asyncHandler(loginUser_handler));
userRouter.post("/password/forgot", forgotIpLimit, forgotLimit, asyncHandler(forgotPassword));
userRouter.post("/password/reset", resetLimit, asyncHandler(resetPassword));
userRouter.post("/password/change", verify, changeLimit, asyncHandler(changePassword));
userRouter.get("/export", verify, asyncHandler(exportData));
userRouter.post("/delete", verify, changeLimit, asyncHandler(deleteAccount));
// No verify: an expired session should still be able to clear its cookies.
userRouter.post("/logout", logoutUser_handler);
userRouter.get("/isAuth", verify, isAuthUser_handler);
userRouter.post("/update", verify, asyncHandler(updateUser));
userRouter.get("/info", verify, asyncHandler(getUserInfo_handler));
userRouter.get("/:id/reliability", verify, asyncHandler(getReliability));
userRouter.post("/verification/request", verify, asyncHandler(requestVerification));

module.exports = userRouter;
