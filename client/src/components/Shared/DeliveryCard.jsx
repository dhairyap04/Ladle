import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import VolunteerActivismRoundedIcon from "@mui/icons-material/VolunteerActivismRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import api, { errorMessage } from "../../api";
import { formatPickupWindow } from "../../time";
import { STORAGE } from "../../food";
import { VEHICLES } from "../../roles";
import ReliabilityBadge from "./ReliabilityBadge";
import DeliveryChat from "./DeliveryChat";

export const DELIVERY_STATUS = {
  requested: { label: "Looking for a driver", sx: { bgcolor: "#FFF1D6", color: "#7A4700" } },
  accepted: { label: "Driver assigned", sx: { bgcolor: "primary.light", color: "primary.dark" } },
  picked_up: { label: "On the way", sx: { bgcolor: "primary.light", color: "primary.dark" } },
  delivered: { label: "Delivered", sx: { bgcolor: "primary.dark", color: "#fff" } },
  cancelled: { label: "Cancelled", sx: { bgcolor: "#EEECE8", color: "#4F5753" } },
  expired: { label: "No driver found", sx: { bgcolor: "#EEECE8", color: "#4F5753" } },
  missed: { label: "Driver didn't collect", sx: { bgcolor: "#FDE7E7", color: "#8A1C1C" } },
};

const DRIVER_FIT = {
  too_heavy: "More than you can carry",
  needs_cooler: "Needs a cooler",
  too_far: "Outside your area",
  day: "Not on a day you're available",
  hours: "Outside your hours",
};

// What each action does, with the confirmation shown before it runs.
const ACTIONS = {
  accept: { label: "Accept delivery", confirm: "Accept this delivery?", body: "You're committing to collect the food during the pickup window and bring it to the food bank." },
  "picked-up": { label: "I've collected the food", confirm: "Collected the food?", body: "The restaurant and food bank will be told it's on the way." },
  delivered: { label: "Mark delivered", confirm: "Delivered the food?", body: "Confirm you've dropped the food off at the food bank." },
  release: { label: "I can't make it", confirm: "Give this delivery back?", body: "We'll ask other drivers to take it. Backing out within 2 hours of the pickup window counts against your reliability." },
  cancel: { label: "Cancel driver request", confirm: "Cancel the driver request?", body: "Drivers will no longer see this delivery. If a driver has accepted, they'll be told." },
};

const Contact = ({ icon: Icon, label, person }) =>
  person ? (
    <Stack direction="row" spacing={1} alignItems="center">
      <Icon fontSize="small" sx={{ color: "primary.main" }} />
      <Typography variant="body2">
        <strong>{person.name}</strong>
        <Box component="span" sx={{ color: "text.secondary" }}> · {label}</Box>
        {person.vehicle && <Box component="span" sx={{ color: "text.secondary" }}> · {VEHICLES[person.vehicle]}</Box>}
        {person.phoneNumber && <> · <Link href={`tel:${person.phoneNumber}`}>{person.phoneNumber}</Link></>}
      </Typography>
    </Stack>
  ) : null;

// A delivery job. `viewer` is "driver" or "foodbank" (actions) or "restaurant" (read-only).
const DeliveryCard = ({ delivery, viewer, onChanged, showPostingLink = false, title, userId }) => {
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = DELIVERY_STATUS[delivery.status];

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api.post(`delivery/${delivery._id}/${confirming}`);
      setConfirming(null);
      onChanged && onChanged(res.data);
    } catch (err) {
      setError(errorMessage(err));
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  };

  const actions = [];
  if (viewer === "driver") {
    if (delivery.status === "requested") actions.push("accept");
    if (delivery.status === "accepted") actions.push("picked-up", "release");
    if (delivery.status === "picked_up") actions.push("delivered");
  }
  if (viewer === "foodbank" && ["requested", "accepted"].includes(delivery.status)) actions.push("cancel");

  const facts = [
    delivery.quantity,
    delivery.estimatedWeightKg ? `about ${delivery.estimatedWeightKg} kg` : "",
    delivery.storage && delivery.storage !== "ambient" ? STORAGE[delivery.storage].short : "",
    delivery.distanceKm !== undefined ? `${delivery.distanceKm} km from you` : "",
    delivery.tripKm !== undefined ? `${delivery.tripKm} km trip` : "",
  ].filter(Boolean).join(" · ");

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 4 }}>
      {title && <Typography component="h2" variant="h6" sx={{ mb: 1 }}>{title}</Typography>}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
        <Chip size="small" label={status.label} sx={status.sx} />
        {(delivery.fitProblems || []).slice(0, 1).map((p) => (
          <Chip key={p} size="small" label={DRIVER_FIT[p]} sx={{ bgcolor: "#FFF1D6", color: "#7A4700" }} />
        ))}
      </Stack>

      <Stack spacing={0.75} sx={{ mt: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <StorefrontRoundedIcon fontSize="small" sx={{ color: "#A34F06", mt: "2px" }} />
          <Typography variant="body2"><strong>From {delivery.restaurantName}</strong> · {delivery.pickupAddress}</Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <VolunteerActivismRoundedIcon fontSize="small" sx={{ color: "primary.main", mt: "2px" }} />
          <Typography variant="body2"><strong>To {delivery.foodBankName}</strong> · {delivery.dropoffAddress}</Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "primary.dark" }}>
          <ScheduleRoundedIcon fontSize="small" />
          <Typography variant="body2" sx={{ fontWeight: 700 }}>Pick up {formatPickupWindow(delivery)}</Typography>
        </Stack>
        {facts && <Typography variant="body2" color="text.secondary">{facts}</Typography>}
        {delivery.notes && <Typography variant="body2" color="text.secondary">Note from the food bank: {delivery.notes}</Typography>}
      </Stack>

      {delivery.contacts && (
        <Stack spacing={0.75} sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: "primary.light" }}>
          {viewer !== "driver" && <Contact icon={LocalShippingRoundedIcon} label="driver" person={delivery.contacts.driver} />}
          {viewer !== "restaurant" && <Contact icon={StorefrontRoundedIcon} label="restaurant" person={delivery.contacts.restaurant} />}
          {viewer !== "foodbank" && <Contact icon={VolunteerActivismRoundedIcon} label="food bank" person={delivery.contacts.foodBank} />}
          {delivery.driverReliability && <ReliabilityBadge summary={delivery.driverReliability} noun="delivery" />}
        </Stack>
      )}
      {delivery.contacts && userId && <DeliveryChat deliveryId={delivery._id} userId={userId} />}

      {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
      {(actions.length > 0 || showPostingLink) && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
          {actions.map((a, i) => (
            <Button
              key={a}
              variant={i === 0 && !["release", "cancel"].includes(a) ? "contained" : "outlined"}
              color={["release", "cancel"].includes(a) ? "error" : "primary"}
              onClick={() => setConfirming(a)}
              disabled={busy || (a === "accept" && (delivery.fitProblems || []).includes("too_heavy"))}
            >
              {ACTIONS[a].label}
            </Button>
          ))}
          {showPostingLink && (
            <Button component={RouterLink} to={`/view_post/${delivery.postingId}`} color="inherit">View posting</Button>
          )}
        </Stack>
      )}

      <Dialog open={Boolean(confirming)} onClose={() => !busy && setConfirming(null)}>
        {confirming && (
          <>
            <DialogTitle>{ACTIONS[confirming].confirm}</DialogTitle>
            <DialogContent><DialogContentText>{ACTIONS[confirming].body}</DialogContentText></DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setConfirming(null)} disabled={busy}>Go back</Button>
              <Button variant="contained" color={["release", "cancel"].includes(confirming) ? "error" : "primary"} onClick={run} disabled={busy}>
                {ACTIONS[confirming].label}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Paper>
  );
};

export default DeliveryCard;
