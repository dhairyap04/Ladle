const mongoUsers = require("./models/Users");
const mongoFoodPostings = require("./models/Postings");
const mongoPostingPhotos = require("./models/PostingPhotos");
const mongoNotifications = require("./models/Notifications");
const mongoMessages = require("./models/Messages");
const mongoRecurringSchedules = require("./models/RecurringSchedules");
const mongoDeliveries = require("./models/Deliveries");
const mongoReliabilityEvents = require("./models/ReliabilityEvents");
const mongoRatings = require("./models/Ratings");
const mongoPasswordResets = require("./models/PasswordResets");
const mongoPushSubscriptions = require("./models/PushSubscriptions");

// Older data may hold charitableTaxNum: null (which a sparse unique index still
// counts), and older databases have a non-sparse unique index on that field.
// Clear the nulls, then bring every collection's indexes in line with its schema.
const migrate = async () => {
  await mongoUsers.updateMany({ charitableTaxNum: null }, { $unset: { charitableTaxNum: "" } });
  // Accounts from before the role field: derive it from isFoodbank.
  await mongoUsers.updateMany({ role: { $exists: false }, isFoodbank: true }, { $set: { role: "foodbank" } });
  await mongoUsers.updateMany({ role: { $exists: false }, isFoodbank: { $ne: true } }, { $set: { role: "restaurant" } });
  await mongoUsers.syncIndexes();
  await mongoFoodPostings.syncIndexes();
  await mongoPostingPhotos.syncIndexes();
  await mongoNotifications.syncIndexes();
  await mongoMessages.syncIndexes();
  await mongoRecurringSchedules.syncIndexes();
  await mongoDeliveries.syncIndexes();
  await mongoReliabilityEvents.syncIndexes();
  await mongoRatings.syncIndexes();
  await mongoPasswordResets.syncIndexes();
  await mongoPushSubscriptions.syncIndexes();
};

module.exports = { migrate };
