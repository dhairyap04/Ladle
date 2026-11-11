// Base Import
var mainRouter = require('express').Router();

const postingRouter = require('./PostingsRoutes');
const userRouter = require("./UserRoutes");
const notificationRouter = require("./NotificationRoutes");
const scheduleRouter = require("./ScheduleRoutes");
const impactRouter = require("./ImpactRoutes");

mainRouter.use('/user', userRouter);
mainRouter.use('/posting', postingRouter);
mainRouter.use('/notification', notificationRouter);
mainRouter.use('/schedule', scheduleRouter);
mainRouter.use('/impact', impactRouter);

module.exports = mainRouter;
