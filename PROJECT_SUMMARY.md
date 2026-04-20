# Class War: International - Project Summary

## Project Status: Active Development

A 2-player board game based on **Class War: International** rules, built with the boardgame.io framework and React. The Working Class and Capitalist Class compete across Production, Action, and Reproduction phases each turn.

---

## Completed Features

### 1. Core Game Engine (boardgame.io)
- Game state management with full TypeScript types
- Turn-based mechanics with player alternation
- Phase system (Production -> Action -> Reproduction) managed via `G.turnPhase`
- Player state tracking per social class
- Card deck shuffling and management

### 2. Production Phase
- Collect wages (Working Class) from all workplaces
- Collect profits (Capitalist Class) from all workplaces
- Unexhaust figures at start of turn
- Phase transition to Action on `collectProduction()` move
- Turn counter increments when Working Class ends their turn

**Tests: 6/6 passing (2 skipped - exhaustion tests)**

### 3. Action Phase
- Play figure cards from hand (`playFigure` move)
- Cost validation against player wealth
- Card draw on figure play (hand refills to max)
- Training system: figures enter `in_training: true`, activate after reproduction
- Multiple cards can be played per turn if affordable
- Plan Strike conflict (`planStrike` move): WC figure leads a strike at a workplace
- Plan Election conflict (`planElection` move): any figure runs for a political office
- Conflict state created with power stats; figure removed from player's figures

**Tests: 7/7 passing (playFigure) + 11/11 passing (planStrike / planElection)**

### 4. Reproduction Phase
- Theorize mechanic: player selects up to `theorizeLimit` hand cards to discard
- Selected cards moved to dustbin; hand refilled from deck
- Remove `in_training` status from all player figures
- `endReproductionPhase(cardIdsToTheorize?)` advances to next player's Production phase
- Turn cycling via boardgame.io `events.endTurn()`

### 5. Turn Start Modal (`src/components/StartGameScreen.tsx`)
- `TurnStartModal` component overlays the board during `TurnPhase.Production`
- Turn 0 / Working Class: shows "CLASS WAR / International" title with "Start Game" button
- Subsequent turns: shows "[Class Name] / Turn N" with "Start [Class] Turn" button
- Clicking the button calls `moves.collectProduction()` to advance to Action phase

### 6. Control Bar Buttons (`src/Board.tsx`)
- **"End Turn" button** (shown during Action phase): calls `moves.endActionPhase()` to advance to Reproduction phase
- **"Finish Theorizing" button** (shown during Reproduction phase): calls `moves.endReproductionPhase(theorizeSelectedIds)` to end the turn; shows selected card count when non-zero
- Both buttons are only shown to the current player (`isMyTurn` guard)

### 7. Card Theorize Selection (`src/Board.tsx`)
- During Reproduction phase, hand cards can be clicked to toggle theorize selection
- Selected cards receive `card-theorize-selected` CSS class (gold highlight)
- Selection is capped at `player.theorizeLimit` cards
- Inspector menu bar shows "Theorize" (enabled/disabled) or "Remove from Theorize" option per card
- Selection state is cleared after "Finish Theorizing" is clicked

### 8. Theorize Limit (`PlayerState.theorizeLimit`)
- `theorizeLimit: 1` initialized in both `ClassWarGame.ts` (`createPlayerState`) and `generate.ts` (`makePlayerState`)
- Enforced in the UI; game move accepts any number of card IDs to discard

### 9. Conflict System (UI only - resolution TBD)
- Strike target: lists all workplaces; empty slots are disabled
- Election target: lists all political offices
- Cancel button returns to normal board state

### 10. React UI Foundation
- Full game board display with responsive CSS
- `TurnStartModal` full-screen overlay for Production phase
- Top bar with game title
- Control bar: Undo button and a next phase button (End Action Phase, Finish Theorizing, End Turn)
- Phase and wealth info display
- Shared board area: Workplaces (3 slots), Political Offices (3 state figures)
- Card inspector menu bar (`ActionMenuBar`) for viewing cards in hand, selecting actions, choosing a conflict target, or generally progressing the game through linear menu option trees.

**Status: Running at localhost:5173**

### 11. Escape Key Closes ActionMenuBar (`src/Board.tsx`)
- `useEffect` in `Board.tsx` attaches a `keydown` listener that listens for the Escape key
- When a card slot is selected and Escape is pressed, the inspector is closed (selected slot cleared)
- Listener is cleaned up on unmount

### 12. "Activated Figures" Rename (`src/Board.tsx`)
- The "Figures in Play" section label was renamed to "Activated Figures" throughout `Board.tsx`
- Reflects the game terminology more accurately: figures become activated once their training is complete

### 13. Card Slot Labels and `demands[-1]` / `institutions[-1]` Support
- `playCardFromHand` move now resolves a slot index of `-1` to the first empty slot in the target array
- Board slot labels updated to be context-sensitive:
  - Empty demand slot: "Make New Demand"
  - Occupied demand slot: "Replace [name] Demand"
  - Empty institution slot: "Build New Institution ($N)"
  - Occupied institution slot: "Replace [name] ($N)"
- Auto-play via `directAction` now uses `-1` notation for demands and institutions

### 14. Status Banners on Figure Cards (`src/components/CardComponent.tsx`)
- `CardComponent` gains an optional `statusBanner?: { line1: string; line2?: string }` prop
- When provided, renders a semi-transparent overlay banner centered on the card face
- Board passes the following banners based on figure state:
  - `{ line1: 'In Training', line2: '(until end of turn)' }` for figures with `in_training: true`
  - `{ line1: 'Exhausted', line2: '(until next turn)' }` for figures with `exhausted: true`

### 15. Turn Counter and Current Player in Top Bar (`src/Board.tsx`)
- `.game-top-controls-center` now displays "Turn N" and "[Class]'s Turn" during Action and Reproduction phases
- Text is derived from `G.turn` and the current player's social class
- Provides at-a-glance awareness of game progress without needing to inspect the state panel

### 16. Redesigned Control Bar (`src/Board.tsx`)
- Center region shows context-sensitive status text:
  - Waiting for the other player: "Waiting for [Class]..."
  - Action phase (no selection): "Select a card to play"
  - Strike targeting: "Select a workplace to strike"
  - Election targeting: "Select an office to run for"
  - Reproduction phase: "Theorize up to N card(s)"
- Right region shows the current player's class name and wealth (`$N`)

### 17. Left Sidebar Replaces Opposing Player Area (`src/Board.tsx`)
- A new left sidebar panel replaced the second `renderPlayerArea` call for the opponent
- Sidebar shows for both players: hand card count, wealth (`$N`), income (wages or profits), and a clickable list of activated figures
- Clicking an activated figure in the sidebar opens the `ActionMenuBar` inspector for that figure
- Main layout is now `[sidebar][my-player-area][shared-area]`
- Opposing player's full card hand is no longer rendered; only their aggregate stats are shown

### 18. Bug Fixes: Production, Conflicts, and Multiplayer UX

**Production phase fix (`collectProduction` in `ClassWarGame.ts`)**
- `collectProduction` was using `playerID` (null in local mode) to determine the player's class, always falling back to Capitalist Class
- Fixed to use `ctx.currentPlayer` so wages/profits are always collected for the correct player

**Conflict player-switching for multiplayer (`ClassWarGame.ts`)**
- `initiateConflict` now calls `events.endTurn({ next: opposingPlayerID })` to transfer boardgame.io move rights to the opposing player for the Responding phase
- `planResponse` now calls `events.endTurn({ next: initiatingPlayerID })` to return control to the initiating player for the Resolving phase
- This works in both local (single-device) and multiplayer modes because the local client sends moves as `ctx.currentPlayer` which correctly follows the turn switches

**Multiplayer waiting interstitial (`src/components/StartGameScreen.tsx`)**
- Added `WaitingInterstitial` component: shown to the non-active player during `TurnPhase.Production`
- Cycles through class-specific flavor messages every 3 seconds (e.g., "The Capitalists are scheming...", "Class consciousness rises...")
- Has a dismissible close button; resets when `ctx.currentPlayer` changes

**Multiplayer ActionMenu guard (`src/Board.tsx`)**
- When `!isMyTurn` and `playerID` is set (multiplayer mode), clicking hand/figure cards now shows a single disabled "Must wait for your turn" option instead of showing no menu at all
- In local mode (`playerID = null/undefined`), this guard is bypassed so both players share the same view

### 19. Conflict Step Card Tracking (`src/game/ClassWarGame.ts`, `src/components/ConflictModal.tsx`)

- `ConflictCardInPlay` extended with `addedThisStep?: boolean` via TypeScript intersection type
- Cards added to a conflict during the current step (Initiating/Responding/Resolving) are marked with this flag
- `addFigureToConflict` and `addTacticToConflict` now call `saveUndo` (individually undoable) and set `addedThisStep: true`
- `initiateConflict` and `planResponse` clear all `addedThisStep` flags before transitioning phases
- New `removeCardFromConflict(cardIndex, forClass)` move: validates `addedThisStep`, returns card to hand/figures, refunds tactic cost, recalculates power
- Initiating class can now also add cards during the Resolving phase (removed prior restriction)
- Responding class's newly-added step cards are hidden from the initiating class during the Responding phase
- Undo button removed from ConflictModal; click-to-remove on green (actionable) step cards replaces it
- E2E tests: `src/game/ConflictCardTracking.test.ts` covers add/remove figure/tactic and wealth changes

### 20. Unified Card Border Color System (`src/components/CardComponent.tsx`, `src/App.css`)

- Old 7-variant system (`'hand' | 'in-play' | 'training' | 'exhausted' | 'other' | 'wc' | 'cc'`) replaced with 5-variant semantic system
- New `CardBorderVariant`: `'actionable' | 'cannot-use' | 'other' | 'wc' | 'cc'`
  - `actionable` = green (#48bb78): card can be clicked/used
  - `cannot-use` = gold (#FFD700): card is visible but blocked
  - `other` = grey: neutral/display-only context
  - `wc` / `cc` = faction colors for class-specific display
- Applied consistently across all card usages: hand cards, figures, institution/demand slots, conflict cards, outcome modal, deal result modal

### 21. Status Text System (`src/util/statusText.ts`)

- Imperative DOM utility that writes to the `#game-status-text` span from anywhere (not just React renders)
- `setStatusText(text, type?: 'info' | 'warn' | 'error')` sets text and adds a type class
- `logError(message, raw?)` appends to an in-memory error log, shows in status bar with flash animation, and calls `console.error`
- `getErrorLog()` returns the full immutable error log for future error panel UI
- Status span in Board.tsx is now an empty `<span id={STATUS_TEXT_ID} />` managed imperatively via `useLayoutEffect`
- Undo button hover text uses `setStatusText` via wrapper `<div>` handlers (disabled buttons suppress mouse events)
- Tests: `src/util/statusText.test.ts` (13 tests covering all behaviors)

### 22. DealResultModal Timing Fix (`src/Board.tsx`)

- `moves.endReproductionPhase()` is now called in `handleFinishTheorizing` (before the modal opens), not in `handleEndTurn`
- This ensures `G` (hand, deck) is already updated when the modal renders, so the board reflects the new state immediately
- Card IDs for the modal preview are captured from the pre-move state before the move executes
- `needsLocalHandoff` now excludes `boardState.mode === 'showingDealtCards'` to prevent two overlays stacking

### 23. Conflict Leader Row & Leader Switching (`src/types/conflicts.ts`, `src/game/ClassWarGame.ts`, `src/components/ConflictModal.tsx`)

**Type changes (`src/types/conflicts.ts`)**
- Removed `strikeLeader: FigureCardInPlay` from `StrikeConflictState`; replaced with `maxStrikeLeaders: number` (default 1)
- Removed `candidate: FigureCardInPlay` from `ElectionConflictState`
- Leader position is now **positional by convention**: first `maxStrikeLeaders` entries of `workingClassCards` are strike leaders; first entry of the initiating class's cards is the election candidate
- Eliminates invariant maintenance — changing leader = array swap + power recompute

**New game move: `changeConflictLeader(leaderSlotIndex, conflictCardIndex)`**
- Valid only during `ConflictPhase.Initiating`
- For strikes: swaps `workingClassCards[leaderSlotIndex]` with `workingClassCards[conflictCardIndex]`; recomputes WC power stats
- For elections: swaps index 0 of the initiating class's cards with `conflictCardIndex`; recomputes that side's power stats
- Guards: phase check, index bounds, slot type validation (leader vs supporter)

**ConflictModal redesign (`src/components/ConflictModal.tsx`)**
- Strike layout: leader row (first N cards) rendered above supporter row; "Change"/"Cancel" buttons toggle swap mode; supporters show "Set as Leader" in swap mode
- Election layout: full-width head-to-head row at top (candidate vs incumbent with "vs" label); "Change"/"Set as Candidate" buttons for candidate swap
- Card effects list: below each side's cards, shows `rules` text for cards that have it
- New prop: `onChangeLeader: (leaderSlotIndex: number, conflictCardIndex: number) => void`
- New local state: `swappingLeaderSlot: number | null` for swap mode

### 24. Multiplayer CC Perspective Bug Fix (`src/App.tsx`)

- Root cause: `findMatchCredentials` always iterated `["0", "1"]`, so on same-device testing both players always loaded WC (player 0) credentials
- Fix: store the most-recently-joined playerID in `localStorage` under `cwi_active_{matchID}` key on each `goToMatch()` call
- `findMatchCredentials` now checks the active player key first, falls back to the other player
- CC players on same device as WC now correctly load their own perspective

### 25. Lobby System and Persistent Match Storage (`src/App.tsx`, `server/index.ts`)

**FlatFile match storage (`server/index.ts`)**
- Server now uses `FlatFile` DB backend (stored in `./data` by default, configurable via `DB_DIR` env var)
- Matches persist across server restarts

**Multi-screen app flow (`src/App.tsx`)**
- `AppMode` discriminated union drives a finite state machine: `setup → connecting → lobby → host` (or `error` on timeout)
- Local mode includes a "⌂ Start Screen" nav bar so players can return to setup without refreshing
- Remote mode includes "← Lobby" and "⌂ Start Screen" nav bar buttons

**Setup screen redesigned**
- "Remote Host" section replaced with "Connect to Lobby" section
- Fields: Host Address (IP or Domain) + Port (default 8001)
- Gear icon reveals advanced options: Game Server Port (default 8000) + Connection Timeout (default 5000 ms)

**Connecting screen**
- Shows spinner + "Connecting to {host}…" while fetching match list via `GET /games/:name`
- `AbortController` + `setTimeout` implement configurable timeout (default 5 s)
- `useRef(false)` guard prevents double-fetch under React StrictMode

**Connection error screen**
- Shown on timeout or fetch failure
- Displays: `"Cannot find host server at {url} after {N}s."` + help subtext
- "↺ Retry Connection" and "← Return to Start Screen" buttons

**Lobby screen**
- Lists open matches fetched from the boardgame.io Lobby API
- Each match card shows: match ID, player slots with social class label + player name (or "Open")
- Player dropdown pre-selects first open slot; disabled for taken slots
- "Join Game" calls `POST /games/:name/:id/join` with `playerCredentials`; join errors shown inline
- "↺ Refresh" re-fetches the match list; "← Back" returns to setup

**Lobby REST API types (`src/types/lobby.ts`)**
- `LobbyPlayer`, `LobbyMatch`, `LobbyMatchList`, `LobbyJoinResponse` typed to match boardgame.io API shapes

---

## Test Coverage

### Test Suites: 14 unit + e2e
1. **ClassWarGame.test.ts** - Setup tests
2. **ProductionPhase.test.ts** - Production + Reproduction mechanics (incl. theorizing)
3. **ActionPhase.test.ts** - Card playing
4. **ConflictPhase.test.ts** - Strike and election planning; `changeConflictLeader` move
5. **ConflictResolution.test.ts** - Conflict resolution + player-switching
6. **ConflictCardTracking.test.ts** - Step card add/remove tracking during conflicts (E2E)
7. **Undo.test.ts** - Undo mechanics
8. **Board.test.tsx** - Board component (incl. multiplayer guards)
9. **CardComponent.test.tsx** - Card component (incl. new border variant system)
10. **ActionMenuBar.test.tsx** - Action menu bar
11. **ConflictModal.test.tsx** - Conflict modal (leader row, HtH election row, swap mode, effects list)
12. **ConflictOutcomeModal.test.tsx** - Conflict outcome modal
13. **DealResultModal.test.tsx** - Deal result modal
14. **statusText.test.ts** - Status text DOM utility (setStatusText, logError)

**E2E (Playwright): `e2e/multiplayer.test.ts`** — 13 tests across 5 suites
- `setup screen` — title and button visibility
- `lobby connection` — successful connection + bad-address error screen
- `multiplayer — two browsers, one match` — join + reach board; production advance
- `server API — match lifecycle` — REST API blackbox: list, create, join both slots, leave, slot independence
- `multiplayer — player perspective` — separate contexts see correct class; same-device CC regression test

**Total: 288 passing + 2 skipped = 290 tests**

### Testing Architecture

All game-logic tests use explicit per-test fixtures generated via `src/game/generate.ts`:
- `makePlayerState(class, overrides?)` - builds a PlayerState from the real unshuffled deck with `theorizeLimit: 1`
- `makeActionPhaseState(wcOverrides?, ccOverrides?)` - builds a full GameState in Action phase
- `withCardInHand(deck, cardId)` - returns a hand/deck split guaranteeing a specific card is at hand[0]
- `withCardsInHand(deck, cardIds)` - same for multiple cards
- `clientFromFixture(G)` - creates a StrictClient starting from the provided GameState

Every test explicitly sets its pre-conditions (hand contents, wealth, figures in play) so no test ever skips or branches on randomly generated values.

Component tests use React Testing Library with `@testing-library/jest-dom` matchers.

**Test runner**: Vitest (migrated from Jest; `globals: true`, `environment: "jsdom"`)

---

## Architecture

### Technology Stack
- **Game Engine**: boardgame.io v0.50.2
- **Backend**: Node with TypeScript (erasable syntax only)
- **Frontend**: React 18 with TypeScript
- **State Management**: boardgame.io (G object with Immer mutations)
- **Testing**: Vitest + React Testing Library
- **Build**: Vite (front-end)

### File Structure
```
src/
├── game/
│   ├── ClassWarGame.ts          # Main game definition, all moves
│   ├── generate.ts              # Test fixture generators
│   ├── ClassWarGame.test.ts     # Setup tests
│   ├── ProductionPhase.test.ts  # Production tests
│   ├── ActionPhase.test.ts      # playFigure tests
│   └── ConflictPhase.test.ts    # planStrike / planElection tests
├── types/
│   ├── cards.ts                 # Card type definitions, SocialClass enum
│   ├── game.ts                  # GameState, PlayerState, TurnPhase
│   └── conflicts.ts             # ConflictState, ConflictType, ConflictPhase
├── data/
│   └── cards.ts                 # Card database, buildDeck(), defaultWorkplaces
├── components/
│   ├── StartGameScreen.tsx      # TurnStartModal + WaitingInterstitial overlays
│   ├── CardComponent.tsx        # Reusable card display with optional status banner
│   ├── ActionMenuBar.tsx        # Action menu bar for selected cards
│   ├── ConflictModal.tsx        # Conflict setup modal (Initiating/Responding/Resolving)
│   ├── ConflictOutcomeModal.tsx # Conflict result display
│   └── DealResultModal.tsx      # Theorize/draw preview modal
├── contexts/
│   └── GameNav.ts               # GameNavContext for passing nav callbacks into Board
├── util/
│   ├── assertions.ts            # assertDefined helper
│   ├── statusText.ts            # setStatusText, logError, getErrorLog (imperative DOM utility)
│   └── typedboardgame.ts        # StrictClient, StrictGameOf types
├── Board.tsx                    # Main board component (HamburgerMenu)
├── App.tsx                      # boardgame.io client setup, lobby flow
└── App.css                      # Responsive styles
```

---

## How to Play

### Start the Game
```bash
npm start
```
Open http://localhost:5173

### Game Flow

**Working Class Turn (Production Phase)**
1. "CLASS WAR / International" modal appears (turn 0) or "Working Class / Turn N" modal appears
2. Click "Start Game" / "Start Working Class Turn" -> Collects wages ($5), enters Action phase

**Action Phase**
3. Click a hand card -> Inspector bar shows "Train ($N)" option if affordable
4. Click a figure in play -> Inspector bar shows "Lead Strike" / "Run for Office" options
5. Click "End Turn" button to advance to Reproduction phase

**Reproduction Phase**
6. Click hand cards to select up to 1 for theorizing (gold highlight)
7. Click "Finish Theorizing" -> selected cards go to dustbin, hand refills, turn ends
8. Next player's Production modal appears

**Capitalist Class Turn** follows the same flow alternating back to Working Class.

### Common Development Tasks
```bash
npm run typecheck     # Typecheck all files
npm test              # Run all tests
npm run lint          # Run the linter on all files
npm start             # Start dev server at localhost:5173
```

---

## Future Development Goals

### Conflict Resolution
- [ ] Dice rolling mechanics for strikes and elections
- [ ] Power calculation (figures + established power)
- [ ] Conflict resolution outcome applying workplace/office changes
- [ ] Win conditions tied to conflict outcomes

### Action Phase Expansion
- [ ] Play institution cards (2 slots per player)
- [ ] Play demand cards (2 slots per player)
- [ ] Build / purchase workplaces
- [ ] Play tactic cards during conflicts

### Law System
- [ ] Legislative conflicts (pass laws)
- [ ] Law effects on gameplay (wages, profits, hand size, etc.)
- [ ] Repeal mechanics

### Advanced Features
- [ ] Special card abilities and hero powers
- [ ] Undo system (UndoState type already present in GameState)
- [ ] Win conditions (control enough workplaces / offices)

### UI Enhancements
- [ ] Conflict resolution animation / modal
- [ ] Card hover tooltips
- [ ] Drag-and-drop card playing
- [ ] Sound effects

### Multiplayer
- [x] Socket.IO integration via boardgame.io SocketIO transport
- [x] `npm run host` starts boardgame.io server; clients connect via Setup screen
- [x] Conflict player-switching via `endTurn({ next })` works in multiplayer
- [x] Waiting interstitial shown to non-active player during Production phase
- [x] Lobby system: match list, join UI, connection timeout/error screen
- [x] FlatFile DB for persistent match storage on server
- [x] Hamburger menu (☰) in top bar replaces bottom nav bar; contains "Return to Lobby" and "Return to Start Screen" actions
- [x] GameNavContext passes nav callbacks through boardgame.io Client HOC into Board.tsx
- [x] "Create Game" button in Lobby screen (POST /games/:name/create)
- [ ] Spectator mode

---

## Key Conventions

| Concern | Approach |
|---------|---------|
| State mutations | Immer (built-in to boardgame.io) - direct mutations in moves |
| Player IDs | Strings `'0'` (WC) and `'1'` (CC) |
| Phase management | Manual via `G.turnPhase`; `events.endTurn()` for player cycling |
| Type safety | No `any` types; no unvalidated `as` casts |
| Styling | CSS only (no JS styles); `vw` units for layout widths |
| Tests | Explicit fixtures; no skipped tests via early returns |
| Components | Functional with hooks; PascalCase names |

---

*Last updated: April 19, 2026*
