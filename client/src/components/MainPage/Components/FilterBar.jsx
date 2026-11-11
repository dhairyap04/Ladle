import { useState } from "react";
import {
  Badge,
  Box,
  Button,
  Collapse,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import MyLocationRoundedIcon from "@mui/icons-material/MyLocationRounded";
import ChipPicker from "../../Shared/ChipPicker";
import { ALLERGENS, FOOD_TYPES } from "../../../food";

export const EMPTY_FILTERS = {
  q: "",
  radiusKm: "",
  date: "",
  pickupBefore: "",
  foodTypes: [],
  excludeAllergens: [],
  fitsMe: false,
  sort: "newest",
};

// Turns filter state into /posting/all query parameters.
export function filterParams(filters, device) {
  const params = {};
  if (filters.q.trim()) params.q = filters.q.trim();
  if (filters.radiusKm) params.radiusKm = filters.radiusKm;
  if (filters.date) params.date = filters.date;
  if (filters.pickupBefore) params.pickupBefore = filters.pickupBefore;
  if (filters.foodTypes.length) params.foodTypes = filters.foodTypes.join(",");
  if (filters.excludeAllergens.length) params.excludeAllergens = filters.excludeAllergens.join(",");
  if (filters.fitsMe) params.fitsMe = "1";
  if (filters.sort !== "newest") params.sort = filters.sort;
  if (device) {
    params.lat = device.lat;
    params.lng = device.lng;
  }
  return params;
}

// Lets a select show its "Any …" option instead of looking empty.
const SHOW_EMPTY = { SelectProps: { displayEmpty: true }, InputLabelProps: { shrink: true } };

const dateInput = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const FilterBar = ({ filters, onChange, isFoodbank, device, onUseDevice, locating }) => {
  const [open, setOpen] = useState(false);
  const set = (field) => (value) => onChange({ ...filters, [field]: value });
  const extraCount = filters.foodTypes.length + filters.excludeAllergens.length + (filters.pickupBefore ? 1 : 0);

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 4, mb: 2 }}>
      <TextField
        fullWidth
        size="small"
        placeholder="Search restaurants, food or notes"
        value={filters.q}
        onChange={(e) => set("q")(e.target.value)}
        inputProps={{ "aria-label": "Search postings" }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> }}
      />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" }, gap: 1.5, mt: 1.5 }}>
        <TextField select size="small" label="Distance" value={filters.radiusKm} {...SHOW_EMPTY} onChange={(e) => set("radiusKm")(e.target.value)}>
          <MenuItem value="">Any distance</MenuItem>
          {[2, 5, 10, 25].map((km) => <MenuItem key={km} value={String(km)}>Within {km} km</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Pickup day" value={filters.date} {...SHOW_EMPTY} onChange={(e) => set("date")(e.target.value)}>
          <MenuItem value="">Any day</MenuItem>
          <MenuItem value={dateInput(0)}>Today</MenuItem>
          <MenuItem value={dateInput(1)}>Tomorrow</MenuItem>
        </TextField>
        <TextField select size="small" label="Sort by" value={filters.sort} onChange={(e) => set("sort")(e.target.value)} sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}>
          <MenuItem value="newest">Newest</MenuItem>
          <MenuItem value="soonest">Pickup ends soonest</MenuItem>
          <MenuItem value="distance">Closest</MenuItem>
        </TextField>
      </Box>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5, flexWrap: "wrap", rowGap: 1 }}>
        <Button size="small" startIcon={<MyLocationRoundedIcon />} onClick={onUseDevice} disabled={locating} variant={device ? "contained" : "outlined"}>
          {locating ? "Locating…" : device ? "Using your location" : "Use my location"}
        </Button>
        <Badge badgeContent={extraCount} color="secondary">
          <Button size="small" startIcon={<TuneRoundedIcon />} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            More filters
          </Button>
        </Badge>
        {isFoodbank && (
          <FormControlLabel
            sx={{ ml: "auto !important" }}
            control={<Switch checked={filters.fitsMe} onChange={(e) => set("fitsMe")(e.target.checked)} />}
            label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Only what we can accept</Typography>}
          />
        )}
      </Stack>

      <Collapse in={open}>
        <Box sx={{ pt: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>Food type</Typography>
          <ChipPicker label="Food type" options={FOOD_TYPES} value={filters.foodTypes} onChange={set("foodTypes")} />
          <Typography variant="body2" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>Avoid allergens</Typography>
          <ChipPicker label="Avoid allergens" options={ALLERGENS} value={filters.excludeAllergens} onChange={set("excludeAllergens")} />
          <TextField
            size="small"
            type="time"
            label="Pickup starts before"
            InputLabelProps={{ shrink: true }}
            value={filters.pickupBefore}
            onChange={(e) => set("pickupBefore")(e.target.value)}
            sx={{ mt: 2, width: 200 }}
          />
          <Box sx={{ mt: 1.5 }}>
            <Button size="small" color="inherit" onClick={() => onChange(EMPTY_FILTERS)}>Clear all filters</Button>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default FilterBar;
