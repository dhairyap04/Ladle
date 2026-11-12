import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Link, Paper, Stack, TextField, Typography } from "@mui/material";
import api, { errorMessage } from "../../api";
import ReliabilityBadge from "../Shared/ReliabilityBadge";

const FLAGS = {
  pickup_far: "Collected away from the restaurant",
  dropoff_far: "Dropped off away from the food bank",
  too_fast: "Delivered implausibly fast",
};

const when = (iso) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const photoUrl = (d, stage) => `${import.meta.env.REACT_APP_HOST_URL}delivery/${d._id}/photo/${stage}`;

const proofText = (proof, who) => {
  if (!proof || !proof.at) return "Not yet";
  const how = proof.method === "code" ? `${who}'s code` : "photo, no code";
  const where = proof.location === "near" ? "at the address" : proof.location === "far" ? `${(proof.distanceM / 1000).toFixed(1)} km away` : "location not shared";
  return `${when(proof.at)} · ${how} · ${where}`;
};

const DeliveryRow = ({ d, onResolve }) => {
  const open = d.dispute && d.dispute.at && !d.dispute.resolution;
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 0.5, mb: 1 }}>
        {open && <Chip size="small" label={d.dispute.stage === "pickup" ? "Restaurant says not collected" : "Food bank says not received"} sx={{ bgcolor: "#FDE7E7", color: "#8A1C1C" }} />}
        {(d.flags || []).map((f) => <Chip key={f} size="small" label={FLAGS[f] || f} sx={{ bgcolor: "#FFF1D6", color: "#7A4700" }} />)}
      </Stack>
      <Typography sx={{ fontWeight: 800 }}>{d.restaurantName} → {d.foodBankName}</Typography>
      <Typography variant="body2" color="text.secondary">
        Driver: {d.driver ? `${d.driver.name} · ${d.driver.email}${d.driver.phoneNumber ? ` · ${d.driver.phoneNumber}` : ""}` : d.driverName}
      </Typography>
      {d.driverReliability && <Box sx={{ mt: 0.5 }}><ReliabilityBadge summary={d.driverReliability} noun="delivery" /></Box>}
      {open && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          Reported by {d.reportedBy ? d.reportedBy.name : "them"} {when(d.dispute.at)}{d.dispute.note ? `: "${d.dispute.note}"` : ""}
        </Typography>
      )}
      <Stack spacing={0.5} sx={{ mt: 1 }}>
        {["pickup", "dropoff"].map((stage) => (
          <Stack key={stage} direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              <strong>{stage === "pickup" ? "Collected" : "Dropped off"}:</strong>{" "}
              {proofText(d[`${stage}Proof`], stage === "pickup" ? "restaurant" : "food bank")}
            </Typography>
            {d[`${stage}Proof`] && d[`${stage}Proof`].hasPhoto && (
              <Link href={photoUrl(d, stage)} target="_blank" rel="noopener noreferrer" aria-label={`${stage} photo`}>
                <Box component="img" src={photoUrl(d, stage)} alt="" sx={{ width: 48, height: 48, objectFit: "cover", borderRadius: 1.5, display: "block" }} />
              </Link>
            )}
          </Stack>
        ))}
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
        <Button variant="contained" size="small" onClick={() => onResolve(d, "delivered")}>{open ? "It was delivered" : "Looks fine"}</Button>
        <Button variant="outlined" color="error" size="small" onClick={() => onResolve(d, "not_delivered")}>It wasn&apos;t delivered</Button>
        <Button component={RouterLink} to={`/view_post/${d.postingId}`} size="small" color="inherit">View posting</Button>
      </Stack>
    </Paper>
  );
};

// Disputed deliveries, and ones whose location or timing looked wrong.
const AdminDeliveries = ({ onChanged }) => {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState(null); // { d, outcome }
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await api.get("admin/deliveries")).data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const resolve = async () => {
    setBusy(true);
    try {
      await api.post(`admin/deliveries/${resolving.d._id}/resolve`, { outcome: resolving.outcome, note });
      setResolving(null);
      setNote("");
      await load();
      onChanged && onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={1.5}>
      {error && <Alert severity="error">{error}</Alert>}
      {items && items.length === 0 && (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>No deliveries need review.</Typography>
      )}
      {items && items.map((d) => <DeliveryRow key={d._id} d={d} onResolve={(target, outcome) => setResolving({ d: target, outcome })} />)}

      <Dialog open={Boolean(resolving)} onClose={() => !busy && setResolving(null)} fullWidth maxWidth="xs">
        {resolving && (
          <>
            <DialogTitle>{resolving.outcome === "delivered" ? "Count this as delivered?" : "Count this as not delivered?"}</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {resolving.outcome === "delivered"
                  ? `${resolving.d.driverName} is credited for the delivery and any reported problem is closed.`
                  : `This counts like a no-show on ${resolving.d.driverName}'s record.`}{" "}
                The driver{resolving.d.dispute && resolving.d.dispute.at ? " and whoever reported it" : ""} will be notified with your note.
              </Typography>
              <TextField fullWidth multiline minRows={2} label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} inputProps={{ maxLength: 500 }} />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setResolving(null)} disabled={busy}>Cancel</Button>
              <Button variant="contained" color={resolving.outcome === "delivered" ? "primary" : "error"} onClick={resolve} disabled={busy}>Confirm</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Stack>
  );
};

export default AdminDeliveries;
