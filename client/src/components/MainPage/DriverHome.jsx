import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Box, Container, FormControlLabel, Paper, Skeleton, Stack, Switch, Typography } from "@mui/material";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import AppHeader from "../Shared/AppHeader";
import DeliveryCard from "../Shared/DeliveryCard";
import api, { errorMessage } from "../../api";
import usePageTitle from "../../usePageTitle";

const ACTIVE = ["accepted", "picked_up"];

const Empty = ({ children }) => (
  <Paper variant="outlined" sx={{ p: 3, borderRadius: 4, borderStyle: "dashed", textAlign: "center", bgcolor: "transparent" }}>
    <LocalShippingRoundedIcon sx={{ color: "primary.main" }} />
    <Typography color="text.secondary">{children}</Typography>
  </Paper>
);

// Home page for volunteer drivers: jobs in progress, then deliveries that need a driver.
const DriverHome = ({ user }) => {
  usePageTitle("Deliveries");
  const [available, setAvailable] = useState(null);
  const [mine, setMine] = useState([]);
  const [profile, setProfile] = useState(null);
  const [onlyFits, setOnlyFits] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [a, m] = await Promise.all([api.get("delivery/available"), api.get("delivery/mine")]);
      setAvailable(a.data);
      setMine(m.data);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Couldn't load deliveries."));
    }
  }, []);

  useEffect(() => {
    load();
    api.get("user/info").then((res) => setProfile(res.data.user)).catch(() => {});
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 30000);
    return () => clearInterval(timer);
  }, [load]);

  const active = mine.filter((d) => ACTIVE.includes(d.status));
  const past = mine.filter((d) => !ACTIVE.includes(d.status)).slice(0, 10);
  const shown = (available || []).filter((d) => !onlyFits || d.fitProblems.length === 0);

  return (
    <>
      <AppHeader user={user} />
      <Container maxWidth="md" component="main" sx={{ py: { xs: 3, md: 5 } }}>
        <Typography component="h1" variant="h4" sx={{ color: "primary.dark" }}>Hi, {user.name}</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>Pick up surplus food from restaurants and bring it to food banks.</Typography>

        {profile && (!profile.address || !profile.vehicle) && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <RouterLink to="/view_profile">Add your home area and vehicle</RouterLink> so we can show you deliveries nearby that you can carry.
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {active.length > 0 && (
          <Box component="section" sx={{ mb: 4 }}>
            <Typography component="h2" variant="h6">Your deliveries in progress</Typography>
            <Stack spacing={1.5} sx={{ mt: 1.5 }}>
              {active.map((d) => <DeliveryCard key={d._id} delivery={d} viewer="driver" onChanged={load} showPostingLink userId={user.id} />)}
            </Stack>
          </Box>
        )}

        <Box component="section" sx={{ mb: 4 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexWrap: "wrap" }}>
            <Box>
              <Typography component="h2" variant="h6">Deliveries that need a driver</Typography>
              <Typography variant="body2" color="text.secondary">Soonest pickup first</Typography>
            </Box>
            <FormControlLabel
              control={<Switch checked={onlyFits} onChange={(e) => setOnlyFits(e.target.checked)} />}
              label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Only ones that suit me</Typography>}
            />
          </Stack>
          <Stack spacing={1.5} sx={{ mt: 1.5 }}>
            {available === null
              ? [0, 1].map((i) => <Skeleton key={i} variant="rounded" height={160} sx={{ borderRadius: 4 }} />)
              : shown.length === 0
                ? <Empty>{available.length ? "None suit your vehicle, area or hours right now." : "No deliveries need a driver right now. We'll notify you when one does."}</Empty>
                : shown.map((d) => <DeliveryCard key={d._id} delivery={d} viewer="driver" onChanged={load} />)}
          </Stack>
        </Box>

        {past.length > 0 && (
          <Box component="section">
            <Typography component="h2" variant="h6">Recent deliveries</Typography>
            <Stack spacing={1.5} sx={{ mt: 1.5 }}>
              {past.map((d) => <DeliveryCard key={d._id} delivery={d} viewer="driver" />)}
            </Stack>
          </Box>
        )}
      </Container>
    </>
  );
};

export default DriverHome;
