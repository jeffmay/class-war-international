/**
 * Component tests for App
 *
 * Tests cover:
 *   - SetupScreen rendering and navigation
 *   - Local play mode (pass-and-play)
 *   - Lobby connection flow (connecting → lobby)
 *   - Connection error screen
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";

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

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
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

  test("saves Player Name to localStorage on Connect", async () => {
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
  test("clicking Play Locally shows the boardgame.io client", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Play Locally/i }));
    expect(screen.getByTestId("bgio-client")).toBeInTheDocument();
  });
});

// ─── Lobby connection flow ────────────────────────────────────────────────────

describe("Lobby connection", () => {
  test("clicking Connect to Lobby shows connecting screen", () => {
    // Never-resolving fetch keeps us in the connecting state
    vi.spyOn(global, "fetch").mockImplementation(
      () => new Promise(() => {}),
    );

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Connect to Lobby/i }));

    expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
  });

  test("successful connection shows Open Matches screen", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ matches: [] }),
    } as Response);

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Connect to Lobby/i }));

    await waitFor(() => {
      expect(screen.getByText("Open Matches")).toBeInTheDocument();
    });
  });

  test("failed connection shows error screen", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new TypeError("fetch failed"));

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Connect to Lobby/i }));

    await waitFor(
      () => {
        expect(screen.getByText(/Cannot find host server/i)).toBeInTheDocument();
      },
      { timeout: 8_000 },
    );
  });
});
