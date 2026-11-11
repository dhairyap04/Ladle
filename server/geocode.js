// Turns addresses into coordinates with the Google Geocoding API, once when a
// posting or profile is saved, so the client doesn't geocode on every visit.
// Without GOOGLE_MAPS_API_KEY nothing is geocoded, and distance search simply
// has no coordinates to work with.
const { googleMapsApiKey } = require("./config");

const cache = new Map();

async function googleGeocode(address) {
  if (!googleMapsApiKey) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("region", "ca");
  url.searchParams.set("key", googleMapsApiKey);
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  const body = await res.json();
  if (body.status !== "OK" || !body.results.length) return null;
  const { lat, lng } = body.results[0].geometry.location;
  return { lat, lng };
}

let geocoder = googleGeocode;

// Resolves to a GeoJSON point, or undefined when the address can't be found.
// Never throws: a failed lookup only means no distance for that address.
async function geocodeToPoint(address) {
  const key = (address || "").trim().toLowerCase();
  if (!key) return undefined;
  if (!cache.has(key)) {
    let result = null;
    try {
      result = await geocoder(address);
    } catch (err) {
      console.error("Geocoding failed:", err.message);
    }
    if (!result) return undefined; // don't cache failures; the next save retries
    cache.set(key, result);
  }
  const { lat, lng } = cache.get(key);
  return { type: "Point", coordinates: [lng, lat] };
}

// Great-circle distance in kilometres between two [lng, lat] pairs.
function distanceKm([lng1, lat1], [lng2, lat2]) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// Tests and local development can swap in a fake geocoder.
function setGeocoder(fn) {
  geocoder = fn || googleGeocode;
  cache.clear();
}

module.exports = { geocodeToPoint, distanceKm, setGeocoder };
