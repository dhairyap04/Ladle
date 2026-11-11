const mongoUsers = require("./models/Users");
const mongoFoodPostings = require("./models/Postings");
const mongoPostingPhotos = require("./models/PostingPhotos");
const mongoNotifications = require("./models/Notifications");
const mongoMessages = require("./models/Messages");

// Older data may hold charitableTaxNum: null (which a sparse unique index still
// counts), and older databases have a non-sparse unique index on that field.
// Clear the nulls, then bring every collection's indexes in line with its schema.
const migrate = async () => {
  await mongoUsers.updateMany({ charitableTaxNum: null }, { $unset: { charitableTaxNum: "" } });
  await mongoUsers.syncIndexes();
  await mongoFoodPostings.syncIndexes();
  await mongoPostingPhotos.syncIndexes();
  await mongoNotifications.syncIndexes();
  await mongoMessages.syncIndexes();
};

module.exports = { migrate };
