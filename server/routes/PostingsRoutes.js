const { verify } = require("../controllers/authHelper");
const { createPosting, getPostings, getOnePost, deleteOnePost } = require("../controllers/PostingsController");

const postingRouter = require("express").Router();

postingRouter.post("/create", verify, createPosting);
postingRouter.get("/all", getPostings);
postingRouter.get("/one/:id", getOnePost);
postingRouter.post("/delete", deleteOnePost);

// userRouter.post("/edit", updateUser);

module.exports = postingRouter;