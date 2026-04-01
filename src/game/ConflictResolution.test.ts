/**
 * Tests for Conflict Resolution mechanics:
 * - cancelConflict
 * - initiateConflict
 * - addFigureToConflict
 * - addTacticToConflict
 * - planResponse
 * - resolveConflict
 * - dismissConflictOutcome
 *
 * Note: all conflict moves use G.activeConflict.activeConflictPlayer to determine
 * who is acting, not boardgame.io's ctx.currentPlayer. This allows single-device
 * play where both players share the same client.
 */

import { CardType, SocialClass, type FigureCardInPlay } from '../types/cards';
import { ConflictPhase, ConflictType } from '../types/conflicts';
import { clientFromFixture, makeActionPhaseState } from './generate';
import { buildDeck } from '../data/cards';

// ── Fixtures ────────────────────────────────────────────────────────────────

const readyWcFigure: FigureCardInPlay = {
  id: 'cashier',
  card_type: CardType.Figure,
  in_play: true,
  exhausted: false,
  in_training: false,
};

const secondWcFigure: FigureCardInPlay = {
  id: 'activist',
  card_type: CardType.Figure,
  in_play: true,
  exhausted: false,
  in_training: false,
};

const readyCcFigure: FigureCardInPlay = {
  id: 'manager',
  card_type: CardType.Figure,
  in_play: true,
  exhausted: false,
  in_training: false,
};

/** Returns a client with an active Strike conflict in the Initiating phase. */
function makeStrikeInitiating() {
  const G = makeActionPhaseState({ figures: [readyWcFigure] });
  const client = clientFromFixture(G);
  client.moves.planStrike('cashier', 0);
  const state = client.getStateOrThrow();
  expect(state.G.activeConflict).toBeDefined();
  expect(state.G.activeConflict!.phase).toBe(ConflictPhase.Initiating);
  return client;
}

/** Returns a client with an active Strike conflict in the Responding phase. */
function makeStrikeResponding() {
  const client = makeStrikeInitiating();
  client.moves.initiateConflict();
  const state = client.getStateOrThrow();
  expect(state.G.activeConflict!.phase).toBe(ConflictPhase.Responding);
  return client;
}

/** Returns a client with an active Strike conflict in the Resolving phase. */
function makeStrikeResolving() {
  const client = makeStrikeResponding();
  // CC (responding player) passes without adding cards
  client.moves.planResponse();
  const state = client.getStateOrThrow();
  expect(state.G.activeConflict!.phase).toBe(ConflictPhase.Resolving);
  return client;
}

// ── cancelConflict ───────────────────────────────────────────────────────────

describe('cancelConflict', () => {
  test('returns the initiating figure to in-play area', () => {
    const client = makeStrikeInitiating();
    expect(client.getStateOrThrow().G.players[SocialClass.WorkingClass].figures).toHaveLength(0);

    client.moves.cancelConflict();
    const state = client.getStateOrThrow();

    expect(state.G.activeConflict).toBeUndefined();
    expect(state.G.players[SocialClass.WorkingClass].figures).toHaveLength(1);
    expect(state.G.players[SocialClass.WorkingClass].figures[0].id).toBe('cashier');
    expect(state.G.players[SocialClass.WorkingClass].figures[0].exhausted).toBe(false);
  });

  test('cannot cancel once conflict is in Responding phase', () => {
    const client = makeStrikeResponding();
    client.moves.cancelConflict();
    expect(client.getStateOrThrow().G.activeConflict).toBeDefined();
  });

  test('cancel is a no-op when there is no active conflict', () => {
    const G = makeActionPhaseState({ figures: [readyWcFigure] });
    const client = clientFromFixture(G);
    client.moves.cancelConflict();
    expect(client.getStateOrThrow().G.activeConflict).toBeUndefined();
  });
});

// ── initiateConflict ─────────────────────────────────────────────────────────

describe('initiateConflict', () => {
  test('moves conflict from Initiating to Responding phase', () => {
    const client = makeStrikeInitiating();
    client.moves.initiateConflict();
    const state = client.getStateOrThrow();

    expect(state.G.activeConflict!.phase).toBe(ConflictPhase.Responding);
    expect(state.G.activeConflict!.activeConflictPlayer).toBe(SocialClass.CapitalistClass);
  });

  test('is a no-op if conflict is already in Responding phase', () => {
    const client = makeStrikeResponding();
    client.moves.initiateConflict();
    expect(client.getStateOrThrow().G.activeConflict!.phase).toBe(ConflictPhase.Responding);
  });
});

// ── addFigureToConflict ───────────────────────────────────────────────────────

describe('addFigureToConflict', () => {
  test('initiating player can add a second figure during Initiating phase', () => {
    const G = makeActionPhaseState({ figures: [readyWcFigure, secondWcFigure] });
    const client = clientFromFixture(G);
    client.moves.planStrike('cashier', 0);

    client.moves.addFigureToConflict('activist');
    const state = client.getStateOrThrow();

    expect(state.G.activeConflict!.workingClassCards).toHaveLength(2);
    expect(state.G.players[SocialClass.WorkingClass].figures).toHaveLength(0);
    // cashier(1 die) + activist(1 die)
    expect(state.G.activeConflict!.workingClassPower.diceCount).toBe(2);
  });

  test('responding player can add a figure during Responding phase', () => {
    const G = makeActionPhaseState({ figures: [readyWcFigure] }, { figures: [readyCcFigure] });
    const client = clientFromFixture(G);
    client.moves.planStrike('cashier', 0);
    client.moves.initiateConflict();

    // activeConflictPlayer is now CC
    client.moves.addFigureToConflict('manager');
    const state = client.getStateOrThrow();

    expect(state.G.activeConflict!.capitalistCards).toHaveLength(1);
    expect(state.G.players[SocialClass.CapitalistClass].figures).toHaveLength(0);
  });

  test('cannot add an exhausted figure', () => {
    const exhaustedFigure: FigureCardInPlay = { ...secondWcFigure, exhausted: true };
    const G = makeActionPhaseState({ figures: [readyWcFigure, exhaustedFigure] });
    const client = clientFromFixture(G);
    client.moves.planStrike('cashier', 0);

    client.moves.addFigureToConflict('activist');
    const state = client.getStateOrThrow();

    expect(state.G.activeConflict!.workingClassCards).toHaveLength(1);
    // exhausted figure remains in player's area
    expect(state.G.players[SocialClass.WorkingClass].figures).toHaveLength(1);
  });

  test('cannot add a figure that is in training', () => {
    const inTrainingFigure: FigureCardInPlay = { ...secondWcFigure, in_training: true };
    const G = makeActionPhaseState({ figures: [readyWcFigure, inTrainingFigure] });
    const client = clientFromFixture(G);
    client.moves.planStrike('cashier', 0);

    client.moves.addFigureToConflict('activist');
    expect(client.getStateOrThrow().G.activeConflict!.workingClassCards).toHaveLength(1);
  });

  test('cannot add a figure that does not exist in the active player\'s area', () => {
    const client = makeStrikeInitiating();
    client.moves.addFigureToConflict('manager'); // manager is CC, not WC
    expect(client.getStateOrThrow().G.activeConflict!.workingClassCards).toHaveLength(1);
  });

  test('cannot add a figure during Resolving phase', () => {
    const G = makeActionPhaseState({ figures: [readyWcFigure, secondWcFigure] });
    const client = clientFromFixture(G);
    client.moves.planStrike('cashier', 0);
    client.moves.initiateConflict();
    client.moves.planResponse(); // skip to Resolving
    expect(client.getStateOrThrow().G.activeConflict!.phase).toBe(ConflictPhase.Resolving);

    client.moves.addFigureToConflict('activist');
    expect(client.getStateOrThrow().G.activeConflict!.workingClassCards).toHaveLength(1);
  });
});

// ── addTacticToConflict ───────────────────────────────────────────────────────

describe('addTacticToConflict', () => {
  test('initiating player can add a tactic from hand', () => {
    const fullDeck = buildDeck(SocialClass.WorkingClass);
    const hand: typeof fullDeck = ['propagandize', ...fullDeck.filter(id => id !== 'propagandize').slice(0, 3)];
    const deck = fullDeck.filter(id => !hand.includes(id));
    const G = makeActionPhaseState({ figures: [readyWcFigure], hand, deck, wealth: 10 });
    const client = clientFromFixture(G);
    client.moves.planStrike('cashier', 0);

    client.moves.addTacticToConflict(0); // propagandize is at index 0
    const state = client.getStateOrThrow();

    // cashier(1 die) + propagandize(2 dice)
    expect(state.G.activeConflict!.workingClassCards).toHaveLength(2);
    expect(state.G.activeConflict!.workingClassPower.diceCount).toBe(3);
    expect(state.G.players[SocialClass.WorkingClass].wealth).toBe(7); // 10 - 3
  });

  test('cannot add tactic if insufficient wealth', () => {
    const fullDeck = buildDeck(SocialClass.WorkingClass);
    const hand: typeof fullDeck = ['propagandize', ...fullDeck.filter(id => id !== 'propagandize').slice(0, 3)];
    const deck = fullDeck.filter(id => !hand.includes(id));
    const G = makeActionPhaseState({ figures: [readyWcFigure], hand, deck, wealth: 0 });
    const client = clientFromFixture(G);
    client.moves.planStrike('cashier', 0);

    client.moves.addTacticToConflict(0);
    const state = client.getStateOrThrow();

    expect(state.G.activeConflict!.workingClassCards).toHaveLength(1); // only cashier
    expect(state.G.players[SocialClass.WorkingClass].wealth).toBe(0);
  });

  test('cannot add a non-tactic card', () => {
    const G = makeActionPhaseState({ figures: [readyWcFigure] });
    const client = clientFromFixture(G);
    client.moves.planStrike('cashier', 0);

    // hand[0] should be a figure/demand/institution card, not a tactic
    const handIndex = 0;
    client.moves.addTacticToConflict(handIndex);
    // Only cashier is in the conflict
    expect(client.getStateOrThrow().G.activeConflict!.workingClassCards).toHaveLength(1);
  });
});

// ── planResponse ──────────────────────────────────────────────────────────────

describe('planResponse', () => {
  test('moves conflict from Responding to Resolving phase, passing back to initiating player', () => {
    const client = makeStrikeResponding();
    client.moves.planResponse();
    const state = client.getStateOrThrow();

    expect(state.G.activeConflict!.phase).toBe(ConflictPhase.Resolving);
    expect(state.G.activeConflict!.activeConflictPlayer).toBe(SocialClass.WorkingClass);
  });

  test('is a no-op if conflict is in Initiating phase', () => {
    const client = makeStrikeInitiating();
    client.moves.planResponse();
    expect(client.getStateOrThrow().G.activeConflict!.phase).toBe(ConflictPhase.Initiating);
  });

  test('is a no-op if conflict is already in Resolving phase', () => {
    const client = makeStrikeResolving();
    client.moves.planResponse();
    expect(client.getStateOrThrow().G.activeConflict!.phase).toBe(ConflictPhase.Resolving);
  });
});

// ── resolveConflict ───────────────────────────────────────────────────────────

describe('resolveConflict', () => {
  test('resolves a strike and produces a conflictOutcome', () => {
    const client = makeStrikeResolving();
    client.moves.resolveConflict();
    const state = client.getStateOrThrow();

    expect(state.G.activeConflict).toBeUndefined();
    expect(state.G.conflictOutcome).toBeDefined();
    const outcome = state.G.conflictOutcome!;
    expect(outcome.conflict.conflictType).toBe(ConflictType.Strike);
    expect([SocialClass.WorkingClass, SocialClass.CapitalistClass]).toContain(outcome.winner);
    expect(outcome.workingClassPower.diceRolls).toHaveLength(outcome.workingClassPower.diceCount);
    expect(outcome.dismissedBy).toHaveLength(0);
  });

  test('exhausts all participating figures and returns them to in-play area', () => {
    const client = makeStrikeResolving();
    client.moves.resolveConflict();
    const state = client.getStateOrThrow();

    const wcFigures = state.G.players[SocialClass.WorkingClass].figures;
    expect(wcFigures).toHaveLength(1);
    expect(wcFigures[0].id).toBe('cashier');
    expect(wcFigures[0].exhausted).toBe(true);
  });

  test('includes workplace established power on the capitalist side', () => {
    const client = makeStrikeResolving();
    client.moves.resolveConflict();
    const outcome = client.getStateOrThrow().G.conflictOutcome!;
    // corner_store has established_power: 1, which goes to CC
    expect(outcome.capitalistPower.establishedPower).toBe(1);
  });

  test('is a no-op if conflict is still in Responding phase', () => {
    const client = makeStrikeResponding();
    client.moves.resolveConflict();
    expect(client.getStateOrThrow().G.activeConflict).toBeDefined();
    expect(client.getStateOrThrow().G.conflictOutcome).toBeUndefined();
  });

  test('sends tactic cards to the dustbin after resolution', () => {
    const fullDeck = buildDeck(SocialClass.WorkingClass);
    const hand: typeof fullDeck = ['propagandize', ...fullDeck.filter(id => id !== 'propagandize').slice(0, 3)];
    const deck = fullDeck.filter(id => !hand.includes(id));
    const G = makeActionPhaseState({ figures: [readyWcFigure], hand, deck, wealth: 10 });
    const client = clientFromFixture(G);
    client.moves.planStrike('cashier', 0);
    client.moves.addTacticToConflict(0);
    client.moves.initiateConflict();
    client.moves.planResponse();
    client.moves.resolveConflict();

    const state = client.getStateOrThrow();
    expect(state.G.players[SocialClass.WorkingClass].dustbin).toContain('propagandize');
  });
});

// ── dismissConflictOutcome ────────────────────────────────────────────────────

describe('dismissConflictOutcome', () => {
  test('outcome is kept until both classes dismiss', () => {
    const client = makeStrikeResolving();
    client.moves.resolveConflict();
    expect(client.getStateOrThrow().G.conflictOutcome).toBeDefined();

    client.moves.dismissConflictOutcome(SocialClass.WorkingClass);
    expect(client.getStateOrThrow().G.conflictOutcome).toBeDefined();
    expect(client.getStateOrThrow().G.conflictOutcome!.dismissedBy).toContain(SocialClass.WorkingClass);

    client.moves.dismissConflictOutcome(SocialClass.CapitalistClass);
    expect(client.getStateOrThrow().G.conflictOutcome).toBeUndefined();
  });

  test('duplicate dismissal from same class is ignored', () => {
    const client = makeStrikeResolving();
    client.moves.resolveConflict();

    client.moves.dismissConflictOutcome(SocialClass.WorkingClass);
    client.moves.dismissConflictOutcome(SocialClass.WorkingClass); // again
    expect(client.getStateOrThrow().G.conflictOutcome!.dismissedBy).toHaveLength(1);
  });

  test('is a no-op when there is no conflict outcome', () => {
    const G = makeActionPhaseState();
    const client = clientFromFixture(G);
    client.moves.dismissConflictOutcome(SocialClass.WorkingClass);
    expect(client.getStateOrThrow().G.conflictOutcome).toBeUndefined();
  });
});
