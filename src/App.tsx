/**
 * Main App component
 *
 * Supports three modes:
 *   local      — pass-and-play on a single device (no network required)
 *   host       — connect to a remote boardgame.io server as a specific player
 *   setup      — mode selection screen shown before a game starts
 */

import React, { useState } from "react";
import { Client } from "boardgame.io/react";
import { Local, SocketIO } from "boardgame.io/multiplayer";
import { ClassWarGame } from "./game/ClassWarGame";
import { ClassWarBoard } from "./Board";
import "./App.css";

// ─── Mode types ────────────────────────────────────────────────────────────────

type AppMode =
  | { kind: "setup" }
  | { kind: "local" }
  | { kind: "host"; server: string; matchID: string; playerID: "0" | "1" };

// ─── boardgame.io client factories ────────────────────────────────────────────

const LocalClient = Client({
  game: ClassWarGame,
  board: ClassWarBoard,
  numPlayers: 2,
  debug: process.env["NODE_ENV"] === "development",
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

// ─── Setup screen ──────────────────────────────────────────────────────────────

interface SetupScreenProps {
  onLocal: () => void;
  onHost: (server: string, matchID: string, playerID: "0" | "1") => void;
}

const DEFAULT_HOST = "http://localhost:8000";

const SetupScreen: React.FC<SetupScreenProps> = ({ onLocal, onHost }) => {
  const [server, setServer] = useState(DEFAULT_HOST);
  const [matchID, setMatchID] = useState("default");
  const [playerID, setPlayerID] = useState<"0" | "1">("0");

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
          <h2 className="setup-section-title">Remote Host</h2>
          <p className="setup-section-description">
            Connect to a game hosted on another device (or start one with{" "}
            <code>npm run host</code>).
          </p>

          <label className="setup-field">
            <span className="setup-field-label">Host address</span>
            <input
              className="setup-field-input"
              type="text"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder="http://192.168.1.x:8000"
            />
          </label>

          <label className="setup-field">
            <span className="setup-field-label">Match ID</span>
            <input
              className="setup-field-input"
              type="text"
              value={matchID}
              onChange={(e) => setMatchID(e.target.value)}
              placeholder="default"
            />
          </label>

          <label className="setup-field">
            <span className="setup-field-label">Player</span>
            <select
              className="setup-field-input"
              value={playerID}
              onChange={(e) => setPlayerID(e.target.value as "0" | "1")}
            >
              <option value="0">Player 0 — Working Class</option>
              <option value="1">Player 1 — Capitalist Class</option>
            </select>
          </label>

          <button
            className="setup-button setup-button-host"
            onClick={() => onHost(server, matchID, playerID)}
          >
            ▶ Connect to Host
          </button>
        </section>
      </div>
    </div>
  );
};

// ─── App root ─────────────────────────────────────────────────────────────────

function App() {
  const [mode, setMode] = useState<AppMode>({ kind: "setup" });

  if (mode.kind === "setup") {
    return (
      <SetupScreen
        onLocal={() => setMode({ kind: "local" })}
        onHost={(server, matchID, playerID) =>
          setMode({ kind: "host", server, matchID, playerID })
        }
      />
    );
  }

  if (mode.kind === "local") {
    return (
      <div className="App">
        <LocalClient />
      </div>
    );
  }

  // Remote host mode — create a fresh client bound to the chosen server
  const RemoteClient = makeRemoteClient(mode.server);
  return (
    <div className="App">
      <RemoteClient matchID={mode.matchID} playerID={mode.playerID} />
    </div>
  );
}

export default App;
