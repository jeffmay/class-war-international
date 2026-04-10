/**
 * Types for the boardgame.io Lobby REST API responses.
 * Matches the shapes returned by GET /games/:name and POST /games/:name/:id/join.
 */

export interface LobbyPlayer {
  id: number;
  name?: string;
  isConnected?: boolean;
}

export interface LobbyMatch {
  matchID: string;
  gameName: string;
  players: LobbyPlayer[];
  createdAt: number;
  updatedAt: number;
  gameover?: unknown;
  unlisted?: boolean;
}

export interface LobbyMatchList {
  matches: LobbyMatch[];
}

export interface LobbyJoinResponse {
  playerID: string;
  playerCredentials: string;
}
