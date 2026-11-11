// Base Import
var mainRouter = require('express').Router();

const postingRouter = require('./PostingsRoutes');
const userRouter = require("./UserRoutes");
const notificationRouter = require("./NotificationRoutes");

mainRouter.use('/user', userRouter);
mainRouter.use('/posting', postingRouter);
mainRouter.use('/notification', notificationRouter);

module.exports = mainRouter;
