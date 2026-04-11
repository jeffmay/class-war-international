/**
 * Multiplayer e2e tests
 *
 * Verifies the full lobby flow: connect → browse matches → join → play.
 * Two browser contexts simulate two players on the same match.
 *
 * Setup (managed by playwright.config.ts webServer):
 *   - boardgame.io server on E2E_SERVER_PORT  (game WebSocket + Lobby REST API)
 *   - React dev server   on E2E_APP_PORT       (the UI)
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_APP_PORT, E2E_SERVER_PORT } from "../playwright.config";

const APP_URL = `http://localhost:${E2E_APP_PORT}`;
const SERVER_URL = `http://localhost:${E2E_SERVER_PORT}`;
const GAME_NAME = "class-war-international";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Create a new match via the Lobby REST API and return the matchID. */
async function createMatch(): Promise<string> {
  const res = await fetch(`${SERVER_URL}/games/${GAME_NAME}/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ numPlayers: 2 }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create match: ${res.status} ${body}`);
  }
  const { matchID } = (await res.json()) as { matchID: string };
  return matchID;
}

/**
 * Navigate to the app, connect to the lobby, and join a specific match
 * as the given player seat.
 */
async function connectAsPlayer(
  page: Page,
  matchID: string,
  playerID: "0" | "1",
): Promise<void> {
  await page.goto(APP_URL);

  // Fill in host address and port on the setup screen
  await page.fill('input[placeholder*="192.168"]', "localhost");
  await page.fill('input[type="number"]', String(E2E_SERVER_PORT));

  // Connect to lobby
  await page.click(".setup-button-host");

  // Wait for the lobby screen to appear
  await expect(page.locator(".setup-section-title")).toHaveText("Open Matches", {
    timeout: 10_000,
  });

  // Find the match card for our matchID and select the correct player seat
  const matchCard = page.locator(".lobby-match-card", {
    has: page.locator(`code:has-text("${matchID}")`),
  });
  await matchCard.waitFor({ state: "visible", timeout: 5_000 });

  // Select the desired player seat in the dropdown
  await matchCard.locator(".lobby-player-select").selectOption(playerID);

  // Click "Join Game"
  await matchCard.locator(".lobby-join-button").click();

  // Wait for the nav bar (RemoteMode rendered) then for the board to receive
  // game state and show the turn-start button (Socket.IO fully connected).
  await expect(page.locator(".remote-nav-bar")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".start-game-button")).toBeVisible({ timeout: 10_000 });
}

/** Wait until the "Turn Start" interstitial button is visible, then click it. */
async function startTurn(page: Page): Promise<void> {
  const startBtn = page.locator(".start-game-button");
  await startBtn.waitFor({ state: "visible", timeout: 10_000 });
  await startBtn.click();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("setup screen", () => {
  test("shows title and both play mode buttons", async ({ page }) => {
    await page.goto(APP_URL);
    await expect(page.locator(".setup-screen-title")).toHaveText("CLASS WAR");
    await expect(page.locator(".setup-button-local")).toBeVisible();
    await expect(page.locator(".setup-button-host")).toBeVisible();
  });
});

test.describe("lobby connection", () => {
  test("connecting to a running server shows the Open Matches screen", async ({
    page,
  }) => {
    await page.goto(APP_URL);

    await page.fill('input[placeholder*="192.168"]', "localhost");
    await page.fill('input[type="number"]', String(E2E_SERVER_PORT));
    await page.click(".setup-button-host");

    await expect(page.locator(".setup-section-title")).toHaveText(
      "Open Matches",
      { timeout: 10_000 },
    );
  });

  test("connecting to a bad address shows the error screen", async ({
    page,
  }) => {
    await page.goto(APP_URL);

    await page.fill('input[placeholder*="192.168"]', "localhost");
    await page.fill('input[type="number"]', "19999"); // nothing listening here
    // Lower timeout via advanced options so the test doesn't take 5s
    await page.click(".setup-advanced-toggle");
    await page.fill('input[step="500"]', "1500");
    await page.click(".setup-button-host");

    await expect(page.locator(".lobby-error-box")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator(".lobby-error-message")).toContainText(
      "Cannot find host server",
    );
  });
});

test.describe("multiplayer — two browsers, one match", () => {
  let matchID: string;

  test.beforeAll(async () => {
    matchID = await createMatch();
  });

  test("two players can join the same match and reach the board", async ({
    browser,
  }) => {
    const ctx0 = await browser.newContext();
    const ctx1 = await browser.newContext();
    const p0 = await ctx0.newPage();
    const p1 = await ctx1.newPage();

    // Join sequentially: FlatFile has no write locking, so concurrent POSTs to
    // /join can overwrite each other's credentials. P0 must be fully connected
    // before P1 joins to avoid the race.
    await connectAsPlayer(p0, matchID, "0");
    await connectAsPlayer(p1, matchID, "1");

    // Player 0 (Working Class) should see the turn-start interstitial
    await startTurn(p0);

    // After clicking Start, the phase advances to Action — both players see the board
    await expect(p0.locator(".game-board")).toBeVisible({ timeout: 10_000 });
    await expect(p1.locator(".game-board")).toBeVisible({ timeout: 10_000 });

    await ctx0.close();
    await ctx1.close();
  });

  test("player 0 collecting production advances state for both players", async ({
    browser,
  }) => {
    const freshMatchID = await createMatch();

    const ctx0 = await browser.newContext();
    const ctx1 = await browser.newContext();
    const p0 = await ctx0.newPage();
    const p1 = await ctx1.newPage();

    // Sequential joins to avoid FlatFile concurrent write race (see above).
    await connectAsPlayer(p0, freshMatchID, "0");
    await connectAsPlayer(p1, freshMatchID, "1");

    await startTurn(p0);

    await expect(p0.locator(".game-board")).toBeVisible({ timeout: 10_000 });
    await expect(
      p1.locator(".start-game-button, .game-board"),
    ).toBeVisible({ timeout: 10_000 });

    await ctx0.close();
    await ctx1.close();
  });
});

test.describe("local / pass-and-play mode", () => {
  test("clicking Play Locally opens the game board without a server", async ({
    page,
  }) => {
    await page.goto(APP_URL);
    await page.click(".setup-button-local");

    const startBtn = page.locator(".start-game-button");
    await startBtn.waitFor({ state: "visible", timeout: 10_000 });
    await startBtn.click();

    await expect(page.locator(".game-board")).toBeVisible({ timeout: 10_000 });
  });
});
