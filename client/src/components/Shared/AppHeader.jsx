import { Link as RouterLink, useHistory } from "react-router-dom";
import { Box, Button, Container, IconButton } from "@mui/material";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import Logo from "./Logo";
import NotificationBell from "./NotificationBell";
import { BottomNav, InstallPrompt, OfflineBanner } from "./AppChrome";
import { HOME_LABELS, roleOf } from "../../roles";
import api from "../../api";

// Top bar shared by every page. `user` is the signed-in user, null for a
// guest, or undefined while the page is still checking.
const AppHeader = ({ user }) => {
  const history = useHistory();

  const logOut = async () => {
    try {
      await api.post("user/logout");
    } finally {
      history.push("/");
    }
  };

  return (
    <>
    <OfflineBanner />
    <InstallPrompt />
    {user && <BottomNav user={user} />}
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        bgcolor: "rgba(250, 247, 242, 0.9)",
        backdropFilter: "blur(8px)",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Container maxWidth="lg" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, py: 1.5 }}>
        <Logo to={user ? "/main" : "/"} />
        <Box component="nav" sx={{ display: "flex", alignItems: "center", gap: { xs: 0.5, sm: 1 }, "& .MuiButton-root": { whiteSpace: "nowrap" } }}>
          {user ? (
            <>
              <Button component={RouterLink} to="/main" color="inherit" sx={{ display: { xs: "none", sm: "inline-flex" } }}>
                {HOME_LABELS[roleOf(user)]}
              </Button>
              <Button component={RouterLink} to="/impact" color="inherit" sx={{ display: { xs: "none", sm: "inline-flex" } }}>
                Impact
              </Button>
              {user.isAdmin && (
                <Button component={RouterLink} to="/admin" color="inherit" sx={{ display: { xs: "none", sm: "inline-flex" } }}>
                  Admin
                </Button>
              )}
              <NotificationBell />
              <Button component={RouterLink} to="/view_profile" color="inherit" sx={{ display: { xs: "none", sm: "inline-flex" } }}>
                Profile
              </Button>
              <Button onClick={logOut} variant="outlined" startIcon={<LogoutRoundedIcon />} sx={{ display: { xs: "none", sm: "inline-flex" } }}>
                Log out
              </Button>
              <IconButton onClick={logOut} aria-label="Log out" sx={{ display: { xs: "inline-flex", sm: "none" } }}>
                <LogoutRoundedIcon />
              </IconButton>
            </>
          ) : user === null ? (
            <>
              <Button component={RouterLink} to="/main" color="inherit" sx={{ display: { xs: "none", sm: "inline-flex" } }}>
                Browse pickups
              </Button>
              <Button component={RouterLink} to="/auth?mode=login" color="inherit">
                Log in
              </Button>
              <Button component={RouterLink} to="/auth" variant="contained">
                Get started
              </Button>
            </>
          ) : null}
        </Box>
      </Container>
    </Box>
    </>
  );
};

export default AppHeader;
