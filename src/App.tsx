/**
 * Main App component
 *
 * URL hash routing:
 *   #/          — start screen (pick player name, enter local or lobby)
 *   #/local     — pass-and-play on a single device (no network)
 *   #/lobby     — browse / create / join networked matches
 *   #/match/:id — playing a specific networked match
 *
 * Player IDs in networked play are assigned by the lobby (0 or 1) and are
 * independent of social class. The social class each player controls is
 * determined by the game's turn order, not the player ID.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Client } from "boardgame.io/react";
import { Lobby } from "boardgame.io/react";
import { Local, SocketIO } from "boardgame.io/multiplayer";
import { ClassWarGame } from "./game/ClassWarGame";
import { ClassWarBoard } from "./Board";

// ─── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_SERVER = "http://localhost:8000";
const PLAYER_NAME_KEY = "cwi_player_name";
const SERVER_KEY = "cwi_server";
const GAME_NAME = "class-war-international";

/**
 * The Lobby component only needs game.name to filter and create matches.
 * We pass a minimal stub because StrictGame's stricter setup signature is
 * not assignable to Game<any> due to contravariance in TypeScript's type
 * checker — even though at runtime StrictGame is a valid Game.
 */
const lobbyGameStub = { name: GAME_NAME };

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

// ─── Route types ───────────────────────────────────────────────────────────────

type Route =
  | { kind: "start" }
  | { kind: "local" }
  | { kind: "lobby" }
  | { kind: "match"; matchID: string; playerID: "0" | "1"; credentials: string };

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#\//, "");
  if (hash === "local") return { kind: "local" };
  if (hash === "lobby") return { kind: "lobby" };
  const matchResult = /^match\/([^/]+)\/(\d+)\/(.+)$/.exec(hash);
  if (matchResult) {
    const [, matchID, playerID, credentials] = matchResult;
    if (playerID === "0" || playerID === "1") {
      return { kind: "match", matchID, playerID, credentials };
    }
  }
  return { kind: "start" };
}

function encodeMatchHash(matchID: string, playerID: string, credentials: string): string {
  return `#/match/${matchID}/${playerID}/${credentials}`;
}

// ─── Start screen ──────────────────────────────────────────────────────────────

interface StartScreenProps {
  onLocal: () => void;
  onLobby: (server: string, playerName: string) => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onLocal, onLobby }) => {
  const [playerName, setPlayerName] = useState(
    () => localStorage.getItem(PLAYER_NAME_KEY) ?? "",
  );
  const [server, setServer] = useState(
    () => localStorage.getItem(SERVER_KEY) ?? DEFAULT_SERVER,
  );

  const handleEnterLobby = () => {
    const name = playerName.trim() || "Player";
    localStorage.setItem(PLAYER_NAME_KEY, name);
    localStorage.setItem(SERVER_KEY, server);
    onLobby(server, name);
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
          <h2 className="setup-section-title">Online Lobby</h2>
          <p className="setup-section-description">
            Browse, create, or join matches hosted on a remote server (start one
            with <code>npm run host</code>).
          </p>

          <label className="setup-field">
            <span className="setup-field-label">Your Player ID</span>
            <input
              className="setup-field-input"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. Alice"
            />
          </label>

          <label className="setup-field">
            <span className="setup-field-label">Server address</span>
            <input
              className="setup-field-input"
              type="text"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder="http://192.168.1.x:8000"
            />
          </label>

          <button
            className="setup-button setup-button-host"
            onClick={handleEnterLobby}
          >
            ▶ Enter Online Lobby
          </button>
        </section>
      </div>
    </div>
  );
};

// ─── Remote match wrapper ─────────────────────────────────────────────────────

interface RemoteMatchProps {
  server: string;
  matchID: string;
  playerID: "0" | "1";
  credentials: string;
  onReturnToLobby: () => void;
  onReturnToStart: () => void;
}

function RemoteMatch({
  server,
  matchID,
  playerID,
  credentials,
  onReturnToLobby,
  onReturnToStart,
}: RemoteMatchProps) {
  const [RemoteClient] = useState(() => makeRemoteClient(server));
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="App">
      {/* Hamburger button */}
      <button
        className="hamburger-button"
        onClick={() => setPanelOpen((v) => !v)}
        aria-label="Open menu"
        aria-expanded={panelOpen}
      >
        ☰
      </button>

      {/* Floating left-side panel */}
      {panelOpen && (
        <>
          <div
            className="panel-backdrop"
            onClick={() => setPanelOpen(false)}
          />
          <div className="side-panel">
            <button
              className="side-panel-close"
              onClick={() => setPanelOpen(false)}
              aria-label="Close menu"
            >
              ✕
            </button>

            <div className="side-panel-lobby">
              <Lobby
                gameComponents={[{ game: lobbyGameStub, board: ClassWarBoard }]}
                lobbyServer={server}
                gameServer={server}
                renderer={({ matches, playerName, handleJoinMatch, handleLeaveMatch }) => (
                  <LobbyMatchList
                    matches={matches}
                    playerName={playerName}
                    currentMatchID={matchID}
                    onJoin={(mID, pID) => handleJoinMatch(GAME_NAME, mID, pID)}
                    onLeave={(mID) => handleLeaveMatch(GAME_NAME, mID)}
                    onPlay={(mID, pID, creds) => {
                      setPanelOpen(false);
                      window.location.hash = encodeMatchHash(mID, pID, creds);
                    }}
                  />
                )}
              />
            </div>

            <div className="side-panel-nav">
              <button
                className="side-panel-nav-button"
                onClick={onReturnToLobby}
              >
                ← Return to Lobby
              </button>
              <button
                className="side-panel-nav-button"
                onClick={onReturnToStart}
              >
                ⏏ Return to Start
              </button>
            </div>
          </div>
        </>
      )}

      <RemoteClient
        matchID={matchID}
        playerID={playerID}
        credentials={credentials}
      />
    </div>
  );
}

// ─── Lobby screen ─────────────────────────────────────────────────────────────

interface LobbyScreenProps {
  server: string;
  playerName: string;
  onPlay: (matchID: string, playerID: "0" | "1", credentials: string) => void;
  onReturnToStart: () => void;
}

function LobbyScreen({ server, playerName, onPlay, onReturnToStart }: LobbyScreenProps) {
  return (
    <div className="lobby-screen">
      <div className="lobby-screen-header">
        <button className="lobby-back-button" onClick={onReturnToStart}>
          ← Back
        </button>
        <span className="lobby-title">Online Lobby</span>
        <span className="lobby-player-name">{playerName}</span>
      </div>
      <div className="lobby-screen-body">
        <Lobby
          gameComponents={[{ game: lobbyGameStub, board: ClassWarBoard }]}
          lobbyServer={server}
          gameServer={server}
          renderer={(args) => (
            <LobbyRenderer
              {...args}
              onPlay={(matchID, playerID, credentials) =>
                onPlay(matchID, playerID as "0" | "1", credentials)
              }
            />
          )}
        />
      </div>
    </div>
  );
}

// ─── Lobby renderer (custom UI for the Lobby component) ──────────────────────

import type { LobbyAPI } from "boardgame.io";

interface LobbyRendererProps {
  errorMsg: string;
  matches: LobbyAPI.MatchList["matches"];
  playerName: string;
  runningMatch?: {
    app: ReturnType<typeof Client>;
    matchID: string;
    playerID: string;
    credentials?: string;
  };
  handleEnterLobby: (playerName: string) => void;
  handleExitLobby: () => Promise<void>;
  handleCreateMatch: (gameName: string, numPlayers: number) => Promise<void>;
  handleJoinMatch: (gameName: string, matchID: string, playerID: string) => Promise<void>;
  handleLeaveMatch: (gameName: string, matchID: string) => Promise<void>;
  handleStartMatch: (gameName: string, opts: { numPlayers: number; matchID: string; playerID?: string }) => void;
  handleRefreshMatches: () => Promise<void>;
  onPlay: (matchID: string, playerID: string, credentials: string) => void;
}

function LobbyRenderer({
  errorMsg,
  matches,
  playerName,
  runningMatch,
  handleEnterLobby,
  handleCreateMatch,
  handleJoinMatch,
  handleLeaveMatch,
  handleStartMatch,
  handleRefreshMatches,
  onPlay,
}: LobbyRendererProps) {
  // Auto-enter the lobby with the stored player name
  useEffect(() => {
    if (!playerName) {
      const name = localStorage.getItem(PLAYER_NAME_KEY) ?? "Player";
      handleEnterLobby(name);
    }
  }, [playerName, handleEnterLobby]);

  // When a match starts, navigate to the match route
  useEffect(() => {
    if (runningMatch?.credentials) {
      onPlay(runningMatch.matchID, runningMatch.playerID, runningMatch.credentials);
    }
  }, [runningMatch, onPlay]);

  const gameMatches = matches.filter((m) => m.gameName === GAME_NAME);

  return (
    <div className="lobby-renderer">
      {errorMsg && <div className="lobby-error">{errorMsg}</div>}

      <div className="lobby-actions">
        <button
          className="lobby-button lobby-button-create"
          onClick={() => handleCreateMatch(GAME_NAME, 2)}
        >
          + Create New Match
        </button>
        <button
          className="lobby-button lobby-button-refresh"
          onClick={handleRefreshMatches}
        >
          ↻ Refresh
        </button>
      </div>

      {gameMatches.length === 0 ? (
        <div className="lobby-empty">No matches yet. Create one to start!</div>
      ) : (
        <ul className="lobby-match-list">
          {gameMatches.map((match) => {
            const mySlot = match.players.find((p) => p.name === playerName);
            const emptySlot = match.players.find((p) => !p.name);
            const isFull = !emptySlot;

            return (
              <li key={match.matchID} className="lobby-match-item">
                <div className="lobby-match-id">Match {match.matchID}</div>
                <div className="lobby-match-players">
                  {match.players.map((p) => (
                    <span key={p.id} className={`lobby-match-seat${p.name ? " lobby-match-seat-taken" : ""}`}>
                      Player {p.id}: {p.name ?? "—"}
                    </span>
                  ))}
                </div>
                <div className="lobby-match-actions">
                  {mySlot ? (
                    <>
                      <button
                        className="lobby-button lobby-button-play"
                        onClick={() =>
                          handleStartMatch(GAME_NAME, {
                            numPlayers: 2,
                            matchID: match.matchID,
                            playerID: String(mySlot.id),
                          })
                        }
                      >
                        ▶ Play
                      </button>
                      <button
                        className="lobby-button lobby-button-leave"
                        onClick={() => handleLeaveMatch(GAME_NAME, match.matchID)}
                      >
                        Leave
                      </button>
                    </>
                  ) : isFull ? (
                    <span className="lobby-match-full">Full</span>
                  ) : (
                    <button
                      className="lobby-button lobby-button-join"
                      onClick={() =>
                        handleJoinMatch(
                          GAME_NAME,
                          match.matchID,
                          String(emptySlot!.id),
                        )
                      }
                    >
                      Join
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Compact match list for in-game side panel ────────────────────────────────

interface LobbyMatchListProps {
  matches: LobbyAPI.MatchList["matches"];
  playerName: string;
  currentMatchID: string;
  onJoin: (matchID: string, playerID: string) => Promise<void>;
  onLeave: (matchID: string) => Promise<void>;
  onPlay: (matchID: string, playerID: string, credentials: string) => void;
}

function LobbyMatchList({
  matches,
  playerName,
  currentMatchID,
  onJoin,
  onLeave,
}: LobbyMatchListProps) {
  const gameMatches = matches.filter((m) => m.gameName === GAME_NAME);
  return (
    <div className="lobby-match-list-compact">
      <div className="lobby-match-list-title">Matches</div>
      {gameMatches.length === 0 ? (
        <div className="lobby-empty">No matches</div>
      ) : (
        <ul className="lobby-match-list">
          {gameMatches.map((match) => {
            const isActive = match.matchID === currentMatchID;
            const mySlot = match.players.find((p) => p.name === playerName);
            const emptySlot = match.players.find((p) => !p.name);
            return (
              <li
                key={match.matchID}
                className={`lobby-match-item-compact${isActive ? " lobby-match-item-active" : ""}`}
              >
                <span className="lobby-match-id-compact">{match.matchID}</span>
                {isActive && <span className="lobby-match-current">(current)</span>}
                {!isActive && mySlot && (
                  <button
                    className="lobby-button lobby-button-join"
                    onClick={() => onJoin(match.matchID, String(mySlot.id))}
                  >
                    Rejoin
                  </button>
                )}
                {!isActive && !mySlot && emptySlot && (
                  <button
                    className="lobby-button lobby-button-join"
                    onClick={() => onJoin(match.matchID, String(emptySlot.id))}
                  >
                    Join
                  </button>
                )}
                {mySlot && (
                  <button
                    className="lobby-button lobby-button-leave"
                    onClick={() => onLeave(match.matchID)}
                  >
                    Leave
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const [lobbyServer, setLobbyServer] = useState(
    () => localStorage.getItem(SERVER_KEY) ?? DEFAULT_SERVER,
  );
  const [lobbyPlayerName, setLobbyPlayerName] = useState(
    () => localStorage.getItem(PLAYER_NAME_KEY) ?? "",
  );

  // Keep route in sync with the URL hash
  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((hash: string) => {
    window.location.hash = hash;
  }, []);

  const goToStart = useCallback(() => navigate("#/"), [navigate]);
  const goToLobby = useCallback(() => navigate("#/lobby"), [navigate]);
  const goToLocal = useCallback(() => navigate("#/local"), [navigate]);

  if (route.kind === "local") {
    return (
      <div className="App">
        <button className="hamburger-button" onClick={goToStart} aria-label="Return to start">
          ☰
        </button>
        <LocalClient />
      </div>
    );
  }

  if (route.kind === "lobby") {
    return (
      <LobbyScreen
        server={lobbyServer}
        playerName={lobbyPlayerName}
        onPlay={(matchID, playerID, credentials) => {
          navigate(encodeMatchHash(matchID, playerID, credentials));
        }}
        onReturnToStart={goToStart}
      />
    );
  }

  if (route.kind === "match") {
    return (
      <RemoteMatch
        server={lobbyServer}
        matchID={route.matchID}
        playerID={route.playerID}
        credentials={route.credentials}
        onReturnToLobby={goToLobby}
        onReturnToStart={goToStart}
      />
    );
  }

  // route.kind === "start"
  return (
    <StartScreen
      onLocal={goToLocal}
      onLobby={(server, playerName) => {
        setLobbyServer(server);
        setLobbyPlayerName(playerName);
        localStorage.setItem(SERVER_KEY, server);
        localStorage.setItem(PLAYER_NAME_KEY, playerName);
        navigate("#/lobby");
      }}
    />
  );
}

export default App;
