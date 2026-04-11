/**
 * Class War: International — boardgame.io multiplayer server
 *
 * Runs the boardgame.io master server so multiple devices can connect and
 * play in the same match.  Start with:
 *
 *   npm run host
 *
 * Both the Lobby REST API and the Socket.IO game server are served on the
 * same port so that Chrome's Private Network Access middleware can be
 * injected into the single Koa app instance.  When a separate apiPort is
 * used, boardgame.io creates a second internal Koa app that is not
 * accessible for middleware injection.
 *
 * Optional environment variables:
 *   PORT         Server port for both API and game (default: 8000)
 *   ORIGINS      Comma-separated list of allowed client origins
 *                (default: http://localhost:5173)
 *   DB_DIR       Directory for FlatFile match storage (default: ./data)
 */

import { Server, Origins, FlatFile } from "boardgame.io/server";
import { ClassWarGame } from "../src/game/ClassWarGame";

const PORT = parseInt(process.env["PORT"] ?? "8000", 10);
const DB_DIR = process.env["DB_DIR"] ?? "./data";

const rawOrigins = process.env["ORIGINS"];
const extraOrigins: string[] = rawOrigins?.split(",")?.map((s) => s.trim()) ?? [];

// Always allow localhost dev origins; append any extra origins from env var.
const origins = [Origins.LOCALHOST_IN_DEVELOPMENT, "http://localhost:5173", ...extraOrigins];

const server = Server({
  games: [ClassWarGame],
  origins,
  db: new FlatFile({ dir: DB_DIR }),
});

// Chrome's Private Network Access (PNA) policy requires this header on
// preflight responses when a "local" origin (e.g. localhost) accesses a
// "private" network address (e.g. 10.x.x.x, 192.168.x.x).  We insert this
// middleware at the front of the stack so it runs as an outer wrapper:
// it calls next() first (allowing the CORS middleware to set its headers and
// return without calling its own next for OPTIONS), then appends the PNA
// header to whatever response was built.
server.app.middleware.unshift(async (ctx, next) => {
  await next();
  if (ctx.headers["access-control-request-private-network"] === "true") {
    ctx.set("Access-Control-Allow-Private-Network", "true");
  }
});

server.run(PORT, () => {
  console.log(`Class War: International server running on port ${PORT}`);
  console.log(`Allowed origins: ${origins.join(", ")}`);
  console.log(`Match data stored in: ${DB_DIR}`);
});
