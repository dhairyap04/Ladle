import { createTheme } from "@mui/material/styles";

// Brand palette. See docs/DESIGN.md for the reasoning.
export const brand = {
  leaf: "#1B6B4A",
  leafDark: "#0F4A32",
  leafTint: "#E6F2EC",
  tangerine: "#F08A24",
  tangerineText: "#B85A08", // tangerine dark enough for text on cream
  tangerineTint: "#FDEEDC",
  cream: "#FAF7F2",
  border: "#E8E2D8",
  ink: "#1C2420",
  slate: "#5B6660",
};

const fontFamily = '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const theme = createTheme({
  palette: {
    primary: { main: brand.leaf, dark: brand.leafDark, light: brand.leafTint, contrastText: "#fff" },
    secondary: { main: brand.tangerine, contrastText: brand.ink },
    warning: { main: "#B26A00" },
    background: { default: brand.cream, paper: "#FFFFFF" },
    text: { primary: brand.ink, secondary: brand.slate },
    divider: brand.border,
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily,
    h1: { fontWeight: 800, letterSpacing: "-0.02em" },
    h2: { fontWeight: 800, letterSpacing: "-0.02em" },
    h3: { fontWeight: 800, letterSpacing: "-0.01em" },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 700 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 999, paddingInline: 20 },
        sizeLarge: { paddingBlock: 12, paddingInline: 28, fontSize: "1rem" },
      },
    },
    MuiPaper: {
      styleOverrides: { outlined: { borderColor: brand.border } },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 20 } },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 700 } },
    },
    MuiOutlinedInput: {
      styleOverrides: { root: { backgroundColor: "#fff" } },
    },
  },
});

export default theme;
