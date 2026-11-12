const { verify } = require("../controllers/authHelper");
const asyncHandler = require("../controllers/asyncHandler");
const { getKey, subscribe, unsubscribe } = require("../controllers/PushController");

const pushRouter = require("express").Router();

pushRouter.get("/key", getKey);
pushRouter.post("/subscribe", verify, asyncHandler(subscribe));
pushRouter.post("/unsubscribe", verify, asyncHandler(unsubscribe));

module.exports = pushRouter;
