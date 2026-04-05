/**
 * Tests for Production Phase mechanics
 */

import { SocialClass } from '../types/cards';
import { TurnPhase } from '../types/game';
import { assertDefined } from '../util/assertions';
import { StrictClient, type StrictClientOf } from '../util/typedboardgame';
import { ClassWarGame } from './ClassWarGame';

describe('Production Phase', () => {
  let client: StrictClientOf<typeof ClassWarGame>;

  beforeEach(() => {
    // Create a client - we'll test from player 0's perspective
    client = StrictClient({ game: ClassWarGame, numPlayers: 2 });
    client.start();
  });

  test('Working Class collects wages from workplaces', () => {
    const state = client.getStateOrThrow();
    const initialWealth = state.G.players[SocialClass.WorkingClass].wealth;

    expect(state?.G.turnPhase).toBe(TurnPhase.Production);
    expect(state?.ctx.currentPlayer).toBe('0'); // Working Class starts
    expect(initialWealth).toBe(0);

    // Collect production
    client.moves.collectProduction();
    const newState = client.getStateOrThrow();

    // Should collect wages: Corner Store (2) + Parts Producer (3) = 5
    expect(newState?.G.players[SocialClass.WorkingClass].wealth).toBe(5);
    expect(newState?.G.turnPhase).toBe(TurnPhase.Action);
  });

  test('Capitalist Class collects profits from workplaces', () => {
    // First, let Working Class complete their turn
    client.moves.collectProduction();
    client.moves.endActionPhase();
    client.moves.endReproductionPhase();

    // Now it should be Capitalist's turn
    const state = client.getStateOrThrow();
    expect(state.G.turnPhase).toBe(TurnPhase.Production);
    expect(state.ctx.currentPlayer).toBe('1');

    const initialWealth = state.G.players[SocialClass.CapitalistClass].wealth;
    expect(initialWealth).toBe(0);

    // Collect production as Capitalist (player 1)
    client.moves.collectProduction('1'); // Specify playerID
    const newState = client.getStateOrThrow();

    // Should collect profits: Corner Store (6) + Parts Producer (9) = 15
    expect(newState.G.players[SocialClass.CapitalistClass].wealth).toBe(15);
    expect(newState.G.turnPhase).toBe(TurnPhase.Action);
  });

  // Skipping exhaustion tests - will implement when we add card playing
  test.skip('collectProduction unexhausts all figures', () => { });
  test.skip('collectProduction unexhausts state figures', () => { });

  test('cannot collect production outside Production phase', () => {
    // Move to Action phase
    client.moves.collectProduction();
    const actionState = client.getStateOrThrow();
    expect(actionState.G.turnPhase).toBe(TurnPhase.Action);

    const wealthAfterProduction = actionState?.G.players[SocialClass.WorkingClass].wealth;

    // Try to collect again
    client.moves.collectProduction();
    const afterSecondAttempt = client.getStateOrThrow();

    // Wealth should not change
    expect(afterSecondAttempt.G.players[SocialClass.WorkingClass].wealth).toBe(wealthAfterProduction);
  });

  test('complete turn cycle updates phase correctly', () => {
    // Start in Production
    expect(client.getStateOrThrow().G.turnPhase).toBe(TurnPhase.Production);

    // Move through phases
    client.moves.collectProduction();
    expect(client.getStateOrThrow().G.turnPhase).toBe(TurnPhase.Action);

    client.moves.endActionPhase();
    expect(client.getStateOrThrow().G.turnPhase).toBe(TurnPhase.Reproduction);

    client.moves.endReproductionPhase();

    // Should be back to Production (but now Capitalist's turn)
    const finalState = client.getStateOrThrow();
    expect(finalState.G.turnPhase).toBe(TurnPhase.Production);
    expect(finalState.ctx.currentPlayer).toBe('1'); // Capitalist's turn
  });

  test('turn number increments after both players complete a full round', () => {
    const initialTurn = client.getStateOrThrow().G.turnNumber;
    expect(initialTurn).toBe(0);

    // Complete Working Class turn
    client.moves.collectProduction();
    client.moves.endActionPhase();
    client.moves.endReproductionPhase();

    // Turn number should stay at 0 until CC also completes their turn
    const afterWcTurn = client.getStateOrThrow();
    expect(afterWcTurn.G.turnNumber).toBe(0);
    expect(afterWcTurn.ctx.currentPlayer).toBe('1'); // Now Capitalist's turn

    // Complete Capitalist turn
    client.moves.collectProduction('1');
    client.moves.endActionPhase('1');
    client.moves.endReproductionPhase();

    // Turn number should increment after CC completes their turn (end of full round)
    const afterFullRound = client.getStateOrThrow();
    expect(afterFullRound.G.turnNumber).toBe(1);
    expect(afterFullRound.ctx.currentPlayer).toBe('0'); // Back to Working Class
  });

  test('empty workplace slots do not generate income', () => {
    const state = client.getStateOrThrow();
    // Verify there's an empty slot
    const emptySlot = state.G.workplaces.find(w => w.id.startsWith('empty_slot'));
    assertDefined(emptySlot);
    expect(emptySlot.wages).toBe(0);
    expect(emptySlot.profits).toBe(0);

    // Collect production
    client.moves.collectProduction();
    const newState = client.getStateOrThrow();
    // Should only collect from non-empty workplaces (2 + 3 = 5)
    expect(newState.G.players[SocialClass.WorkingClass].wealth).toBe(5);
  });
});
