import { Box, TextField } from "@mui/material";

// Street / city / postal code / province / country fields. Each change is
// reported through `changeValue(field, value)`.
const AddressContainer = ({ changeValue }) => {
  const handle = (field) => (e) => changeValue(field, e.target.value);
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
      <TextField label="Street address" required fullWidth onChange={handle("street")} sx={{ gridColumn: { sm: "1 / -1" } }} autoComplete="street-address" />
      <TextField label="City" required onChange={handle("city")} autoComplete="address-level2" />
      <TextField label="Postal code" onChange={handle("postalCode")} autoComplete="postal-code" />
      <TextField label="Province" onChange={handle("province")} autoComplete="address-level1" />
      <TextField label="Country" onChange={handle("country")} autoComplete="country-name" />
    </Box>
  );
};

export default AddressContainer;
