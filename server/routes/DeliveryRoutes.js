const { verify, requireDriver, requireFoodbank } = require("../controllers/authHelper");
const asyncHandler = require("../controllers/asyncHandler");
const d = require("../controllers/DeliveriesController");

const deliveryRouter = require("express").Router();

deliveryRouter.use(verify);
deliveryRouter.post("/", requireFoodbank, asyncHandler(d.requestDelivery));
deliveryRouter.get("/available", requireDriver, asyncHandler(d.listAvailable));
deliveryRouter.get("/mine", asyncHandler(d.listMine));
deliveryRouter.get("/for-posting/:postingId", asyncHandler(d.getForPosting));
deliveryRouter.post("/:id/accept", requireDriver, asyncHandler(d.acceptDelivery));
deliveryRouter.post("/:id/release", requireDriver, asyncHandler(d.releaseDelivery));
deliveryRouter.post("/:id/picked-up", requireDriver, asyncHandler(d.markCollected));
deliveryRouter.post("/:id/delivered", requireDriver, asyncHandler(d.markDelivered));
deliveryRouter.post("/:id/cancel", requireFoodbank, asyncHandler(d.cancelDelivery));
deliveryRouter.get("/:id/messages", asyncHandler(d.listDeliveryMessages));
deliveryRouter.post("/:id/messages", asyncHandler(d.sendDeliveryMessage));

module.exports = deliveryRouter;
