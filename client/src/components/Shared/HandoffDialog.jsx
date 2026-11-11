import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MyLocationRoundedIcon from "@mui/icons-material/MyLocationRounded";
import LocationOffRoundedIcon from "@mui/icons-material/LocationOffRounded";
import api, { errorMessage } from "../../api";
import { resizePhoto } from "../../photo";

const COPY = {
  pickup: {
    title: "Collect the food",
    ask: (d) => <>Ask <strong>{d.restaurantName}</strong> for their 4-digit handoff code. It shows you picked the food up.</>,
    noCode: "If they don't have it, take a photo of the food instead. The restaurant will be told you collected without the code.",
    submit: "I've collected the food",
    path: "picked-up",
  },
  dropoff: {
    title: "Drop off the food",
    ask: (d) => <>Ask <strong>{d.foodBankName}</strong> for their 4-digit drop-off code. It confirms the delivery straight away.</>,
    noCode: "If nobody has the code, take a photo of the food where you left it. The food bank will be asked to confirm it arrived.",
    submit: "Mark delivered",
    path: "delivered",
  },
};

// Asks the phone where it is once, so the server can check the driver is at
// the address. Never blocks: a refusal or timeout just means "not shared".
function useLocationOnce(active) {
  const [state, setState] = useState({ status: "idle" });
  useEffect(() => {
    if (!active) return undefined;
    if (!("geolocation" in navigator)) {
      setState({ status: "unavailable" });
      return undefined;
    }
    let cancelled = false;
    setState({ status: "checking" });
    navigator.geolocation.getCurrentPosition(
      (pos) => !cancelled && setState({
        status: "ok",
        location: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy },
      }),
      () => !cancelled && setState({ status: "unavailable" }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
    return () => { cancelled = true; };
  }, [active]);
  return state;
}

// The driver's step at the restaurant ("pickup") or the food bank ("dropoff"):
// enter the other person's code, or add a photo.
const HandoffDialog = ({ delivery, stage, open, onClose, onDone }) => {
  const copy = COPY[stage];
  const [code, setCode] = useState("");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const place = useLocationOnce(open);

  useEffect(() => {
    if (open) {
      setCode("");
      setPhoto(null);
      setError("");
    }
  }, [open]);

  const choosePhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await resizePhoto(file);
      if (!dataUrl) setError("Please choose an image.");
      else {
        setPhoto(dataUrl);
        setError("");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const ready = code.length === 4 || Boolean(photo);

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      const body = {};
      if (code.length === 4) body.code = code;
      if (photo) body.photo = photo;
      if (place.location) body.location = place.location;
      const res = await api.post(`delivery/${delivery._id}/${copy.path}`, body);
      onDone(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={submit}>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>{copy.ask(delivery)}</DialogContentText>
          <TextField
            fullWidth
            label="Handoff code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputProps={{
              inputMode: "numeric",
              autoComplete: "one-time-code",
              maxLength: 4,
              style: { fontSize: "1.75rem", letterSpacing: "0.5em", textAlign: "center", fontWeight: 800 },
            }}
          />

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5, mb: 1 }}>
            <strong>No code?</strong> {copy.noCode}
          </Typography>
          {photo ? (
            <Box sx={{ position: "relative", width: 120 }}>
              <Box component="img" src={photo} alt="Photo of the food" sx={{ width: 120, height: 90, objectFit: "cover", borderRadius: 2, display: "block" }} />
              <IconButton
                size="small"
                aria-label="Remove photo"
                onClick={() => setPhoto(null)}
                sx={{ position: "absolute", top: 4, right: 4, bgcolor: "rgba(255,255,255,0.9)", "&:hover": { bgcolor: "#fff" } }}
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Button variant="outlined" startIcon={<PhotoCameraRoundedIcon />} onClick={() => fileRef.current && fileRef.current.click()}>
              Take a photo of the food
            </Button>
          )}
          <input ref={fileRef} hidden type="file" accept="image/*" capture="environment" onChange={choosePhoto} />

          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 2, color: "text.secondary" }} aria-live="polite">
            {place.status === "ok" ? <MyLocationRoundedIcon fontSize="small" sx={{ color: "primary.main" }} /> : <LocationOffRoundedIcon fontSize="small" />}
            <Typography variant="caption">
              {place.status === "checking" && "Checking your location…"}
              {place.status === "ok" && "Your location will be checked against the address. Only the result is kept."}
              {place.status === "unavailable" && "Location not shared. That's OK, you can still continue."}
            </Typography>
          </Stack>

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={busy}>Go back</Button>
          <Button type="submit" variant="contained" disabled={busy || !ready}>{copy.submit}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default HandoffDialog;
