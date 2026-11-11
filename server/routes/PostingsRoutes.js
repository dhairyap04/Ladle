const { verify, optionalAuth, requireDonor, requireFoodbank } = require("../controllers/authHelper");
const asyncHandler = require("../controllers/asyncHandler");
const {
  createPosting,
  getPostings,
  getMyPostings,
  getOnePost,
  claimPosting,
  markPickedUp,
  editPosting,
  cancelPosting,
  getPhoto,
} = require("../controllers/PostingsController");

const { listMessages, sendMessage } = require("../controllers/MessagesController");
const { getReceipt } = require("../controllers/ImpactController");
const rel = require("../controllers/ReliabilityController");

const postingRouter = require("express").Router();

postingRouter.post("/create", verify, requireDonor, asyncHandler(createPosting));
postingRouter.get("/all", optionalAuth, asyncHandler(getPostings));
postingRouter.get("/mine", verify, asyncHandler(getMyPostings));
postingRouter.get("/one/:id", asyncHandler(getOnePost));
postingRouter.get("/:id/photo", asyncHandler(getPhoto));
postingRouter.post("/:id/release", verify, requireFoodbank, asyncHandler(rel.releaseClaim));
postingRouter.post("/:id/no-show", verify, requireDonor, asyncHandler(rel.reportNoShow));
postingRouter.post("/:id/confirm-pickup", verify, requireDonor, asyncHandler(rel.confirmPickup));
postingRouter.get("/:id/ratings", verify, asyncHandler(rel.listRatings));
postingRouter.post("/:id/ratings", verify, asyncHandler(rel.rate));
postingRouter.get("/:id/receipt", verify, asyncHandler(getReceipt));
postingRouter.get("/:id/messages", verify, asyncHandler(listMessages));
postingRouter.post("/:id/messages", verify, asyncHandler(sendMessage));
postingRouter.post("/:id/claim", verify, requireFoodbank, asyncHandler(claimPosting));
postingRouter.post("/:id/picked-up", verify, requireFoodbank, asyncHandler(markPickedUp));
postingRouter.post("/:id/edit", verify, requireDonor, asyncHandler(editPosting));
postingRouter.post("/:id/cancel", verify, requireDonor, asyncHandler(cancelPosting));

module.exports = postingRouter;
