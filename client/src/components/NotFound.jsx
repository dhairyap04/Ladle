import { Link as RouterLink } from "react-router-dom";
import { Button, Container, Paper, Typography } from "@mui/material";
import AppHeader from "./Shared/AppHeader";
import useAuthUser from "../useAuthUser";
import usePageTitle from "../usePageTitle";

// Shown for any address the app doesn't know.
const NotFound = () => {
  const user = useAuthUser();
  usePageTitle("Page not found");
  return (
    <>
      <AppHeader user={user} />
      <Container component="main" maxWidth="sm" sx={{ py: { xs: 5, md: 8 } }}>
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, borderRadius: 5, textAlign: "center" }}>
          <Typography component="h1" variant="h4" sx={{ color: "primary.dark" }}>We couldn&apos;t find that page</Typography>
          <Typography color="text.secondary" sx={{ mt: 1.5 }}>
            The link may be old, or the posting may have been removed.
          </Typography>
          <Button component={RouterLink} to={user ? "/main" : "/"} variant="contained" size="large" sx={{ mt: 3 }}>
            {user ? "Go to your home page" : "Go to the home page"}
          </Button>
        </Paper>
      </Container>
    </>
  );
};

export default NotFound;
