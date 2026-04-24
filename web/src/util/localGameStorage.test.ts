import {
  listLocalGames,
  deleteLocalGame,
  getMostRecentLocalGame,
  BGIO_STORAGE_KEY,
} from "./localGameStorage";

// ─── localStorage mock helpers ────────────────────────────────────────────────

function writeMetadata(entries: Array<[string, { updatedAt: number }]>) {
  localStorage.setItem(`${BGIO_STORAGE_KEY}_metadata`, JSON.stringify(entries));
}

function writeState(entries: Array<[string, unknown]>) {
  localStorage.setItem(`${BGIO_STORAGE_KEY}_state`, JSON.stringify(entries));
}

beforeEach(() => localStorage.clear());

// ─── listLocalGames ───────────────────────────────────────────────────────────

describe("listLocalGames", () => {
  test("returns empty array when no games are saved", () => {
    expect(listLocalGames()).toEqual([]);
  });

  test("returns a single saved game", () => {
    writeMetadata([["My Game", { updatedAt: 1000 }]]);
    const games = listLocalGames();
    expect(games).toHaveLength(1);
    expect(games[0].gameName).toBe("My Game");
    expect(games[0].lastPlayed).toBe(1000);
  });

  test("returns multiple games sorted most-recently-played first", () => {
    writeMetadata([
      ["Older Game", { updatedAt: 1000 }],
      ["Newer Game", { updatedAt: 5000 }],
      ["Middle Game", { updatedAt: 3000 }],
    ]);
    const games = listLocalGames();
    expect(games.map((g) => g.gameName)).toEqual(["Newer Game", "Middle Game", "Older Game"]);
  });

  test("uses 0 for lastPlayed when updatedAt is absent", () => {
    writeMetadata([["No Date", {}]] as Array<[string, { updatedAt: number }]>);
    const games = listLocalGames();
    expect(games[0].lastPlayed).toBe(0);
  });

  test("does not throw when localStorage metadata is malformed JSON", () => {
    localStorage.setItem(`${BGIO_STORAGE_KEY}_metadata`, "not json");
    expect(() => listLocalGames()).not.toThrow();
    expect(listLocalGames()).toEqual([]);
  });
});

// ─── deleteLocalGame ──────────────────────────────────────────────────────────

describe("deleteLocalGame", () => {
  test("removes the game from metadata", () => {
    writeMetadata([
      ["Game A", { updatedAt: 1000 }],
      ["Game B", { updatedAt: 2000 }],
    ]);
    deleteLocalGame("Game A");
    const remaining = listLocalGames();
    expect(remaining.map((g) => g.gameName)).toEqual(["Game B"]);
  });

  test("removes the game from state storage", () => {
    writeMetadata([["Game A", { updatedAt: 1000 }]]);
    writeState([["Game A", { G: {}, ctx: {} }]]);
    deleteLocalGame("Game A");
    const raw = localStorage.getItem(`${BGIO_STORAGE_KEY}_state`);
    const entries: Array<[string, unknown]> = JSON.parse(raw ?? "[]");
    expect(entries.find(([id]) => id === "Game A")).toBeUndefined();
  });

  test("does not affect other games in the same storage", () => {
    writeMetadata([
      ["Keep This", { updatedAt: 2000 }],
      ["Delete This", { updatedAt: 1000 }],
    ]);
    deleteLocalGame("Delete This");
    const remaining = listLocalGames();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].gameName).toBe("Keep This");
  });

  test("does not throw when the game does not exist", () => {
    expect(() => deleteLocalGame("Nonexistent")).not.toThrow();
  });
});

// ─── getMostRecentLocalGame ───────────────────────────────────────────────────

describe("getMostRecentLocalGame", () => {
  test("returns null when no games exist", () => {
    expect(getMostRecentLocalGame()).toBeNull();
  });

  test("returns the most recently played game", () => {
    writeMetadata([
      ["Older", { updatedAt: 1000 }],
      ["Newer", { updatedAt: 9000 }],
    ]);
    expect(getMostRecentLocalGame()?.gameName).toBe("Newer");
  });
});
