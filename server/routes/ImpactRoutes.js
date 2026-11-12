const { verify } = require("../controllers/authHelper");
const asyncHandler = require("../controllers/asyncHandler");
const { getImpact, exportDonations } = require("../controllers/ImpactController");

const impactRouter = require("express").Router();

impactRouter.get("/", verify, asyncHandler(getImpact));
impactRouter.get("/donations.csv", verify, asyncHandler(exportDonations));

module.exports = impactRouter;
