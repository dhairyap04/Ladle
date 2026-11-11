import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { Alert, Box, Button, Container, FormControlLabel, InputAdornment, Paper, Stack, Switch, TextField, Typography } from "@mui/material";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import VolunteerActivismRoundedIcon from "@mui/icons-material/VolunteerActivismRounded";

import AppHeader from "../Shared/AppHeader";
import ChipPicker from "../Shared/ChipPicker";
import api, { errorMessage } from "../../api";
import { FOOD_TYPES, WEEKDAYS } from "../../food";

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
});

const TEXT_FIELDS = ["name", "phoneNumber", "charitableTaxNum", "address", "website"];
const FOODBANK_FIELDS = ["acceptedFoodTypes", "coldStorage", "receivingDays", "maxPickupKg", "serviceRadiusKm"];

const Section = ({ title, hint, children }) => (
  <Box sx={{ "& + &": { mt: 4 } }}>
    <Typography component="h2" variant="h6">{title}</Typography>
    {hint && <Typography variant="body2" color="text.secondary">{hint}</Typography>}
    <Box sx={{ mt: 2 }}>{children}</Box>
  </Box>
);

const ProfilePage = () => {
  const history = useHistory();
  const [user, setUser] = useState(undefined); // for the header
  const [values, setValues] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const loading = values === null;

  useEffect(() => {
    api.get("user/info")
      .then((res) => {
        const form = toForm(res.data.user);
        setUser(res.data.user);
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
    ["notifyByEmail", ...(user.isFoodbank ? ["notifyNewPostings"] : [])].forEach((f) => {
      if (values[f] !== saved[f]) changes[f] = values[f];
    });
    if (user.isFoodbank) {
      FOODBANK_FIELDS.forEach((f) => {
        if (JSON.stringify(values[f]) !== JSON.stringify(saved[f])) {
          changes[f] = f === "receivingDays" ? values[f].map(Number) : values[f];
        }
      });
    }
    if (Object.keys(changes).length === 0) {
      history.push("/main");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await api.post("user/update", changes);
      history.push("/main");
    } catch (err) {
      setSaving(false);
      setError(errorMessage(err));
    }
  };

  const isFoodbank = user && user.isFoodbank;
  const RoleIcon = isFoodbank ? VolunteerActivismRoundedIcon : StorefrontRoundedIcon;
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
              {loading ? "Loading…" : isFoodbank ? "Food bank account" : "Restaurant account"}
            </Typography>
          </Box>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 5 }}>
          <Section title="Organization">
            <Box sx={twoCol}>
              {field("name", "Name", { required: true })}
              {field("phoneNumber", "Phone number", { type: "tel", autoComplete: "tel" })}
              {field("website", "Website", { type: "url", autoComplete: "url" })}
              {isFoodbank && field("charitableTaxNum", "Charitable registration #", { placeholder: "123456789RR0001" })}
            </Box>
          </Section>

          <Section
            title={isFoodbank ? "Location and receiving hours" : "Location and hours"}
            hint={isFoodbank ? "When your team can collect or receive food." : undefined}
          >
            <Box sx={twoCol}>
              {field("address", "Address", { autoComplete: "street-address", sx: { gridColumn: { sm: "1 / -1" } } })}
              {field("openTime", isFoodbank ? "From" : "Opens at", { type: "time", InputLabelProps: { shrink: true } })}
              {field("closeTime", isFoodbank ? "Until" : "Closes at", { type: "time", InputLabelProps: { shrink: true } })}
            </Box>
            {isFoodbank && values && (
              <>
                <Typography variant="body2" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>Days you can collect (leave empty for any day)</Typography>
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

          {values && (
            <Section title="Alerts" hint="Alerts always appear under the bell at the top of the page.">
              <Stack>
                {isFoodbank && (
                  <FormControlLabel
                    control={<Switch checked={values.notifyNewPostings} onChange={(e) => set("notifyNewPostings", e.target.checked)} />}
                    label="Alert us when food we can accept is posted nearby"
                  />
                )}
                <FormControlLabel
                  control={<Switch checked={values.notifyByEmail} onChange={(e) => set("notifyByEmail", e.target.checked)} />}
                  label={isFoodbank ? "Also send alerts by email" : "Email me when my food is claimed or picked up, and when I get a message"}
                />
              </Stack>
            </Section>
          )}

          <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 4 }}>
            <Button onClick={() => history.push("/main")} color="inherit">Cancel</Button>
            <Button onClick={save} disabled={loading || saving} variant="contained" size="large">
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </Stack>
        </Paper>
      </Container>
    </>
  );
};

export default ProfilePage;
