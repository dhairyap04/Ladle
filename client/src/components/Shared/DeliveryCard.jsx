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
  TextField,
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
import HandoffDialog from "./HandoffDialog";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";

export const DELIVERY_STATUS = {
  requested: { label: "Looking for a driver", sx: { bgcolor: "#FFF1D6", color: "#7A4700" } },
  accepted: { label: "Driver assigned", sx: { bgcolor: "primary.light", color: "primary.dark" } },
  picked_up: { label: "On the way", sx: { bgcolor: "primary.light", color: "primary.dark" } },
  delivered: { label: "Delivered", sx: { bgcolor: "primary.dark", color: "#fff" } },
  cancelled: { label: "Cancelled", sx: { bgcolor: "#EEECE8", color: "#4F5753" } },
  expired: { label: "No driver found", sx: { bgcolor: "#EEECE8", color: "#4F5753" } },
  missed: { label: "Driver didn't collect", sx: { bgcolor: "#FDE7E7", color: "#8A1C1C" } },
};

// How the food bank's receipt was established, shown next to "Delivered".
const RECEIPT = {
  confirmed: { label: "Confirmed", sx: { bgcolor: "primary.light", color: "primary.dark" } },
  pending: { label: "Waiting for the food bank to confirm", sx: { bgcolor: "#FFF1D6", color: "#7A4700" } },
  assumed: { label: "Not confirmed", sx: { bgcolor: "#EEECE8", color: "#4F5753" } },
  disputed: { label: "Problem reported", sx: { bgcolor: "#FDE7E7", color: "#8A1C1C" } },
};

const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const day = (iso) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });

const photoUrl = (delivery, stage) => `${import.meta.env.REACT_APP_HOST_URL}delivery/${delivery._id}/photo/${stage}`;

// One line of evidence: when, how, and whether the driver was at the address.
const ProofLine = ({ delivery, stage }) => {
  const proof = delivery[`${stage}Proof`];
  if (!proof || !proof.at) return null;
  const who = stage === "pickup" ? "the restaurant" : "the food bank";
  const parts = [
    `${stage === "pickup" ? "Collected" : "Dropped off"} ${day(proof.at)}, ${time(proof.at)}`,
    proof.method === "code" ? `with ${who}'s code` : "with a photo, no code",
    proof.location === "near" ? `at ${who}` : proof.location === "far" ? `${(proof.distanceM / 1000).toFixed(1)} km from ${who}` : "location not shared",
  ];
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {proof.method === "code"
        ? <VerifiedRoundedIcon fontSize="small" sx={{ color: "primary.main" }} />
        : <PhotoCameraRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} />}
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{parts.join(" · ")}</Typography>
      {proof.hasPhoto && (
        <Link href={photoUrl(delivery, stage)} target="_blank" rel="noopener noreferrer" aria-label={`${stage === "pickup" ? "Pickup" : "Drop-off"} photo`}>
          <Box component="img" src={photoUrl(delivery, stage)} alt="" sx={{ width: 44, height: 44, objectFit: "cover", borderRadius: 1.5, display: "block" }} />
        </Link>
      )}
    </Stack>
  );
};

// The code the restaurant or food bank reads out to the driver.
const HandoffCode = ({ delivery, viewer }) => (
  <Box sx={{ mt: 1.5, p: 2, borderRadius: 3, border: 2, borderColor: "secondary.main", bgcolor: "#FFF8EF" }}>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1, sm: 2.5 }} alignItems={{ sm: "center" }}>
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 700, color: "#A34F06", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {viewer === "restaurant" ? "Your pickup code" : "Your drop-off code"}
        </Typography>
        <Typography aria-label={`Code ${delivery.handoffCode.split("").join(" ")}`} sx={{ fontSize: "2.25rem", fontWeight: 800, letterSpacing: "0.3em", lineHeight: 1.1, color: "text.primary" }}>
          {delivery.handoffCode}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary">
        {viewer === "restaurant"
          ? <>Give this to {delivery.driverName || "the driver"} when they collect the food. It confirms they picked it up.</>
          : <>Give this to {delivery.driverName || "the driver"} when the food arrives. It confirms the delivery. Don&apos;t share it before then.</>}
      </Typography>
    </Stack>
  </Box>
);

const REPORT = {
  dropoff: {
    button: "It didn't arrive",
    title: "Report that the food didn't arrive?",
    body: (d) => `This counts against ${d.driverName}'s reliability until a Ladle admin looks into it. If it's just late, try the delivery chat first.`,
  },
  pickup: {
    button: "They didn't collect it",
    title: "Report that the driver didn't collect the food?",
    body: (d) => `${d.driverName} marked it collected without your pickup code. This counts against their reliability until a Ladle admin looks into it.`,
  },
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
  const [handoff, setHandoff] = useState(null); // "pickup" | "dropoff"
  const [reporting, setReporting] = useState(null); // "pickup" | "dropoff"
  const [reportNote, setReportNote] = useState("");
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

  const sendReport = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api.post(`delivery/${delivery._id}/report`, { stage: reporting, note: reportNote });
      setReporting(null);
      setReportNote("");
      onChanged && onChanged(res.data);
    } catch (err) {
      setError(errorMessage(err));
      setReporting(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmReceipt = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api.post(`delivery/${delivery._id}/confirm`);
      onChanged && onChanged(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openDispute = delivery.dispute && delivery.dispute.at && !delivery.dispute.resolution;
  const resolved = delivery.dispute && delivery.dispute.resolution;
  const receipt = delivery.status === "delivered" || openDispute ? RECEIPT[delivery.receipt] : null;

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
        {receipt && <Chip size="small" label={receipt.label} sx={receipt.sx} />}
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
      {delivery.handoffCode && <HandoffCode delivery={delivery} viewer={viewer} />}

      {(delivery.pickupProof || delivery.dropoffProof) && (
        <Stack spacing={0.75} sx={{ mt: 1.5 }}>
          <ProofLine delivery={delivery} stage="pickup" />
          <ProofLine delivery={delivery} stage="dropoff" />
        </Stack>
      )}

      {delivery.canConfirm && !openDispute && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          <strong>Did this arrive?</strong> {delivery.driverName} marked it delivered without your drop-off code.
          Please confirm, so they&apos;re credited for the delivery.
        </Alert>
      )}
      {openDispute && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          <strong>Problem reported</strong>
          {delivery.dispute.note ? `: "${delivery.dispute.note}"` : "."} A Ladle admin will look into it.
          {delivery.canConfirm && " If the food has turned up, confirm it below."}
        </Alert>
      )}
      {resolved && (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          Reviewed by Ladle: counted as {delivery.dispute.resolution === "delivered" ? "delivered" : "not delivered"}.
        </Alert>
      )}

      {delivery.contacts && userId && <DeliveryChat deliveryId={delivery._id} userId={userId} />}

      {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
      {(delivery.canConfirm || delivery.canReportDropoff || delivery.canReportPickup) && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
          {delivery.canConfirm && (
            <Button variant="contained" onClick={confirmReceipt} disabled={busy}>Yes, it arrived</Button>
          )}
          {delivery.canReportDropoff && (
            <Button variant="outlined" color="error" onClick={() => setReporting("dropoff")} disabled={busy}>{REPORT.dropoff.button}</Button>
          )}
          {delivery.canReportPickup && (
            <Button variant="outlined" color="error" onClick={() => setReporting("pickup")} disabled={busy}>{REPORT.pickup.button}</Button>
          )}
        </Stack>
      )}
      {(actions.length > 0 || showPostingLink) && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
          {actions.map((a, i) => (
            <Button
              key={a}
              variant={i === 0 && !["release", "cancel"].includes(a) ? "contained" : "outlined"}
              color={["release", "cancel"].includes(a) ? "error" : "primary"}
              onClick={() => (a === "picked-up" ? setHandoff("pickup") : a === "delivered" ? setHandoff("dropoff") : setConfirming(a))}
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

      {viewer === "driver" && (
        <HandoffDialog
          delivery={delivery}
          stage={handoff || "pickup"}
          open={Boolean(handoff)}
          onClose={() => setHandoff(null)}
          onDone={(data) => {
            setHandoff(null);
            onChanged && onChanged(data);
          }}
        />
      )}

      <Dialog open={Boolean(reporting)} onClose={() => !busy && setReporting(null)} fullWidth maxWidth="xs">
        {reporting && (
          <>
            <DialogTitle>{REPORT[reporting].title}</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>{REPORT[reporting].body(delivery)}</DialogContentText>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="What happened? (optional)"
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                inputProps={{ maxLength: 500 }}
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setReporting(null)} disabled={busy}>Go back</Button>
              <Button variant="contained" color="error" onClick={sendReport} disabled={busy}>Report it</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

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
