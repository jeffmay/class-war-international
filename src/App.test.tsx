/**
 * Component tests for App
 *
 * Tests cover:
 *   - StartScreen rendering and navigation
 *   - LobbyScreen rendering and back navigation
 *   - Hash-based routing between start, lobby, and match
 *
 * The boardgame.io Lobby component is mocked because it makes real HTTP
 * requests to the server. The LocalClient and RemoteMatch components are
 * also stubbed to keep tests focused on routing logic.
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";

// ─── Mock boardgame.io react components ──────────────────────────────────────

vi.mock("boardgame.io/react", () => ({
  Client: () => () => <div data-testid="bgio-client" />,
  Lobby: ({ renderer }: { renderer: (args: Record<string, unknown>) => React.ReactNode }) =>
    renderer({
      errorMsg: "",
      matches: [],
      playerName: "TestPlayer",
      runningMatch: undefined,
      handleEnterLobby: vi.fn(),
      handleExitLobby: vi.fn(),
      handleCreateMatch: vi.fn(),
      handleJoinMatch: vi.fn(),
      handleLeaveMatch: vi.fn(),
      handleStartMatch: vi.fn(),
      handleRefreshMatches: vi.fn(),
    }),
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
  // Reset hash to start screen before each test
  window.location.hash = "#/";
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.location.hash = "#/";
});

// ─── StartScreen ──────────────────────────────────────────────────────────────

describe("StartScreen", () => {
  test("renders the title and both play options", () => {
    renderApp();
    expect(screen.getByText("CLASS WAR")).toBeInTheDocument();
    expect(screen.getByText("International")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Play Locally/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enter Online Lobby/i })).toBeInTheDocument();
  });

  test("shows Player ID and Server address fields", () => {
    renderApp();
    expect(screen.getByLabelText(/Your Player ID/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Server address/i)).toBeInTheDocument();
  });

  test("pre-fills Player ID from localStorage", () => {
    localStorage.setItem("cwi_player_name", "Rosa");
    renderApp();
    expect(screen.getByLabelText(/Your Player ID/i)).toHaveValue("Rosa");
  });

  test("pre-fills Server address from localStorage", () => {
    localStorage.setItem("cwi_server", "http://192.168.1.42:8000");
    renderApp();
    expect(screen.getByLabelText(/Server address/i)).toHaveValue("http://192.168.1.42:8000");
  });

  test("navigates to local game when Play Locally is clicked", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Play Locally/i }));
    expect(window.location.hash).toBe("#/local");
  });

  test("navigates to lobby when Enter Online Lobby is clicked", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Enter Online Lobby/i }));
    expect(window.location.hash).toBe("#/lobby");
  });

  test("saves player name to localStorage when entering lobby", () => {
    renderApp();
    fireEvent.change(screen.getByLabelText(/Your Player ID/i), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enter Online Lobby/i }));
    expect(localStorage.getItem("cwi_player_name")).toBe("Alice");
  });

  test("saves server address to localStorage when entering lobby", () => {
    renderApp();
    fireEvent.change(screen.getByLabelText(/Server address/i), {
      target: { value: "http://10.0.0.1:8000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enter Online Lobby/i }));
    expect(localStorage.getItem("cwi_server")).toBe("http://10.0.0.1:8000");
  });
});

// ─── LobbyScreen ─────────────────────────────────────────────────────────────

describe("LobbyScreen", () => {
  beforeEach(() => {
    window.location.hash = "#/lobby";
    localStorage.setItem("cwi_player_name", "TestPlayer");
  });

  test("renders lobby header with title", () => {
    renderApp();
    expect(screen.getByText("Online Lobby")).toBeInTheDocument();
  });

  test("shows the player name in the header", () => {
    renderApp();
    expect(screen.getByText(/TestPlayer/)).toBeInTheDocument();
  });

  test("returns to start when back button is clicked", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    expect(window.location.hash).toBe("#/");
  });

  test("shows Create New Match button in lobby renderer", () => {
    renderApp();
    expect(screen.getByRole("button", { name: /Create New Match/i })).toBeInTheDocument();
  });

  test("shows Refresh button in lobby renderer", () => {
    renderApp();
    expect(screen.getByRole("button", { name: /Refresh/i })).toBeInTheDocument();
  });

  test("shows empty state when no matches exist", () => {
    renderApp();
    expect(screen.getByText(/No matches yet/i)).toBeInTheDocument();
  });
});

// ─── Local game route ─────────────────────────────────────────────────────────

describe("Local game route (#/local)", () => {
  beforeEach(() => {
    window.location.hash = "#/local";
  });

  test("renders the boardgame.io local client", () => {
    renderApp();
    expect(screen.getByTestId("bgio-client")).toBeInTheDocument();
  });

  test("shows a hamburger button", () => {
    renderApp();
    expect(screen.getByRole("button", { name: /Return to start/i })).toBeInTheDocument();
  });
});
