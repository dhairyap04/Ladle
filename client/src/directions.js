import { isIos } from "./pwa";

// A link that opens turn-by-turn directions in the phone's maps app: Apple
// Maps on iPhone and iPad, Google Maps everywhere else (its app opens if
// installed, otherwise the website).
export function directionsUrl(address) {
  const dest = encodeURIComponent(address || "");
  return isIos()
    ? `https://maps.apple.com/?daddr=${dest}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}
