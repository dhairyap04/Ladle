import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import IosShareRoundedIcon from "@mui/icons-material/IosShareRounded";
import AddBoxOutlinedIcon from "@mui/icons-material/AddBoxOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { installMethod, onInstallAvailable, promptInstall } from "../../pwa";

// How Ladle can be installed here ("prompt", "ios" or null), kept up to date
// as the browser decides whether it can show its own prompt.
export function useInstallMethod() {
  const [method, setMethod] = useState(installMethod);
  useEffect(() => onInstallAvailable(() => setMethod(installMethod())), []);
  return method;
}

const Step = ({ n, icon, children }) => (
  <Stack direction="row" spacing={1.5} alignItems="flex-start">
    <Box
      sx={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
        display: "grid", placeItems: "center",
        bgcolor: "primary.light", color: "primary.dark", fontWeight: 800, fontSize: "0.9rem",
      }}
    >
      {n}
    </Box>
    <Typography sx={{ pt: 0.25 }}>
      {children}
      {icon && <Box component="span" sx={{ display: "inline-flex", verticalAlign: "middle", ml: 0.75, color: "primary.main" }}>{icon}</Box>}
    </Typography>
  </Stack>
);

// The Share menu steps for iPhone and iPad, where Safari has no install button.
export const IosInstallDialog = ({ open, onClose }) => (
  <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
    <DialogTitle>Add Ladle to your home screen</DialogTitle>
    <DialogContent>
      <Stack spacing={2}>
        <Step n={1} icon={<IosShareRoundedIcon fontSize="small" />}>
          Tap the <strong>Share</strong> button. In Safari it&apos;s in the toolbar at the bottom (on iPad, at the top). In Chrome it&apos;s at the top right.
        </Step>
        <Step n={2} icon={<AddBoxOutlinedIcon fontSize="small" />}>
          Scroll down and choose <strong>Add to Home Screen</strong>.
        </Step>
        <Step n={3} icon={<CheckCircleRoundedIcon fontSize="small" />}>
          Tap <strong>Add</strong>, then open Ladle from its icon on your home screen.
        </Step>
      </Stack>
      <Alert severity="info" sx={{ mt: 3 }}>
        On iPhone and iPad, Ladle can only send notifications (like a new delivery or a pickup reminder) once it&apos;s on your home screen.
      </Alert>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button variant="contained" onClick={onClose}>Got it</Button>
    </DialogActions>
  </Dialog>
);

// An "Install the app" button that does the right thing for this browser.
// Renders nothing where Ladle is already installed or can't be.
export const InstallButton = ({ onDone, children = "Install the app", ...props }) => {
  const method = useInstallMethod();
  const [guide, setGuide] = useState(false);
  if (!method) return null;
  const click = async () => {
    if (method === "ios") setGuide(true);
    else if (await promptInstall()) onDone && onDone();
  };
  return (
    <>
      <Button onClick={click} {...props}>{children}</Button>
      <IosInstallDialog open={guide} onClose={() => { setGuide(false); onDone && onDone(); }} />
    </>
  );
};
