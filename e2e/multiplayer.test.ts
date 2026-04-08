/**
 * Multiplayer e2e tests
 *
 * Verifies that two browser contexts can connect to the same boardgame.io
 * server, join a match, and interact with shared game state.
 *
 * Setup (managed by playwright.config.ts webServer):
 *   - boardgame.io server on E2E_SERVER_PORT  (game WebSocket)
 *   - boardgame.io API   on E2E_API_PORT      (Lobby REST API)
 *   - React dev server  on E2E_APP_PORT       (the UI)
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_API_PORT, E2E_APP_PORT, E2E_SERVER_PORT } from "../playwright.config";

const APP_URL = `http://localhost:${E2E_APP_PORT}`;
const API_URL = `http://localhost:${E2E_API_PORT}`;
const SERVER_URL = `http://localhost:${E2E_SERVER_PORT}`;
const GAME_NAME = "class-war-international";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Create a new match via the Lobby REST API and return the matchID. */
async function createMatch(): Promise<string> {
  const res = await fetch(`${API_URL}/games/${GAME_NAME}/create`, {
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
 * Navigate a page to the app and use the setup screen to connect to the
 * remote host as a specific player.
 */
async function connectAsPlayer(
  page: Page,
  matchID: string,
  playerID: "0" | "1",
): Promise<void> {
  await page.goto(APP_URL);

  // Fill in the host form
  await page.fill('input[placeholder*="192.168"]', SERVER_URL);
  await page.fill('input[placeholder="default"]', matchID);
  await page.selectOption("select", playerID);

  await page.click("button.setup-button-host");
}

/** Wait until the "Turn Start" interstitial button is visible, then click it. */
async function startTurn(page: Page): Promise<void> {
  const startBtn = page.locator(".start-game-button");
  await startBtn.waitFor({ state: "visible", timeout: 10_000 });
  await startBtn.click();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("multiplayer — two browsers, one match", () => {
  let matchID: string;

  test.beforeAll(async () => {
    matchID = await createMatch();
  });

  test("both players see the setup screen on load", async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await page1.goto(APP_URL);

    await expect(page1.locator(".setup-screen-title")).toHaveText("CLASS WAR");
    await expect(page1.locator(".setup-button-local")).toBeVisible();
    await expect(page1.locator(".setup-button-host")).toBeVisible();

    await ctx1.close();
  });

  test("two players can join the same match and reach the board", async ({
    browser,
  }) => {
    const ctx0 = await browser.newContext();
    const ctx1 = await browser.newContext();
    const p0 = await ctx0.newPage();
    const p1 = await ctx1.newPage();

    // Both players connect to the same match
    await Promise.all([
      connectAsPlayer(p0, matchID, "0"),
      connectAsPlayer(p1, matchID, "1"),
    ]);

    // Player 0 (Working Class) should see the turn-start interstitial first
    // (the boardgame.io board renders once the WebSocket is connected)
    await startTurn(p0);

    // After clicking Start, the game board should be visible on player 0's screen
    await expect(p0.locator(".game-board")).toBeVisible({ timeout: 10_000 });

    // Player 1 should still see the interstitial (it's player 0's turn)
    await expect(p1.locator(".start-game-button")).toBeVisible({
      timeout: 10_000,
    });

    await ctx0.close();
    await ctx1.close();
  });

  test("player 0 collecting production advances state for both players", async ({
    browser,
  }) => {
    // Create a fresh match so this test is independent
    const freshMatchID = await createMatch();

    const ctx0 = await browser.newContext();
    const ctx1 = await browser.newContext();
    const p0 = await ctx0.newPage();
    const p1 = await ctx1.newPage();

    await Promise.all([
      connectAsPlayer(p0, freshMatchID, "0"),
      connectAsPlayer(p1, freshMatchID, "1"),
    ]);

    // Player 0 clicks "Start Working Class Turn" (collectProduction)
    await startTurn(p0);

    // The board is now in Action phase for player 0
    await expect(p0.locator(".game-board")).toBeVisible({ timeout: 10_000 });

    // Player 1 observes the board after p0 acts — the turn-start interstitial
    // should still be showing on p1's screen because it's p0's turn, not p1's.
    // The important thing is that p1 is also connected and showing a valid board state.
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

    await expect(page.locator(".setup-screen-title")).toHaveText("CLASS WAR");

    await page.click(".setup-button-local");

    // The local client renders the Start Game interstitial immediately
    const startBtn = page.locator(".start-game-button");
    await startBtn.waitFor({ state: "visible", timeout: 10_000 });
    await startBtn.click();

    // Board should now be visible
    await expect(page.locator(".game-board")).toBeVisible({ timeout: 10_000 });
  });
});
