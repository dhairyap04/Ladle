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

const postingRouter = require("express").Router();

postingRouter.post("/create", verify, requireDonor, asyncHandler(createPosting));
postingRouter.get("/all", optionalAuth, asyncHandler(getPostings));
postingRouter.get("/mine", verify, asyncHandler(getMyPostings));
postingRouter.get("/one/:id", asyncHandler(getOnePost));
postingRouter.get("/:id/photo", asyncHandler(getPhoto));
postingRouter.get("/:id/receipt", verify, asyncHandler(getReceipt));
postingRouter.get("/:id/messages", verify, asyncHandler(listMessages));
postingRouter.post("/:id/messages", verify, asyncHandler(sendMessage));
postingRouter.post("/:id/claim", verify, requireFoodbank, asyncHandler(claimPosting));
postingRouter.post("/:id/picked-up", verify, requireFoodbank, asyncHandler(markPickedUp));
postingRouter.post("/:id/edit", verify, requireDonor, asyncHandler(editPosting));
postingRouter.post("/:id/cancel", verify, requireDonor, asyncHandler(cancelPosting));

module.exports = postingRouter;
