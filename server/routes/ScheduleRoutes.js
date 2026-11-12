const { verify, requireDonor } = require("../controllers/authHelper");
const asyncHandler = require("../controllers/asyncHandler");
const {
  createSchedule,
  listSchedules,
  editSchedule,
  pauseSchedule,
  resumeSchedule,
  deleteSchedule,
} = require("../controllers/ScheduleController");

const scheduleRouter = require("express").Router();

scheduleRouter.use(verify, requireDonor);
scheduleRouter.post("/", asyncHandler(createSchedule));
scheduleRouter.get("/mine", asyncHandler(listSchedules));
scheduleRouter.post("/:id/edit", asyncHandler(editSchedule));
scheduleRouter.post("/:id/pause", asyncHandler(pauseSchedule));
scheduleRouter.post("/:id/resume", asyncHandler(resumeSchedule));
scheduleRouter.post("/:id/delete", asyncHandler(deleteSchedule));

module.exports = scheduleRouter;
