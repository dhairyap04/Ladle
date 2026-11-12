import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { Alert, Box, Button, Container, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, InputAdornment, Link, MenuItem, Paper, Skeleton, Snackbar, Stack, Switch, TextField, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import VolunteerActivismRoundedIcon from "@mui/icons-material/VolunteerActivismRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import { ROLE_LABELS, VEHICLES, roleOf } from "../../roles";
import ReliabilityBadge from "../Shared/ReliabilityBadge";

import AppHeader from "../Shared/AppHeader";
import ChipPicker from "../Shared/ChipPicker";
import api, { errorMessage } from "../../api";
import { InstallButton } from "../Shared/InstallGuide";
import { FOOD_TYPES, WEEKDAYS } from "../../food";
import usePageTitle from "../../usePageTitle";

// openHours is stored as "HH:MM-HH:MM".
const splitHours = (openHours) => {
  const [openTime = "", closeTime = ""] = (openHours || "").split("-");
  return { openTime: openTime.trim(), closeTime: closeTime.trim() };
};

const COLD_STORAGE = { refrigerated: "Refrigerator", frozen: "Freezer" };

// Turns the saved user into form values (strings for text inputs, arrays for chips).
const toForm = (user) => ({
  name: user.name || "",
  phoneNumber: user.phoneNumber || "",
  charitableTaxNum: user.charitableTaxNum || "",
  address: user.address || "",
  website: user.website || "",
  ...splitHours(user.openHours),
  acceptedFoodTypes: user.acceptedFoodTypes || [],
  coldStorage: user.coldStorage || [],
  receivingDays: (user.receivingDays || []).map(String),
  maxPickupKg: user.maxPickupKg ? String(user.maxPickupKg) : "",
  serviceRadiusKm: user.serviceRadiusKm ? String(user.serviceRadiusKm) : "",
  notifyByEmail: user.notifyByEmail !== false,
  notifyNewPostings: user.notifyNewPostings !== false,
  vehicle: user.vehicle || "",
});

const TEXT_FIELDS = ["name", "phoneNumber", "charitableTaxNum", "address", "website"];
const FOODBANK_FIELDS = ["acceptedFoodTypes", "coldStorage", "receivingDays", "maxPickupKg", "serviceRadiusKm"];

const VERIFICATION = {
  unverified: {
    severity: "info",
    title: "Get verified",
    text: "Verified food banks show a badge to restaurants. Save your charitable registration number and address, then request verification.",
  },
  pending: { severity: "info", title: "Verification requested", text: "A Ladle admin is reviewing your details. We'll let you know." },
  verified: { severity: "success", title: "Verified food bank", text: "Restaurants see a verified badge when you claim their food." },
  rejected: { severity: "warning", title: "Verification not approved", text: "" },
};

// Verification status and the button to request it.
const VerificationCard = ({ user, onChange, dirty }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = user.verificationStatus || "unverified";
  const info = VERIFICATION[status];
  const request = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api.post("user/verification/request");
      onChange(res.data.user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Alert
      severity={info.severity}
      icon={status === "verified" ? <VerifiedRoundedIcon /> : undefined}
      sx={{ mb: 3, borderRadius: 3 }}
      action={
        (status === "unverified" || status === "rejected") && (
          <Button color="inherit" size="small" onClick={request} disabled={busy || dirty} title={dirty ? "Save your profile first" : undefined}>
            {status === "rejected" ? "Request again" : "Request verification"}
          </Button>
        )
      }
    >
      <strong>{info.title}.</strong> {status === "rejected" ? `Reason: ${user.verificationNote || "not given"}. Update your details and request again.` : info.text}
      {error && <Box sx={{ mt: 0.5, color: "error.main" }}>{error}</Box>}
    </Alert>
  );
};

// Change password while logged in. Separate from the profile form so the
// passwords are never sent with other changes.
const PasswordSection = () => {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setDone("");
    if (form.next.length < 8) return setError("New password must be at least 8 characters.");
    if (form.next !== form.confirm) return setError("The new passwords don't match.");
    setBusy(true);
    setError("");
    try {
      const res = await api.post("user/password/change", { currentPassword: form.current, newPassword: form.next });
      setDone(res.data.msg);
      setForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Paper variant="outlined" component="form" onSubmit={submit} noValidate sx={{ p: { xs: 3, sm: 4 }, borderRadius: 5, mt: 3 }}>
      <Typography component="h2" variant="h6">Password</Typography>
      <Typography variant="body2" color="text.secondary">Changing it signs out your other devices.</Typography>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {done && <Alert severity="success" sx={{ mt: 2 }}>{done}</Alert>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 2, mt: 2 }}>
        <TextField type="password" label="Current password" autoComplete="current-password" value={form.current} onChange={set("current")} />
        <TextField type="password" label="New password" autoComplete="new-password" value={form.next} onChange={set("next")} helperText="At least 8 characters" />
        <TextField type="password" label="New password again" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />
      </Box>
      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
        <Button type="submit" variant="outlined" disabled={busy || !form.current || !form.next}>
          {busy ? "Changing…" : "Change password"}
        </Button>
      </Stack>
    </Paper>
  );
};

// Installing the app on this device, and signing out lost or shared devices.
const DevicesSection = () => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { severity, text }

  const signOutOthers = async () => {
    setBusy(true);
    try {
      const res = await api.post("user/logout-others");
      setMessage({ severity: "success", text: res.data.msg });
    } catch (err) {
      setMessage({ severity: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 5, mt: 3 }}>
      <Typography component="h2" variant="h6">Your devices</Typography>
      <Typography variant="body2" color="text.secondary">
        Ladle works best added to the home screen of your phone or tablet: it opens full screen and can send notifications.
        If a phone is lost, or someone else used a shared tablet, sign out everywhere else.
      </Typography>
      {message && <Alert severity={message.severity} sx={{ mt: 2 }}>{message.text}</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
        <InstallButton variant="outlined">Add Ladle to this device</InstallButton>
        <Button onClick={signOutOthers} disabled={busy}>Sign out on all other devices</Button>
      </Stack>
    </Paper>
  );
};

// Download everything Ladle holds about you, or delete your account.
const DataSection = () => {
  const history = useHistory();
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await api.post("user/delete", { password });
      history.replace("/?deleted=1");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 5, mt: 3 }}>
      <Typography component="h2" variant="h6">Your data</Typography>
      <Typography variant="body2" color="text.secondary">
        See what Ladle stores and why in the <Link component={RouterLink} to="/privacy">privacy policy</Link>.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
        <Button variant="outlined" href={`${import.meta.env.REACT_APP_HOST_URL}user/export`}>Download my data</Button>
        <Button color="error" onClick={() => setDeleting(true)}>Delete my account</Button>
      </Stack>

      <Dialog open={deleting} onClose={() => !busy && setDeleting(false)} fullWidth maxWidth="xs">
        <DialogTitle>Delete your account?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This can&apos;t be undone. Your profile, open postings, weekly donations, ratings, notifications and messages are deleted.
            Pickups you completed stay in the other organization&apos;s records under &quot;Former Ladle member&quot;.
          </DialogContentText>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          <TextField
            fullWidth
            type="password"
            label="Your password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleting(false)} disabled={busy}>Keep my account</Button>
          <Button color="error" variant="contained" onClick={remove} disabled={busy || !password}>Delete forever</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

const Section = ({ title, hint, children }) => (
  <Box sx={{ "& + &": { mt: 4 } }}>
    <Typography component="h2" variant="h6">{title}</Typography>
    {hint && <Typography variant="body2" color="text.secondary">{hint}</Typography>}
    <Box sx={{ mt: 2 }}>{children}</Box>
  </Box>
);

const ProfilePage = () => {
  usePageTitle("Your profile");
  const history = useHistory();
  const [user, setUser] = useState(undefined); // for the header
  const [track, setTrack] = useState(null); // own reliability summary
  const [values, setValues] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const loading = values === null;

  useEffect(() => {
    api.get("user/info")
      .then((res) => {
        const form = toForm(res.data.user);
        setUser(res.data.user);
        setTrack(res.data.reliability || null);
        setValues(form);
        setSaved(form);
      })
      .catch((err) => {
        if (err.response && err.response.status === 401) history.replace("/auth");
        else setError(errorMessage(err, "Couldn't load your profile."));
      });
  }, [history]);

  const set = (field, value) => setValues((v) => ({ ...v, [field]: value }));
  const field = (name, label, extra = {}) => (
    <TextField
      value={values ? values[name] : ""}
      onChange={(e) => set(name, e.target.value)}
      fullWidth
      label={label}
      disabled={loading}
      {...extra}
    />
  );

  const save = async () => {
    if (!values.name.trim()) {
      setError("Name cannot be empty.");
      return;
    }
    // Send only what changed, so untouched fields are never overwritten.
    const changes = {};
    TEXT_FIELDS.forEach((f) => {
      if (values[f] !== saved[f]) changes[f] = values[f];
    });
    if (values.openTime !== saved.openTime || values.closeTime !== saved.closeTime) {
      changes.openHours = values.openTime || values.closeTime ? `${values.openTime}-${values.closeTime}` : "";
    }
    ["notifyByEmail", ...(role !== "restaurant" ? ["notifyNewPostings"] : [])].forEach((f) => {
      if (values[f] !== saved[f]) changes[f] = values[f];
    });
    if (isDriver && values.vehicle !== saved.vehicle) changes.vehicle = values.vehicle;
    if (role !== "restaurant") {
      FOODBANK_FIELDS.filter((f) => isFoodbank || f !== "acceptedFoodTypes").forEach((f) => {
        if (JSON.stringify(values[f]) !== JSON.stringify(saved[f])) {
          changes[f] = f === "receivingDays" ? values[f].map(Number) : values[f];
        }
      });
    }
    if (Object.keys(changes).length === 0) {
      setNotice("There's nothing new to save.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await api.post("user/update", changes);
      // Stay on the page so the change is visible; resync from what was saved.
      const form = toForm(res.data.user);
      setUser(res.data.user);
      setValues(form);
      setSaved(form);
      setNotice("Profile saved.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const role = roleOf(user);
  const isFoodbank = role === "foodbank";
  const isDriver = role === "driver";
  const RoleIcon = isDriver ? LocalShippingRoundedIcon : isFoodbank ? VolunteerActivismRoundedIcon : StorefrontRoundedIcon;
  const twoCol = { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 };

  return (
    <>
      <AppHeader user={user} />
      <Container component="main" maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <Box sx={{ width: 56, height: 56, borderRadius: 3, bgcolor: "primary.light", color: "primary.main", display: "grid", placeItems: "center" }}>
            <RoleIcon />
          </Box>
          <Box>
            <Typography component="h1" variant="h4" sx={{ color: "primary.dark" }}>Your profile</Typography>
            <Typography color="text.secondary">
              {loading ? "Loading…" : `${ROLE_LABELS[role]} account`}
            </Typography>
          </Box>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {track && role !== "restaurant" && (
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 4, mb: 3 }}>
            <Typography sx={{ fontWeight: 800 }}>Your track record</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              What restaurants{isDriver ? " and food banks" : ""} see about you, from the last 6 months.
              Releasing within 2 hours of a pickup or missing one lowers it.
            </Typography>
            <ReliabilityBadge summary={track} noun={isDriver ? "delivery" : "pickup"} />
          </Paper>
        )}
        {isFoodbank && (
          <VerificationCard user={user} onChange={setUser} dirty={JSON.stringify(values) !== JSON.stringify(saved)} />
        )}

        {/* Fields render once the profile has loaded, so labels sit above filled values. */}
        {loading && !error && <Skeleton variant="rounded" height={480} sx={{ borderRadius: 5 }} />}
        {!loading && (
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 5 }}>
          <Section title={isDriver ? "About you" : "Organization"} hint={isDriver ? "Your name and phone number are shared with the restaurant and food bank once you accept a delivery." : undefined}>
            <Box sx={twoCol}>
              {field("name", "Name", { required: true })}
              {field("phoneNumber", "Phone number", { type: "tel", autoComplete: "tel" })}
              {!isDriver && field("website", "Website", { type: "url", autoComplete: "url" })}
              {isFoodbank && field("charitableTaxNum", "Charitable registration #", { placeholder: "123456789RR0001" })}
            </Box>
          </Section>

          <Section
            title={isDriver ? "Where and when you can drive" : isFoodbank ? "Location and receiving hours" : "Location and hours"}
            hint={isDriver
              ? "Your home area is only used to find deliveries near you; it isn't shown to anyone."
              : isFoodbank ? "When your team can collect or receive food." : undefined}
          >
            <Box sx={twoCol}>
              {field("address", isDriver ? "Home area (street or neighbourhood)" : "Address", { autoComplete: "street-address", sx: { gridColumn: { sm: "1 / -1" } } })}
              {field("openTime", isFoodbank || isDriver ? "From" : "Opens at", { type: "time", InputLabelProps: { shrink: true } })}
              {field("closeTime", isFoodbank || isDriver ? "Until" : "Closes at", { type: "time", InputLabelProps: { shrink: true } })}
            </Box>
            {(isFoodbank || isDriver) && values && (
              <>
                <Typography variant="body2" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>{isDriver ? "Days you can drive" : "Days you can collect"} (leave empty for any day)</Typography>
                <ChipPicker label="Receiving days" options={WEEKDAYS} value={values.receivingDays} onChange={(v) => set("receivingDays", v)} />
              </>
            )}
          </Section>

          {isFoodbank && values && (
            <Section title="What you can accept" hint="Postings that don't match are labelled, so you can skip food you can't take or store.">
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>Food types (leave empty to accept anything)</Typography>
              <ChipPicker label="Accepted food types" options={FOOD_TYPES} value={values.acceptedFoodTypes} onChange={(v) => set("acceptedFoodTypes", v)} />
              <Typography variant="body2" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>Cold storage you have</Typography>
              <ChipPicker label="Cold storage" options={COLD_STORAGE} value={values.coldStorage} onChange={(v) => set("coldStorage", v)} />
              <Box sx={{ ...twoCol, mt: 2.5 }}>
                {field("maxPickupKg", "Most you can take per pickup", {
                  type: "number",
                  inputProps: { min: 1 },
                  InputProps: { endAdornment: <InputAdornment position="end">kg</InputAdornment> },
                  helperText: "Optional",
                })}
                {field("serviceRadiusKm", "How far you'll travel", {
                  type: "number",
                  inputProps: { min: 1, max: 200 },
                  InputProps: { endAdornment: <InputAdornment position="end">km</InputAdornment> },
                  helperText: "Used for distance search and new-food alerts",
                })}
              </Box>
            </Section>
          )}

          {isDriver && values && (
            <Section title="Your vehicle" hint="Deliveries you can't carry or keep cold are marked, and you won't be alerted about them.">
              <Box sx={twoCol}>
                {field("vehicle", "Vehicle", { select: true, children: [<MenuItem key="" value="">Not set</MenuItem>, ...Object.entries(VEHICLES).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)] })}
                {field("maxPickupKg", "Most you can carry", {
                  type: "number",
                  inputProps: { min: 1 },
                  InputProps: { endAdornment: <InputAdornment position="end">kg</InputAdornment> },
                })}
                {field("serviceRadiusKm", "How far you'll drive to a pickup", {
                  type: "number",
                  inputProps: { min: 1, max: 200 },
                  InputProps: { endAdornment: <InputAdornment position="end">km</InputAdornment> },
                })}
              </Box>
              <FormControlLabel
                sx={{ mt: 1 }}
                control={<Switch checked={values.coldStorage.length > 0} onChange={(e) => set("coldStorage", e.target.checked ? ["refrigerated"] : [])} />}
                label="I have a cooler for chilled or frozen food"
              />
            </Section>
          )}

          {values && (
            <Section title="Alerts" hint="Alerts always appear under the bell at the top of the page.">
              <Stack>
                {(isFoodbank || isDriver) && (
                  <FormControlLabel
                    control={<Switch checked={values.notifyNewPostings} onChange={(e) => set("notifyNewPostings", e.target.checked)} />}
                    label={isDriver ? "Alert me when a delivery I can do is needed nearby" : "Alert us when food we can accept is posted nearby"}
                  />
                )}
                <FormControlLabel
                  control={<Switch checked={values.notifyByEmail} onChange={(e) => set("notifyByEmail", e.target.checked)} />}
                  label={isFoodbank || isDriver ? "Also send alerts by email" : "Email me when my food is claimed or picked up, and when I get a message"}
                />
              </Stack>
            </Section>
          )}

          <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 4 }}>
            <Button onClick={() => history.push("/main")} color="inherit">Back</Button>
            <Button onClick={save} disabled={loading || saving} variant="contained" size="large">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </Stack>
        </Paper>
        )}
        {!loading && <PasswordSection />}
        {!loading && <DevicesSection />}
        {!loading && <DataSection />}
        <Snackbar
          open={Boolean(notice)}
          autoHideDuration={3000}
          onClose={() => setNotice("")}
          message={notice}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          sx={{ bottom: { xs: 80, sm: 24 } }}
        />
      </Container>
    </>
  );
};

export default ProfilePage;
