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

  // Wait for the lobby screen to appear. The setup screen also has .setup-section-title
  // elements, so filter by text to avoid a strict-mode violation.
  await expect(
    page.locator(".setup-section-title", { hasText: "Open Matches" }),
  ).toBeVisible({ timeout: 10_000 });

  // Find the match card for our matchID and select the correct player seat
  const matchCard = page.locator(".lobby-match-card", {
    has: page.locator(`code:has-text("${matchID}")`),
  });
  await matchCard.waitFor({ state: "visible", timeout: 5_000 });

  // Select the desired player seat in the dropdown
  await matchCard.locator(".lobby-player-select").selectOption(playerID);

  // Click "Join Game"
  await matchCard.locator(".lobby-join-button").click();

  // Wait for Socket.IO to connect and the game state to arrive — both the active
  // player's TurnStartModal and the waiting player's WaitingInterstitial show
  // .start-game-button, so this is a reliable cross-player readiness signal.
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

    await expect(
      page.locator(".setup-section-title", { hasText: "Open Matches" }),
    ).toBeVisible({ timeout: 10_000 });
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
    await expect(p1.locator(".game-board")).toBeVisible({ timeout: 10_000 });

    await ctx0.close();
    await ctx1.close();
  });
});

// ─── Server API blackbox tests ────────────────────────────────────────────────

interface LobbyPlayer {
  id: number;
  name?: string;
}

interface LobbyMatchState {
  matchID: string;
  gameName: string;
  players: LobbyPlayer[];
}

/** Fetch the current match state from the Lobby REST API. */
async function getMatch(matchID: string): Promise<LobbyMatchState> {
  const res = await fetch(`${SERVER_URL}/games/${GAME_NAME}/${matchID}`);
  if (!res.ok) throw new Error(`GET match failed: ${res.status}`);
  return (await res.json()) as LobbyMatchState;
}

/** Join a match slot via the Lobby REST API and return the player credentials. */
async function joinMatch(
  matchID: string,
  playerID: "0" | "1",
  playerName: string,
): Promise<string> {
  const res = await fetch(`${SERVER_URL}/games/${GAME_NAME}/${matchID}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerID, playerName }),
  });
  if (!res.ok) throw new Error(`JOIN failed: ${res.status} ${await res.text()}`);
  const { playerCredentials } = (await res.json()) as { playerCredentials: string };
  return playerCredentials;
}

/** Leave a match slot via the Lobby REST API. */
async function leaveMatch(
  matchID: string,
  playerID: "0" | "1",
  credentials: string,
): Promise<void> {
  const res = await fetch(`${SERVER_URL}/games/${GAME_NAME}/${matchID}/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerID, credentials }),
  });
  if (!res.ok) throw new Error(`LEAVE failed: ${res.status} ${await res.text()}`);
}

test.describe("server API — match lifecycle", () => {
  test("server is reachable and returns a match list", async () => {
    const res = await fetch(`${SERVER_URL}/games/${GAME_NAME}`);
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { matches: unknown[] };
    expect(Array.isArray(body.matches)).toBe(true);
  });

  test("created match starts with both slots open", async () => {
    const matchID = await createMatch();
    const match = await getMatch(matchID);
    expect(match.matchID).toBe(matchID);
    expect(match.players).toHaveLength(2);
    expect(match.players[0].name).toBeUndefined();
    expect(match.players[1].name).toBeUndefined();
  });

  test("both players can join and the match reflects their names", async () => {
    const matchID = await createMatch();
    await joinMatch(matchID, "0", "Alice");
    await joinMatch(matchID, "1", "Bob");

    const match = await getMatch(matchID);
    const p0 = match.players.find((p) => p.id === 0);
    const p1 = match.players.find((p) => p.id === 1);
    expect(p0?.name).toBe("Alice");
    expect(p1?.name).toBe("Bob");
  });

  test("leaving a match reopens that player slot", async () => {
    const matchID = await createMatch();
    const creds0 = await joinMatch(matchID, "0", "Alice");
    await joinMatch(matchID, "1", "Bob");

    await leaveMatch(matchID, "0", creds0);

    const match = await getMatch(matchID);
    const p0 = match.players.find((p) => p.id === 0);
    expect(p0?.name).toBeUndefined();
  });

  test("player 1 slot is independent from player 0 slot", async () => {
    const matchID = await createMatch();
    await joinMatch(matchID, "0", "Alice");

    // Only player 0 has joined; player 1 is still open
    const matchAfterOne = await getMatch(matchID);
    expect(matchAfterOne.players.find((p) => p.id === 0)?.name).toBe("Alice");
    expect(matchAfterOne.players.find((p) => p.id === 1)?.name).toBeUndefined();

    await joinMatch(matchID, "1", "Bob");
    const matchAfterBoth = await getMatch(matchID);
    expect(matchAfterBoth.players.find((p) => p.id === 1)?.name).toBe("Bob");
  });
});

// ─── Player perspective tests ─────────────────────────────────────────────────

test.describe("multiplayer — player perspective", () => {
  test("player 0 sees Working Class area and player 1 sees Capitalist Class area", async ({
    browser,
  }) => {
    const matchID = await createMatch();

    // Separate browser contexts give each player their own localStorage.
    const ctx0 = await browser.newContext();
    const ctx1 = await browser.newContext();
    const p0 = await ctx0.newPage();
    const p1 = await ctx1.newPage();

    // Sequential joins to avoid FlatFile write race (see above).
    await connectAsPlayer(p0, matchID, "0");
    await connectAsPlayer(p1, matchID, "1");

    // WC starts first — dismiss the interstitial.
    await startTurn(p0);

    await expect(p0.locator(".game-board")).toBeVisible({ timeout: 10_000 });
    await expect(p1.locator(".game-board")).toBeVisible({ timeout: 10_000 });

    // Each player's own area should be labelled with their class.
    await expect(
      p0.locator(".player-area-working-class .player-area-title"),
    ).toHaveText("Working Class");
    await expect(
      p1.locator(".player-area-capitalist-class .player-area-title"),
    ).toHaveText("Capitalist Class");

    await ctx0.close();
    await ctx1.close();
  });

  test("CC player on the same device as WC player still sees CC perspective", async ({
    browser,
  }) => {
    const matchID = await createMatch();

    // Single context = shared localStorage, reproducing the same-device scenario.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // First join as WC (player 0) — credentials for player 0 land in localStorage.
    await connectAsPlayer(page, matchID, "0");

    // Then join as CC (player 1) on the same page, same localStorage.
    // connectAsPlayer calls page.goto(APP_URL) which returns to the setup screen,
    // then goes through the lobby flow again.  After joining, both player 0 and
    // player 1 credentials exist in localStorage; the fix ensures player 1's are used.
    await connectAsPlayer(page, matchID, "1");

    // Start the turn — WC is first mover, but the CC interstitial also waits.
    // We resolve it from the CC page (which is now player 1's view).
    await startTurn(page);

    await expect(page.locator(".game-board")).toBeVisible({ timeout: 10_000 });

    // Without the fix, findMatchCredentials would return player 0 (WC) first
    // and this assertion would fail.
    await expect(
      page.locator(".player-area-capitalist-class .player-area-title"),
    ).toHaveText("Capitalist Class");

    await ctx.close();
  });
});

// ─── Local / pass-and-play mode ───────────────────────────────────────────────

test.describe("local / pass-and-play mode", () => {
  test("clicking Play Locally opens the game board without a server", async ({
    page,
  }) => {
    await page.goto(APP_URL);
    // "Play Locally" → LocalGameManager
    await page.click(".setup-button-local");
    // "Start New Game" → local game loads
    await page.click(".setup-button-local");

    // Turn-start interstitial appears; dismiss it to reveal the board.
    const startBtn = page.locator(".start-game-button");
    await startBtn.waitFor({ state: "visible", timeout: 10_000 });
    await startBtn.click();

    await expect(page.locator(".game-board")).toBeVisible({ timeout: 10_000 });
  });
});
