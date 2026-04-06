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

import { buildDeck } from '../data/cards';
import { CardType, SocialClass, WorkplaceForSale, type FigureCardInPlay } from '../types/cards';
import { ConflictPhase, ConflictType } from '../types/conflicts';
import { TurnPhase } from '../types/game';
import { filterMap } from '../util/fun';
import { playDemandCard, playFigureCard } from '../util/game';
import { clientFromFixture, makeActionPhaseState } from './generate';

// ── Fixtures ────────────────────────────────────────────────────────────────

const readyWcFigure = playFigureCard('cashier', { in_training: false });

const secondWcFigure = playFigureCard('student_activist', { in_training: false });

const readyCcFigure = playFigureCard('manager', { in_training: false });

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

    client.moves.addFigureToConflict('student_activist');
    const state = client.getStateOrThrow();

    expect(state.G.activeConflict!.workingClassCards).toHaveLength(2);
    expect(state.G.players[SocialClass.WorkingClass].figures).toHaveLength(0);
    // cashier(1 die) + student_activist(1 die)
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

    client.moves.addFigureToConflict('student_activist');
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

    client.moves.addFigureToConflict('student_activist');
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

    client.moves.addFigureToConflict('student_activist');
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

  test('each die roll is 0, 1, or 2 (custom die faces)', () => {
    // Run several resolutions and assert every roll value is in {0, 1, 2}
    for (let i = 0; i < 20; i++) {
      const client = makeStrikeResolving();
      client.moves.resolveConflict();
      const outcome = client.getStateOrThrow().G.conflictOutcome!;
      for (const roll of [...outcome.workingClassPower.diceRolls, ...outcome.capitalistPower.diceRolls]) {
        expect([0, 1, 2]).toContain(roll);
      }
    }
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

// ── Election: cooldown and figure placement ───────────────────────────────────

describe('resolveConflict - election', () => {
  test('election produces a conflictOutcome with election type', () => {
    const G = makeActionPhaseState({
      figures: [{ id: 'cashier', card_type: CardType.Figure, in_play: true, exhausted: false, in_training: false }],
    });
    const client = clientFromFixture(G);
    client.moves.planElection('cashier', 0);
    client.moves.initiateConflict();
    client.moves.planResponse();
    client.moves.resolveConflict();

    const outcome = client.getStateOrThrow().G.conflictOutcome!;
    expect(outcome).toBeDefined();
    expect(outcome.conflict.conflictType).toBe(ConflictType.Election);
    expect([SocialClass.WorkingClass, SocialClass.CapitalistClass]).toContain(outcome.winner);
  });

  test('WC election win places candidate in office with cooldown=1', () => {
    const candidate = playFigureCard('cashier');
    const G = makeActionPhaseState();
    // Build a Resolving-phase election fixture directly with overwhelming WC power
    G.activeConflict = {
      conflictType: ConflictType.Election,
      targetOfficeIndex: 0,
      targetIncumbent: { ...G.politicalOffices[0] },
      candidate,
      workingClassCards: [candidate],
      capitalistCards: [],
      active: true,
      phase: ConflictPhase.Resolving,
      initiatingClass: SocialClass.WorkingClass,
      activeConflictPlayer: SocialClass.WorkingClass,
      workingClassPower: { diceCount: 0, establishedPower: 100 },
      capitalistPower: { diceCount: 0, establishedPower: 0 },
    };
    const client = clientFromFixture(G);
    client.moves.resolveConflict();

    const finalState = client.getStateOrThrow();
    const electedOffice = finalState.G.politicalOffices[0];
    if (electedOffice.card_type !== CardType.Figure) throw new Error('expected elected figure in office');
    expect(electedOffice.id).toBe('cashier');
    expect(electedOffice.electionCooldownTurnsRemaining).toBe(1);
    expect(finalState.G.players[SocialClass.WorkingClass].figures.some(f => f.id === 'cashier')).toBe(false);
  });

  test('WC election loss returns candidate exhausted; no office cooldown set', () => {
    const candidate = playFigureCard('cashier');
    const G = makeActionPhaseState();
    G.activeConflict = {
      conflictType: ConflictType.Election,
      targetOfficeIndex: 0,
      targetIncumbent: { ...G.politicalOffices[0] },
      candidate,
      workingClassCards: [candidate],
      capitalistCards: [],
      active: true,
      phase: ConflictPhase.Resolving,
      initiatingClass: SocialClass.WorkingClass,
      activeConflictPlayer: SocialClass.WorkingClass,
      workingClassPower: { diceCount: 0, establishedPower: 0 },
      capitalistPower: { diceCount: 0, establishedPower: 100 },
    };
    const client = clientFromFixture(G);
    client.moves.resolveConflict();

    const finalState = client.getStateOrThrow();
    expect(finalState.G.politicalOffices[0].card_type).toBe(CardType.DefaultStateFigure);
    expect(finalState.G.politicalOffices[0].electionCooldownTurnsRemaining).toBeUndefined();
    const returnedFigure = finalState.G.players[SocialClass.WorkingClass].figures.find(f => f.id === 'cashier');
    expect(returnedFigure).toBeDefined();
    expect(returnedFigure!.exhausted).toBe(true);
  });

  test('election cooldown decrements by 1 when the elected class ends their turn', () => {
    // WC wins election and places cashier in office with cooldown=1
    // Cooldown should decrement when WC ends their turn
    const wcElectedFigure: FigureCardInPlay = {
      id: 'cashier',
      card_type: CardType.Figure,
      in_play: true,
      exhausted: false,
      in_training: false,
      electionCooldownTurnsRemaining: 1,
    };
    const G = makeActionPhaseState();
    G.politicalOffices[0] = wcElectedFigure;
    const client = clientFromFixture(G);

    client.moves.endActionPhase();
    client.moves.endReproductionPhase();

    const state = client.getStateOrThrow();
    expect(state.G.politicalOffices[0].electionCooldownTurnsRemaining).toBe(0);
  });

  test('election cooldown does NOT decrement when the opposing class ends their turn', () => {
    // WC wins election — cooldown should only decrement on WC's turn end, not CC's
    const wcElectedFigure = playFigureCard('cashier', { in_training: false, electionCooldownTurnsRemaining: 1 });
    const G = makeActionPhaseState();
    G.politicalOffices[0] = wcElectedFigure;
    const client = clientFromFixture(G);

    // Skip WC's turn without ending it — jump straight to CC's turn
    // by having WC NOT end their turn here; instead fast-forward:
    // WC ends turn (cooldown: 1 → 0), then CC ends turn (should stay at 0)
    client.moves.endActionPhase();
    client.moves.endReproductionPhase(); // WC ends turn → cooldown decrements to 0
    client.moves.collectProduction();    // CC production
    client.moves.endActionPhase();
    client.moves.endReproductionPhase(); // CC ends turn — should NOT decrement below 0

    const state = client.getStateOrThrow();
    expect(state.G.politicalOffices[0].electionCooldownTurnsRemaining ?? 0).toBe(0);
  });

  test('CC-elected figure cooldown decrements only on CC turn end', () => {
    // CC wins election — their figure is in office; cooldown should decrement on CC turn end
    const ccElectedFigure = playFigureCard('manager', { electionCooldownTurnsRemaining: 1, in_training: false });
    const G = makeActionPhaseState();
    G.politicalOffices[0] = ccElectedFigure;
    const client = clientFromFixture(G);

    // WC ends their turn — cooldown should NOT decrement (office held by CC figure)
    client.moves.endActionPhase();
    client.moves.endReproductionPhase();
    expect(client.getStateOrThrow().G.politicalOffices[0].electionCooldownTurnsRemaining).toBe(1);

    // CC ends their turn — cooldown should decrement
    client.moves.collectProduction();
    client.moves.endActionPhase();
    client.moves.endReproductionPhase();
    expect(client.getStateOrThrow().G.politicalOffices[0].electionCooldownTurnsRemaining).toBe(0);
  });
});

// ── Legislation resolution ────────────────────────────────────────────────────

function makeWcLegislationFixture() {
  const G = makeActionPhaseState({
    demands: [playDemandCard('wealth_tax'), null],
  });
  G.politicalOffices[0] = { ...playFigureCard('cashier') };
  return G;
}

describe('resolveConflict - legislation', () => {
  function makeWcLegislationResolving(wcWealth = 0) {
    const G = makeActionPhaseState({
      demands: [playDemandCard('wealth_tax'), null],
      wealth: wcWealth,
    });
    G.politicalOffices[0] = { ...playFigureCard('cashier') };
    const client = clientFromFixture(G);

    client.moves.planLegislation(0, 0);
    expect(client.getStateOrThrow().G.activeConflict).toBeDefined();
    client.moves.initiateConflict();
    client.moves.planResponse();
    expect(client.getStateOrThrow().G.activeConflict!.phase).toBe(ConflictPhase.Resolving);
    return client;
  }

  test('resolves legislation and produces a conflictOutcome', () => {
    const client = makeWcLegislationResolving();
    client.moves.resolveConflict();
    const state = client.getStateOrThrow();

    expect(state.G.activeConflict).toBeUndefined();
    expect(state.G.conflictOutcome).toBeDefined();
    const outcome = state.G.conflictOutcome!;
    expect(outcome.conflict.conflictType).toBe(ConflictType.Legislation);
    expect([SocialClass.WorkingClass, SocialClass.CapitalistClass]).toContain(outcome.winner);
  });

  test('winning legislation adds demand to laws list', () => {
    const G = makeWcLegislationFixture();
    G.activeConflict = {
      conflictType: ConflictType.Legislation,
      demandCardId: 'wealth_tax',
      demandSlotIndex: 0,
      proposingOfficeIndex: 0,
      workingClassCards: [{ ...G.politicalOffices[0] }],
      capitalistCards: [],
      active: true,
      phase: ConflictPhase.Resolving,
      initiatingClass: SocialClass.WorkingClass,
      activeConflictPlayer: SocialClass.WorkingClass,
      workingClassPower: { diceCount: 0, establishedPower: 100 },
      capitalistPower: { diceCount: 0, establishedPower: 0 },
    };
    const client = clientFromFixture(G);
    client.moves.resolveConflict();
    expect(client.getStateOrThrow().G.laws).toContain('wealth_tax');
  });

  test('losing legislation does not add demand to laws list', () => {
    const G = makeWcLegislationFixture();
    G.activeConflict = {
      conflictType: ConflictType.Legislation,
      demandCardId: 'wealth_tax',
      demandSlotIndex: 0,
      proposingOfficeIndex: 0,
      workingClassCards: [{ ...G.politicalOffices[0] }],
      capitalistCards: [],
      active: true,
      phase: ConflictPhase.Resolving,
      initiatingClass: SocialClass.WorkingClass,
      activeConflictPlayer: SocialClass.WorkingClass,
      workingClassPower: { diceCount: 0, establishedPower: 0 },
      capitalistPower: { diceCount: 0, establishedPower: 100 },
    };
    const client = clientFromFixture(G);
    client.moves.resolveConflict();
    expect(client.getStateOrThrow().G.laws).not.toContain('wealth_tax');
  });

  test('state figures are exhausted after legislation resolves', () => {
    const client = makeWcLegislationResolving();
    client.moves.resolveConflict();
    const state = client.getStateOrThrow();

    // All political offices should be exhausted (they all participated)
    for (const office of state.G.politicalOffices) {
      expect(office.exhausted).toBe(true);
    }
  });

  test('deregulation law shifts $1 from wages to profits at each workplace on win', () => {
    const G = makeActionPhaseState({
      demands: [playDemandCard('deregulation'), null],
    });
    G.politicalOffices[0] = { ...playFigureCard('cashier') };

    const initialWages = G.workplaces.map(w => w === WorkplaceForSale ? 0 : w.wages);
    const initialProfits = G.workplaces.map(w => w === WorkplaceForSale ? 0 : w.profits);

    // Build a Resolving-phase legislation fixture with overwhelming WC power
    G.activeConflict = {
      conflictType: ConflictType.Legislation,
      demandCardId: 'deregulation',
      demandSlotIndex: 0,
      proposingOfficeIndex: 0,
      workingClassCards: [{ ...G.politicalOffices[0] }],
      capitalistCards: [],
      active: true,
      phase: ConflictPhase.Resolving,
      initiatingClass: SocialClass.WorkingClass,
      activeConflictPlayer: SocialClass.WorkingClass,
      workingClassPower: { diceCount: 0, establishedPower: 100 },
      capitalistPower: { diceCount: 0, establishedPower: 0 },
    };
    const client = clientFromFixture(G);
    client.moves.resolveConflict();

    const state = client.getStateOrThrow();
    expect(state.G.laws).toContain('deregulation');

    const nonEmpty = filterMap(state.G.workplaces, (w) => w === WorkplaceForSale ? undefined : w);
    const nonEmptyInitialWages = initialWages.filter((_, i) => G.workplaces[i] !== WorkplaceForSale);
    const nonEmptyInitialProfits = initialProfits.filter((_, i) => G.workplaces[i] !== WorkplaceForSale);
    nonEmpty.forEach((wp, i) => {
      expect(wp.wages).toBe(Math.max(1, nonEmptyInitialWages[i] - 1));
      expect(wp.profits).toBe(nonEmptyInitialProfits[i] + 1);
    });
  });
});

// ── Law effects in production ─────────────────────────────────────────────────

describe('law effects - wealth_tax', () => {
  test('wealth_tax halves wealth above $20 at production time', () => {
    const G = makeActionPhaseState();
    G.laws = ['wealth_tax'];
    G.turnPhase = TurnPhase.Production;
    G.players[SocialClass.WorkingClass].wealth = 25; // above threshold

    const client = clientFromFixture(G);

    // WC collects production (corner_store wages=2 + parts_producer wages=3 = 5)
    // wealth before: 25, after income: 30 → wealth_tax: floor(30/2) = 15
    client.moves.collectProduction();
    expect(client.getStateOrThrow().G.players[SocialClass.WorkingClass].wealth).toBe(15);
  });

  test('wealth_tax does not apply when wealth is exactly $20 after income', () => {
    const G = makeActionPhaseState();
    G.laws = ['wealth_tax'];
    G.turnPhase = TurnPhase.Production;
    G.players[SocialClass.WorkingClass].wealth = 15; // after +5 wages = 20, not > 20

    const client = clientFromFixture(G);

    client.moves.collectProduction();
    expect(client.getStateOrThrow().G.players[SocialClass.WorkingClass].wealth).toBe(20);
  });

  test('wealth_tax applies to both classes when WC collects production', () => {
    const G = makeActionPhaseState();
    G.laws = ['wealth_tax'];
    G.turnPhase = TurnPhase.Production;
    G.players[SocialClass.WorkingClass].wealth = 20;  // after +5 wages = 25 > 20 → floor(25/2) = 12
    G.players[SocialClass.CapitalistClass].wealth = 25; // also > 20 → floor(25/2) = 12

    const client = clientFromFixture(G);

    // wealth_tax checks both classes on every collectProduction call
    client.moves.collectProduction();
    const state = client.getStateOrThrow();
    expect(state.G.players[SocialClass.WorkingClass].wealth).toBe(12);
    expect(state.G.players[SocialClass.CapitalistClass].wealth).toBe(12);
  });
});
