# Class War: International

A 2-player asymmetric strategy card game built with [boardgame.io](https://boardgame.io/) and React + TypeScript.

## Gameplay

**Class War: International** is an asymmetric 2-player game where:

- **Player 0 — Working Class**: earns wages, trains union figures, passes legislation
- **Player 1 — Capitalist Class**: earns profits, builds enterprises, controls workplaces

### Turn Structure

Each turn has three phases:

1. **Production Phase** — collect wages or profits; unexhaust all figures
2. **Action Phase** — play cards from your hand, initiate strikes, run for office, propose legislation
3. **Reproduction Phase** — theorize (discard and redraw) up to your theorize limit; then draw back to hand size

---

## Features

### Completed

- ✅ Core game engine (boardgame.io)
- ✅ Full card type system (Figure, Demand, Institution, Workplace, Tactic)
- ✅ Production phase — wage/profit collection, figure unexhausting
- ✅ Action phase — playing all card types, slot management, cost validation
- ✅ Reproduction phase — theorize selection, card cycling, hand refill
- ✅ Conflict system — strikes, elections, legislation, dice rolling, outcomes
- ✅ Undo support (blocked after random events or opponent actions)
- ✅ Law effects applied when demands are passed
- ✅ Left sidebar — live opponent stats (hand size, wealth, income, figures)
- ✅ Turn start modal (Production phase)
- ✅ Conflict modals (target selection, outcome display)
- ✅ Deal result modal (shows theorized and newly drawn cards)
- ✅ Status banners on figure cards (In Training / Exhausted)
- ✅ Pass-and-play local mode
- ✅ Online multiplayer via boardgame.io server
- ✅ Lobby — create, join, leave, and rejoin matches by player ID
- ✅ URL hash routing (`#/`, `#/local`, `#/lobby`, `#/match/:id/:player/:creds`)
- ✅ Persistent player name and server address (localStorage)
- ✅ Hamburger menu in-game — floating side panel with match list and navigation
- ✅ Fully responsive layout (mobile → tablet → laptop → wide screen)
- ✅ Comprehensive test suite (200+ tests)

### In Progress / Future

- 🚧 Full card database (70+ cards; current set is a playable subset)
- 🚧 Complete special card ability implementations
- 🚧 Win condition system
- 🚧 Saved / persistent game state

---

## Running the App

### Development UI

```bash
npm start          # Start Vite dev server at http://localhost:5173
```

### Online Multiplayer Server

```bash
npm run host       # Start boardgame.io server on port 8000
```

Optional environment variables:

| Variable  | Default                   | Description                                           |
|-----------|---------------------------|-------------------------------------------------------|
| `PORT`    | `8000`                    | Game server and lobby API port                        |
| `ORIGINS` | `http://localhost:5173`   | Comma-separated list of allowed client origins        |

The lobby REST API and the WebSocket game server run on the **same port**. There is no separate API port.

Example with custom settings:

```bash
PORT=9000 ORIGINS="http://192.168.1.42:5173" npm run host
```

---

## How the Lobby Works

The lobby uses boardgame.io's built-in match management system.

### Player IDs vs Social Class

A player's **numeric ID** (0 or 1) is assigned by the lobby when joining a match and persists across reconnects. It is **not** tied to social class or turn order — class assignment is determined by the game rules.

### Player Name

Your **Player Name** is a human-readable identifier you set before entering the lobby. It is stored in `localStorage` so you don't have to re-enter it. The same name is used to:

- Identify your seat in a match
- Rejoin a match you previously left (by matching the name)

### Flow

1. Open the app → **Start Screen**
2. Enter your **Player Name** and **Server address**
3. Click **Enter Online Lobby** → **Lobby Screen**
4. Create a new match or join an existing one
5. Once both players are seated, click **▶ Play** to start
6. During a game the **☰ hamburger button** opens a side panel with:
   - A compact list of all matches (join or rejoin any)
   - **Return to Lobby** — go back to the full lobby view
   - **Return to Start** — go back to the start screen

### Rejoining a Match

If you close the browser or lose connection, open the app, re-enter your **Player Name**, and return to the lobby. Your previously joined match will show a **Rejoin** button. Clicking it reconnects you to the same seat.

Matches are stored in memory on the server and are lost if the server restarts.

---

## Development

### Commands

```bash
npm start            # Start dev server
npm test             # Run unit + component tests
npm run typecheck    # TypeScript type check
npm run lint         # ESLint
npm run build        # Production build
npm run host         # Start multiplayer server
```

### Project Structure

```
src/
├── game/
│   ├── ClassWarGame.ts          # Game definition (moves, phases, rules)
│   ├── generate.ts              # Test fixtures
│   └── *.test.ts                # Game logic tests
├── types/
│   ├── cards.ts                 # Card type definitions
│   ├── game.ts                  # Game state types
│   └── conflicts.ts             # Conflict types
├── data/
│   └── cards.ts                 # Card database (auto-generated from TSV)
├── components/
│   ├── ActionMenuBar.tsx        # Floating card-action menu
│   ├── CardComponent.tsx        # Card face renderer
│   ├── ConflictModal.tsx        # Strike / election / legislation targeting
│   ├── ConflictOutcomeModal.tsx # Dice roll result display
│   ├── DealResultModal.tsx      # Theorize / draw preview
│   ├── Die.tsx                  # Animated die
│   └── StartGameScreen.tsx      # Turn start overlay
├── util/
│   ├── typedboardgame.ts        # Strict type wrappers for boardgame.io
│   ├── game.ts                  # Game helpers
│   └── ...
├── App.tsx                      # Routing, lobby, start screen
├── App.test.tsx                 # App routing / UI tests
├── Board.tsx                    # Main game board component
├── App.css                      # All styles (responsive, vw-based)
└── index.tsx                    # Entry point

server/
└── index.ts                     # boardgame.io multiplayer server

scripts/
└── generate-cards.ts            # Regenerate cards.ts from docs/cards.tsv

docs/
├── rules.pdf                    # Official game rules
└── cards.tsv                    # Card database source
```

### Testing Philosophy

- All significant game logic has unit tests before UI implementation
- Component tests use `@testing-library/react`
- The boardgame.io `Lobby` component is mocked in component tests (it makes real HTTP calls)
- Never skip tests with early returns — provide fixtures that satisfy pre-conditions
- 200+ tests, 0 failures

---

## License

Based on the Class War board game. Game design by Jacobin.
