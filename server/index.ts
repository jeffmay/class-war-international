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
 *   ORIGINS      Comma-separated list of allowed client origins
 *                (default: http://localhost:3000)
 *
 * The lobby API is served on the same port as the game server. Clients
 * connect to a single URL for both game WebSocket traffic and lobby REST calls.
 */

import { Server, Origins } from "boardgame.io/server";
import { ClassWarGame } from "../src/game/ClassWarGame";

const PORT = parseInt(process.env["PORT"] ?? "8000", 10);

const rawOrigins = process.env["ORIGINS"];
const origins: string[] = rawOrigins
  ? rawOrigins.split(",").map((s) => s.trim())
  : ["http://localhost:3000"];

const server = Server({
  games: [ClassWarGame],
  origins: [...origins, Origins.LOCALHOST],
});

server.run(
  { port: PORT },
  () => {
    console.log(`Class War: International server running on port ${PORT}`);
    console.log(`Lobby API available at http://localhost:${PORT}/games`);
    console.log(`Allowed origins: ${origins.join(", ")}`);
  },
);
