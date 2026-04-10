/**
 * Main App component
 *
 * Supports these modes:
 *   setup      — start screen (local play or connect to lobby)
 *   local      — pass-and-play on a single device (no network required)
 *   lobby      — browse open matches on a remote server
 *   connecting — waiting for lobby to respond (with timeout)
 *   error      — connection timed out or failed
 *   host       — connected to a remote boardgame.io server as a specific player
 */

import React, { useEffect, useRef, useState } from "react";
import { Client } from "boardgame.io/react";
import { Local, SocketIO } from "boardgame.io/multiplayer";
import { ClassWarGame } from "./game/ClassWarGame";
import { ClassWarBoard } from "./Board";
import { LobbyMatch, LobbyMatchList, LobbyJoinResponse } from "./types/lobby";
import { SocialClass } from "./types/cards";
import "./App.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const GAME_NAME = "class-war-international";
const DEFAULT_HOST = "localhost";
const DEFAULT_API_PORT = 8001;
const DEFAULT_GAME_PORT = 8000;
const DEFAULT_TIMEOUT_MS = 5000;

// ─── Mode types ────────────────────────────────────────────────────────────────

type AppMode =
  | { kind: "setup" }
  | { kind: "local" }
  | { kind: "connecting"; apiBase: string; gameServer: string; timeoutMs: number }
  | { kind: "error"; apiBase: string; gameServer: string; timeoutMs: number }
  | { kind: "lobby"; apiBase: string; gameServer: string; matches: LobbyMatch[] }
  | { kind: "host"; gameServer: string; matchID: string; playerID: "0" | "1"; playerCredentials: string };

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

// ─── Helper: build URLs ───────────────────────────────────────────────────────

function buildUrls(host: string, apiPort: number, gamePort: number) {
  const base = host.startsWith("http") ? host : `http://${host}`;
  return {
    apiBase: `${base}:${apiPort}`,
    gameServer: `${base}:${gamePort}`,
  };
}

// ─── Setup screen ──────────────────────────────────────────────────────────────

interface SetupScreenProps {
  onLocal: () => void;
  onConnectToLobby: (apiBase: string, gameServer: string, timeoutMs: number) => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onLocal, onConnectToLobby }) => {
  const [host, setHost] = useState(DEFAULT_HOST);
  const [apiPort, setApiPort] = useState(DEFAULT_API_PORT);
  const [gamePort, setGamePort] = useState(DEFAULT_GAME_PORT);
  const [timeoutMs, setTimeoutMs] = useState(DEFAULT_TIMEOUT_MS);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleConnect = () => {
    const { apiBase, gameServer } = buildUrls(host, apiPort, gamePort);
    onConnectToLobby(apiBase, gameServer, timeoutMs);
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
              value={apiPort}
              onChange={(e) => setApiPort(parseInt(e.target.value, 10))}
            />
          </label>

          <div className="setup-advanced-header">
            <button
              className="setup-advanced-toggle"
              onClick={() => setShowAdvanced(v => !v)}
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
                <span className="setup-field-label">Game Server Port</span>
                <input
                  className="setup-field-input setup-field-input-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={gamePort}
                  onChange={(e) => setGamePort(parseInt(e.target.value, 10))}
                />
              </label>
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

          <button
            className="setup-button setup-button-host"
            onClick={handleConnect}
          >
            ▶ Connect to Lobby
          </button>
        </section>
      </div>
    </div>
  );
};

// ─── Connecting screen ────────────────────────────────────────────────────────

interface ConnectingScreenProps {
  apiBase: string;
  timeoutMs: number;
  onSuccess: (matches: LobbyMatch[]) => void;
  onTimeout: () => void;
  onBack: () => void;
}

const ConnectingScreen: React.FC<ConnectingScreenProps> = ({
  apiBase,
  timeoutMs,
  onSuccess,
  onTimeout,
  onBack,
}) => {
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      onTimeout();
    }, timeoutMs);

    fetch(`${apiBase}/games/${GAME_NAME}`, { signal: controller.signal })
      .then(async (res) => {
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: LobbyMatchList = await res.json() as LobbyMatchList;
        onSuccess(data.matches ?? []);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        if (err instanceof Error && err.name === "AbortError") return; // timeout already handled
        onTimeout();
      });

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [apiBase, timeoutMs, onSuccess, onTimeout]);

  return (
    <div className="setup-screen">
      <div className="setup-screen-content">
        <div className="setup-screen-title">CLASS WAR</div>
        <div className="setup-screen-subtitle">International</div>
        <div className="lobby-connecting-box">
          <div className="lobby-spinner" aria-label="Connecting" />
          <p className="lobby-connecting-text">Connecting to {apiBase}…</p>
          <button className="setup-button setup-button-secondary" onClick={onBack}>
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Connection error screen ──────────────────────────────────────────────────

interface ConnectionErrorScreenProps {
  apiBase: string;
  timeoutMs: number;
  onRetry: () => void;
  onBack: () => void;
}

const ConnectionErrorScreen: React.FC<ConnectionErrorScreenProps> = ({
  apiBase,
  timeoutMs,
  onRetry,
  onBack,
}) => (
  <div className="setup-screen">
    <div className="setup-screen-content">
      <div className="setup-screen-title">CLASS WAR</div>
      <div className="setup-screen-subtitle">International</div>

      <div className="lobby-error-box">
        <p className="lobby-error-message">
          Cannot find host server at <strong>{apiBase}</strong> after{" "}
          <strong>{timeoutMs / 1000}s</strong>.
        </p>
        <p className="lobby-error-subtext">
          Do you have the correct IP address (or domain), port, and is the host server running?
        </p>
        <div className="lobby-error-actions">
          <button className="setup-button setup-button-host" onClick={onRetry}>
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

// ─── Lobby screen ─────────────────────────────────────────────────────────────

interface LobbyScreenProps {
  apiBase: string;
  gameServer: string;
  matches: LobbyMatch[];
  onJoin: (matchID: string, playerID: "0" | "1", playerCredentials: string) => void;
  onRefresh: () => void;
  onBack: () => void;
}

const PLAYER_CLASS_LABEL: Record<string, string> = {
  "0": "Working Class",
  "1": "Capitalist Class",
};

const LobbyScreen: React.FC<LobbyScreenProps> = ({
  apiBase,
  gameServer,
  matches,
  onJoin,
  onRefresh,
  onBack,
}) => {
  const [selectedPlayerID, setSelectedPlayerID] = useState<Record<string, "0" | "1">>({});
  const [joining, setJoining] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleJoin = async (match: LobbyMatch) => {
    const pid = selectedPlayerID[match.matchID] ?? getDefaultPlayerID(match);
    if (!pid) return;
    setJoining(match.matchID);
    setJoinError(null);
    try {
      const res = await fetch(
        `${apiBase}/games/${GAME_NAME}/${match.matchID}/join`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerID: pid, playerName: PLAYER_CLASS_LABEL[pid] }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data: LobbyJoinResponse = await res.json() as LobbyJoinResponse;
      onJoin(match.matchID, pid as "0" | "1", data.playerCredentials);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Unknown error");
      setJoining(null);
    }
  };

  return (
    <div className="setup-screen">
      <div className="setup-screen-content">
        <div className="setup-screen-title">CLASS WAR</div>
        <div className="setup-screen-subtitle">International</div>

        <section className="setup-section">
          <div className="lobby-header">
            <h2 className="setup-section-title">Open Matches</h2>
            <div className="lobby-header-actions">
              <button className="setup-button setup-button-small setup-button-secondary" onClick={onRefresh}>
                ↺ Refresh
              </button>
              <button className="setup-button setup-button-small setup-button-secondary" onClick={onBack}>
                ← Back
              </button>
            </div>
          </div>
          <p className="setup-section-description lobby-server-label">
            Server: {gameServer}
          </p>

          {joinError && (
            <p className="lobby-join-error">{joinError}</p>
          )}

          {matches.length === 0 ? (
            <div className="lobby-empty">
              <p>No open matches found.</p>
              <p className="lobby-empty-hint">
                Start a new match by running <code>npm run host</code> and creating one from another client.
              </p>
            </div>
          ) : (
            <div className="lobby-match-list">
              {matches.map((match) => {
                const isFull = match.players.every((p) => p.name !== undefined);
                const pid = selectedPlayerID[match.matchID] ?? getDefaultPlayerID(match);

                return (
                  <div key={match.matchID} className={`lobby-match-card${isFull ? " lobby-match-card-full" : ""}`}>
                    <div className="lobby-match-id">Match: <code>{match.matchID}</code></div>
                    <div className="lobby-match-players">
                      {match.players.map((player) => (
                        <div key={player.id} className={`lobby-player-slot${player.name ? " lobby-player-slot-taken" : " lobby-player-slot-open"}`}>
                          <span className="lobby-player-class">{PLAYER_CLASS_LABEL[String(player.id)]}</span>
                          <span className="lobby-player-name">{player.name ?? "Open"}</span>
                        </div>
                      ))}
                    </div>
                    <div className="lobby-match-join">
                      <select
                        className="setup-field-input lobby-player-select"
                        value={pid ?? ""}
                        onChange={(e) =>
                          setSelectedPlayerID((prev) => ({
                            ...prev,
                            [match.matchID]: e.target.value as "0" | "1",
                          }))
                        }
                        disabled={isFull || joining === match.matchID}
                      >
                        {match.players.map((player) => (
                          <option
                            key={player.id}
                            value={String(player.id)}
                            disabled={player.name !== undefined}
                          >
                            {PLAYER_CLASS_LABEL[String(player.id)]}{player.name ? " (taken)" : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        className="setup-button setup-button-host lobby-join-button"
                        disabled={isFull || joining === match.matchID}
                        onClick={() => handleJoin(match)}
                      >
                        {joining === match.matchID ? "Joining…" : isFull ? "Full" : "Join Game"}
                      </button>
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

// ─── Remote mode wrapper ──────────────────────────────────────────────────────

function RemoteMode({
  gameServer,
  matchID,
  playerID,
  playerCredentials,
  onReturnToLobby,
  onReturnToStart,
}: {
  gameServer: string;
  matchID: string;
  playerID: "0" | "1";
  playerCredentials: string;
  onReturnToLobby: () => void;
  onReturnToStart: () => void;
}) {
  const [RemoteClient] = useState(() => makeRemoteClient(gameServer));
  const playerClass = playerID === "0" ? SocialClass.WorkingClass : SocialClass.CapitalistClass;

  return (
    <div className="App">
      <RemoteClient matchID={matchID} playerID={playerID} credentials={playerCredentials} />
      <div className="remote-nav-bar">
        <button className="remote-nav-button" onClick={onReturnToLobby}>
          ← Lobby
        </button>
        <span className="remote-nav-info">
          {playerClass} · Match <code>{matchID}</code>
        </span>
        <button className="remote-nav-button" onClick={onReturnToStart}>
          ⌂ Start Screen
        </button>
      </div>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

function App() {
  const [mode, setMode] = useState<AppMode>({ kind: "setup" });
  // Preserve lobby connection params so "Return to Lobby" can reconnect
  const lobbyParamsRef = useRef<{ apiBase: string; gameServer: string; timeoutMs: number } | null>(null);

  const goToSetup = () => setMode({ kind: "setup" });

  const connectToLobby = (apiBase: string, gameServer: string, timeoutMs: number) => {
    lobbyParamsRef.current = { apiBase, gameServer, timeoutMs };
    setMode({ kind: "connecting", apiBase, gameServer, timeoutMs });
  };

  const retryConnection = () => {
    if (!lobbyParamsRef.current) return;
    const { apiBase, gameServer, timeoutMs } = lobbyParamsRef.current;
    setMode({ kind: "connecting", apiBase, gameServer, timeoutMs });
    // Re-trigger connecting by resetting then setting
    setTimeout(() => setMode({ kind: "connecting", apiBase, gameServer, timeoutMs }), 0);
  };

  const returnToLobby = () => {
    if (!lobbyParamsRef.current) { goToSetup(); return; }
    const { apiBase, gameServer, timeoutMs } = lobbyParamsRef.current;
    setMode({ kind: "connecting", apiBase, gameServer, timeoutMs });
  };

  if (mode.kind === "setup") {
    return (
      <SetupScreen
        onLocal={() => setMode({ kind: "local" })}
        onConnectToLobby={connectToLobby}
      />
    );
  }

  if (mode.kind === "local") {
    return (
      <div className="App">
        <LocalClient />
        <div className="remote-nav-bar">
          <button className="remote-nav-button" onClick={goToSetup}>
            ⌂ Start Screen
          </button>
        </div>
      </div>
    );
  }

  if (mode.kind === "connecting") {
    return (
      <ConnectingScreen
        apiBase={mode.apiBase}
        timeoutMs={mode.timeoutMs}
        onSuccess={(matches) =>
          setMode({ kind: "lobby", apiBase: mode.apiBase, gameServer: mode.gameServer, matches })
        }
        onTimeout={() =>
          setMode({ kind: "error", apiBase: mode.apiBase, gameServer: mode.gameServer, timeoutMs: mode.timeoutMs })
        }
        onBack={goToSetup}
      />
    );
  }

  if (mode.kind === "error") {
    return (
      <ConnectionErrorScreen
        apiBase={mode.apiBase}
        timeoutMs={mode.timeoutMs}
        onRetry={retryConnection}
        onBack={goToSetup}
      />
    );
  }

  if (mode.kind === "lobby") {
    return (
      <LobbyScreen
        apiBase={mode.apiBase}
        gameServer={mode.gameServer}
        matches={mode.matches}
        onJoin={(matchID, playerID, playerCredentials) =>
          setMode({ kind: "host", gameServer: mode.gameServer, matchID, playerID, playerCredentials })
        }
        onRefresh={() => {
          const timeoutMs = lobbyParamsRef.current?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
          setMode({ kind: "connecting", apiBase: mode.apiBase, gameServer: mode.gameServer, timeoutMs });
        }}
        onBack={goToSetup}
      />
    );
  }

  return (
    <RemoteMode
      gameServer={mode.gameServer}
      matchID={mode.matchID}
      playerID={mode.playerID}
      playerCredentials={mode.playerCredentials}
      onReturnToLobby={returnToLobby}
      onReturnToStart={goToSetup}
    />
  );
}

export default App;
