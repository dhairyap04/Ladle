import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Chip, Container, Link, Paper, Stack, Typography } from "@mui/material";
import PostAddRoundedIcon from "@mui/icons-material/PostAddRounded";
import TouchAppRoundedIcon from "@mui/icons-material/TouchAppRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import VolunteerActivismRoundedIcon from "@mui/icons-material/VolunteerActivismRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import AppHeader from "../Shared/AppHeader";
import Logo from "../Shared/Logo";
import useAuthUser from "../../useAuthUser";

const STEPS = [
  {
    icon: PostAddRoundedIcon,
    title: "Restaurant posts surplus",
    text: "Add the pickup address, date and time window, plus a note about the food. It takes about a minute.",
  },
  {
    icon: TouchAppRoundedIcon,
    title: "A food bank claims it",
    text: "Nearby food banks see it on a list and a map. The first to claim it reserves it, so nothing gets double-booked.",
  },
  {
    icon: TaskAltRoundedIcon,
    title: "Food gets picked up",
    text: "The food bank collects it during the window and marks it picked up. Both sides can see where every donation stands.",
  },
];

const AUDIENCES = [
  {
    icon: StorefrontRoundedIcon,
    title: "For restaurants",
    role: "restaurant",
    cta: "Start donating",
    points: [
      "Post end-of-day surplus in about a minute",
      "Edit or withdraw a posting while it's open",
      "See when a food bank claims it and picks it up",
    ],
  },
  {
    icon: VolunteerActivismRoundedIcon,
    title: "For food banks",
    role: "foodbank",
    cta: "Find food nearby",
    points: [
      "Browse open pickups on a list and a map",
      "Claim a pickup in one tap, with no double-booking",
      "Keep track of every pickup you've committed to",
    ],
  },
  {
    icon: LocalShippingRoundedIcon,
    title: "For volunteer drivers",
    role: "driver",
    cta: "Volunteer to drive",
    points: [
      "Deliver for food banks that can't collect themselves",
      "Only see jobs your vehicle can carry, near you, when you're free",
      "Accept a delivery in one tap and track your impact",
    ],
  },
];

const IconBadge = ({ icon: Icon, tone = "leaf" }) => (
  <Box
    sx={{
      width: 48,
      height: 48,
      borderRadius: 3,
      display: "grid",
      placeItems: "center",
      bgcolor: tone === "leaf" ? "primary.light" : "#FDEEDC",
      color: tone === "leaf" ? "primary.main" : "#B85A08",
      flexShrink: 0,
    }}
  >
    <Icon />
  </Box>
);

const LandingPage = () => {
  const user = useAuthUser();

  return (
    <>
      <AppHeader user={user} />

      {/* Hero */}
      <Container maxWidth="lg" component="main">
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1.1fr 1fr" },
            alignItems: "center",
            gap: { xs: 4, md: 6 },
            py: { xs: 5, md: 9 },
          }}
        >
          <Box>
            <Chip label="Free for restaurants and food banks" sx={{ bgcolor: "#FDEEDC", color: "#B85A08", mb: 2 }} />
            <Typography component="h1" variant="h2" sx={{ fontSize: { xs: "2.4rem", md: "3.5rem" }, lineHeight: 1.1, color: "primary.dark" }}>
              Good food, picked up. <Box component="span" sx={{ color: "primary.main" }}>Not thrown out.</Box>
            </Typography>
            <Typography sx={{ mt: 2.5, fontSize: "1.15rem", color: "text.secondary", maxWidth: 520 }}>
              Ladle connects restaurants that have surplus food with food banks nearby. Post in a minute, claim in a tap, and track every pickup.
            </Typography>
            {user ? (
              <Button component={RouterLink} to="/main" variant="contained" size="large" sx={{ mt: 4 }}>
                {{ foodbank: "See open pickups", driver: "See deliveries" }[user.role] || "Go to your postings"}
              </Button>
            ) : (
              <>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 4 }}>
                  <Button component={RouterLink} to="/auth?role=restaurant" variant="contained" size="large" startIcon={<StorefrontRoundedIcon />}>
                    I&apos;m a restaurant
                  </Button>
                  <Button component={RouterLink} to="/auth?role=foodbank" variant="outlined" size="large" startIcon={<VolunteerActivismRoundedIcon />}>
                    I&apos;m a food bank
                  </Button>
                </Stack>
                <Typography sx={{ mt: 2, color: "text.secondary" }}>
                  Just looking? <Link component={RouterLink} to="/main" sx={{ fontWeight: 700 }}>Browse open pickups</Link>
                </Typography>
              </>
            )}
          </Box>
          <Box component="img" src="/images/hero.svg" alt="" sx={{ width: "100%", maxWidth: 520, justifySelf: "center" }} />
        </Box>
      </Container>

      {/* How it works */}
      <Box component="section" aria-labelledby="how-title" sx={{ bgcolor: "#fff", borderBlock: 1, borderColor: "divider", py: { xs: 6, md: 8 } }}>
        <Container maxWidth="lg">
          <Typography id="how-title" component="h2" variant="h4" sx={{ textAlign: "center", color: "primary.dark" }}>
            How Ladle works
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 3, mt: 4 }}>
            {STEPS.map((step, index) => (
              <Paper key={step.title} variant="outlined" sx={{ p: 3, borderRadius: 4, bgcolor: "background.default" }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <IconBadge icon={step.icon} />
                  <Typography sx={{ fontWeight: 800, color: "#B85A08" }}>Step {index + 1}</Typography>
                </Stack>
                <Typography component="h3" variant="h6" sx={{ mt: 2 }}>{step.title}</Typography>
                <Typography sx={{ mt: 1, color: "text.secondary" }}>{step.text}</Typography>
              </Paper>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Audiences */}
      <Container maxWidth="lg" component="section" aria-label="Who Ladle is for" sx={{ py: { xs: 6, md: 8 } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 3 }}>
          {AUDIENCES.map((audience, index) => (
            <Paper key={audience.title} variant="outlined" sx={{ p: { xs: 3, md: 4 }, borderRadius: 4 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <IconBadge icon={audience.icon} tone={index === 1 ? "tangerine" : "leaf"} />
                <Typography component="h2" variant="h5">{audience.title}</Typography>
              </Stack>
              <Stack component="ul" spacing={1.25} sx={{ listStyle: "none", p: 0, my: 3 }}>
                {audience.points.map((point) => (
                  <Stack component="li" key={point} direction="row" spacing={1.25} alignItems="flex-start">
                    <CheckRoundedIcon sx={{ color: "primary.main", mt: "2px" }} fontSize="small" />
                    <Typography>{point}</Typography>
                  </Stack>
                ))}
              </Stack>
              {!user && (
                <Button component={RouterLink} to={`/auth?role=${audience.role}`} variant={index === 0 ? "contained" : "outlined"}>
                  {audience.cta}
                </Button>
              )}
            </Paper>
          ))}
        </Box>
      </Container>

      <Box component="footer" sx={{ borderTop: 1, borderColor: "divider", py: 4, mt: "auto" }}>
        <Container maxWidth="lg" sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2, alignItems: { sm: "center" }, justifyContent: "space-between" }}>
          <Logo size={28} />
          <Typography variant="body2" color="text.secondary">
            Built by Dhairya Prajapati · Reducing food waste, one pickup at a time.
          </Typography>
        </Container>
      </Box>
    </>
  );
};

export default LandingPage;
