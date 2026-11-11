// Base Import
var mainRouter = require('express').Router();

const postingRouter = require('./PostingsRoutes');
const userRouter = require("./UserRoutes");
const notificationRouter = require("./NotificationRoutes");
const scheduleRouter = require("./ScheduleRoutes");
const impactRouter = require("./ImpactRoutes");
const adminRouter = require("./AdminRoutes");
const deliveryRouter = require("./DeliveryRoutes");

mainRouter.use('/user', userRouter);
mainRouter.use('/posting', postingRouter);
mainRouter.use('/notification', notificationRouter);
mainRouter.use('/schedule', scheduleRouter);
mainRouter.use('/impact', impactRouter);
mainRouter.use('/admin', adminRouter);
mainRouter.use('/delivery', deliveryRouter);

module.exports = mainRouter;
