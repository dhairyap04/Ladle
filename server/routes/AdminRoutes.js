const { verify, requireAdmin } = require("../controllers/authHelper");
const asyncHandler = require("../controllers/asyncHandler");
const { getOverview, listUsers, decideVerification, listDeliveries, resolveDelivery } = require("../controllers/AdminController");

const adminRouter = require("express").Router();

adminRouter.use(verify, requireAdmin);
adminRouter.get("/overview", asyncHandler(getOverview));
adminRouter.get("/users", asyncHandler(listUsers));
adminRouter.post("/users/:id/verification", asyncHandler(decideVerification));
adminRouter.get("/deliveries", asyncHandler(listDeliveries));
adminRouter.post("/deliveries/:id/resolve", asyncHandler(resolveDelivery));

module.exports = adminRouter;
