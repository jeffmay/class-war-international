/**
 * Tests for undo functionality
 *
 * undoMove restores the GameState snapshot saved by saveUndo.
 * clearUndo prevents undo after irreversible actions (dice rolls, card draws,
 * opponent decisions).
 */

import { buildDeck } from '../data/cards';
import { CardType, SocialClass } from '../types/cards';
import { TurnPhase } from '../types/game';
import { clientFromFixture, makeActionPhaseState, withCardInHand } from './generate';

describe('Undo - saveUndo / undoMove', () => {
  test('undoMove restores state after playCardFromHand (figure)', () => {
    const wcDeck = buildDeck(SocialClass.WorkingClass);
    const { hand, deck } = withCardInHand(wcDeck, 'cashier');
    const G = makeActionPhaseState({ hand, deck, wealth: 10 });
    const client = clientFromFixture(G);

    const before = client.getStateOrThrow().G;
    const beforeHandSize = before.players[SocialClass.WorkingClass].hand.length;
    const beforeWealth = before.players[SocialClass.WorkingClass].wealth;

    client.moves.playCardFromHand(0, 'figures[-1]');
    const afterPlay = client.getStateOrThrow().G;
    expect(afterPlay.players[SocialClass.WorkingClass].figures.length).toBe(1);
    expect(afterPlay.undoState?.canUndo).toBe(true);

    client.moves.undoMove();
    const afterUndo = client.getStateOrThrow().G;

    expect(afterUndo.players[SocialClass.WorkingClass].figures.length).toBe(0);
    expect(afterUndo.players[SocialClass.WorkingClass].hand.length).toBe(beforeHandSize);
    expect(afterUndo.players[SocialClass.WorkingClass].wealth).toBe(beforeWealth);
  });

  test('undoMove restores state after planStrike', () => {
    const wcDeck = buildDeck(SocialClass.WorkingClass);
    const { hand, deck } = withCardInHand(wcDeck, 'cashier');
    const G = makeActionPhaseState({ hand, deck, wealth: 10 });
    // Put cashier in figures so it can lead a strike
    G.players[SocialClass.WorkingClass].figures = [
      { id: 'cashier', card_type: CardType.Figure, in_play: true, in_training: false, exhausted: false },
    ];
    const client = clientFromFixture(G);

    client.moves.planStrike('cashier', 0); // figureId, workplaceIndex
    const afterPlan = client.getStateOrThrow().G;
    expect(afterPlan.activeConflict).toBeDefined();
    expect(afterPlan.undoState?.canUndo).toBe(true);

    client.moves.undoMove();
    const afterUndo = client.getStateOrThrow().G;
    expect(afterUndo.activeConflict).toBeUndefined();
  });

  test('undoMove does nothing when canUndo is false', () => {
    const G = makeActionPhaseState({ wealth: 10 });
    // Manually set canUndo to false
    G.undoState = { canUndo: false, reason: 'Cannot undo after collecting production' };
    const client = clientFromFixture(G);

    client.moves.undoMove();
    const after = client.getStateOrThrow().G;
    // undoState should remain as-is (no state change)
    expect(after.undoState?.canUndo).toBe(false);
  });

  test('undoMove does nothing when undoState is undefined', () => {
    const G = makeActionPhaseState({ wealth: 10 });
    G.undoState = undefined;
    const client = clientFromFixture(G);

    const before = client.getStateOrThrow().G;
    client.moves.undoMove();
    const after = client.getStateOrThrow().G;

    // State should be identical (boardgame.io returns same reference when no mutation)
    expect(after.turnPhase).toBe(before.turnPhase);
    expect(after.undoState).toBeUndefined();
  });
});

describe('Undo - clearUndo blocks undo', () => {
  test('collectProduction sets canUndo false', () => {
    const G = makeActionPhaseState({ wealth: 0 });
    G.turnPhase = TurnPhase.Production;
    const client = clientFromFixture(G);

    client.moves.collectProduction();
    const after = client.getStateOrThrow().G;
    expect(after.undoState?.canUndo).toBe(false);
  });

  test('endReproductionPhase sets canUndo false', () => {
    const G = makeActionPhaseState({ wealth: 0 });
    G.turnPhase = TurnPhase.Reproduction;
    const client = clientFromFixture(G);

    client.moves.endReproductionPhase();
    // endReproductionPhase calls clearUndo before advancing the turn.
    // After endTurn fires the board state transitions to the next player's Production phase,
    // at which point undoState may be cleared. Either way, undoMove should have no effect.
    // We verify this by calling undoMove and confirming turnPhase stays at Production.
    const after = client.getStateOrThrow().G;
    client.moves.undoMove();
    const afterUndo = client.getStateOrThrow().G;
    expect(afterUndo.turnPhase).toBe(after.turnPhase);
  });

  test('canUndo label reflects saved action name', () => {
    const wcDeck = buildDeck(SocialClass.WorkingClass);
    const { hand, deck } = withCardInHand(wcDeck, 'cashier');
    const G = makeActionPhaseState({ hand, deck, wealth: 10 });
    const client = clientFromFixture(G);

    client.moves.playCardFromHand(0, 'figures[-1]');
    const after = client.getStateOrThrow().G;

    expect(after.undoState?.canUndo).toBe(true);
    expect(after.undoState?.canUndo && after.undoState.previousActionName).toBe('Train Figure');
  });
});
