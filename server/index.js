const mongoose = require("mongoose");

const { mongoUri, port } = require("./config");
const app = require("./app");
const { migrate } = require("./migrate");

mongoose
  .connect(mongoUri, { autoIndex: false })
  .then(migrate)
  .then(() => app.listen(port, () => console.log(`Server running on port ${port}; MongoDB connected`)))
  .catch((error) => {
    console.error(`Error on server start: ${error.message}`);
    process.exit(1);
  });
