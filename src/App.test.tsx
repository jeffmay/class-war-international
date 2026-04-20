/**
 * Component tests for App
 *
 * Tests cover:
 *   - SetupScreen rendering and navigation
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

  test("shows Player Name, Host Address, and Port fields", () => {
    renderApp();
    expect(screen.getByLabelText(/Player Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Host Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Port/i)).toBeInTheDocument();
  });

  test("pre-fills Player Name from localStorage", () => {
    localStorage.setItem("cwi_player_name", "Rosa");
    renderApp();
    expect(screen.getByLabelText(/Player Name/i)).toHaveValue("Rosa");
  });

  test("saves Player Name to localStorage on Connect", () => {
    vi.spyOn(global, "fetch").mockImplementation(() => new Promise(() => {}));
    renderApp();
    fireEvent.change(screen.getByLabelText(/Player Name/i), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Connect to Lobby/i }));
    expect(localStorage.getItem("cwi_player_name")).toBe("Alice");
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
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Connect to Lobby/i }));
    // Hash change is async in jsdom; wait for the route update
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

  const matchWithMe = {
    matchID: MATCH_ID,
    gameName: "class-war-international",
    players: [
      { id: 0, name: "Alice" },
      { id: 1, name: undefined },
    ],
  };

  beforeEach(() => {
    localStorage.setItem("cwi_player_name", "Alice");
    localStorage.setItem(`cwi_creds_${MATCH_ID}_0`, "test-creds");
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
      expect(localStorage.getItem(`cwi_creds_${MATCH_ID}_0`)).toBeNull();
    });
  });
});
