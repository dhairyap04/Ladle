import { useCallback, useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import { Badge, Box, Button, Divider, FormControlLabel, IconButton, ListItemButton, Popover, Stack, Switch, Typography } from "@mui/material";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import api from "../../api";
import { disablePush, enablePush, pushStatus } from "../../pushClient";
import { isIos, isStandalone } from "../../pwa";
import { InstallButton } from "./InstallGuide";

const POLL_MS = 30000;

const timeAgo = (iso) => {
  const minutes = Math.round((Date.now() - new Date(iso)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
};

const browserAlertsSupported = () => typeof window !== "undefined" && "Notification" in window;

// Bell with an unread count. Polls while the tab is visible, and shows a
// browser notification for new items once the user has allowed it.
const NotificationBell = () => {
  const history = useHistory();
  const [data, setData] = useState({ items: [], unread: 0 });
  const [anchor, setAnchor] = useState(null);
  const [permission, setPermission] = useState(browserAlertsSupported() ? Notification.permission : "unsupported");
  const seen = useRef(null); // ids already shown, so only new ones raise an alert
  const [push, setPush] = useState({ available: false, subscribed: false });
  const [pushError, setPushError] = useState("");

  useEffect(() => { pushStatus().then(setPush); }, []);

  const togglePush = async (on) => {
    setPushError("");
    try {
      if (on) await enablePush(push.publicKey);
      else await disablePush();
    } catch (err) {
      setPushError(err.message);
    }
    setPush(await pushStatus());
  };

  const load = useCallback(async () => {
    try {
      const res = await api.get("notification");
      const fresh = res.data.items.filter((n) => !n.readAt && seen.current && !seen.current.has(n._id));
      if (browserAlertsSupported() && Notification.permission === "granted" && document.visibilityState !== "visible") {
        fresh.slice(0, 3).forEach((n) => {
          const alert = new Notification(n.title, { body: n.body, icon: "/images/icon-192.png", tag: n._id });
          alert.onclick = () => {
            window.focus();
            if (n.link) history.push(n.link);
          };
        });
      }
      seen.current = new Set(res.data.items.map((n) => n._id));
      setData(res.data);
    } catch {
      // Signed out or offline: try again on the next poll.
    }
  }, [history]);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" || permission === "granted") load();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, permission]);

  const open = (n) => {
    setAnchor(null);
    if (!n.readAt) api.post(`notification/${n._id}/read`).then(load);
    if (n.link) history.push(n.link);
  };

  const markAll = async () => {
    await api.post("notification/read-all");
    load();
  };

  const enableAlerts = async () => setPermission(await Notification.requestPermission());

  return (
    <>
      <IconButton
        aria-label={data.unread ? `Notifications, ${data.unread} unread` : "Notifications"}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <Badge badgeContent={data.unread} color="secondary" max={9}>
          <NotificationsRoundedIcon />
        </Badge>
      </IconButton>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { width: 360, maxWidth: "calc(100vw - 24px)", borderRadius: 4 } }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
          <Typography sx={{ fontWeight: 800 }}>Notifications</Typography>
          {data.unread > 0 && <Button size="small" onClick={markAll}>Mark all read</Button>}
        </Stack>
        <Divider />
        <Box sx={{ maxHeight: 400, overflowY: "auto" }}>
          {data.items.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 3, textAlign: "center" }}>
              You&apos;re all caught up.
            </Typography>
          ) : (
            data.items.map((n) => (
              <ListItemButton key={n._id} onClick={() => open(n)} sx={{ alignItems: "flex-start", gap: 1.5, py: 1.5, bgcolor: n.readAt ? "transparent" : "primary.light" }}>
                <Box sx={{ width: 8, height: 8, mt: 1, borderRadius: "50%", flexShrink: 0, bgcolor: n.readAt ? "transparent" : "secondary.main" }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{n.title}</Typography>
                  {n.body && <Typography variant="body2" color="text.secondary">{n.body}</Typography>}
                  <Typography variant="caption" color="text.secondary">{timeAgo(n.createdAt)}</Typography>
                </Box>
              </ListItemButton>
            ))
          )}
        </Box>
        {push.available && (
          <>
            <Divider />
            <Box sx={{ px: 2, py: 1 }}>
              <FormControlLabel
                control={<Switch checked={push.subscribed} onChange={(e) => togglePush(e.target.checked)} disabled={push.blocked && !push.subscribed} />}
                label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Push notifications on this device</Typography>}
              />
              {(pushError || (push.blocked && !push.subscribed)) && (
                <Typography variant="caption" color="error" sx={{ display: "block" }}>
                  {pushError || "Notifications are blocked for this site. Allow them in your browser settings."}
                </Typography>
              )}
            </Box>
          </>
        )}
        {isIos() && !isStandalone() && (
          <>
            <Divider />
            <Box sx={{ p: 1.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                To get notifications on this {/iPad|Macintosh/.test(navigator.userAgent) ? "iPad" : "iPhone"}, add Ladle to your home screen and open it from there.
              </Typography>
              <InstallButton fullWidth size="small" variant="outlined">Show me how</InstallButton>
            </Box>
          </>
        )}
        {!push.available && permission === "default" && !isIos() && (
          <>
            <Divider />
            <Box sx={{ p: 1.5 }}>
              <Button fullWidth size="small" startIcon={<NotificationsActiveRoundedIcon />} onClick={enableAlerts}>
                Get browser alerts for new notifications
              </Button>
            </Box>
          </>
        )}
      </Popover>
    </>
  );
};

export default NotificationBell;
