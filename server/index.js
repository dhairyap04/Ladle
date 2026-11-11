const mongoose = require("mongoose");

const { mongoUri, port } = require("./config");
const app = require("./app");
const mongoUsers = require("./models/Users");
const mongoFoodPostings = require("./models/Postings");

// Older data may hold charitableTaxNum: null (which a sparse unique index still
// counts), and older databases have a non-sparse unique index on that field.
// Clear the nulls, then bring indexes in line with the schemas.
const migrate = async () => {
  await mongoUsers.updateMany({ charitableTaxNum: null }, { $unset: { charitableTaxNum: "" } });
  await mongoUsers.syncIndexes();
  await mongoFoodPostings.syncIndexes();
};

mongoose
  .connect(mongoUri, { autoIndex: false })
  .then(migrate)
  .then(() => app.listen(port, () => console.log(`Server running on port ${port}; MongoDB connected`)))
  .catch((error) => {
    console.error(`Error on server start: ${error.message}`);
    process.exit(1);
  });
