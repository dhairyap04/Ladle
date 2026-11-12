import { Button } from "@mui/material";
import DirectionsRoundedIcon from "@mui/icons-material/DirectionsRounded";
import { directionsUrl } from "../../directions";

// Opens directions to `address` in the maps app.
const DirectionsButton = ({ address, label = "Directions", ...props }) => (
  <Button
    size="small"
    variant="outlined"
    startIcon={<DirectionsRoundedIcon />}
    href={directionsUrl(address)}
    target="_blank"
    rel="noopener noreferrer"
    {...props}
  >
    {label}
  </Button>
);

export default DirectionsButton;
