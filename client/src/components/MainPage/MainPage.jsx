import { useCallback, useEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Box, Button, Container, Paper, Skeleton, Stack, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RestaurantRoundedIcon from "@mui/icons-material/RestaurantRounded";

import AppHeader from "../Shared/AppHeader";
import PostingTile from "./Components/PostingTile";
import SimpleMap from "./Components/GoogleMap";
import CreatePostingModal from "./Components/CreatePosting";
import FilterBar, { EMPTY_FILTERS, filterParams } from "./Components/FilterBar";
import ScheduleList from "./Components/ScheduleList";
import { mapPoints } from "../../mapPoints";
import api from "../../api";
import useAuthUser from "../../useAuthUser";
import { roleOf } from "../../roles";
import DriverHome from "./DriverHome";
import usePageTitle from "../../usePageTitle";


const EmptyState = ({ children }) => (
  <Paper variant="outlined" sx={{ p: 3, borderRadius: 4, borderStyle: "dashed", textAlign: "center", bgcolor: "transparent" }}>
    <Box sx={{ width: 48, height: 48, mx: "auto", mb: 1, borderRadius: "50%", bgcolor: "primary.light", color: "primary.main", display: "grid", placeItems: "center" }}>
      <RestaurantRoundedIcon />
    </Box>
    <Typography color="text.secondary">{children}</Typography>
  </Paper>
);

const Section = ({ title, subtitle, children }) => (
  <Box component="section" sx={{ mb: 4 }}>
    <Typography component="h2" variant="h6">{title}</Typography>
    {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
    <Stack spacing={1.5} sx={{ mt: 1.5 }}>{children}</Stack>
  </Box>
);

const Stat = ({ value, label }) => (
  <Paper variant="outlined" sx={{ px: 2.5, py: 1.5, borderRadius: 3, minWidth: 120 }}>
    <Typography sx={{ fontWeight: 800, fontSize: "1.6rem", color: "primary.dark", lineHeight: 1.2 }}>{value}</Typography>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
  </Paper>
);

// Restaurants, food banks and guests browse postings; drivers get their own home.
const MainPage = () => {
  const user = useAuthUser();
  if (user && roleOf(user) === "driver") return <DriverHome user={user} />;
  return <PostingsHome user={user} />;
};

const PostingsHome = ({ user }) => {
  usePageTitle(roleOf(user) === "restaurant" ? "Your postings" : "Open pickups");
  const [postings, setPostings] = useState(null); // null while loading
  const [loadError, setLoadError] = useState(false);
  const [myPostings, setMyPostings] = useState([]);
  const [latlng, setLatlng] = useState([]);
  const [creating, setCreating] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [editingSchedule, setEditingSchedule] = useState(null);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [device, setDevice] = useState(null); // { lat, lng } from the browser
  const [locating, setLocating] = useState(false);
  const [origin, setOrigin] = useState("none"); // where distances are measured from
  const [locationError, setLocationError] = useState("");
  const requestId = useRef(0);

  const loadPostings = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const res = await api.get("posting/all", { params: filterParams(filters, device) });
      if (id !== requestId.current) return; // a newer search has started
      setPostings(res.data);
      setOrigin(res.headers["x-search-origin"] || "none");
      setLoadError(false);
      const points = await mapPoints(res.data);
      if (id === requestId.current) setLatlng(points);
    } catch (err) {
      console.error("Posting retrieval failed", err);
      setPostings([]);
      setLoadError(true);
    }
  }, [filters, device]);

  const useDeviceLocation = () => {
    if (device) {
      setDevice(null);
      return;
    }
    if (!navigator.geolocation) {
      setLocationError("Your browser can't share its location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDevice({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationError("");
        setLocating(false);
      },
      () => {
        setLocationError("We couldn't get your location. Check your browser's location permission.");
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  };

  // A restaurant's own postings, or the pickups a food bank has claimed.
  const loadMine = useCallback(async () => {
    try {
      const res = await api.get("posting/mine");
      setMyPostings(res.data);
    } catch (err) {
      console.error("My postings retrieval failed", err);
    }
  }, []);

  // Wait for typing to pause before searching.
  useEffect(() => {
    const timer = setTimeout(loadPostings, filters.q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadPostings, filters.q]);
  const loadSchedules = useCallback(async () => {
    try {
      const res = await api.get("schedule/mine");
      setSchedules(res.data);
    } catch (err) {
      console.error("Schedule retrieval failed", err);
    }
  }, []);

  useEffect(() => { if (user) loadMine(); }, [user, loadMine]);
  useEffect(() => { if (roleOf(user) === "restaurant") loadSchedules(); }, [user, loadSchedules]);

  const handleCreated = () => {
    setCreating(false);
    setEditingSchedule(null);
    loadPostings();
    loadMine();
    loadSchedules();
  };

  const isRestaurant = roleOf(user) === "restaurant";
  const count = (status) => myPostings.filter((p) => p.status === status).length;

  const openList = (
    <Section
      title={isRestaurant ? "All open pickups" : "Open pickups"}
      subtitle={isRestaurant ? "What's currently available to food banks in the area" : "Claim one to reserve it for your food bank"}
    >
      <FilterBar
        filters={filters}
        onChange={setFilters}
        isFoodbank={Boolean(user && user.isFoodbank)}
        device={device}
        onUseDevice={useDeviceLocation}
        locating={locating}
      />
      {locationError && <Alert severity="warning" onClose={() => setLocationError("")}>{locationError}</Alert>}
      {(filters.radiusKm || filters.sort === "distance") && origin === "none" && (
        <Alert severity="info">
          To search by distance, use your location{user ? <> or <RouterLink to="/view_profile">add your address to your profile</RouterLink></> : ""}.
        </Alert>
      )}
      {postings === null ? (
        [0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={96} sx={{ borderRadius: 4 }} />)
      ) : loadError ? (
        <Alert severity="error">Couldn&apos;t load postings. Please refresh the page.</Alert>
      ) : postings.length === 0 ? (
        <EmptyState>
          {JSON.stringify(filters) === JSON.stringify(EMPTY_FILTERS)
            ? "No food is waiting for pickup right now. Check back soon."
            : "Nothing matches these filters. Try widening your search."}
        </EmptyState>
      ) : (
        postings.map((posting) => <PostingTile key={posting._id} postingData={posting} />)
      )}
    </Section>
  );

  const mineList = user && (
    <Section
      title={user.isFoodbank ? "Your pickups" : "Your postings"}
      subtitle={user.isFoodbank ? "Pickups your food bank has claimed" : "Everything you've posted, with its current status"}
    >
      {myPostings.length === 0 ? (
        <EmptyState>
          {user.isFoodbank ? "Pickups you claim will show up here." : "You haven't posted any food yet. Your postings will show up here."}
        </EmptyState>
      ) : (
        myPostings.map((posting) => <PostingTile key={posting._id} postingData={posting} showStatus foodTitle={isRestaurant} />)
      )}
    </Section>
  );

  return (
    <>
      <AppHeader user={user} />
      {creating && <CreatePostingModal onClose={() => setCreating(false)} onSaved={handleCreated} />}
      {editingSchedule && (
        <CreatePostingModal schedule={editingSchedule} onClose={() => setEditingSchedule(null)} onSaved={handleCreated} />
      )}

      <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
        {/* Page heading */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "flex-end" }} sx={{ mb: 3 }}>
          <Box>
            <Typography component="h1" variant="h4" sx={{ color: "primary.dark" }}>
              {user ? `Hi, ${user.name}` : "Food waiting for pickup"}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {isRestaurant
                ? "Got surplus food? Post it and nearby food banks can claim it."
                : user
                  ? "Find surplus food from restaurants near you."
                  : "Restaurants post surplus food here for food banks to collect."}
            </Typography>
          </Box>
          {isRestaurant && (
            <Button variant="contained" size="large" startIcon={<AddRoundedIcon />} onClick={() => setCreating(true)} sx={{ flexShrink: 0 }}>
              Post surplus food
            </Button>
          )}
        </Stack>

        {user && myPostings.length > 0 && (
          <Stack direction="row" spacing={1.5} sx={{ mb: 3, overflowX: "auto", pb: 0.5 }}>
            {user.isFoodbank ? (
              <>
                <Stat value={count("claimed")} label="Upcoming pickups" />
                <Stat value={count("picked_up")} label="Pickups completed" />
              </>
            ) : (
              <>
                <Stat value={count("open")} label="Open now" />
                <Stat value={count("claimed")} label="Claimed" />
                <Stat value={count("picked_up")} label="Donations picked up" />
              </>
            )}
          </Stack>
        )}

        {user === null && (
          <Alert severity="info" sx={{ mb: 3 }} action={<Button component={RouterLink} to="/auth?role=foodbank" color="inherit">Sign up</Button>}>
            Food banks can claim these pickups with a free account.
          </Alert>
        )}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" }, gap: { xs: 3, md: 4 }, alignItems: "start" }}>
          <Box>
            {isRestaurant ? (
              <>
                <ScheduleList schedules={schedules} onEdit={setEditingSchedule} onChanged={() => { loadSchedules(); loadMine(); loadPostings(); }} />
                {mineList}
                {openList}
              </>
            ) : <>{openList}{mineList}</>}
          </Box>
          <Paper
            variant="outlined"
            sx={{
              position: { md: "sticky" },
              top: { md: 88 },
              height: { xs: 260, md: "calc(100vh - 120px)" },
              maxHeight: 640,
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <SimpleMap latlng={latlng} />
          </Paper>
        </Box>
      </Container>
    </>
  );
};

export default MainPage;
