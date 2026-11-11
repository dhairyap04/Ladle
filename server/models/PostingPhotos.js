const mongoose = require("mongoose");

// One photo per posting, kept out of the postings collection so listing
// postings never loads image bytes.
const PostingPhotosSchema = new mongoose.Schema(
  {
    postingId: { type: mongoose.Schema.Types.ObjectId, ref: "FoodPostings", required: true, unique: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PostingPhotos", PostingPhotosSchema, "PostingPhotos");
