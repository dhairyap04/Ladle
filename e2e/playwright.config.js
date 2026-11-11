// Starts the demo API (in-memory data) and the client, then runs the tests in
// tests/ against them in Chromium. Ports are unusual so a running dev setup
// doesn't clash.
const { defineConfig, devices } = require("@playwright/test");

const API_PORT = 5099;
const APP_PORT = 4199;

module.exports = defineConfig({
  testDir: "tests",
  fullyParallel: false,
  workers: 1, // the tests share one seeded demo database
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.js/ },
    { name: "phone", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.js/ },
  ],
  webServer: [
    {
      command: "npm run demo",
      cwd: "../server",
      url: `http://localhost:${API_PORT}/push/key`,
      env: { PORT: String(API_PORT), CLIENT_ORIGINS: `http://localhost:${APP_PORT}` },
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: `npx vite --port ${APP_PORT} --strictPort`,
      cwd: "../client",
      url: `http://localhost:${APP_PORT}`,
      env: { REACT_APP_HOST_URL: `http://localhost:${API_PORT}/` },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
