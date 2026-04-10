/**
 * Class War: International — boardgame.io multiplayer server
 *
 * Runs the boardgame.io master server so multiple devices can connect and
 * play in the same match.  Start with:
 *
 *   npm run host
 *
 * Optional environment variables:
 *   PORT         Game server port (default: 8000)
 *   API_PORT     Lobby API port  (default: 8001)
 *   ORIGINS      Comma-separated list of allowed client origins
 *                (default: http://localhost:3000)
 */

import { Server, Origins, FlatFile } from "boardgame.io/server";
import { ClassWarGame } from "../src/game/ClassWarGame";

const PORT = parseInt(process.env["PORT"] ?? "8000", 10);
const API_PORT = parseInt(process.env["API_PORT"] ?? "8001", 10);
const DB_DIR = process.env["DB_DIR"] ?? "./data";

const rawOrigins = process.env["ORIGINS"];
const origins: string[] = rawOrigins
  ? rawOrigins.split(",").map((s) => s.trim())
  : ["http://localhost:3000"];

const server = Server({
  games: [ClassWarGame],
  origins: [...origins, Origins.LOCALHOST],
  db: new FlatFile({ dir: DB_DIR }),
});

server.run(
  {
    port: PORT,
    lobbyConfig: {
      apiPort: API_PORT,
    },
  },
  () => {
    console.log(`Class War: International server running on port ${PORT}`);
    console.log(`Lobby API running on port ${API_PORT}`);
    console.log(`Allowed origins: ${origins.join(", ")}`);
    console.log(`Match data stored in: ${DB_DIR}`);
  },
);
