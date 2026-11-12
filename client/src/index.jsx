import { StrictMode } from "react";
import ReactDOM from "react-dom";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";

import App from "./App";
import theme from "./theme";
import { registerServiceWorker } from "./pwa";
import { startOutbox } from "./outbox";

const rootElement = document.getElementById("root");
ReactDOM.render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
  rootElement
);

registerServiceWorker();
startOutbox();
