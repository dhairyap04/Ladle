import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import DeliveryCard from "../Shared/DeliveryCard";
import api, { errorMessage } from "../../api";
import { roleOf } from "../../roles";

const ENDED = ["delivered", "cancelled", "expired", "missed"];

// Volunteer driver status for a posting. The claiming food bank can ask for a
// driver; the restaurant and driver see progress and contact details.
const DeliverySection = ({ post, user, isOwner, isClaimer, onPostChanged, onDelivery }) => {
  const [delivery, setDelivery] = useState(undefined);
  const [asking, setAsking] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get(`delivery/for-posting/${post._id}`);
      setDelivery(res.data);
      if (onDelivery) onDelivery(res.data);
    } catch {
      setDelivery(null);
    }
  }, [post._id, onDelivery]);

  useEffect(() => { load(); }, [load]);

  const request = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api.post("delivery", { postingId: post._id, notes });
      setDelivery(res.data);
      if (onDelivery) onDelivery(res.data);
      setAsking(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const changed = () => {
    load();
    onPostChanged();
  };

  if (delivery === undefined) return null;
  const role = roleOf(user);
  const viewer = isClaimer ? "foodbank" : isOwner ? "restaurant" : role === "driver" ? "driver" : null;
  const canAsk = isClaimer && post.status === "claimed" && (!delivery || ENDED.includes(delivery.status) && delivery.status !== "delivered");

  if (!viewer) return null;
  if (!delivery && !canAsk) return null;

  return (
    <Stack spacing={1.5}>
      {delivery && <DeliveryCard delivery={delivery} viewer={viewer} onChanged={changed} title="Volunteer delivery" />}
      {canAsk && (
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 4 }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <LocalShippingRoundedIcon sx={{ color: "primary.main", mt: 0.25 }} />
            <div>
              <Typography sx={{ fontWeight: 800 }}>Can&apos;t collect it yourselves?</Typography>
              <Typography variant="body2" color="text.secondary">
                Ask a volunteer driver to pick it up from the restaurant and bring it to your food bank.
              </Typography>
              <Button variant="outlined" sx={{ mt: 1.5 }} onClick={() => setAsking(true)}>Request a volunteer driver</Button>
            </div>
          </Stack>
        </Paper>
      )}

      <Dialog open={asking} onClose={() => !busy && setAsking(false)} fullWidth maxWidth="xs">
        <DialogTitle>Request a volunteer driver</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Drivers nearby who can carry this load will be notified. They&apos;ll deliver to the address on your profile.
          </DialogContentText>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Drop-off instructions (optional)"
            placeholder="e.g. Use the loading dock at the back and ring the bell."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            inputProps={{ maxLength: 500 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAsking(false)} disabled={busy}>Cancel</Button>
          <Button variant="contained" onClick={request} disabled={busy}>Request driver</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default DeliverySection;
