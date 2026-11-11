import { Box, Chip } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

// Multi-select as toggleable chips. `options` maps value -> label.
// `exclusive` values (e.g. "none") clear every other selection and vice versa.
const ChipPicker = ({ options, value, onChange, exclusive = [], label }) => {
  const toggle = (key) => {
    if (value.includes(key)) {
      onChange(value.filter((v) => v !== key));
    } else if (exclusive.includes(key)) {
      onChange([key]);
    } else {
      onChange([...value.filter((v) => !exclusive.includes(v)), key]);
    }
  };
  return (
    <Box role="group" aria-label={label} sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {Object.entries(options).map(([key, text]) => {
        const selected = value.includes(key);
        return (
          <Chip
            key={key}
            label={text}
            icon={selected ? <CheckRoundedIcon /> : undefined}
            onClick={() => toggle(key)}
            color={selected ? "primary" : "default"}
            variant={selected ? "filled" : "outlined"}
            aria-pressed={selected}
            sx={{ fontWeight: 600 }}
          />
        );
      })}
    </Box>
  );
};

export default ChipPicker;
