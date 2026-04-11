/**
 * Playwright configuration for end-to-end multiplayer tests.
 *
 * Tests spin up the boardgame.io server + React dev server automatically
 * using the `webServer` option, so running `npm run test:e2e` is sufficient.
 */

import { defineConfig, devices } from "@playwright/test";

// Ports used during e2e runs (avoid clashing with the standard dev server).
// Game WebSocket and Lobby REST API share the same port (boardgame.io default).
export const E2E_APP_PORT = 3001;
export const E2E_SERVER_PORT = 8100;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.test.ts",
  /* Fail fast — stop after first failure during CI */
  maxFailures: process.env["CI"] ? 1 : 0,
  /* Retry flaky tests once in CI */
  retries: process.env["CI"] ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: `http://localhost:${E2E_APP_PORT}`,
    trace: "on-first-retry",
    headless: true,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      /**
       * boardgame.io server — game WebSocket and Lobby REST API on the same port.
       */
      command: [
        "PORT=" + E2E_SERVER_PORT,
        "ORIGINS=http://localhost:" + E2E_APP_PORT,
        "node --no-experimental-require-module --import tsx server/index.ts",
      ].join(" "),
      port: E2E_SERVER_PORT,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      /**
       * React dev server — uses a non-standard port so it does not clash with
       * the default `npm start` on port 3000.
       */
      command: "npx vite --port " + E2E_APP_PORT,
      port: E2E_APP_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
