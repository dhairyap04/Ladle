import Geocode from "react-geocode";

// Google Geocoding settings for postings the server couldn't geocode.
Geocode.setApiKey(import.meta.env.REACT_APP_GCP_KEY);
Geocode.setLanguage("en");
Geocode.setRegion("ca");

// Map pins for postings. Uses the coordinates the server stored, and only
// geocodes in the browser for postings without them (e.g. older postings).
// "Harvest Table · Jasper Ave" tells two branches' pins apart.
const pinName = (posting) =>
  posting.pickupLocationName ? `${posting.fromRestaurantName} · ${posting.pickupLocationName}` : posting.fromRestaurantName;

export async function mapPoints(postings) {
  const points = await Promise.all(
    postings.map(async (posting) => {
      const coords = posting.location && posting.location.coordinates;
      if (coords && coords.length === 2) {
        return { lat: coords[1], lng: coords[0], name: pinName(posting) };
      }
      if (!import.meta.env.REACT_APP_GCP_KEY) return null;
      try {
        const geo = await Geocode.fromAddress(posting.fromRestaurantAddress);
        const { lat, lng } = geo.results[0].geometry.location;
        return { lat, lng, name: pinName(posting) };
      } catch {
        return null; // an address Google can't find just has no pin
      }
    })
  );
  return points.filter(Boolean);
}
