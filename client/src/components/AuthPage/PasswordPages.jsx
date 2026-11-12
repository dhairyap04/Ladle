import { useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { Alert, Box, Button, Container, Link, Paper, TextField, Typography } from "@mui/material";
import AppHeader from "../Shared/AppHeader";
import api, { errorMessage } from "../../api";
import usePageTitle from "../../usePageTitle";

const Card = ({ title, intro, children }) => (
  <>
    <AppHeader user={null} />
    <Container component="main" maxWidth="sm" sx={{ py: { xs: 4, md: 7 } }}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 5 }}>
        <Typography component="h1" variant="h4" sx={{ color: "primary.dark" }}>{title}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>{intro}</Typography>
        {children}
      </Paper>
    </Container>
  </>
);

// "Forgot your password?" — asks for an email and sends a reset link.
export const ForgotPasswordPage = () => {
  usePageTitle("Forgot password");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.post("user/password/forgot", { email });
      setSent(res.data.msg);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Forgot your password?" intro="Enter the email you signed up with and we'll send you a link to choose a new password.">
      {sent ? (
        <>
          <Alert severity="success" sx={{ mt: 3 }}>{sent}</Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Didn&apos;t get it? Check your spam folder, or <Link component="button" onClick={() => setSent("")} sx={{ verticalAlign: "baseline" }}>try again</Link>.
          </Typography>
          <Button component={RouterLink} to="/auth?mode=login" sx={{ mt: 2 }}>Back to log in</Button>
        </>
      ) : (
        <Box component="form" onSubmit={submit} noValidate sx={{ mt: 3 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField fullWidth required type="email" label="Email address" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" fullWidth variant="contained" size="large" disabled={busy} sx={{ mt: 3 }}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
          <Button component={RouterLink} to="/auth?mode=login" fullWidth sx={{ mt: 1 }}>Back to log in</Button>
        </Box>
      )}
    </Card>
  );
};

// Opened from the emailed link: /reset-password?token=...
export const ResetPasswordPage = () => {
  usePageTitle("Choose a new password");
  const token = new URLSearchParams(useLocation().search).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError("");
    try {
      const res = await api.post("user/password/reset", { token, password });
      setDone(res.data.msg);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  if (!token) {
    return (
      <Card title="Reset link missing" intro="This page needs the link from your reset email.">
        <Button component={RouterLink} to="/forgot-password" variant="contained" sx={{ mt: 3 }}>Get a new link</Button>
      </Card>
    );
  }

  return (
    <Card title="Choose a new password" intro="Other devices signed in to your account will be signed out.">
      {done ? (
        <>
          <Alert severity="success" sx={{ mt: 3 }}>{done}</Alert>
          <Button component={RouterLink} to="/auth?mode=login" variant="contained" size="large" sx={{ mt: 3 }}>Log in</Button>
        </>
      ) : (
        <Box component="form" onSubmit={submit} noValidate sx={{ mt: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}{" "}
              {/expired|invalid/i.test(error) && <Link component={RouterLink} to="/forgot-password">Get a new link</Link>}
            </Alert>
          )}
          <TextField fullWidth required type="password" label="New password" autoComplete="new-password" helperText="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
          <TextField fullWidth required type="password" label="Type it again" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} sx={{ mt: 2 }} />
          <Button type="submit" fullWidth variant="contained" size="large" disabled={busy} sx={{ mt: 3 }}>
            {busy ? "Saving…" : "Set new password"}
          </Button>
        </Box>
      )}
    </Card>
  );
};
