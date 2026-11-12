import GoogleMapReact from "google-map-react";
import { Box, Typography } from "@mui/material";
import MapRoundedIcon from "@mui/icons-material/MapRounded";

const MAPS_KEY = import.meta.env.REACT_APP_GCP_KEY;

// Pages leave out the map entirely when there's no key, rather than showing
// an empty panel.
export const mapsEnabled = Boolean(MAPS_KEY);
const DEFAULT_CENTER = { lat: 53.5052, lng: -113.4938 }; // Edmonton
const DEFAULT_ZOOM = 11;

// A brand-coloured pin with the restaurant's name. google-map-react positions
// it from the lat/lng props.
const Pin = ({ text }) => (
  <Box sx={{ position: "absolute", transform: "translate(-50%, -100%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
    <Box
      sx={{
        bgcolor: "#fff",
        color: "primary.dark",
        border: 1,
        borderColor: "divider",
        borderRadius: 999,
        px: 1.25,
        py: 0.25,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
      }}
    >
      {text}
    </Box>
    <svg width="26" height="34" viewBox="0 0 28 38" aria-hidden="true">
      <path d="M14 0a14 14 0 0 1 14 14c0 11-14 24-14 24S0 25 0 14A14 14 0 0 1 14 0Z" fill="#1B6B4A" />
      <circle cx="14" cy="14" r="5" fill="#fff" />
    </svg>
  </Box>
);

const SimpleMap = ({ latlng }) => {
  if (!MAPS_KEY) {
    return (
      <Box sx={{ height: "100%", display: "grid", placeItems: "center", textAlign: "center", p: 3, bgcolor: "primary.light", color: "primary.dark" }}>
        <Box>
          <MapRoundedIcon sx={{ fontSize: 40 }} />
          <Typography sx={{ fontWeight: 700, mt: 1 }}>Map unavailable</Typography>
          <Typography variant="body2" color="text.secondary">Pickup addresses are listed on each posting.</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <GoogleMapReact
      defaultCenter={DEFAULT_CENTER}
      defaultZoom={DEFAULT_ZOOM}
      bootstrapURLKeys={{ key: MAPS_KEY }}
      options={{ fullscreenControl: false, clickableIcons: false }}
    >
      {latlng.map((point, index) => (
        <Pin key={index} lat={point.lat} lng={point.lng} text={point.name} />
      ))}
    </GoogleMapReact>
  );
};

export default SimpleMap;
