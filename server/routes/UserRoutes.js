const { verify } = require("../controllers/authHelper");
const { registerUser, updateUser, loginUser_handler, logoutUser_handler, isAuthUser_handler, getUserInfo_handler } = require("../controllers/UserController");

const userRouter = require("express").Router();

userRouter.post("/create", registerUser);
userRouter.post("/login", loginUser_handler);
userRouter.post("/logout", verify, logoutUser_handler);
userRouter.get("/isAuth", verify, isAuthUser_handler);
userRouter.post("/update", verify, updateUser);
userRouter.get('/info', verify, getUserInfo_handler);

module.exports = userRouter;