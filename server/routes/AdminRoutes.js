const { verify, requireAdmin } = require("../controllers/authHelper");
const asyncHandler = require("../controllers/asyncHandler");
const { getOverview, listUsers, decideVerification } = require("../controllers/AdminController");

const adminRouter = require("express").Router();

adminRouter.use(verify, requireAdmin);
adminRouter.get("/overview", asyncHandler(getOverview));
adminRouter.get("/users", asyncHandler(listUsers));
adminRouter.post("/users/:id/verification", asyncHandler(decideVerification));

module.exports = adminRouter;
