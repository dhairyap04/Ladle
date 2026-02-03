// Base Import
var mainRouter = require('express').Router();

const postingRouter = require('./PostingsRoutes');
const userRouter = require("./UserRoutes");

mainRouter.use('/user', userRouter);
mainRouter.use('/posting', postingRouter);

module.exports = mainRouter;
