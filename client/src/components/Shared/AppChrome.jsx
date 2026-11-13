import { useEffect, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { Alert, BottomNavigation, BottomNavigationAction, GlobalStyles, IconButton, Paper, Slide, Snackbar } from "@mui/material";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import InstallMobileRoundedIcon from "@mui/icons-material/InstallMobileRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import { useInstallMethod, InstallButton } from "./InstallGuide";
import { HOME_LABELS, roleOf } from "../../roles";

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
        You&apos;re offline. Drivers can still record a pickup or drop-off; it&apos;s sent when you reconnect. Posting and claiming need a connection.
      </Alert>
    </Slide>
  );
};

// Offers to install Ladle as an app: the browser's own prompt where there is
// one, or the Share menu steps on iPhone and iPad.
export const InstallPrompt = () => {
  const method = useInstallMethod();
  const [dismissed, setDismissed] = useState(readDismissed);

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
      open={Boolean(method) && !dismissed}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      // Below dialogs (MUI snackbars normally sit above them), so the banner never
      // covers a dialog's buttons, such as the driver's "I've collected the food".
      sx={{ bottom: { xs: 80, sm: 24 }, zIndex: (theme) => theme.zIndex.modal - 1 }}
    >
      <Alert
        severity="success"
        icon={<InstallMobileRoundedIcon />}
        sx={{ alignItems: "center", boxShadow: 3 }}
        action={
          <>
            <InstallButton color="inherit" size="small" onDone={dismiss} sx={{ whiteSpace: "nowrap" }}>{method === "ios" ? "Show me how" : "Install"}</InstallButton>
            <IconButton size="small" aria-label="Not now" color="inherit" onClick={dismiss}><CloseRoundedIcon fontSize="small" /></IconButton>
          </>
        }
      >
        {method === "ios" ? "Add Ladle to your home screen to get notifications." : "Install Ladle for quicker posting and pickups."}
      </Alert>
    </Snackbar>
  );
};

// Thumb-reachable navigation for signed-in users on phones.
export const BottomNav = ({ user }) => {
  const { pathname } = useLocation();
  const items = [
    { to: "/main", label: HOME_LABELS[roleOf(user)], icon: <HomeRoundedIcon /> },
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
