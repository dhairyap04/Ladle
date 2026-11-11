import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AddAPhotoRoundedIcon from "@mui/icons-material/AddAPhotoRounded";

import AddressContainer from "../../Shared/AddressContainer";
import ChipPicker from "../../Shared/ChipPicker";
import api, { errorMessage } from "../../../api";
import { localDateTimeToIso, todayDateInput, toTimeInput } from "../../../time";
import { ALLERGENS, FOOD_TYPES, STORAGE, WEEKDAYS, photoUrl } from "../../../food";
import { resizePhoto } from "../../../photo";

const ALLERGEN_OPTIONS = { ...ALLERGENS, none: "None of these" };

// "2026-11-11T09:30:00.000Z" -> "2026-11-11T02:30" for <input type="datetime-local">.
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const Section = ({ title, hint, children }) => (
  <Box>
    <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
    {hint && <Typography variant="body2" color="text.secondary">{hint}</Typography>}
    <Box sx={{ mt: 1.5 }}>{children}</Box>
  </Box>
);

// Creates a posting or a weekly schedule. Edits a posting when given `posting`,
// or a schedule when given `schedule`.
const CreatePostingModal = ({ posting, schedule, onClose, onSaved }) => {
  const isEdit = Boolean(posting || schedule);
  const source = posting || schedule;
  const [repeat, setRepeat] = useState(Boolean(schedule));
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));

  const [form, setForm] = useState({
    // Create uses separate address parts; edit shows the saved address as one field.
    street: "",
    city: "",
    province: "",
    postalCode: "",
    country: "",
    address: source ? source.fromRestaurantAddress : "",
    pickupDate: (posting && posting.pickupDate) || (schedule && schedule.startsOn) || todayDateInput(),
    endsOn: (schedule && schedule.endsOn) || "",
    daysOfWeek: schedule ? schedule.daysOfWeek.map(String) : [String(new Date().getDay())],
    pickupTimeBegin: source ? toTimeInput(source.pickupTimeBegin) : "",
    pickupTimeEnd: source ? toTimeInput(source.pickupTimeEnd) : "",
    notes: source ? source.notes || "" : "",
    foodTypes: source ? source.foodTypes || [] : [],
    allergens: source ? source.allergens || [] : [],
    storage: source ? source.storage || "ambient" : "ambient",
    preparedAt: posting ? toLocalInput(posting.preparedAt) : "",
    quantity: source ? source.quantity || "" : "",
    estimatedWeightKg: source && source.estimatedWeightKg ? String(source.estimatedWeightKg) : "",
  });
  // null: unchanged; a data URL: new photo; "": remove the existing one.
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const bind = (field) => ({ value: form[field], onChange: (e) => set(field, e.target.value) });

  const fullAddress = () => {
    if (isEdit) return form.address.trim();
    return [form.street, form.city, form.province, form.postalCode, form.country]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ");
  };

  const validate = () => {
    if (isEdit ? !form.address.trim() : !form.street.trim() || !form.city.trim()) {
      return isEdit ? "Please enter the pickup address." : "Please enter the street address and city.";
    }
    if (!form.pickupDate) return "Please enter the pickup date.";
    if (!form.pickupTimeBegin || !form.pickupTimeEnd) return "Please enter the pickup start and end times.";
    if (form.pickupTimeEnd <= form.pickupTimeBegin) return "The pickup end time must be after the start time.";
    if (repeat && form.daysOfWeek.length === 0) return "Please choose at least one day of the week.";
    if (repeat && form.endsOn && form.endsOn < form.pickupDate) return "The end date must be after the start date.";
    if (!repeat && new Date(`${form.pickupDate}T${form.pickupTimeEnd}`) <= new Date()) {
      return "That pickup window has already ended. Please choose a later date or time.";
    }
    if (form.foodTypes.length === 0) return "Please choose at least one type of food.";
    if (form.allergens.length === 0) return "Please list the allergens, or choose \"None of these\".";
    return "";
  };

  const choosePhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    try {
      const dataUrl = await resizePhoto(file);
      if (dataUrl) setPhoto(dataUrl);
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    const food = {
      notes: form.notes,
      foodTypes: form.foodTypes,
      allergens: form.allergens,
      storage: form.storage,
      quantity: form.quantity,
      estimatedWeightKg: form.estimatedWeightKg,
    };
    if (repeat) {
      const scheduleBody = {
        ...food,
        fromRestaurantAddress: fullAddress(),
        daysOfWeek: form.daysOfWeek.map(Number),
        pickupTimeBegin: form.pickupTimeBegin,
        pickupTimeEnd: form.pickupTimeEnd,
        startsOn: form.pickupDate,
        endsOn: form.endsOn,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      setError("");
      setSubmitting(true);
      try {
        const res = schedule
          ? await api.post(`schedule/${schedule._id}/edit`, scheduleBody)
          : await api.post("schedule", scheduleBody);
        onSaved(res.data);
      } catch (err) {
        setError(errorMessage(err));
        setSubmitting(false);
      }
      return;
    }

    const body = {
      fromRestaurantAddress: fullAddress(),
      pickupDate: form.pickupDate,
      pickupEndsAt: localDateTimeToIso(form.pickupDate, form.pickupTimeEnd),
      pickupTimeBegin: form.pickupTimeBegin,
      pickupTimeEnd: form.pickupTimeEnd,
      notes: form.notes,
      foodTypes: form.foodTypes,
      allergens: form.allergens,
      storage: form.storage,
      preparedAt: form.preparedAt ? new Date(form.preparedAt).toISOString() : "",
      quantity: form.quantity,
      estimatedWeightKg: form.estimatedWeightKg,
      ...(photo ? { photo } : photo === "" ? { removePhoto: true } : {}),
    };

    setError("");
    setSubmitting(true);
    try {
      const res = isEdit
        ? await api.post(`posting/${posting._id}/edit`, body)
        : await api.post("posting/create", body);
      onSaved(res.data);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  const previewSrc = photo || (photo === null && posting && posting.hasPhoto ? photoUrl(posting) : "");
  const title = schedule ? "Edit weekly donation" : posting ? "Edit posting" : repeat ? "Set up a weekly donation" : "Post surplus food";

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} aria-labelledby="posting-dialog-title">
      <DialogTitle id="posting-dialog-title" sx={{ pr: 7 }}>
        <Typography component="span" variant="h5" sx={{ display: "block", color: "primary.dark" }}>
          {title}
        </Typography>
        <Typography component="span" variant="body2" color="text.secondary">
          {repeat
            ? "We'll post this automatically on the days you choose, and food banks can claim each one."
            : "Nearby food banks will see this and can claim it."}
        </Typography>
        <IconButton aria-label="Close" onClick={onClose} sx={{ position: "absolute", right: 12, top: 12 }}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={3}>
          <Section title="What food is it?">
            <ChipPicker label="Food types" options={FOOD_TYPES} value={form.foodTypes} onChange={(v) => set("foodTypes", v)} />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1.4fr 1fr" }, gap: 1.5, mt: 2 }}>
              <TextField label="Quantity" placeholder="e.g. 3 trays, 20 sandwiches" {...bind("quantity")} inputProps={{ maxLength: 120 }} />
              <TextField
                label="Approx. weight"
                type="number"
                inputProps={{ min: 0, step: 0.5 }}
                InputProps={{ endAdornment: <InputAdornment position="end">kg</InputAdornment> }}
                {...bind("estimatedWeightKg")}
              />
            </Box>
          </Section>

          <Section
            title="Food safety"
            hint={<>Helps food banks decide whether they can accept it. <Link href="/food-safety" target="_blank" rel="noopener">Food safety guidance</Link></>}
          >
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
              <TextField select label="Storage" {...bind("storage")}>
                {Object.entries(STORAGE).map(([key, s]) => <MenuItem key={key} value={key}>{s.label}</MenuItem>)}
              </TextField>
              {!repeat && <TextField
                label="Prepared at"
                type="datetime-local"
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: toLocalInput(new Date().toISOString()) }}
                helperText="Optional"
                {...bind("preparedAt")}
              />}
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>Allergens it contains</Typography>
            <ChipPicker label="Allergens" options={ALLERGEN_OPTIONS} exclusive={["none"]} value={form.allergens} onChange={(v) => set("allergens", v)} />
          </Section>

          {!repeat && <Section title="Photo" hint="Optional, but food banks are more likely to claim food they can see.">
            {previewSrc ? (
              <Stack direction="row" spacing={2} alignItems="center">
                <Box component="img" src={previewSrc} alt="Food photo preview" sx={{ width: 120, height: 90, objectFit: "cover", borderRadius: 2, border: 1, borderColor: "divider" }} />
                <Stack spacing={1}>
                  <Button component="label" variant="outlined" size="small">
                    Replace
                    <input hidden type="file" accept="image/*" onChange={choosePhoto} />
                  </Button>
                  <Button size="small" color="error" onClick={() => setPhoto("")}>Remove</Button>
                </Stack>
              </Stack>
            ) : (
              <Button component="label" variant="outlined" startIcon={<AddAPhotoRoundedIcon />}>
                Add a photo
                <input hidden type="file" accept="image/*" capture="environment" onChange={choosePhoto} />
              </Button>
            )}
          </Section>}

          <Section title="Where">
            {isEdit
              ? <TextField fullWidth required label="Pickup address" {...bind("address")} />
              : <AddressContainer changeValue={set} />}
          </Section>

          <Section title="When">
            {!posting && (
              <FormControlLabel
                sx={{ mb: 1.5 }}
                control={<Switch checked={repeat} onChange={(e) => setRepeat(e.target.checked)} disabled={Boolean(schedule)} />}
                label="Repeat every week"
              />
            )}
            {repeat && (
              <Box sx={{ mb: 2 }}>
                <ChipPicker label="Days of the week" options={WEEKDAYS} value={form.daysOfWeek} onChange={(v) => set("daysOfWeek", v)} />
              </Box>
            )}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1.2fr 1fr 1fr" }, gap: 1.5 }}>
              <TextField type="date" required label={repeat ? "Starting" : "Pickup date"} InputLabelProps={{ shrink: true }} inputProps={{ min: schedule ? undefined : todayDateInput() }} {...bind("pickupDate")} />
              <TextField type="time" required label="From" InputLabelProps={{ shrink: true }} {...bind("pickupTimeBegin")} />
              <TextField type="time" required label="Until" InputLabelProps={{ shrink: true }} {...bind("pickupTimeEnd")} />
            </Box>
            {repeat && (
              <TextField type="date" label="Last day (optional)" InputLabelProps={{ shrink: true }} sx={{ mt: 1.5, width: { xs: "100%", sm: 220 } }} {...bind("endsOn")} />
            )}
          </Section>

          <Section title="Notes for the food bank">
            <TextField
              fullWidth
              multiline
              minRows={2}
              placeholder="e.g. Ask at the back door. Bring a cooler for the dairy."
              {...bind("notes")}
            />
          </Section>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button onClick={submit} disabled={submitting} variant="contained">
          {submitting ? "Saving…" : isEdit ? "Save changes" : repeat ? "Start weekly donation" : "Post it"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreatePostingModal;
