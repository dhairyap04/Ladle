const { verify, requireDonor, requireFoodbank } = require("../controllers/authHelper");
const asyncHandler = require("../controllers/asyncHandler");
const {
  createPosting,
  getPostings,
  getOnePost,
  claimPosting,
  cancelPosting,
} = require("../controllers/PostingsController");

const postingRouter = require("express").Router();

postingRouter.post("/create", verify, requireDonor, asyncHandler(createPosting));
postingRouter.get("/all", asyncHandler(getPostings));
postingRouter.get("/one/:id", asyncHandler(getOnePost));
postingRouter.post("/:id/claim", verify, requireFoodbank, asyncHandler(claimPosting));
postingRouter.post("/:id/cancel", verify, requireDonor, asyncHandler(cancelPosting));

module.exports = postingRouter;
