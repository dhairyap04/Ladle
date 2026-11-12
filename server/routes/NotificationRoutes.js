const { verify } = require("../controllers/authHelper");
const asyncHandler = require("../controllers/asyncHandler");
const { listNotifications, markRead, markAllRead } = require("../controllers/NotificationsController");

const notificationRouter = require("express").Router();

notificationRouter.get("/", verify, asyncHandler(listNotifications));
notificationRouter.post("/read-all", verify, asyncHandler(markAllRead));
notificationRouter.post("/:id/read", verify, asyncHandler(markRead));

module.exports = notificationRouter;
