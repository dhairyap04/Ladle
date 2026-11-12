import { useEffect, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { Alert, BottomNavigation, BottomNavigationAction, Button, GlobalStyles, IconButton, Paper, Slide, Snackbar } from "@mui/material";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import InstallMobileRoundedIcon from "@mui/icons-material/InstallMobileRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import { canInstall, isStandalone, onInstallAvailable, promptInstall } from "../../pwa";

const DISMISS_KEY = "ladle.installDismissed";

const readDismissed = () => {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
};

// "You're offline" banner, shown while the browser has no connection.
export const OfflineBanner = () => {
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return (
    <Slide in={offline} direction="down" mountOnEnter unmountOnExit>
      <Alert severity="warning" icon={<CloudOffRoundedIcon />} sx={{ borderRadius: 0, justifyContent: "center" }} role="status">
        You&apos;re offline. You can look around, but nothing can be posted or claimed until you reconnect.
      </Alert>
    </Slide>
  );
};

// Offers to install Ladle as an app, where the browser supports it.
export const InstallPrompt = () => {
  const [available, setAvailable] = useState(canInstall());
  const [dismissed, setDismissed] = useState(readDismissed);
  useEffect(() => onInstallAvailable(setAvailable), []);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Storage blocked: the prompt just comes back next visit.
    }
  };

  return (
    <Snackbar
      open={available && !dismissed && !isStandalone()}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      sx={{ bottom: { xs: 80, sm: 24 } }}
    >
      <Alert
        severity="success"
        icon={<InstallMobileRoundedIcon />}
        sx={{ alignItems: "center", boxShadow: 3 }}
        action={
          <>
            <Button color="inherit" size="small" onClick={() => promptInstall().then(dismiss)}>Install</Button>
            <IconButton size="small" aria-label="Not now" color="inherit" onClick={dismiss}><CloseRoundedIcon fontSize="small" /></IconButton>
          </>
        }
      >
        Install Ladle for quicker posting and pickups.
      </Alert>
    </Snackbar>
  );
};

// Thumb-reachable navigation for signed-in users on phones.
export const BottomNav = ({ user }) => {
  const { pathname } = useLocation();
  const items = [
    { to: "/main", label: user.isFoodbank ? "Pickups" : "Postings", icon: <HomeRoundedIcon /> },
    { to: "/impact", label: "Impact", icon: <InsightsRoundedIcon /> },
    ...(user.isAdmin ? [{ to: "/admin", label: "Admin", icon: <AdminPanelSettingsRoundedIcon /> }] : []),
    { to: "/view_profile", label: "Profile", icon: <PersonRoundedIcon /> },
  ];
  const current = items.find((i) => pathname.startsWith(i.to));
  return (
    <>
      {/* Keeps page content clear of the fixed bar. */}
      <GlobalStyles
        styles={(theme) => ({
          body: { [theme.breakpoints.down("sm")]: { paddingBottom: "calc(64px + env(safe-area-inset-bottom))" } },
        })}
      />
      <Paper
        component="nav"
        aria-label="Main"
        elevation={0}
        sx={{
          display: { xs: "block", sm: "none" },
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          borderTop: 1,
          borderColor: "divider",
          pb: "env(safe-area-inset-bottom)",
          "@media print": { display: "none" },
        }}
      >
        <BottomNavigation showLabels value={current ? current.to : false} sx={{ height: 64 }}>
          {items.map((item) => (
            <BottomNavigationAction key={item.to} component={RouterLink} to={item.to} value={item.to} label={item.label} icon={item.icon} />
          ))}
        </BottomNavigation>
      </Paper>
    </>
  );
};
