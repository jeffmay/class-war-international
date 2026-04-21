/**
 * Component tests for App
 *
 * Tests cover:
 *   - SetupScreen rendering, player profile management, and navigation
 *   - Local play mode (pass-and-play)
 *   - Lobby connection flow (connecting → ready | error)
 *   - Leave match from lobby
 *
 * Hash state is reset before each test because App uses hash routing and
 * jsdom preserves window.location.hash across renders within a test file.
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";
import { encodeHostID } from "./util/hostEncoding";

// ─── Mock boardgame.io react components ──────────────────────────────────────

vi.mock("boardgame.io/react", () => ({
  Client: () => () => <div data-testid="bgio-client" />,
}));

vi.mock("boardgame.io/multiplayer", () => ({
  Local: () => ({}),
  SocketIO: () => ({}),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderApp() {
  return render(<App />);
}

/** Navigate and render; the App reads window.location.hash on init. */
function renderAt(hash: string) {
  window.location.hash = hash;
  return render(<App />);
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  window.location.hash = "";
});

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

// ─── SetupScreen ──────────────────────────────────────────────────────────────

describe("SetupScreen", () => {
  test("renders the title and both play options", () => {
    renderApp();
    expect(screen.getByText("CLASS WAR")).toBeInTheDocument();
    expect(screen.getByText("International")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Play Locally/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect to Lobby/i })).toBeInTheDocument();
  });

  test("shows Choose Player section with Host Address and Port fields", () => {
    renderApp();
    expect(screen.getByText("Choose Player")).toBeInTheDocument();
    expect(screen.getByLabelText(/Host Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Port/i)).toBeInTheDocument();
  });

  test("Connect to Lobby is disabled when no player is selected", () => {
    renderApp();
    expect(screen.getByRole("button", { name: /Connect to Lobby/i })).toBeDisabled();
  });

  test("Connect to Lobby is enabled after a player is selected", () => {
    renderApp();
    fireEvent.change(screen.getByPlaceholderText(/New player name/i), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Create$/i }));
    expect(screen.getByRole("button", { name: /Connect to Lobby/i })).not.toBeDisabled();
  });

  test("creating a player adds it to the list and auto-selects it", () => {
    renderApp();
    fireEvent.change(screen.getByPlaceholderText(/New player name/i), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Create$/i }));
    expect(screen.getByRole("button", { name: "Alice" })).toHaveClass("setup-player-button-active");
  });

  test("selecting a different profile changes the active player", () => {
    localStorage.setItem("cwi_players", JSON.stringify(["Bob", "Alice"]));
    localStorage.setItem("cwi_last_player", "Bob");
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Alice" }));
    expect(screen.getByRole("button", { name: "Alice" })).toHaveClass("setup-player-button-active");
    expect(screen.getByRole("button", { name: "Bob" })).not.toHaveClass(
      "setup-player-button-active",
    );
  });

  test("deleting the active player selects the next profile", () => {
    localStorage.setItem("cwi_players", JSON.stringify(["Alice", "Bob"]));
    localStorage.setItem("cwi_last_player", "Alice");
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Delete player Alice" }));
    expect(screen.queryByRole("button", { name: "Alice" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bob" })).toHaveClass("setup-player-button-active");
  });

  test("pre-selects the last used player from cwi_last_player", () => {
    localStorage.setItem("cwi_players", JSON.stringify(["Alice", "Bob"]));
    localStorage.setItem("cwi_last_player", "Bob");
    renderApp();
    expect(screen.getByRole("button", { name: "Bob" })).toHaveClass("setup-player-button-active");
  });

  test("falls back to cwi_player_name for migration", () => {
    localStorage.setItem("cwi_players", JSON.stringify(["Rosa"]));
    localStorage.setItem("cwi_player_name", "Rosa");
    renderApp();
    expect(screen.getByRole("button", { name: "Rosa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect to Lobby/i })).not.toBeDisabled();
  });

  test("saves player list and last player to localStorage on create", () => {
    renderApp();
    fireEvent.change(screen.getByPlaceholderText(/New player name/i), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Create$/i }));
    expect(localStorage.getItem("cwi_last_player")).toBe("Alice");
    expect(JSON.parse(localStorage.getItem("cwi_players") ?? "[]")).toContain("Alice");
  });
});

// ─── Local play mode ──────────────────────────────────────────────────────────

describe("Local play mode", () => {
  test("navigating to #/local shows the local game manager", () => {
    renderAt("#/local");
    expect(screen.getByText(/Local Games/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start New Game/i })).toBeInTheDocument();
  });

  test("navigating to #/local/{gameName} shows the boardgame.io client", () => {
    renderAt("#/local/My%20Game");
    expect(screen.getByTestId("bgio-client")).toBeInTheDocument();
  });

  test("clicking Play Locally shows the local game manager", async () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Play Locally/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Start New Game/i })).toBeInTheDocument();
    });
  });

  test("Start New Game navigates to a local game URL", async () => {
    renderAt("#/local");
    fireEvent.click(screen.getByRole("button", { name: /Start New Game/i }));
    await waitFor(() => {
      expect(screen.getByTestId("bgio-client")).toBeInTheDocument();
    });
  });

  test("saved games list shows existing games from localStorage", () => {
    localStorage.setItem(
      "cwi_metadata",
      JSON.stringify([["My Saved Game", { updatedAt: Date.now() }]]),
    );
    renderAt("#/local");
    expect(screen.getByText("My Saved Game")).toBeInTheDocument();
  });

  test("Continue button appears and goes to the most recent game", async () => {
    localStorage.setItem(
      "cwi_metadata",
      JSON.stringify([["Recent Game", { updatedAt: Date.now() }]]),
    );
    renderAt("#/local");
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    expect(continueBtn).toBeInTheDocument();
    fireEvent.click(continueBtn);
    await waitFor(() => {
      expect(screen.getByTestId("bgio-client")).toBeInTheDocument();
    });
  });
});

// ─── Lobby connection flow ────────────────────────────────────────────────────

describe("Lobby connection", () => {
  test("navigating to #/lobby/<server> shows connecting screen", () => {
    vi.spyOn(global, "fetch").mockImplementation(() => new Promise(() => {}));
    renderAt(`#/lobby/${encodeHostID("http://localhost:8000")}`);
    expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
  });

  test("clicking Connect to Lobby shows connecting screen", async () => {
    vi.spyOn(global, "fetch").mockImplementation(() => new Promise(() => {}));
    localStorage.setItem("cwi_players", JSON.stringify(["Alice"]));
    localStorage.setItem("cwi_last_player", "Alice");
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Connect to Lobby/i }));
    await waitFor(() => {
      expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
    });
  });

  test("successful connection shows Open Matches screen", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ matches: [] }),
    } as Response);

    renderAt(`#/lobby/${encodeHostID("http://localhost:8000")}`);

    await waitFor(() => {
      expect(screen.getByText("Open Matches")).toBeInTheDocument();
    });
  });

  test("failed connection shows error screen", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new TypeError("fetch failed"));

    renderAt(`#/lobby/${encodeHostID("http://localhost:8000")}`);

    await waitFor(
      () => {
        expect(screen.getByText(/Cannot find host server/i)).toBeInTheDocument();
      },
      { timeout: 8_000 },
    );
  });
});

// ─── Lobby: Leave match ───────────────────────────────────────────────────────

describe("Lobby: Leave match", () => {
  const SERVER = "http://localhost:8000";
  const MATCH_ID = "match-abc";
  const PROFILE = "Alice";

  const matchWithMe = {
    matchID: MATCH_ID,
    gameName: "class-war-international",
    players: [
      { id: 0, name: "Alice" },
      { id: 1, name: undefined },
    ],
  };

  beforeEach(() => {
    localStorage.setItem("cwi_players", JSON.stringify([PROFILE]));
    localStorage.setItem("cwi_last_player", PROFILE);
    localStorage.setItem(
      `cwi_match_${MATCH_ID}_${PROFILE}`,
      JSON.stringify({ playerID: "0", credentials: "test-creds", displayName: PROFILE }),
    );
  });

  test("shows Rejoin and Leave buttons for a match I am in", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ matches: [matchWithMe] }),
    } as Response);

    renderAt(`#/lobby/${encodeHostID(SERVER)}`);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Rejoin/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Leave/i })).toBeInTheDocument();
    });
  });

  test("Leave calls the leave API and removes credentials", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");

    // Initial match list
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ matches: [matchWithMe] }),
    } as Response);

    // POST /leave
    fetchSpy.mockResolvedValueOnce({ ok: true } as Response);

    // GET match list after leave (match now empty → trigger delete)
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        matches: [{
          ...matchWithMe,
          players: [{ id: 0, name: undefined }, { id: 1, name: undefined }],
        }],
      }),
    } as Response);

    // DELETE match
    fetchSpy.mockResolvedValueOnce({ ok: true } as Response);

    // Final refresh
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ matches: [] }),
    } as Response);

    renderAt(`#/lobby/${encodeHostID(SERVER)}`);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Leave/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Leave/i }));

    await waitFor(() => {
      expect(localStorage.getItem(`cwi_match_${MATCH_ID}_${PROFILE}`)).toBeNull();
    });
  });
});
