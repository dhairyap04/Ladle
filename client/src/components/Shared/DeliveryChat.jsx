import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Collapse, Stack, TextField, Typography } from "@mui/material";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import api, { errorMessage } from "../../api";

const POLL_MS = 10000;

// Group chat for a delivery between the restaurant, food bank and driver.
// Collapsed by default; opens straight away when linked to with #delivery-chat.
const DeliveryChat = ({ deliveryId, userId }) => {
  const [open, setOpen] = useState(() => window.location.hash === "#delivery-chat");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`delivery/${deliveryId}/messages`);
      setMessages(res.data);
    } catch {
      // Not part of this delivery any more, or offline.
    }
  }, [deliveryId]);

  useEffect(() => {
    load();
    if (!open) return undefined;
    const timer = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load, open]);

  useEffect(() => {
    if (open && endRef.current) endRef.current.scrollIntoView({ block: "nearest" });
  }, [open, messages.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api.post(`delivery/${deliveryId}/messages`, { body: draft });
      setDraft("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box id="delivery-chat" sx={{ mt: 1.5, scrollMarginTop: 90 }}>
      <Button size="small" startIcon={<ChatRoundedIcon />} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "Hide delivery chat" : `Delivery chat${messages.length ? ` (${messages.length})` : ""}`}
      </Button>
      <Collapse in={open}>
        <Box sx={{ mt: 1, p: 1.5, borderRadius: 3, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
          <Typography variant="caption" color="text.secondary">Everyone on this delivery sees these messages.</Typography>
          <Stack spacing={1} sx={{ mt: 1, maxHeight: 260, overflowY: "auto" }} aria-live="polite">
            {messages.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 1 }}>No messages yet.</Typography>
            )}
            {messages.map((m) => {
              const mine = m.senderId === userId;
              return (
                <Box key={m._id} sx={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "85%", px: 1.5, py: 0.75, borderRadius: 2.5, bgcolor: mine ? "primary.main" : "#F1ECE3", color: mine ? "#fff" : "text.primary" }}>
                  {!mine && <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>{m.senderName}</Typography>}
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.body}</Typography>
                </Box>
              );
            })}
            <div ref={endRef} />
          </Stack>
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
          <Box component="form" onSubmit={send} sx={{ display: "flex", gap: 1, mt: 1.5 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="e.g. Running 10 minutes late"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              inputProps={{ maxLength: 1000, "aria-label": "Delivery chat message" }}
            />
            <Button type="submit" variant="contained" disabled={busy || !draft.trim()} aria-label="Send" sx={{ minWidth: 0, px: 2 }}>
              <SendRoundedIcon fontSize="small" />
            </Button>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

export default DeliveryChat;
