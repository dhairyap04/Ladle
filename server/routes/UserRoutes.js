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

const userRouter = require("express").Router();

userRouter.post("/create", asyncHandler(registerUser));
userRouter.post("/login", asyncHandler(loginUser_handler));
// No verify: an expired session should still be able to clear its cookies.
userRouter.post("/logout", logoutUser_handler);
userRouter.get("/isAuth", verify, isAuthUser_handler);
userRouter.post("/update", verify, asyncHandler(updateUser));
userRouter.get("/info", verify, asyncHandler(getUserInfo_handler));
userRouter.post("/verification/request", verify, asyncHandler(requestVerification));

module.exports = userRouter;
