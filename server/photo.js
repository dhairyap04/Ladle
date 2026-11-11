// Photo uploads arrive as data URLs from the client (already resized there).
const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// "data:image/jpeg;base64,..." -> { contentType, data } or { error }.
const parsePhoto = (dataUrl) => {
  const match = typeof dataUrl === "string" && /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match || !PHOTO_TYPES.includes(match[1])) {
    return { error: "Photos must be JPEG, PNG or WebP images." };
  }
  const data = Buffer.from(match[2], "base64");
  if (data.length > MAX_PHOTO_BYTES) return { error: "That photo is too large. Please use one under 1.5 MB." };
  return { contentType: match[1], data };
};

module.exports = { parsePhoto, MAX_PHOTO_BYTES, PHOTO_TYPES };
