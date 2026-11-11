import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
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
import { ALLERGENS, FOOD_TYPES, STORAGE, photoUrl } from "../../../food";
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

// Creates a posting, or edits one when given a `posting` prop.
const CreatePostingModal = ({ posting, onClose, onSaved }) => {
  const isEdit = Boolean(posting);
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));

  const [form, setForm] = useState({
    // Create uses separate address parts; edit shows the saved address as one field.
    street: "",
    city: "",
    province: "",
    postalCode: "",
    country: "",
    address: posting ? posting.fromRestaurantAddress : "",
    pickupDate: (posting && posting.pickupDate) || todayDateInput(),
    pickupTimeBegin: posting ? toTimeInput(posting.pickupTimeBegin) : "",
    pickupTimeEnd: posting ? toTimeInput(posting.pickupTimeEnd) : "",
    notes: posting ? posting.notes || "" : "",
    foodTypes: posting ? posting.foodTypes || [] : [],
    allergens: posting ? posting.allergens || [] : [],
    storage: posting ? posting.storage || "ambient" : "ambient",
    preparedAt: posting ? toLocalInput(posting.preparedAt) : "",
    quantity: posting ? posting.quantity || "" : "",
    estimatedWeightKg: posting && posting.estimatedWeightKg ? String(posting.estimatedWeightKg) : "",
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
    if (new Date(`${form.pickupDate}T${form.pickupTimeEnd}`) <= new Date()) {
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

  const previewSrc = photo || (photo === null && isEdit && posting.hasPhoto ? photoUrl(posting) : "");

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} aria-labelledby="posting-dialog-title">
      <DialogTitle id="posting-dialog-title" sx={{ pr: 7 }}>
        <Typography component="span" variant="h5" sx={{ display: "block", color: "primary.dark" }}>
          {isEdit ? "Edit posting" : "Post surplus food"}
        </Typography>
        <Typography component="span" variant="body2" color="text.secondary">
          Nearby food banks will see this and can claim it.
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

          <Section title="Food safety" hint="Helps food banks decide whether they can accept it.">
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
              <TextField select label="Storage" {...bind("storage")}>
                {Object.entries(STORAGE).map(([key, s]) => <MenuItem key={key} value={key}>{s.label}</MenuItem>)}
              </TextField>
              <TextField
                label="Prepared at"
                type="datetime-local"
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: toLocalInput(new Date().toISOString()) }}
                helperText="Optional"
                {...bind("preparedAt")}
              />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>Allergens it contains</Typography>
            <ChipPicker label="Allergens" options={ALLERGEN_OPTIONS} exclusive={["none"]} value={form.allergens} onChange={(v) => set("allergens", v)} />
          </Section>

          <Section title="Photo" hint="Optional, but food banks are more likely to claim food they can see.">
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
          </Section>

          <Section title="Where">
            {isEdit
              ? <TextField fullWidth required label="Pickup address" {...bind("address")} />
              : <AddressContainer changeValue={set} />}
          </Section>

          <Section title="When">
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1.2fr 1fr 1fr" }, gap: 1.5 }}>
              <TextField type="date" required label="Pickup date" InputLabelProps={{ shrink: true }} inputProps={{ min: todayDateInput() }} {...bind("pickupDate")} />
              <TextField type="time" required label="From" InputLabelProps={{ shrink: true }} {...bind("pickupTimeBegin")} />
              <TextField type="time" required label="Until" InputLabelProps={{ shrink: true }} {...bind("pickupTimeEnd")} />
            </Box>
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
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Post it"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreatePostingModal;
