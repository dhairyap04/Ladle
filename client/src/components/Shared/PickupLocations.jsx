import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import AddLocationAltRoundedIcon from "@mui/icons-material/AddLocationAltRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import api, { errorMessage } from "../../api";

const ADDRESS_HINT = "Street, city and province, e.g. 10150 Jasper Ave, Edmonton, AB";
const NOTES_PLACEHOLDER = "e.g. Use the back door on 101 St and ask for the kitchen manager";

// The signed-in restaurant's saved locations, loaded fresh (they may have
// changed on another device since the page loaded).
export function useMyLocations() {
  const [data, setData] = useState(null); // { locations, defaultLocationId, preferredLocationId }
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    api.get("user/info")
      .then((res) => {
        const { locations = [], defaultLocationId = null, preferredLocationId = null } = res.data.user;
        setData({ locations, defaultLocationId, preferredLocationId });
      })
      .catch((err) => {
        setError(errorMessage(err, "Couldn't load your locations."));
        setData({ locations: [], defaultLocationId: null, preferredLocationId: null });
      });
  }, []);
  useEffect(reload, [reload]);
  return { data, error };
}

// --- Choosing where a posting or weekly donation is collected ---------------

// Starting value for the picker. `source` is a posting or schedule being edited.
export function initialPickup(data, source) {
  if (!data) return null;
  const { locations, preferredLocationId } = data;
  if (source) {
    const match = locations.find((l) => (source.locationId && l.id === source.locationId) || l.address === source.fromRestaurantAddress);
    if (match) return { mode: "saved", locationId: match.id };
    return { mode: "other", address: source.fromRestaurantAddress || "", pickupNotes: source.pickupNotes || "", save: false, locationName: "" };
  }
  if (preferredLocationId) return { mode: "saved", locationId: preferredLocationId };
  // Nothing saved yet: type it once, and it's remembered.
  return { mode: "other", address: "", pickupNotes: "", save: true, locationName: "" };
}

// Request fields for the chosen pickup, or { error }.
export function pickupBody(pickup) {
  if (!pickup) return { error: "Your locations are still loading." };
  if (pickup.mode === "saved") return { locationId: pickup.locationId };
  const address = pickup.address.trim();
  if (!address) return { error: "Please enter the pickup address." };
  return {
    fromRestaurantAddress: address,
    pickupNotes: pickup.pickupNotes.trim(),
    ...(pickup.save ? { saveLocation: true, locationName: pickup.locationName.trim() } : {}),
  };
}

const Radio = ({ checked }) =>
  checked
    ? <CheckCircleRoundedIcon sx={{ color: "primary.main", flexShrink: 0 }} />
    : <RadioButtonUncheckedRoundedIcon sx={{ color: "text.disabled", flexShrink: 0 }} />;

// One tappable choice in the list.
const Choice = ({ checked, onSelect, children }) => (
  <ButtonBase
    role="radio"
    aria-checked={checked}
    onClick={onSelect}
    focusRipple
    sx={{
      // ButtonBase centres its content; keep the circles in one column on the left.
      display: "flex", alignItems: "flex-start", justifyContent: "flex-start", gap: 1.5, width: "100%", textAlign: "left",
      p: 1.5, borderRadius: 3, border: 2,
      borderColor: checked ? "primary.main" : "divider",
      bgcolor: checked ? "primary.light" : "background.paper",
      "&:hover": { borderColor: "primary.main" },
    }}
  >
    <Radio checked={checked} />
    <Box sx={{ minWidth: 0 }}>{children}</Box>
  </ButtonBase>
);

const LocationText = ({ location }) => (
  <>
    <Typography sx={{ fontWeight: 800 }}>{location.name}</Typography>
    <Typography variant="body2" color="text.secondary">{location.address}</Typography>
    {location.notes && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>Note for drivers: {location.notes}</Typography>}
  </>
);

// The "Where" part of the posting form: the saved location filled in, a list
// to pick from when there are several, or an address typed in.
export const LocationPicker = ({ data, value, onChange }) => {
  const [expanded, setExpanded] = useState(false);
  if (!data || !value) return <Skeleton variant="rounded" height={72} sx={{ borderRadius: 3 }} />;
  const { locations } = data;
  const set = (patch) => onChange({ ...value, ...patch });
  const chosen = value.mode === "saved" && locations.find((l) => l.id === value.locationId);

  // One location (or the choice already made) and not asked to change: just show it.
  if (chosen && !expanded && locations.length === 1) {
    return (
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, display: "flex", gap: 1.5, alignItems: "flex-start" }}>
        <PlaceRoundedIcon sx={{ color: "primary.main", mt: 0.25 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}><LocationText location={chosen} /></Box>
        <Button size="small" onClick={() => setExpanded(true)}>Change</Button>
      </Paper>
    );
  }

  const other = value.mode === "other";
  const otherFields = other && (
    <Stack spacing={1.5} sx={{ mt: locations.length ? 1.5 : 0 }}>
      <TextField
        fullWidth
        required
        label="Pickup address"
        helperText={ADDRESS_HINT}
        autoComplete="street-address"
        value={value.address}
        onChange={(e) => set({ address: e.target.value })}
        inputProps={{ maxLength: 200 }}
      />
      <TextField
        fullWidth
        label="Directions for drivers (optional)"
        placeholder={NOTES_PLACEHOLDER}
        value={value.pickupNotes}
        onChange={(e) => set({ pickupNotes: e.target.value })}
        inputProps={{ maxLength: 300 }}
      />
      <FormControlLabel
        control={<Checkbox checked={value.save} onChange={(e) => set({ save: e.target.checked })} />}
        label={locations.length ? "Save this location for next time" : "Save as my pickup location, so I don't have to type it again"}
      />
      {value.save && locations.length > 0 && (
        <TextField
          fullWidth
          label="Name for this location"
          placeholder="e.g. Whyte Ave"
          helperText="Optional. Leave it empty to use the street."
          value={value.locationName}
          onChange={(e) => set({ locationName: e.target.value })}
          inputProps={{ maxLength: 60 }}
        />
      )}
    </Stack>
  );

  if (!locations.length) return otherFields;

  return (
    <Box>
      <Stack spacing={1} role="radiogroup" aria-label="Pickup location">
        {locations.map((l) => (
          <Choice key={l.id} checked={value.mode === "saved" && value.locationId === l.id} onSelect={() => set({ mode: "saved", locationId: l.id })}>
            <LocationText location={l} />
          </Choice>
        ))}
        <Choice
          checked={other}
          onSelect={() => set({ mode: "other", address: value.address || "", pickupNotes: value.pickupNotes || "", save: Boolean(value.save), locationName: value.locationName || "" })}
        >
          <Typography sx={{ fontWeight: 800 }}>Somewhere else this time</Typography>
          <Typography variant="body2" color="text.secondary">For example, a catering event</Typography>
        </Choice>
      </Stack>
      {otherFields}
    </Box>
  );
};

// --- Managing locations on the profile ---------------------------------------

const LocationDialog = ({ location, isFirst, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: location ? location.name : "",
    address: location ? location.address : "",
    notes: location ? location.notes : "",
    makeDefault: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bind = (field) => ({ value: form[field], onChange: (e) => setForm((f) => ({ ...f, [field]: e.target.value })) });

  const save = async (e) => {
    e.preventDefault();
    if (!form.address.trim()) {
      setError("Please enter the address.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = { name: form.name, address: form.address, notes: form.notes, makeDefault: form.makeDefault };
      const res = location
        ? await api.patch(`user/locations/${location.id}`, body)
        : await api.post("user/locations", body);
      onSaved(res.data.user);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={() => !busy && onClose()} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={save}>
        <DialogTitle>{location ? "Edit location" : "Add a location"}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Name" placeholder="e.g. Jasper Ave or Downtown" helperText="Optional. Leave it empty to use the street." inputProps={{ maxLength: 60 }} {...bind("name")} />
            <TextField label="Address" required helperText={ADDRESS_HINT} autoComplete="street-address" inputProps={{ maxLength: 200 }} {...bind("address")} />
            <TextField label="Directions for drivers" placeholder={NOTES_PLACEHOLDER} multiline minRows={2} inputProps={{ maxLength: 300 }} helperText="Optional. Shown to whoever collects the food." {...bind("notes")} />
            {!isFirst && !(location && location.isDefault) && (
              <FormControlLabel
                control={<Checkbox checked={form.makeDefault} onChange={(e) => setForm((f) => ({ ...f, makeDefault: e.target.checked }))} />}
                label="Make this my main location"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={busy}>{busy ? "Saving…" : "Save location"}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

// The restaurant's pickup locations, on the profile page. Changes save
// straight away and hand back the updated user.
export const LocationsManager = ({ user, onChange }) => {
  const [editing, setEditing] = useState(null); // a location, "new" or null
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locations = (user.locations || []).map((l) => ({ ...l, isDefault: l.id === user.defaultLocationId }));

  const run = async (request) => {
    setBusy(true);
    setError("");
    try {
      const res = await request();
      onChange(res.data.user);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!locations.length && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 3 }}>
          Add your restaurant&apos;s address, and it&apos;s filled in for you every time you post food.
        </Alert>
      )}
      <Stack spacing={1.5}>
        {locations.map((l) => (
          <Paper key={l.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <PlaceRoundedIcon sx={{ color: "primary.main", mt: 0.25 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                  <Typography sx={{ fontWeight: 800 }}>{l.name}</Typography>
                  {l.isDefault && locations.length > 1 && <Chip size="small" label="Main" sx={{ bgcolor: "primary.light", color: "primary.dark", fontWeight: 700 }} />}
                </Stack>
                <Typography variant="body2" color="text.secondary">{l.address}</Typography>
                {l.notes && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>Note for drivers: {l.notes}</Typography>}
                {!l.hasLocation && (
                  <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: "warning.dark" }}>
                    We couldn&apos;t find this address on the map, so it won&apos;t show distances. Check the spelling and city.
                  </Typography>
                )}
                <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: "wrap" }}>
                  <Button size="small" onClick={() => setEditing(l)}>Edit</Button>
                  {!l.isDefault && (
                    <Button size="small" disabled={busy} onClick={() => run(() => api.patch(`user/locations/${l.id}`, { makeDefault: true }))}>
                      Make main
                    </Button>
                  )}
                  {locations.length > 1 && <Button size="small" color="error" onClick={() => setRemoving(l)}>Delete</Button>}
                </Stack>
              </Box>
            </Stack>
          </Paper>
        ))}
      </Stack>
      <Button startIcon={<AddLocationAltRoundedIcon />} variant="outlined" sx={{ mt: 2 }} onClick={() => setEditing("new")}>
        {locations.length ? "Add another location" : "Add your address"}
      </Button>

      {editing && (
        <LocationDialog
          location={editing === "new" ? null : editing}
          isFirst={!locations.length}
          onClose={() => setEditing(null)}
          onSaved={(u) => {
            onChange(u);
            setEditing(null);
          }}
        />
      )}
      <Dialog open={Boolean(removing)} onClose={() => !busy && setRemoving(null)}>
        <DialogTitle>Delete {removing && removing.name}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Food you&apos;ve already posted from here keeps this address. Weekly donations from here keep it too, but won&apos;t pick up later changes.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRemoving(null)} disabled={busy}>Keep it</Button>
          <Button
            color="error"
            variant="contained"
            disabled={busy}
            onClick={async () => {
              if (await run(() => api.delete(`user/locations/${removing.id}`))) setRemoving(null);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
