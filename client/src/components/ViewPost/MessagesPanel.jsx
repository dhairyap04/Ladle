import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Chip, Link, Paper, Stack, TextField, Typography } from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import api, { errorMessage } from "../../api";
import ReliabilityBadge from "../Shared/ReliabilityBadge";

const POLL_MS = 10000;

const Bubble = ({ message, mine }) => (
  <Box sx={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
    <Box
      sx={{
        maxWidth: "80%",
        px: 1.75,
        py: 1,
        borderRadius: 3,
        borderBottomRightRadius: mine ? 4 : undefined,
        borderBottomLeftRadius: mine ? undefined : 4,
        bgcolor: mine ? "primary.main" : "#F1ECE3",
        color: mine ? "#fff" : "text.primary",
      }}
    >
      {!mine && <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>{message.senderName}</Typography>}
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.body}</Typography>
      <Typography variant="caption" sx={{ opacity: 0.75 }}>
        {new Date(message.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
      </Typography>
    </Box>
  </Box>
);

// Conversation(s) about a posting. Food banks see their own thread with the
// restaurant; the restaurant can switch between food banks' threads.
const MessagesPanel = ({ postingId, user, isOwner }) => {
  const [data, setData] = useState(null);
  const [active, setActive] = useState(null); // foodBankId of the open thread (restaurant only)
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`posting/${postingId}/messages`);
      setData(res.data);
    } catch (err) {
      setData({ threads: [], contact: null, unavailable: errorMessage(err) });
    }
  }, [postingId]);

  useEffect(() => {
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const threads = data ? data.threads : [];
  const thread = isOwner
    ? threads.find((t) => t.foodBankId === active) || threads[0]
    : threads[0] || { messages: [] };
  const messageCount = thread ? thread.messages.length : 0;

  useEffect(() => {
    if (endRef.current && messageCount) endRef.current.scrollIntoView({ block: "nearest" });
  }, [messageCount]);

  // Scroll here when arriving from a "new message" notification.
  useEffect(() => {
    if (window.location.hash === "#messages" && data) {
      document.getElementById("messages")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [data]);

  if (!data) return null;
  if (data.unavailable) return null; // e.g. another food bank claimed it

  const send = async (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError("");
    try {
      await api.post(`posting/${postingId}/messages`, { body: draft, ...(isOwner ? { foodBankId: thread.foodBankId } : {}) });
      setDraft("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const canWrite = !isOwner || Boolean(thread);

  return (
    <Paper id="messages" variant="outlined" sx={{ p: { xs: 2.5, sm: 3 }, borderRadius: 5, scrollMarginTop: 90 }}>
      <Typography component="h2" variant="h6">Messages</Typography>
      <Typography variant="body2" color="text.secondary">
        {isOwner
          ? "Questions from food banks and pickup details."
          : "Ask the restaurant about the food or arrange pickup details."}
      </Typography>

      {data.contact && (
        <Alert icon={<PhoneRoundedIcon />} severity="success" sx={{ mt: 2 }}>
          <strong>{data.contact.name}</strong>
          {data.contact.phoneNumber
            ? <> · <Link href={`tel:${data.contact.phoneNumber}`}>{data.contact.phoneNumber}</Link></>
            : " hasn't added a phone number yet."}
        </Alert>
      )}

      {isOwner && threads.length > 1 && (
        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap", rowGap: 1 }}>
          {threads.map((t) => (
            <Chip
              key={t.foodBankId}
              label={`${t.foodBankName}${t.isClaimer ? " (claimed)" : ""}`}
              onClick={() => setActive(t.foodBankId)}
              color={thread && thread.foodBankId === t.foodBankId ? "primary" : "default"}
              variant={thread && thread.foodBankId === t.foodBankId ? "filled" : "outlined"}
            />
          ))}
        </Stack>
      )}

      {isOwner && thread && thread.reliability && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">{thread.foodBankName}&apos;s track record</Typography>
          <ReliabilityBadge summary={thread.reliability} />
        </Box>
      )}

      <Stack spacing={1} sx={{ mt: 2, maxHeight: 320, overflowY: "auto", pr: 0.5 }} aria-live="polite">
        {!thread || thread.messages.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
            {isOwner
              ? thread ? `No messages with ${thread.foodBankName} yet.` : "No food banks have messaged you about this posting yet."
              : "No messages yet."}
          </Typography>
        ) : (
          thread.messages.map((m) => <Bubble key={m._id} message={m} mine={m.senderId === user.id} />)
        )}
        <div ref={endRef} />
      </Stack>

      {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
      {canWrite && (
        <Box component="form" onSubmit={send} sx={{ display: "flex", gap: 1, mt: 2 }}>
          <TextField
            fullWidth
            size="small"
            multiline
            maxRows={4}
            placeholder={isOwner ? `Reply to ${thread.foodBankName}` : "Write a message"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) send(e);
            }}
            inputProps={{ maxLength: 1000, "aria-label": "Message" }}
          />
          <Button type="submit" variant="contained" disabled={sending || !draft.trim()} aria-label="Send" sx={{ minWidth: 0, px: 2 }}>
            <SendRoundedIcon fontSize="small" />
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default MessagesPanel;
