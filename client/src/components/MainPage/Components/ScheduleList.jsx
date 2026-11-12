import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import api from "../../../api";
import { formatPickupTime } from "../../../time";
import { FOOD_TYPES, WEEKDAYS } from "../../../food";

// "Every Mon, Wed, Fri" / "Every day"
const describeDays = (days) =>
  days.length === 7 ? "Every day" : `Every ${[...days].sort().map((d) => WEEKDAYS[d]).join(", ")}`;

// A restaurant's weekly donations, with edit, pause/resume and delete.
const ScheduleList = ({ schedules, onEdit, onChanged }) => {
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const act = async (schedule, action) => {
    setBusy(true);
    try {
      await api.post(`schedule/${schedule._id}/${action}`);
      onChanged();
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  };

  if (!schedules.length) return null;
  return (
    <Box component="section" sx={{ mb: 4 }}>
      <Typography component="h2" variant="h6">Weekly donations</Typography>
      <Typography variant="body2" color="text.secondary">Posted automatically the day before each pickup</Typography>
      <Stack spacing={1.5} sx={{ mt: 1.5 }}>
        {schedules.map((s) => (
          <Paper key={s._id} variant="outlined" sx={{ p: 2, borderRadius: 4, opacity: s.active ? 1 : 0.7 }}>
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Box sx={{ width: 44, height: 44, borderRadius: 3, bgcolor: "primary.light", color: "primary.main", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <EventRepeatRoundedIcon />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                  <Typography sx={{ fontWeight: 800 }}>{describeDays(s.daysOfWeek)}</Typography>
                  <Chip
                    size="small"
                    label={s.active ? "Active" : "Paused"}
                    sx={s.active ? { bgcolor: "primary.light", color: "primary.dark" } : { bgcolor: "#EEECE8", color: "#4F5753" }}
                  />
                </Stack>
                <Typography variant="body2" sx={{ fontWeight: 700, color: "primary.dark", mt: 0.5 }}>
                  {formatPickupTime(s.pickupTimeBegin)} – {formatPickupTime(s.pickupTimeEnd)}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {[(s.foodTypes || []).map((t) => FOOD_TYPES[t]).join(", "), s.quantity].filter(Boolean).join(" · ") || s.fromRestaurantAddress}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Button size="small" onClick={() => onEdit(s)}>Edit</Button>
                  <Button size="small" disabled={busy} onClick={() => act(s, s.active ? "pause" : "resume")}>
                    {s.active ? "Pause" : "Resume"}
                  </Button>
                  <Button size="small" color="error" onClick={() => setDeleting(s)}>Delete</Button>
                </Stack>
              </Box>
            </Stack>
          </Paper>
        ))}
      </Stack>

      <Dialog open={Boolean(deleting)} onClose={() => !busy && setDeleting(null)}>
        <DialogTitle>Delete this weekly donation?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            No new postings will be created from it. Postings it already created stay as they are; you can withdraw them individually.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleting(null)} disabled={busy}>Go back</Button>
          <Button color="error" variant="contained" disabled={busy} onClick={() => act(deleting, "delete")}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ScheduleList;
