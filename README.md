# Class War: International - boardgame.io Edition

A 2-player asymmetric strategy card game built with boardgame.io and React + TypeScript.

## Project Status

✅ **Completed:**
- boardgame.io project setup
- Core game state structure
- Card type definitions and data models
- Initial card database (subset for testing)
- Game initialization with deck shuffling
- Production Phase implementation
- Comprehensive test suite (15 tests passing)

🚧 **In Progress:**
- Action Phase (card playing mechanics)
- Conflict system (Strike, Election, Legislative)
- Reproduction Phase (Theorize/card cycling)
- Law effects and special card abilities
- React UI integration

## Game Overview

**Class War: International** is an asymmetric 2-player strategy game where:
- **Player 0**: Working Class - Earns wages, unionizes workplaces
- **Player 1**: Capitalist Class - Earns profits, builds enterprises

### Turn Structure

Each turn consists of three phases:

1. **Production Phase**
   - Collect wages (Working Class) or profits (Capitalist Class)
   - Unexhaust all figures and state figures
   - Working Class: $2 (Corner Store) + $3 (Parts Producer) = $5
   - Capitalist Class: $6 (Corner Store) + $9 (Parts Producer) = $15

2. **Action Phase**
   - Play cards (figures, institutions, demands, workplaces)
   - Initiate conflicts (strikes, elections, legislation)
   - Respond to opponent's conflicts

3. **Reproduction Phase**
   - Theorize (discard and redraw cards)
   - Refill hand to max size
   - End turn

## Tech Stack

- **Game Engine**: [boardgame.io](https://boardgame.io/)
- **Frontend**: React 18 with TypeScript
- **Testing**: Jest + React Testing Library
- **Build Tool**: Create React App

## Project Structure

```
src/
├── game/
│   ├── ClassWarGame.ts          # Main game definition
│   ├── ClassWarGame.test.ts     # Setup tests (9 tests)
│   └── ProductionPhase.test.ts  # Production Phase tests (6 tests)
├── types/
│   ├── cards.ts                 # Card type definitions
│   └── game.ts                  # Game state types
├── data/
│   └── cards.ts                 # Card database
├── App.tsx                      # Main React component
└── index.tsx                    # Entry point
```

## Development

### Available Commands

```bash
# Start development server
npm start

# Run tests
npm test

# Run tests without watch mode
npm test -- --watchAll=false

# Build for production
npm run build
```

### Test Coverage

- **Setup Tests**: 9 tests validating game initialization
  - Player state initialization
  - Workplace and political office setup
  - Deck shuffling and card distribution

- **Production Phase Tests**: 6 tests + 2 skipped
  - Wage/profit collection
  - Phase transitions
  - Turn cycling
  - Income calculation

## Game State

### Player State
```typescript
{
  wealth: number;           // Currency for playing cards
  hand: CardId[];           // Current hand (4 cards)
  deck: CardId[];           // Draw pile
  dustbin: CardId[];        // Discard pile
  institutions: [...];      // 2 institution slots
  demands: [...];           // 2 demand slots
  figures: [...];           // Active character cards
  maxHandSize: 4;           // Can be increased by institutions
}
```

### Shared Board State
```typescript
{
  workplaces: WorkplaceInPlay[];        // 3 workplace slots
  politicalOffices: StateFigureInPlay[]; // 3 political offices
  laws: DemandId[];                      // Passed legislation
  turnPhase: TurnPhase;                  // Current phase
  turnNumber: number;                    // Increments each round
}
```

## Card Types

1. **Figure Cards** - Characters with dice values for conflicts
2. **Demand Cards** - Legislation that becomes laws
3. **Institution Cards** - Permanent effects
4. **Workplace Cards** - Generate wages/profits
5. **Tactic Cards** - One-time use in conflicts

## Current Cards

### Working Class
- **Figures**: Cashier, Activist, Rosa Luxembear (hero)
- **Demands**: Wealth Tax, Free Health Care
- **Institutions**: Political Education Group
- **Tactics**: Propagandize

### Capitalist Class
- **Figures**: Manager, Consultant, Steve Amphibannon (hero)
- **Demands**: Tax Breaks, Deregulation
- **Institutions**: Think Tank
- **Workplaces**: Fast Food Chain, Superstore
- **Tactics**: Union Busting

## Next Steps

### Immediate Priorities

1. **Action Phase Implementation**
   - Play figure cards from hand
   - Play institution/demand cards
   - Build workplaces
   - Validate costs and slot availability

2. **Conflict System**
   - Strike conflicts (labor disputes)
   - Election conflicts (running for office)
   - Legislative conflicts (passing laws)
   - Dice rolling and power calculation

3. **Reproduction Phase**
   - Theorize (discard/redraw)
   - Card cycling mechanics
   - Hand refilling

4. **React UI**
   - Board display
   - Hand visualization
   - Drag-and-drop card playing
   - Conflict resolution interface

### Future Enhancements

- Complete card database (70+ more cards)
- Law effect implementation
- Special card abilities
- Win condition system
- Multiplayer support
- Saved game states

## Testing Philosophy

All game logic is tested before UI implementation:
- Unit tests for moves and phase transitions
- Integration tests for complete turn cycles
- Test-driven development for new features

## Contributing

When adding new features:
1. Write tests first
2. Implement the feature
3. Verify all tests pass
4. Commit with descriptive message

## License

Based on the Class War board game by Jacobin.

---

**Status**: Early development, core mechanics functional, UI pending
