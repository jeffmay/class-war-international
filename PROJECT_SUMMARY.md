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
- `ConflictTargetMenuBar` component for choosing strike/election targets
- Strike target: lists all workplaces; empty slots are disabled
- Election target: lists all political offices
- Cancel button returns to normal board state

### 10. React UI Foundation
- Full game board display with responsive CSS
- `TurnStartModal` full-screen overlay for Production phase
- Top bar with game title
- Control bar: Undo button, End Turn / Finish Theorizing button
- Phase and wealth info display
- Shared board area: Workplaces (3 slots), Political Offices (3 state figures)
- Card inspector menu bar (`ActionMenuBar`) for action selection
- Conflict target menu bar (`ConflictTargetMenuBar`) for strike/election targeting

**Status: Running at localhost:3000**

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

---

## Test Coverage

### Test Suites: 6
1. **ClassWarGame.test.ts** - Setup tests (9 tests)
2. **ProductionPhase.test.ts** - Production mechanics (6 passing, 2 skipped)
3. **ActionPhase.test.ts** - Card playing (7 tests)
4. **ConflictPhase.test.ts** - Strike and election planning (11 tests)
5. **CardInspectorMenuBar.test.tsx** - Card inspector component (12 tests)
6. **ConflictTargetMenuBar.test.tsx** - Conflict target component (12 tests)

**Total: 64 passing + 2 skipped = 66 tests**

### Testing Architecture

All game-logic tests use explicit per-test fixtures generated via `src/game/generate.ts`:
- `makePlayerState(class, overrides?)` - builds a PlayerState from the real unshuffled deck with `theorizeLimit: 1`
- `makeActionPhaseState(wcOverrides?, ccOverrides?)` - builds a full GameState in Action phase
- `withCardInHand(deck, cardId)` - returns a hand/deck split guaranteeing a specific card is at hand[0]
- `withCardsInHand(deck, cardIds)` - same for multiple cards
- `clientFromFixture(G)` - creates a StrictClient starting from the provided GameState

Every test explicitly sets its pre-conditions (hand contents, wealth, figures in play) so no test ever skips or branches on randomly generated values.

Component tests use React Testing Library with `@testing-library/jest-dom` matchers.

---

## Architecture

### Technology Stack
- **Game Engine**: boardgame.io v0.50.2
- **Frontend**: React 18 with TypeScript
- **State Management**: boardgame.io (G object with Immer mutations)
- **Testing**: Jest + React Testing Library
- **Build**: Create React App

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
│   ├── StartGameScreen.tsx      # TurnStartModal overlay
│   ├── CardComponent.tsx        # Reusable card display with optional status banner
│   ├── CardInspectorMenuBar.tsx # Action menu bar for selected cards
│   ├── CardInspectorMenuBar.test.tsx
│   ├── ConflictTargetMenuBar.tsx # Strike/election target selector
│   └── ConflictTargetMenuBar.test.tsx
├── util/
│   ├── assertions.ts            # assertDefined helper
│   └── typedboardgame.ts        # StrictClient, StrictGameOf types
├── Board.tsx                    # Main board component
├── App.tsx                      # boardgame.io client setup
└── App.css                      # Responsive styles
```

---

## How to Play

### Start the Game
```bash
npm start
```
Open http://localhost:3000

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
npm start             # Start dev server at localhost:3000
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
- [ ] Socket.IO integration for real networked play
- [ ] Lobby system
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

*Last updated: March 25, 2026*
