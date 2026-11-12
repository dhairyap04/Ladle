import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Paper, Rating, Stack, TextField, Typography } from "@mui/material";
import api, { errorMessage } from "../../api";
import { ROLE_LABELS } from "../../roles";

// Rate one person you worked with on this pickup. Ratings can be changed later.
const RateOne = ({ postingId, party, existing, onSaved }) => {
  const [stars, setStars] = useState(existing ? existing.stars : null);
  const [comment, setComment] = useState(existing ? existing.comment : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(Boolean(existing));

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api.post(`posting/${postingId}/ratings`, { toUserId: party.id, stars, comment });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const labelId = `rate-${party.id}`;
  return (
    <Box>
      <Typography id={labelId} variant="body2" sx={{ fontWeight: 700 }}>
        {party.name} <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>· {ROLE_LABELS[party.role]}</Box>
      </Typography>
      <Rating
        value={stars}
        onChange={(e, v) => { setStars(v); setSaved(false); }}
        aria-labelledby={labelId}
        size="large"
        sx={{ color: "#A34F06", my: 0.5 }}
      />
      {stars && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-start" }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Anything to add? (optional)"
            value={comment}
            onChange={(e) => { setComment(e.target.value); setSaved(false); }}
            inputProps={{ maxLength: 500, "aria-label": `Comment about ${party.name}` }}
          />
          <Button variant={saved ? "text" : "contained"} onClick={save} disabled={busy || saved} sx={{ flexShrink: 0 }}>
            {saved ? "Saved" : "Save rating"}
          </Button>
        </Stack>
      )}
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </Box>
  );
};

// After pickup: rate the other people on it (restaurant, food bank, driver).
const RatingCard = ({ postingId }) => {
  const [data, setData] = useState(null);
  const load = useCallback(() => {
    api.get(`posting/${postingId}/ratings`).then((res) => setData(res.data)).catch(() => setData(null));
  }, [postingId]);
  useEffect(() => { load(); }, [load]);

  if (!data || !data.canRate || data.parties.length === 0) return null;
  const mine = Object.fromEntries(data.mine.map((r) => [r.toUserId, r]));
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Typography sx={{ fontWeight: 800 }}>How did it go?</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Ratings help restaurants and food banks know who they can count on.
      </Typography>
      <Stack spacing={2}>
        {data.parties.map((p) => (
          <RateOne key={p.id} postingId={postingId} party={p} existing={mine[p.id]} onSaved={load} />
        ))}
      </Stack>
    </Paper>
  );
};

export default RatingCard;
