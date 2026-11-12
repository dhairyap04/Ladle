import { useCallback, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Link,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AppHeader from "../Shared/AppHeader";
import api, { errorMessage } from "../../api";
import useAuthUser from "../../useAuthUser";

const STATUS_CHIP = {
  unverified: { label: "Unverified", sx: { bgcolor: "#EEECE8", color: "#4F5753" } },
  pending: { label: "Pending", sx: { bgcolor: "#FFF1D6", color: "#7A4700" } },
  verified: { label: "Verified", sx: { bgcolor: "primary.light", color: "primary.dark" } },
  rejected: { label: "Rejected", sx: { bgcolor: "#FDE7E7", color: "#8A1C1C" } },
};

const Stat = ({ value, label }) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
    <Typography sx={{ fontWeight: 800, fontSize: "1.6rem", color: "primary.dark" }}>{value}</Typography>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
  </Paper>
);

// One account in a list, with verification actions for food banks.
const UserRow = ({ user, onDecide }) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between">
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
          <Typography sx={{ fontWeight: 800 }}>{user.name}</Typography>
          <Chip size="small" label={user.isFoodbank ? "Food bank" : "Restaurant"} variant="outlined" />
          {user.isFoodbank && <Chip size="small" {...STATUS_CHIP[user.verificationStatus || "unverified"]} />}
          {user.isAdmin && <Chip size="small" label="Admin" color="secondary" />}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
          {user.email}{user.phoneNumber ? ` · ${user.phoneNumber}` : ""}
        </Typography>
        {user.address && <Typography variant="body2" color="text.secondary">{user.address}</Typography>}
        {user.isFoodbank && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Charitable #: <strong>{user.charitableTaxNum || "not given"}</strong>
            {user.charitableTaxNum && (
              <>
                {" · "}
                <Link
                  href="https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch?request_locale=en"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Check the CRA charities listing
                </Link>
              </>
            )}
          </Typography>
        )}
        {user.website && (
          <Typography variant="body2">
            <Link href={/^https?:\/\//.test(user.website) ? user.website : `https://${user.website}`} target="_blank" rel="noopener noreferrer">
              {user.website}
            </Link>
          </Typography>
        )}
        {user.verificationNote && <Typography variant="body2" color="text.secondary">Note: {user.verificationNote}</Typography>}
        <Typography variant="caption" color="text.secondary">
          Joined {new Date(user.createdAt).toLocaleDateString()}
          {user.verificationRequestedAt ? ` · requested ${new Date(user.verificationRequestedAt).toLocaleDateString()}` : ""}
        </Typography>
      </Box>
      {user.isFoodbank && (
        <Stack direction={{ xs: "row", sm: "column" }} spacing={1} sx={{ flexShrink: 0 }}>
          {user.verificationStatus !== "verified" && (
            <Button variant="contained" size="small" onClick={() => onDecide(user, "verified")}>Verify</Button>
          )}
          {user.verificationStatus === "pending" && (
            <Button variant="outlined" size="small" color="error" onClick={() => onDecide(user, "rejected")}>Reject</Button>
          )}
          {user.verificationStatus === "verified" && (
            <Button variant="outlined" size="small" color="error" onClick={() => onDecide(user, "unverified")}>Remove verification</Button>
          )}
        </Stack>
      )}
    </Stack>
  </Paper>
);

const AdminPage = () => {
  const user = useAuthUser();
  const history = useHistory();
  const [tab, setTab] = useState("pending");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [deciding, setDeciding] = useState(null); // { user, decision }
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user === null) history.replace("/auth?mode=login");
  }, [user, history]);

  const load = useCallback(async () => {
    try {
      const params = tab === "pending" ? { verification: "pending" } : { q, role: tab === "all" ? undefined : tab };
      const [o, u] = await Promise.all([api.get("admin/overview"), api.get("admin/users", { params })]);
      setOverview(o.data);
      setUsers(u.data);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [tab, q]);

  useEffect(() => {
    if (!user) return undefined;
    const timer = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [user, load, q]);

  const decide = async () => {
    setBusy(true);
    try {
      await api.post(`admin/users/${deciding.user.id}/verification`, { decision: deciding.decision, note });
      setDeciding(null);
      setNote("");
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const pending = overview ? overview.verification.pending || 0 : 0;

  return (
    <>
      <AppHeader user={user} />
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Typography component="h1" variant="h4" sx={{ color: "primary.dark" }}>Admin</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>Verify food banks and keep an eye on activity.</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {overview && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" }, gap: 2, mb: 3 }}>
            <Stat value={overview.restaurants} label="Restaurants" />
            <Stat value={overview.foodBanks} label={`Food banks (${overview.verification.verified || 0} verified)`} />
            <Stat value={pending} label="Waiting for verification" />
            <Stat value={overview.postings.open || 0} label="Open postings" />
            <Stat value={`${overview.kgRescued} kg`} label={`Rescued (${overview.postings.picked_up || 0} pickups)`} />
          </Box>
        )}

        <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" sx={{ mb: 2 }}>
          <Tab value="pending" label={`Verification queue${pending ? ` (${pending})` : ""}`} />
          <Tab value="foodbank" label="Food banks" />
          <Tab value="restaurant" label="Restaurants" />
          <Tab value="all" label="Everyone" />
        </Tabs>

        {tab !== "pending" && (
          <TextField
            size="small"
            fullWidth
            placeholder="Search by name, email or charitable number"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> }}
            sx={{ mb: 2 }}
          />
        )}

        <Stack spacing={1.5}>
          {users && users.length === 0 && (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
              {tab === "pending" ? "No food banks are waiting for verification." : "No accounts match."}
            </Typography>
          )}
          {users && users.map((u) => <UserRow key={u.id} user={u} onDecide={(target, decision) => setDeciding({ user: target, decision })} />)}
        </Stack>
      </Container>

      <Dialog open={Boolean(deciding)} onClose={() => !busy && setDeciding(null)} fullWidth maxWidth="xs">
        {deciding && (
          <>
            <DialogTitle>
              {deciding.decision === "verified" ? `Verify ${deciding.user.name}?` : deciding.decision === "rejected" ? `Reject ${deciding.user.name}?` : `Remove ${deciding.user.name}'s verification?`}
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {deciding.decision === "verified"
                  ? "Check the charitable number against the CRA listing first. The food bank will be notified."
                  : "The food bank will see this note and be notified."}
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label={deciding.decision === "rejected" ? "Reason (required)" : "Note (optional)"}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                inputProps={{ maxLength: 500 }}
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setDeciding(null)} disabled={busy}>Cancel</Button>
              <Button
                variant="contained"
                color={deciding.decision === "verified" ? "primary" : "error"}
                onClick={decide}
                disabled={busy || (deciding.decision === "rejected" && !note.trim())}
              >
                Confirm
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
};

export default AdminPage;
