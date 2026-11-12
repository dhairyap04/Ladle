import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Keep the REACT_APP_ names from the Create React App setup so existing .env files still work.
  envPrefix: "REACT_APP_",
  // Port 3000 matches the API's default CLIENT_ORIGINS.
  server: { port: 3000 },
  preview: { port: 3000 },
  build: { outDir: "build" },
});
