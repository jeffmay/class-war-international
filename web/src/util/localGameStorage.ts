/**
 * Utilities for listing and deleting local (pass-and-play) games stored by
 * boardgame.io's Local transport with { persist: true, storageKey: "cwi" }.
 *
 * boardgame.io stores game state as JSON-serialized Map entries under these
 * localStorage keys:
 *   cwi_state    — [[matchID, stateObject], ...]
 *   cwi_metadata — [[matchID, metadataObject], ...]
 *   cwi_initial  — [[matchID, initialState], ...]
 *   cwi_log      — [[matchID, logEntries], ...]
 *
 * Each matchID is the game name the user chose (or a generated default).
 * The metadata object contains { updatedAt: number } for last-played time.
 */

export const BGIO_STORAGE_KEY = "cwi";

export interface LocalGameEntry {
  /** The boardgame.io matchID — used as the URL game name. */
  gameName: string;
  /** Unix timestamp (ms) when the game was last modified. */
  lastPlayed: number;
}

type BgioMetadata = {
  updatedAt?: number;
};

function readBgioEntries<T>(suffix: string): Array<[string, T]> {
  try {
    const raw = localStorage.getItem(`${BGIO_STORAGE_KEY}_${suffix}`);
    if (!raw) return [];
    return JSON.parse(raw) as Array<[string, T]>;
  } catch {
    return [];
  }
}

function writeBgioEntries<T>(suffix: string, entries: Array<[string, T]>): void {
  try {
    localStorage.setItem(`${BGIO_STORAGE_KEY}_${suffix}`, JSON.stringify(entries));
  } catch {
    // ignore storage-full errors
  }
}

/** Returns all saved local games, sorted most-recently-played first. */
export function listLocalGames(): LocalGameEntry[] {
  const entries = readBgioEntries<BgioMetadata>("metadata");
  return entries
    .map(([gameName, meta]) => ({
      gameName,
      lastPlayed: meta?.updatedAt ?? 0,
    }))
    .sort((a, b) => b.lastPlayed - a.lastPlayed);
}

/** Removes all boardgame.io storage entries for the given game name. */
export function deleteLocalGame(gameName: string): void {
  for (const suffix of ["state", "initial", "metadata", "log"]) {
    const entries = readBgioEntries<unknown>(suffix);
    writeBgioEntries(
      suffix,
      entries.filter(([id]) => id !== gameName),
    );
  }
}

/** Returns the most recently played game, or null if none exist. */
export function getMostRecentLocalGame(): LocalGameEntry | null {
  const games = listLocalGames();
  return games[0] ?? null;
}
