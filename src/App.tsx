/**
 * Main App component
 *
 * URL hash routing:
 *   #/                                        — setup screen
 *   #/local                                   — pass-and-play on a single device
 *   #/lobby/<encodedServer>                   — browse / create / join matches
 *   #/match/<encodedServer>/<id>/<pid>/<cred> — playing a specific match
 *
 * Player name is persisted in localStorage (cwi_player_name).
 * Per-match credentials are persisted in localStorage (cwi_creds_<id>_<pid>)
 * so a player can rejoin after a page refresh without re-joining via the API.
 *
 * In the future the player name + credentials will be replaced with an Auth0
 * access token when authentication is added.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Client } from "boardgame.io/react";
import { Local, SocketIO } from "boardgame.io/multiplayer";
import { ClassWarGame } from "./game/ClassWarGame";
import { ClassWarBoard } from "./Board";
import { LobbyMatch, LobbyMatchList, LobbyJoinResponse } from "./types/lobby";
import { GameNavContext } from "./contexts/GameNav";
import "./App.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const GAME_NAME = "class-war-international";
const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 8000;
const DEFAULT_TIMEOUT_MS = 5000;
const PLAYER_NAME_KEY = "cwi_player_name";
const TIMEOUT_MS_KEY = "cwi_timeout_ms";

/** Per-match credentials stored so the player can rejoin after a refresh. */
function credentialsKey(matchID: string, playerID: string): string {
  return `cwi_creds_${matchID}_${playerID}`;
}

// ─── Route types + hash helpers ───────────────────────────────────────────────

type Route =
  | { kind: "setup" }
  | { kind: "local" }
  | { kind: "lobby"; server: string }
  | { kind: "match"; server: string; matchID: string; playerID: "0" | "1"; credentials: string };

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#\//, "");
  if (!raw) return { kind: "setup" };
  if (raw === "local") return { kind: "local" };

  const lobbyM = /^lobby\/(.+)$/.exec(raw);
  if (lobbyM) {
    try {
      return { kind: "lobby", server: decodeURIComponent(lobbyM[1]) };
    } catch {
      return { kind: "setup" };
    }
  }

  // match/<encodedServer>/<matchID>/(0|1)/<encodedCredentials>
  const matchM = /^match\/([^/]+)\/([^/]+)\/(0|1)\/(.+)$/.exec(raw);
  if (matchM) {
    try {
      const [, encServer, matchID, playerID, encCreds] = matchM;
      return {
        kind: "match",
        server: decodeURIComponent(encServer),
        matchID,
        playerID: playerID as "0" | "1",
        credentials: decodeURIComponent(encCreds),
      };
    } catch {
      return { kind: "setup" };
    }
  }

  return { kind: "setup" };
}

function lobbyHash(server: string): string {
  return `#/lobby/${encodeURIComponent(server)}`;
}

function matchHash(
  server: string,
  matchID: string,
  playerID: string,
  credentials: string,
): string {
  return `#/match/${encodeURIComponent(server)}/${matchID}/${playerID}/${encodeURIComponent(credentials)}`;
}

function buildServer(host: string, port: number): string {
  const base = host.startsWith("http") ? host : `http://${host}`;
  return `${base}:${port}`;
}

// ─── boardgame.io client factories ────────────────────────────────────────────

const LocalClient = Client({
  game: ClassWarGame,
  board: ClassWarBoard,
  numPlayers: 2,
  debug: import.meta.env.DEV,
  multiplayer: Local(),
});

function makeRemoteClient(server: string) {
  return Client({
    game: ClassWarGame,
    board: ClassWarBoard,
    numPlayers: 2,
    debug: false,
    multiplayer: SocketIO({ server }),
  });
}

// ─── Leave + delete match helper (shared by LobbyRoute and RemoteGame) ────────

async function leaveAndMaybeDelete(
  server: string,
  matchID: string,
  playerID: string,
  credentials: string,
): Promise<void> {
  await fetch(`${server}/games/${GAME_NAME}/${matchID}/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerID, credentials }),
  });
  localStorage.removeItem(credentialsKey(matchID, playerID));

  // Re-fetch to check if the match is now empty and delete it if so
  try {
    const res = await fetch(`${server}/games/${GAME_NAME}`);
    if (res.ok) {
      const data: LobbyMatchList = await res.json() as LobbyMatchList;
      const updated = data.matches.find((m) => m.matchID === matchID);
      if (updated && updated.players.every((p) => !p.name)) {
        await fetch(`${server}/games/${GAME_NAME}/${matchID}`, { method: "DELETE" });
      }
    }
  } catch {
    // Best-effort: ignore errors checking/deleting the emptied match
  }
}

// ─── Setup screen ──────────────────────────────────────────────────────────────

interface SetupScreenProps {
  initialPlayerName: string;
  onLocal: () => void;
  onConnectToLobby: (server: string, playerName: string) => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({
  initialPlayerName,
  onLocal,
  onConnectToLobby,
}) => {
  const [playerName, setPlayerName] = useState(initialPlayerName);
  const [host, setHost] = useState(DEFAULT_HOST);
  const [port, setPort] = useState(DEFAULT_PORT);
  const [timeoutMs, setTimeoutMs] = useState(
    () => parseInt(localStorage.getItem(TIMEOUT_MS_KEY) ?? String(DEFAULT_TIMEOUT_MS), 10),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleConnect = () => {
    const server = buildServer(host, port);
    const name = playerName.trim();
    localStorage.setItem(PLAYER_NAME_KEY, name);
    localStorage.setItem(TIMEOUT_MS_KEY, String(timeoutMs));
    onConnectToLobby(server, name);
  };

  return (
    <div className="setup-screen">
      <div className="setup-screen-content">
        <div className="setup-screen-title">CLASS WAR</div>
        <div className="setup-screen-subtitle">International</div>

        <section className="setup-section">
          <h2 className="setup-section-title">Local / Pass-and-Play</h2>
          <p className="setup-section-description">
            Both players share this device. Pass the screen between turns.
          </p>
          <button className="setup-button setup-button-local" onClick={onLocal}>
            ▶ Play Locally
          </button>
        </section>

        <section className="setup-section">
          <h2 className="setup-section-title">Connect to Lobby</h2>
          <p className="setup-section-description">
            Join a game hosted on another device. Start a server with{" "}
            <code>npm run host</code>.
          </p>

          <label className="setup-field">
            <span className="setup-field-label">Player Name</span>
            <input
              className="setup-field-input"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. Alice"
            />
          </label>

          <label className="setup-field">
            <span className="setup-field-label">Host Address (IP or Domain)</span>
            <input
              className="setup-field-input"
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.x or mygame.example.com"
            />
          </label>

          <label className="setup-field">
            <span className="setup-field-label">Port</span>
            <input
              className="setup-field-input setup-field-input-port"
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value, 10))}
            />
          </label>

          <div className="setup-advanced-header">
            <button
              className="setup-advanced-toggle"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
              aria-controls="setup-advanced-options"
            >
              <span className="setup-advanced-gear">⚙</span>
              Advanced options
              <span className="setup-advanced-chevron">{showAdvanced ? "▲" : "▼"}</span>
            </button>
          </div>

          {showAdvanced && (
            <div className="setup-advanced-options" id="setup-advanced-options">
              <label className="setup-field">
                <span className="setup-field-label">Connection timeout (ms)</span>
                <input
                  className="setup-field-input setup-field-input-port"
                  type="number"
                  min={1000}
                  max={60000}
                  step={500}
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(parseInt(e.target.value, 10))}
                />
              </label>
            </div>
          )}

          <button className="setup-button setup-button-host" onClick={handleConnect}>
            ▶ Connect to Lobby
          </button>
        </section>
      </div>
    </div>
  );
};

// ─── Lobby route ───────────────────────────────────────────────────────────────
// Handles the full connecting → (error | match list) flow for a specific server.

type LobbyStatus =
  | { kind: "connecting" }
  | { kind: "error" }
  | { kind: "ready"; matches: LobbyMatch[] };

interface LobbyRouteProps {
  server: string;
  playerName: string;
  onEnterMatch: (matchID: string, playerID: "0" | "1", credentials: string) => void;
  onBack: () => void;
}

const PLAYER_CLASS_LABEL: Record<string, string> = {
  "0": "Working Class",
  "1": "Capitalist Class",
};

const LobbyRoute: React.FC<LobbyRouteProps> = ({
  server,
  playerName,
  onEnterMatch,
  onBack,
}) => {
  const [status, setStatus] = useState<LobbyStatus>({ kind: "connecting" });
  const [timeoutMs] = useState(
    () => parseInt(localStorage.getItem(TIMEOUT_MS_KEY) ?? String(DEFAULT_TIMEOUT_MS), 10),
  );
  const [selectedPlayerID, setSelectedPlayerID] = useState<Record<string, "0" | "1">>({});
  const [joining, setJoining] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Use a ref for the fetch abort controller so fetchMatches can be called
  // multiple times (refresh, retry) without stale closure issues.
  const abortRef = useRef<AbortController | null>(null);

  const fetchMatches = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus({ kind: "connecting" });
    setActionError(null);

    const timer = setTimeout(() => {
      controller.abort();
      setStatus({ kind: "error" });
    }, timeoutMs);

    try {
      const res = await fetch(`${server}/games/${GAME_NAME}`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LobbyMatchList = await res.json() as LobbyMatchList;
      setStatus({ kind: "ready", matches: data.matches ?? [] });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") return;
      setStatus({ kind: "error" });
    }
  }, [server, timeoutMs]);

  useEffect(() => {
    void fetchMatches();
    return () => abortRef.current?.abort();
  }, [fetchMatches]);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`${server}/games/${GAME_NAME}/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numPlayers: 2 }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      await fetchMatches();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (match: LobbyMatch) => {
    const pid = selectedPlayerID[match.matchID] ?? getDefaultPlayerID(match);
    if (!pid) return;
    setJoining(match.matchID);
    setActionError(null);
    try {
      const displayName = playerName || PLAYER_CLASS_LABEL[pid];
      const res = await fetch(`${server}/games/${GAME_NAME}/${match.matchID}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerID: pid, playerName: displayName }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data: LobbyJoinResponse = await res.json() as LobbyJoinResponse;
      localStorage.setItem(credentialsKey(match.matchID, pid), data.playerCredentials);
      onEnterMatch(match.matchID, pid as "0" | "1", data.playerCredentials);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
      setJoining(null);
    }
  };

  const handleRejoin = (match: LobbyMatch, pid: "0" | "1") => {
    const storedCreds = localStorage.getItem(credentialsKey(match.matchID, pid));
    if (!storedCreds) {
      setActionError(
        "Cannot rejoin: credentials not found. Try clearing match history or rejoining from the original device.",
      );
      return;
    }
    onEnterMatch(match.matchID, pid, storedCreds);
  };

  const handleLeave = async (match: LobbyMatch, pid: "0" | "1") => {
    const creds = localStorage.getItem(credentialsKey(match.matchID, pid));
    if (!creds) {
      setActionError("Cannot leave: credentials not found.");
      return;
    }
    setLeaving(match.matchID);
    setActionError(null);
    try {
      await leaveAndMaybeDelete(server, match.matchID, pid, creds);
      await fetchMatches();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLeaving(null);
    }
  };

  // ── Connecting view ──────────────────────────────────────────────────────────

  if (status.kind === "connecting") {
    return (
      <div className="setup-screen">
        <div className="setup-screen-content">
          <div className="setup-screen-title">CLASS WAR</div>
          <div className="setup-screen-subtitle">International</div>
          <div className="lobby-connecting-box">
            <div className="lobby-spinner" aria-label="Connecting" />
            <p className="lobby-connecting-text">Connecting to {server}…</p>
            <button className="setup-button setup-button-secondary" onClick={onBack}>
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Error view ───────────────────────────────────────────────────────────────

  if (status.kind === "error") {
    return (
      <div className="setup-screen">
        <div className="setup-screen-content">
          <div className="setup-screen-title">CLASS WAR</div>
          <div className="setup-screen-subtitle">International</div>
          <div className="lobby-error-box">
            <p className="lobby-error-message">
              Cannot find host server at <strong>{server}</strong> after{" "}
              <strong>{timeoutMs / 1000}s</strong>.
            </p>
            <p className="lobby-error-subtext">
              Do you have the correct IP address (or domain), port, and is the host server running?
            </p>
            <div className="lobby-error-actions">
              <button
                className="setup-button setup-button-host"
                onClick={() => void fetchMatches()}
              >
                ↺ Retry Connection
              </button>
              <button className="setup-button setup-button-secondary" onClick={onBack}>
                ← Return to Start Screen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Match list view ──────────────────────────────────────────────────────────

  const { matches } = status;

  return (
    <div className="setup-screen">
      <div className="setup-screen-content">
        <div className="setup-screen-title">CLASS WAR</div>
        <div className="setup-screen-subtitle">International</div>

        <section className="setup-section">
          <div className="lobby-header">
            <h2 className="setup-section-title">Open Matches</h2>
            <div className="lobby-header-actions">
              <button
                className="setup-button setup-button-small setup-button-secondary"
                onClick={() => void fetchMatches()}
              >
                ↺ Refresh
              </button>
              <button
                className="setup-button setup-button-small setup-button-secondary"
                onClick={onBack}
              >
                ← Back
              </button>
            </div>
          </div>
          <div className="lobby-server-info">
            <p className="setup-section-description lobby-server-label">
              Server: {server}
            </p>
            {playerName && (
              <p className="lobby-current-player">
                Playing as: <span className="lobby-current-player-name">{playerName}</span>
              </p>
            )}
          </div>

          <div className="lobby-create">
            <button
              className="setup-button setup-button-host lobby-create-button"
              onClick={() => void handleCreate()}
              disabled={creating}
            >
              {creating ? "Creating…" : "+ Create Game"}
            </button>
            {createError && <p className="lobby-join-error">{createError}</p>}
          </div>

          {actionError && <p className="lobby-join-error">{actionError}</p>}

          {matches.length === 0 ? (
            <div className="lobby-empty">
              <p>No open matches found.</p>
              <p className="lobby-empty-hint">
                Create a game above or ask the host to create one.
              </p>
            </div>
          ) : (
            <div className="lobby-match-list">
              {matches.map((match) => {
                const mySlot = playerName
                  ? match.players.find((p) => p.name === playerName)
                  : undefined;
                const isRejoinable = mySlot !== undefined;
                const isFull = !isRejoinable && match.players.every((p) => p.name !== undefined);
                const pid = selectedPlayerID[match.matchID] ?? getDefaultPlayerID(match);
                const isBusy =
                  joining === match.matchID || leaving === match.matchID;

                return (
                  <div
                    key={match.matchID}
                    className={`lobby-match-card${isFull ? " lobby-match-card-full" : ""}`}
                  >
                    <div className="lobby-match-id">
                      Match: <code>{match.matchID}</code>
                    </div>
                    <div className="lobby-match-players">
                      {match.players.map((player) => {
                        const isMine = Boolean(playerName && player.name === playerName);
                        let slotClass = "lobby-player-slot";
                        if (isMine) slotClass += " lobby-player-slot-mine";
                        else if (player.name) slotClass += " lobby-player-slot-taken";
                        else slotClass += " lobby-player-slot-open";
                        return (
                          <div key={player.id} className={slotClass}>
                            <span className="lobby-player-class">
                              {PLAYER_CLASS_LABEL[String(player.id)]}
                            </span>
                            <span className="lobby-player-name">
                              {player.name ?? "Open"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="lobby-match-join">
                      {isRejoinable ? (
                        <>
                          <button
                            className="lobby-rejoin-button"
                            disabled={isBusy}
                            onClick={() =>
                              handleRejoin(match, String(mySlot.id) as "0" | "1")
                            }
                          >
                            {joining === match.matchID ? "Rejoining…" : "↩ Rejoin"}
                          </button>
                          <button
                            className="setup-button setup-button-secondary lobby-leave-button"
                            disabled={isBusy}
                            onClick={() =>
                              void handleLeave(match, String(mySlot.id) as "0" | "1")
                            }
                          >
                            {leaving === match.matchID ? "Leaving…" : "Leave"}
                          </button>
                        </>
                      ) : (
                        <>
                          <select
                            className="setup-field-input lobby-player-select"
                            value={pid ?? ""}
                            onChange={(e) =>
                              setSelectedPlayerID((prev) => ({
                                ...prev,
                                [match.matchID]: e.target.value as "0" | "1",
                              }))
                            }
                            disabled={isFull || isBusy}
                          >
                            {match.players.map((player) => (
                              <option
                                key={player.id}
                                value={String(player.id)}
                                disabled={player.name !== undefined}
                              >
                                {PLAYER_CLASS_LABEL[String(player.id)]}
                                {player.name ? " (taken)" : ""}
                              </option>
                            ))}
                          </select>
                          <button
                            className="setup-button setup-button-host lobby-join-button"
                            disabled={isFull || isBusy}
                            onClick={() => void handleJoin(match)}
                          >
                            {joining === match.matchID
                              ? "Joining…"
                              : isFull
                                ? "Full"
                                : "Join Game"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

function getDefaultPlayerID(match: LobbyMatch): "0" | "1" | undefined {
  const open = match.players.find((p) => p.name === undefined);
  if (open === undefined) return undefined;
  return String(open.id) as "0" | "1";
}

// ─── Remote game wrapper ──────────────────────────────────────────────────────

interface RemoteGameProps {
  server: string;
  matchID: string;
  playerID: "0" | "1";
  credentials: string;
}

function RemoteGame({ server, matchID, playerID, credentials }: RemoteGameProps) {
  const [RemoteClient] = useState(() => makeRemoteClient(server));

  const returnToLobby = useCallback(() => {
    window.location.hash = lobbyHash(server);
  }, [server]);

  const returnToStart = useCallback(() => {
    window.location.hash = "#/";
  }, []);

  const leaveMatch = useCallback(async () => {
    try {
      await leaveAndMaybeDelete(server, matchID, playerID, credentials);
    } finally {
      window.location.hash = lobbyHash(server);
    }
  }, [server, matchID, playerID, credentials]);

  return (
    <GameNavContext.Provider
      value={{
        onReturnToLobby: returnToLobby,
        onReturnToStart: returnToStart,
        onLeaveMatch: leaveMatch,
      }}
    >
      <div className="App">
        <RemoteClient matchID={matchID} playerID={playerID} credentials={credentials} />
      </div>
    </GameNavContext.Provider>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const [playerName, setPlayerName] = useState<string>(
    () => localStorage.getItem(PLAYER_NAME_KEY) ?? "",
  );

  // Keep route in sync with the URL hash (handles browser back/forward)
  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const goToSetup = useCallback(() => {
    window.location.hash = "#/";
  }, []);

  const goToLobby = useCallback(
    (server: string, name: string) => {
      setPlayerName(name);
      window.location.hash = lobbyHash(server);
    },
    [],
  );

  const goToMatch = useCallback(
    (server: string, matchID: string, playerID: "0" | "1", credentials: string) => {
      window.location.hash = matchHash(server, matchID, playerID, credentials);
    },
    [],
  );

  if (route.kind === "local") {
    return (
      <GameNavContext.Provider
        value={{ onReturnToStart: goToSetup, onReturnToLobby: null, onLeaveMatch: null }}
      >
        <div className="App">
          <LocalClient />
        </div>
      </GameNavContext.Provider>
    );
  }

  if (route.kind === "lobby") {
    return (
      <LobbyRoute
        server={route.server}
        playerName={playerName}
        onEnterMatch={(matchID, playerID, credentials) =>
          goToMatch(route.server, matchID, playerID, credentials)
        }
        onBack={goToSetup}
      />
    );
  }

  if (route.kind === "match") {
    return (
      <RemoteGame
        server={route.server}
        matchID={route.matchID}
        playerID={route.playerID}
        credentials={route.credentials}
      />
    );
  }

  // route.kind === "setup"
  return (
    <SetupScreen
      initialPlayerName={playerName}
      onLocal={() => { window.location.hash = "#/local"; }}
      onConnectToLobby={goToLobby}
    />
  );
}

export default App;
