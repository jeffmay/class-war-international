/**
 * Main App component
 *
 * URL hash routing:
 *   #/                                         — setup screen
 *   #/local                                    — local game manager (list saved games)
 *   #/local/{gameName}                         — play a specific local game (pass-and-play)
 *   #/lobby/{hostID}                           — browse / create / join matches
 *   #/host/{hostID}/match/{matchID}            — playing a specific match
 *
 * Host ID encoding (see src/util/hostEncoding.ts):
 *   '_' prefix = DNS hostname: encodeURI(host:port)
 *   '4' prefix = IPv4: base64url([b0,b1,b2,b3,portHi,portLo])
 *   '6' prefix = IPv6: base64url([...16 bytes, portHi, portLo])
 *
 * Local game state is persisted by boardgame.io's Local transport with
 * { persist: true, storageKey: "cwi" } — no custom serialization needed.
 *
 * Player profiles are persisted in localStorage (cwi_players, cwi_last_player).
 * Per-match credentials are persisted in localStorage (cwi_match_<id>_<profile>)
 * keyed by profile name so a player can rejoin after a page refresh and
 * two profiles can play the same match from the same device.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Client } from "boardgame.io/react";
import { SocketIO, Local } from "boardgame.io/multiplayer";
import { ClassWarGame } from "./game/ClassWarGame";
import { ClassWarBoard } from "./Board";
import { LobbyMatch, LobbyMatchList, LobbyJoinResponse } from "./types/lobby";
import { GameNavContext } from "./contexts/GameNav";
import { encodeHostID, decodeHostID } from "./util/hostEncoding";
import {
  listLocalGames,
  deleteLocalGame,
  getMostRecentLocalGame,
  BGIO_STORAGE_KEY,
  type LocalGameEntry,
} from "./util/localGameStorage";
import "./App.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const GAME_NAME = "class-war-international";
const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 8000;
const DEFAULT_TIMEOUT_MS = 5000;
const PLAYER_NAME_KEY = "cwi_player_name"; // kept for migration reads only
const PLAYERS_KEY = "cwi_players";
const LAST_PLAYER_KEY = "cwi_last_player";
const TIMEOUT_MS_KEY = "cwi_timeout_ms";

function getPlayers(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PLAYERS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function savePlayers(names: string[]): void {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(names));
}

function matchCredentialsKey(matchID: string, profileName: string): string {
  return `cwi_match_${matchID}_${profileName}`;
}

interface StoredMatchCredentials {
  playerID: "0" | "1";
  credentials: string;
  displayName: string;
}

function getMatchCredentials(matchID: string, profileName: string): StoredMatchCredentials | null {
  const raw = localStorage.getItem(matchCredentialsKey(matchID, profileName));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredMatchCredentials;
  } catch {
    return null;
  }
}

function setMatchCredentials(
  matchID: string,
  profileName: string,
  data: StoredMatchCredentials,
): void {
  localStorage.setItem(matchCredentialsKey(matchID, profileName), JSON.stringify(data));
}

function removeMatchCredentials(matchID: string, profileName: string): void {
  localStorage.removeItem(matchCredentialsKey(matchID, profileName));
}

/**
 * Find stored credentials for a multiplayer match by profile name.
 * Falls back to the old slot-keyed format for backward compatibility.
 */
function findMatchCredentials(
  matchID: string,
  profileName: string,
): { playerID: "0" | "1"; credentials: string } | null {
  const stored = getMatchCredentials(matchID, profileName);
  if (stored) return { playerID: stored.playerID, credentials: stored.credentials };
  // Migration: old slot-keyed format
  const activePID = localStorage.getItem(`cwi_active_${matchID}`) as "0" | "1" | null;
  const lookupOrder: Array<"0" | "1"> = activePID
    ? [activePID, activePID === "0" ? "1" : "0"]
    : ["0", "1"];
  for (const pid of lookupOrder) {
    const creds = localStorage.getItem(`cwi_creds_${matchID}_${pid}`);
    if (creds) return { playerID: pid, credentials: creds };
  }
  return null;
}

// ─── Route types + hash helpers ───────────────────────────────────────────────

type Route =
  | { kind: "setup" }
  | { kind: "localManager" }
  | { kind: "localGame"; gameName: string }
  | { kind: "lobby"; server: string }
  | { kind: "match"; server: string; matchID: string };

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#\//, "");
  if (!raw) return { kind: "setup" };
  if (raw === "local") return { kind: "localManager" };

  // #/local/{gameName}
  const localM = /^local\/(.+)$/.exec(raw);
  if (localM) {
    try {
      return { kind: "localGame", gameName: decodeURIComponent(localM[1]) };
    } catch {
      return { kind: "localManager" };
    }
  }

  // #/lobby/{hostID}
  const lobbyM = /^lobby\/(.+)$/.exec(raw);
  if (lobbyM) {
    try {
      return { kind: "lobby", server: decodeHostID(lobbyM[1]) };
    } catch {
      return { kind: "setup" };
    }
  }

  // #/host/{hostID}/match/{matchID}
  const matchM = /^host\/([^/]+)\/match\/([^/]+)$/.exec(raw);
  if (matchM) {
    try {
      return { kind: "match", server: decodeHostID(matchM[1]), matchID: matchM[2] };
    } catch {
      return { kind: "setup" };
    }
  }

  // Legacy: #/match/{encodedServer}/{matchID}/{playerID}/{credentials}
  const legacyM = /^match\/([^/]+)\/([^/]+)\/(0|1)\/(.+)$/.exec(raw);
  if (legacyM) {
    try {
      const server = decodeURIComponent(legacyM[1]);
      const matchID = legacyM[2];
      const playerID = legacyM[3] as "0" | "1";
      const credentials = decodeURIComponent(legacyM[4]);
      localStorage.setItem(`cwi_creds_${matchID}_${playerID}`, credentials);
      window.location.hash = matchHash(server, matchID);
      return { kind: "match", server, matchID };
    } catch {
      return { kind: "setup" };
    }
  }

  return { kind: "setup" };
}

function localManagerHash(): string {
  return "#/local";
}

function localGameHash(gameName: string): string {
  return `#/local/${encodeURIComponent(gameName)}`;
}

function lobbyHash(server: string): string {
  return `#/lobby/${encodeHostID(server)}`;
}

function matchHash(server: string, matchID: string): string {
  return `#/host/${encodeHostID(server)}/match/${matchID}`;
}

function buildServer(host: string, port: number): string {
  const base = host.startsWith("http") ? host : `http://${host}`;
  return `${base}:${port}`;
}

// ─── boardgame.io client factories ────────────────────────────────────────────

/**
 * Persistent local client: uses boardgame.io's Local transport with localStorage
 * so game state survives page refreshes. No playerID is set — the board's
 * isMyTurn logic treats null playerID as always-my-turn (pass-and-play).
 */
const PersistentLocalClient = Client({
  game: ClassWarGame,
  board: ClassWarBoard,
  numPlayers: 2,
  multiplayer: Local({ persist: true, storageKey: BGIO_STORAGE_KEY }),
  debug: import.meta.env.DEV,
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

// ─── Leave + delete match helper ──────────────────────────────────────────────

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

  try {
    const res = await fetch(`${server}/games/${GAME_NAME}`);
    if (res.ok) {
      const data: LobbyMatchList = (await res.json()) as LobbyMatchList;
      const updated = data.matches.find((m) => m.matchID === matchID);
      if (updated && updated.players.every((p) => !p.name)) {
        await fetch(`${server}/games/${GAME_NAME}/${matchID}`, { method: "DELETE" });
      }
    }
  } catch {
    // Best-effort: ignore errors checking/deleting the emptied match
  }
}

// ─── Local Game Manager ────────────────────────────────────────────────────────

interface LocalGameManagerProps {
  onBack: () => void;
}

const LocalGameManager: React.FC<LocalGameManagerProps> = ({ onBack }) => {
  const [games, setGames] = useState<LocalGameEntry[]>(() => listLocalGames());
  const [newGameName, setNewGameName] = useState("");

  const refresh = () => setGames(listLocalGames());

  const handleStartNew = () => {
    const name = newGameName.trim() || `Game ${games.length + 1}`;
    window.location.hash = localGameHash(name);
  };

  const handleContinueLast = () => {
    const last = getMostRecentLocalGame();
    if (last) window.location.hash = localGameHash(last.gameName);
  };

  const handleDelete = (gameName: string) => {
    deleteLocalGame(gameName);
    refresh();
  };

  const mostRecent = games[0];

  return (
    <div className="setup-screen">
      <div className="setup-screen-content">
        <div className="setup-screen-title">CLASS WAR</div>
        <div className="setup-screen-subtitle">International — Local Games</div>

        <section className="setup-section">
          {mostRecent && (
            <button
              className="setup-button setup-button-host local-continue-button"
              onClick={handleContinueLast}
            >
              ▶ Continue: {mostRecent.gameName}
            </button>
          )}

          <div className="local-new-game">
            <h2 className="setup-section-title">New Game</h2>
            <label className="setup-field">
              <span className="setup-field-label">Game Name</span>
              <input
                className="setup-field-input"
                type="text"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStartNew()}
                placeholder={`Game ${games.length + 1}`}
              />
            </label>
            <button className="setup-button setup-button-local" onClick={handleStartNew}>
              ▶ Start New Game
            </button>
          </div>

          {games.length > 0 && (
            <div className="local-saved-games">
              <h2 className="setup-section-title">Saved Games</h2>
              <div className="local-game-list">
                {games.map((entry) => (
                  <div key={entry.gameName} className="local-game-card">
                    <div className="local-game-info">
                      <span className="local-game-name">{entry.gameName}</span>
                      <span className="local-game-date">
                        {entry.lastPlayed
                          ? new Date(entry.lastPlayed).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                    </div>
                    <div className="local-game-actions">
                      <button
                        className="local-game-resume-button"
                        onClick={() => {
                          window.location.hash = localGameHash(entry.gameName);
                        }}
                      >
                        Resume
                      </button>
                      <button
                        className="local-game-delete-button"
                        onClick={() => handleDelete(entry.gameName)}
                        aria-label={`Delete ${entry.gameName}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="setup-button setup-button-secondary" onClick={onBack}>
            ← Back to Start
          </button>
        </section>
      </div>
    </div>
  );
};

// ─── Local game route ─────────────────────────────────────────────────────────

interface LocalGameRouteProps {
  gameName: string;
  onReturnToStart: () => void;
}

const LocalGameRoute: React.FC<LocalGameRouteProps> = ({ gameName, onReturnToStart }) => {
  const returnToManager = useCallback(() => {
    window.location.hash = localManagerHash();
  }, []);

  return (
    <GameNavContext.Provider
      value={{ onReturnToStart, onReturnToLobby: returnToManager, onLeaveMatch: null }}
    >
      <div className="App">
        <PersistentLocalClient matchID={gameName} />
      </div>
    </GameNavContext.Provider>
  );
};

// ─── Setup screen ──────────────────────────────────────────────────────────────

interface SetupScreenProps {
  players: string[];
  activePlayer: string;
  onSelectPlayer: (name: string) => void;
  onCreatePlayer: (name: string) => void;
  onDeletePlayer: (name: string) => void;
  onLocal: () => void;
  onConnectToLobby: (server: string) => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({
  players,
  activePlayer,
  onSelectPlayer,
  onCreatePlayer,
  onDeletePlayer,
  onLocal,
  onConnectToLobby,
}) => {
  const [newPlayerName, setNewPlayerName] = useState("");
  const [host, setHost] = useState(DEFAULT_HOST);
  const [port, setPort] = useState(DEFAULT_PORT);
  const [timeoutMs, setTimeoutMs] = useState(
    () => parseInt(localStorage.getItem(TIMEOUT_MS_KEY) ?? String(DEFAULT_TIMEOUT_MS), 10),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleCreatePlayer = () => {
    const name = newPlayerName.trim();
    if (!name) return;
    onCreatePlayer(name);
    setNewPlayerName("");
  };

  const handleConnect = () => {
    const server = buildServer(host, port);
    localStorage.setItem(TIMEOUT_MS_KEY, String(timeoutMs));
    onConnectToLobby(server);
  };

  return (
    <div className="setup-screen">
      <div className="setup-screen-content">
        <div className="setup-screen-title">CLASS WAR</div>
        <div className="setup-screen-subtitle">International</div>

        <section className="setup-section">
          <h2 className="setup-section-title">Choose Player</h2>
          {players.length > 0 && (
            <div className="setup-player-list">
              {players.map((name) => (
                <div key={name} className="setup-player-item">
                  <button
                    className={`setup-player-button${name === activePlayer ? " setup-player-button-active" : ""}`}
                    onClick={() => onSelectPlayer(name)}
                  >
                    {name}
                  </button>
                  <button
                    className="setup-player-delete-btn"
                    onClick={() => onDeletePlayer(name)}
                    aria-label={`Delete player ${name}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="setup-player-new">
            <input
              className="setup-field-input setup-player-new-input"
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreatePlayer()}
              placeholder="New player name…"
            />
            <button
              className="setup-button setup-button-secondary setup-player-new-btn"
              onClick={handleCreatePlayer}
              disabled={!newPlayerName.trim()}
            >
              Create
            </button>
          </div>
        </section>

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

          <button
            className="setup-button setup-button-host"
            onClick={handleConnect}
            disabled={!activePlayer}
          >
            ▶ Connect to Lobby
          </button>
          {!activePlayer && (
            <p className="setup-section-description">
              Create or select a player above to connect.
            </p>
          )}
        </section>
      </div>
    </div>
  );
};

// ─── Lobby route ───────────────────────────────────────────────────────────────

type LobbyStatus =
  | { kind: "connecting" }
  | { kind: "error" }
  | { kind: "ready"; matches: LobbyMatch[] };

interface LobbyRouteProps {
  server: string;
  activePlayer: string;
  onEnterMatch: (matchID: string, playerID: "0" | "1", credentials: string, displayName: string) => void;
  onBack: () => void;
}

const PLAYER_CLASS_LABEL: Record<string, string> = {
  "0": "Working Class",
  "1": "Capitalist Class",
};

const LobbyRoute: React.FC<LobbyRouteProps> = ({ server, activePlayer, onEnterMatch, onBack }) => {
  const [status, setStatus] = useState<LobbyStatus>({ kind: "connecting" });
  const [timeoutMs] = useState(
    () => parseInt(localStorage.getItem(TIMEOUT_MS_KEY) ?? String(DEFAULT_TIMEOUT_MS), 10),
  );
  const [selectedPlayerID, setSelectedPlayerID] = useState<Record<string, "0" | "1">>({});
  const [displayName, setDisplayName] = useState<Record<string, string>>({});
  const [joining, setJoining] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
      const res = await fetch(`${server}/games/${GAME_NAME}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LobbyMatchList = (await res.json()) as LobbyMatchList;
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
      const name = (displayName[match.matchID] ?? activePlayer).trim() || PLAYER_CLASS_LABEL[pid];
      const res = await fetch(`${server}/games/${GAME_NAME}/${match.matchID}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerID: pid, playerName: name }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data: LobbyJoinResponse = (await res.json()) as LobbyJoinResponse;
      setMatchCredentials(match.matchID, activePlayer, {
        playerID: pid as "0" | "1",
        credentials: data.playerCredentials,
        displayName: name,
      });
      onEnterMatch(match.matchID, pid as "0" | "1", data.playerCredentials, name);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
      setJoining(null);
    }
  };

  const handleRejoin = (match: LobbyMatch) => {
    const stored = getMatchCredentials(match.matchID, activePlayer);
    if (!stored) {
      setActionError(
        "Cannot rejoin: credentials not found. Try clearing match history or rejoining from the original device.",
      );
      return;
    }
    onEnterMatch(match.matchID, stored.playerID, stored.credentials, stored.displayName);
  };

  const handleLeave = async (match: LobbyMatch) => {
    const stored = getMatchCredentials(match.matchID, activePlayer);
    if (!stored) {
      setActionError("Cannot leave: credentials not found.");
      return;
    }
    setLeaving(match.matchID);
    setActionError(null);
    try {
      await leaveAndMaybeDelete(server, match.matchID, stored.playerID, stored.credentials);
      removeMatchCredentials(match.matchID, activePlayer);
      await fetchMatches();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLeaving(null);
    }
  };

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
            <p className="setup-section-description lobby-server-label">Server: {server}</p>
            {activePlayer && (
              <p className="lobby-current-player">
                Playing as:{" "}
                <span className="lobby-current-player-name">{activePlayer}</span>
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
                const storedCreds = getMatchCredentials(match.matchID, activePlayer);
                const mySlot = storedCreds
                  ? match.players[parseInt(storedCreds.playerID)]
                  : undefined;
                const isRejoinable = mySlot !== undefined && mySlot.name !== undefined;
                const isFull = !isRejoinable && match.players.every((p) => p.name !== undefined);
                const pid = selectedPlayerID[match.matchID] ?? getDefaultPlayerID(match);
                const isBusy = joining === match.matchID || leaving === match.matchID;

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
                        const isMine = isRejoinable && mySlot && player.id === mySlot.id;
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
                            onClick={() => handleRejoin(match)}
                          >
                            {joining === match.matchID ? "Rejoining…" : "↩ Rejoin"}
                          </button>
                          <button
                            className="setup-button setup-button-secondary lobby-leave-button"
                            disabled={isBusy}
                            onClick={() => void handleLeave(match)}
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
                          <input
                            className="setup-field-input lobby-display-name-input"
                            type="text"
                            value={displayName[match.matchID] ?? activePlayer}
                            onChange={(e) =>
                              setDisplayName((prev) => ({
                                ...prev,
                                [match.matchID]: e.target.value,
                              }))
                            }
                            placeholder={activePlayer || "Display name"}
                            disabled={isFull || isBusy}
                          />
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

// ─── Match redirect (no credentials) ─────────────────────────────────────────

function MatchRedirectToLobby({ server }: { server: string }) {
  useEffect(() => {
    window.location.hash = lobbyHash(server);
  }, [server]);
  return null;
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
  const [players, setPlayers] = useState<string[]>(getPlayers);
  const [activePlayer, setActivePlayer] = useState<string>(
    () =>
      localStorage.getItem(LAST_PLAYER_KEY) ??
      localStorage.getItem(PLAYER_NAME_KEY) ??
      "",
  );

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const selectPlayer = useCallback((name: string) => {
    setActivePlayer(name);
    localStorage.setItem(LAST_PLAYER_KEY, name);
    setPlayers((prev) => {
      const updated = [name, ...prev.filter((p) => p !== name)];
      savePlayers(updated);
      return updated;
    });
  }, []);

  const createPlayer = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || players.includes(trimmed)) return;
      const updated = [trimmed, ...players];
      setPlayers(updated);
      savePlayers(updated);
      selectPlayer(trimmed);
    },
    [players, selectPlayer],
  );

  const deletePlayer = useCallback(
    (name: string) => {
      const updated = players.filter((p) => p !== name);
      setPlayers(updated);
      savePlayers(updated);
      if (activePlayer === name) {
        const next = updated[0] ?? "";
        setActivePlayer(next);
        localStorage.setItem(LAST_PLAYER_KEY, next);
      }
    },
    [players, activePlayer],
  );

  const goToSetup = useCallback(() => {
    window.location.hash = "#/";
  }, []);

  const goToMatch = useCallback(
    (server: string, matchID: string, playerID: "0" | "1", credentials: string, displayName: string) => {
      setMatchCredentials(matchID, activePlayer, { playerID, credentials, displayName });
      window.location.hash = matchHash(server, matchID);
    },
    [activePlayer],
  );

  if (route.kind === "localManager") {
    return <LocalGameManager onBack={goToSetup} />;
  }

  if (route.kind === "localGame") {
    return <LocalGameRoute gameName={route.gameName} onReturnToStart={goToSetup} />;
  }

  if (route.kind === "lobby") {
    return (
      <LobbyRoute
        server={route.server}
        activePlayer={activePlayer}
        onEnterMatch={(matchID, playerID, credentials, displayName) =>
          goToMatch(route.server, matchID, playerID, credentials, displayName)
        }
        onBack={goToSetup}
      />
    );
  }

  if (route.kind === "match") {
    const found = findMatchCredentials(route.matchID, activePlayer);
    if (!found) {
      return <MatchRedirectToLobby server={route.server} />;
    }
    return (
      <RemoteGame
        server={route.server}
        matchID={route.matchID}
        playerID={found.playerID}
        credentials={found.credentials}
      />
    );
  }

  // route.kind === "setup"
  return (
    <SetupScreen
      players={players}
      activePlayer={activePlayer}
      onSelectPlayer={selectPlayer}
      onCreatePlayer={createPlayer}
      onDeletePlayer={deletePlayer}
      onLocal={() => {
        window.location.hash = localManagerHash();
      }}
      onConnectToLobby={(server) => {
        window.location.hash = lobbyHash(server);
      }}
    />
  );
}

export default App;
