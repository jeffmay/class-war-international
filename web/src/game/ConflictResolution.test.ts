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
import { playDemandCard, playFigureCard, playTacticCard } from '../util/game';
import { clientFromFixture, makeActionPhaseState } from './generate';
import { vi } from 'vitest';

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

  test('can add a figure during Resolving phase', () => {
    const G = makeActionPhaseState({ figures: [readyWcFigure, secondWcFigure] });
    const client = clientFromFixture(G);
    client.moves.planStrike('cashier', 0);
    client.moves.initiateConflict();
    client.moves.planResponse(); // skip to Resolving
    expect(client.getStateOrThrow().G.activeConflict!.phase).toBe(ConflictPhase.Resolving);

    client.moves.addFigureToConflict('student_activist');
    expect(client.getStateOrThrow().G.activeConflict!.workingClassCards).toHaveLength(2);
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

  test('each die roll is a valid face side (0–5)', () => {
    // diceRolls stores face sides 0–5; sideToValue maps them to 0/1/2
    for (let i = 0; i < 20; i++) {
      const client = makeStrikeResolving();
      client.moves.resolveConflict();
      const outcome = client.getStateOrThrow().G.conflictOutcome!;
      for (const roll of [...outcome.workingClassPower.diceRolls, ...outcome.capitalistPower.diceRolls]) {
        expect([0, 1, 2, 3, 4, 5]).toContain(roll);
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

  test('resolves immediately when called from Responding phase', () => {
    const client = makeStrikeResponding();
    client.moves.resolveConflict();
    expect(client.getStateOrThrow().G.activeConflict).toBeUndefined();
    expect(client.getStateOrThrow().G.conflictOutcome).toBeDefined();
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
      const shifted = nonEmptyInitialWages[i] > 1 ? 1 : 0;
      expect(wp.wages).toBe(nonEmptyInitialWages[i] - shifted);
      expect(wp.profits).toBe(nonEmptyInitialProfits[i] + shifted);
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

    // WC collects production (corner_store wages=1 + parts_producer wages=3 = 4)
    // wealth before: 25, after income: 29 → wealth_tax: floor(29/2) = 14
    client.moves.collectProduction();
    expect(client.getStateOrThrow().G.players[SocialClass.WorkingClass].wealth).toBe(14);
  });

  test('wealth_tax does not apply when wealth is exactly $20 after income', () => {
    const G = makeActionPhaseState();
    G.laws = ['wealth_tax'];
    G.turnPhase = TurnPhase.Production;
    G.players[SocialClass.WorkingClass].wealth = 16; // after +4 wages = 20, not > 20

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

// ── Tactic conflict filtering (enabled_by_conflict) ───────────────────────────

describe('addTacticToConflict - enabled_by_conflict filtering', () => {
  test('rejects a strike-only tactic during an election conflict', () => {
    // union_drive is enabled only for Strike conflicts
    const wcDeck = buildDeck(SocialClass.WorkingClass);
    const hand: typeof wcDeck = ['union_drive', ...wcDeck.filter(id => id !== 'union_drive').slice(0, 3)];
    const deck = wcDeck.filter(id => !hand.includes(id));
    const candidate = playFigureCard('cashier', { in_training: false });
    const G = makeActionPhaseState({ figures: [candidate], hand, deck, wealth: 100 });
    const client = clientFromFixture(G);

    client.moves.planElection('cashier', 0);
    expect(client.getStateOrThrow().G.activeConflict?.conflictType).toBe(ConflictType.Election);

    client.moves.addTacticToConflict(0); // union_drive index 0
    const state = client.getStateOrThrow();

    // union_drive should be rejected — only the candidate is in the conflict
    expect(state.G.activeConflict!.workingClassCards).toHaveLength(1);
    expect(state.G.errorMessage).toContain('cannot be played');
  });

  test('accepts a tactic enabled for the active conflict type', () => {
    // propagandize is enabled for Strike, Election, and Legislation
    const wcDeck = buildDeck(SocialClass.WorkingClass);
    const hand: typeof wcDeck = ['propagandize', ...wcDeck.filter(id => id !== 'propagandize').slice(0, 3)];
    const deck = wcDeck.filter(id => !hand.includes(id));
    const candidate = playFigureCard('cashier', { in_training: false });
    const G = makeActionPhaseState({ figures: [candidate], hand, deck, wealth: 100 });
    const client = clientFromFixture(G);

    client.moves.planElection('cashier', 0);
    client.moves.addTacticToConflict(0); // propagandize at index 0
    const state = client.getStateOrThrow();

    expect(state.G.activeConflict!.workingClassCards).toHaveLength(2);
    expect(state.G.errorMessage).toBeUndefined();
  });
});

// ── Election: incumbent established power ─────────────────────────────────────

describe('resolveConflict - election incumbent power', () => {
  test('incumbent established power is added to the defending class', () => {
    const candidate = playFigureCard('cashier', { in_training: false });
    const G = makeActionPhaseState({ figures: [candidate] });

    // Office 0 holds a DefaultStateFigure with established_power: 1 (centrist has 3, populist 1)
    // We'll use office index 1 (centrist: established_power = 3) for a clear test.
    // WC is challenging so CC defends — centrist established_power goes to CC.
    G.activeConflict = {
      conflictType: ConflictType.Election,
      targetOfficeIndex: 1,
      targetIncumbent: { ...G.politicalOffices[1] },
      workingClassCards: [candidate],
      capitalistCards: [],
      active: true,
      phase: ConflictPhase.Resolving,
      initiatingClass: SocialClass.WorkingClass,
      activeConflictPlayer: SocialClass.WorkingClass,
      // Give WC overwhelming dice to determine the winner, but we can still check established power
      workingClassPower: { diceCount: 0, establishedPower: 0 },
      capitalistPower: { diceCount: 0, establishedPower: 0 },
    };
    const client = clientFromFixture(G);
    client.moves.resolveConflict();

    const outcome = client.getStateOrThrow().G.conflictOutcome!;
    // centrist has established_power: 3 and sides with CC (the defender when WC challenges)
    expect(outcome.capitalistPower.establishedPower).toBe(3);
    expect(outcome.workingClassPower.establishedPower).toBe(0);
  });

  test('incumbent power goes to WC when CC is the challenger', () => {
    const ccCandidate = playFigureCard('manager', { in_training: false });
    const G = makeActionPhaseState(undefined, { figures: [ccCandidate] });

    // CC challenges office 1 (centrist: established_power = 3), WC defends
    G.activeConflict = {
      conflictType: ConflictType.Election,
      targetOfficeIndex: 1,
      targetIncumbent: { ...G.politicalOffices[1] },
      workingClassCards: [],
      capitalistCards: [ccCandidate],
      active: true,
      phase: ConflictPhase.Resolving,
      initiatingClass: SocialClass.CapitalistClass,
      activeConflictPlayer: SocialClass.CapitalistClass,
      workingClassPower: { diceCount: 0, establishedPower: 0 },
      capitalistPower: { diceCount: 0, establishedPower: 0 },
    };
    const client = clientFromFixture(G);
    client.moves.resolveConflict();

    const outcome = client.getStateOrThrow().G.conflictOutcome!;
    expect(outcome.workingClassPower.establishedPower).toBe(3);
    expect(outcome.capitalistPower.establishedPower).toBe(0);
  });
});

// ── Conflict player-switching (multiplayer) ───────────────────────────────────

describe('conflict player switching via endTurn', () => {
  test('initiateConflict transfers currentPlayer to opposing player (0 → 1)', () => {
    const client = makeStrikeInitiating();
    // WC (player 0) is currentPlayer and initiated the strike
    expect(client.getStateOrThrow().ctx.currentPlayer).toBe('0');

    client.moves.initiateConflict();
    const state = client.getStateOrThrow();

    // activeConflictPlayer in game state should now be CC
    expect(state.G.activeConflict!.activeConflictPlayer).toBe(SocialClass.CapitalistClass);
    // boardgame.io currentPlayer should now be player '1' (CC is responding)
    expect(state.ctx.currentPlayer).toBe('1');
  });

  test('planResponse transfers currentPlayer back to initiating player (1 → 0)', () => {
    const client = makeStrikeResponding();
    // After initiateConflict, currentPlayer is now '1' (CC is responding)
    expect(client.getStateOrThrow().ctx.currentPlayer).toBe('1');

    client.moves.planResponse();
    const state = client.getStateOrThrow();

    // activeConflictPlayer in game state should be back to WC (initiator)
    expect(state.G.activeConflict!.activeConflictPlayer).toBe(SocialClass.WorkingClass);
    // boardgame.io currentPlayer should be back to WC '0'
    expect(state.ctx.currentPlayer).toBe('0');
  });
});

// ── Tactic conflict bonuses ───────────────────────────────────────────────────

describe('tactic bonus - call_the_police established power', () => {
  test('call_the_police adds 2 established power to score', () => {
    const wcCaptain = playFigureCard('cashier', { in_training: false });
    const ccTactic = { ...playTacticCard('call_the_police'), addedThisStep: false as const };
    const G = makeActionPhaseState({ figures: [wcCaptain] });

    G.activeConflict = {
      conflictType: ConflictType.Strike,
      targetWorkplaceIndex: 0,
      targetWorkplace: { ...(G.workplaces[0] as Exclude<typeof G.workplaces[0], string>) },
      maxStrikeLeaders: 1,
      workingClassCards: [{ ...wcCaptain }],
      capitalistCards: [ccTactic],
      active: true,
      phase: ConflictPhase.Resolving,
      initiatingClass: SocialClass.WorkingClass,
      activeConflictPlayer: SocialClass.WorkingClass,
      workingClassPower: { diceCount: 1, establishedPower: 0 },
      capitalistPower: { diceCount: 0, establishedPower: 2 },
    };

    const client = clientFromFixture(G);
    client.moves.resolveConflict();

    const outcome = client.getStateOrThrow().G.conflictOutcome!;
    // 2 from call_the_police + 1 from corner_store established_power = 3
    expect(outcome.capitalistPower.establishedPower).toBe(3);
  });
});

describe('tactic bonus - hire_scabs', () => {
  test('CC wins with hire_scabs: shifts $1 from wages to profits at the workplace', () => {
    const wcCaptain = playFigureCard('cashier', { in_training: false });
    const ccTactic = { ...playTacticCard('hire_scabs'), addedThisStep: false as const };
    const G = makeActionPhaseState({ figures: [wcCaptain] });
    const workplace = G.workplaces[1] as Exclude<typeof G.workplaces[0], string>; // parts_producer wages=3
    const initialWages = workplace.wages;

    G.activeConflict = {
      conflictType: ConflictType.Strike,
      targetWorkplaceIndex: 1,
      targetWorkplace: { ...workplace },
      maxStrikeLeaders: 1,
      workingClassCards: [{ ...wcCaptain }],
      capitalistCards: [ccTactic],
      active: true,
      phase: ConflictPhase.Resolving,
      initiatingClass: SocialClass.WorkingClass,
      activeConflictPlayer: SocialClass.WorkingClass,
      workingClassPower: { diceCount: 1, establishedPower: 0 },
      capitalistPower: { diceCount: 2, establishedPower: 0 },
    };

    // All dice roll 0 (value 0); workplace established_power breaks tie for CC
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const client = clientFromFixture(G);
    client.moves.resolveConflict();
    spy.mockRestore();

    const state = client.getStateOrThrow();
    expect(state.G.conflictOutcome!.winner).toBe(SocialClass.CapitalistClass);
    const wp = state.G.workplaces[1] as Exclude<typeof state.G.workplaces[1], string>;
    expect(wp.wages).toBe(initialWages - 1);
    expect(wp.profits).toBe(workplace.profits + 1);
  });
});

describe('tactic bonus - hire_private_security', () => {
  test('CC wins by 3+ with hire_private_security: WC captain put in dustbin', () => {
    const wcCaptain = playFigureCard('cashier', { in_training: false });
    const hps = { ...playTacticCard('hire_private_security'), addedThisStep: false as const };
    const G = makeActionPhaseState({ figures: [] }); // figure is in conflict, not player area

    G.activeConflict = {
      conflictType: ConflictType.Strike,
      targetWorkplaceIndex: 0,
      targetWorkplace: { ...(G.workplaces[0] as Exclude<typeof G.workplaces[0], string>) },
      maxStrikeLeaders: 1,
      workingClassCards: [{ ...wcCaptain }],
      capitalistCards: [hps],
      active: true,
      phase: ConflictPhase.Resolving,
      initiatingClass: SocialClass.WorkingClass,
      activeConflictPlayer: SocialClass.WorkingClass,
      workingClassPower: { diceCount: 1, establishedPower: 0 },
      capitalistPower: { diceCount: 3, establishedPower: 0 },
    };

    // All dice roll max (side 5, value 2): WC=2, CC=6+wp_power → margin ≥ 3
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const client = clientFromFixture(G);
    client.moves.resolveConflict();
    spy.mockRestore();

    const state = client.getStateOrThrow();
    expect(state.G.conflictOutcome!.winner).toBe(SocialClass.CapitalistClass);
    expect(state.G.players[SocialClass.WorkingClass].dustbin).toContain('cashier');
    expect(state.G.players[SocialClass.WorkingClass].figures.map(f => f.id)).not.toContain('cashier');
  });
});

describe('figure strike effect - cleaning_crew', () => {
  test('cleaning_crew in leader slot steals $1 from CC when WC loses', () => {
    const cleaningCrew = playFigureCard('cleaning_crew', { in_training: false });
    const G = makeActionPhaseState({ figures: [] });
    G.players[SocialClass.WorkingClass].wealth = 5;
    G.players[SocialClass.CapitalistClass].wealth = 10;

    G.activeConflict = {
      conflictType: ConflictType.Strike,
      targetWorkplaceIndex: 0,
      targetWorkplace: { ...(G.workplaces[0] as Exclude<typeof G.workplaces[0], string>) },
      maxStrikeLeaders: 1,
      workingClassCards: [{ ...cleaningCrew }],
      capitalistCards: [],
      active: true,
      phase: ConflictPhase.Resolving,
      initiatingClass: SocialClass.WorkingClass,
      activeConflictPlayer: SocialClass.WorkingClass,
      // CC wins via overwhelming established power
      workingClassPower: { diceCount: 0, establishedPower: 0 },
      capitalistPower: { diceCount: 0, establishedPower: 10 },
    };

    const client = clientFromFixture(G);
    client.moves.resolveConflict();

    const state = client.getStateOrThrow();
    expect(state.G.conflictOutcome!.winner).toBe(SocialClass.CapitalistClass);
    expect(state.G.players[SocialClass.CapitalistClass].wealth).toBe(9);
    expect(state.G.players[SocialClass.WorkingClass].wealth).toBe(6);
  });

  test('cleaning_crew does NOT steal when WC wins', () => {
    const cleaningCrew = playFigureCard('cleaning_crew', { in_training: false });
    const G = makeActionPhaseState({ figures: [] });
    G.players[SocialClass.WorkingClass].wealth = 5;
    G.players[SocialClass.CapitalistClass].wealth = 10;

    G.activeConflict = {
      conflictType: ConflictType.Strike,
      targetWorkplaceIndex: 0,
      targetWorkplace: { ...(G.workplaces[0] as Exclude<typeof G.workplaces[0], string>) },
      maxStrikeLeaders: 1,
      workingClassCards: [{ ...cleaningCrew }],
      capitalistCards: [],
      active: true,
      phase: ConflictPhase.Resolving,
      initiatingClass: SocialClass.WorkingClass,
      activeConflictPlayer: SocialClass.WorkingClass,
      workingClassPower: { diceCount: 0, establishedPower: 10 },
      capitalistPower: { diceCount: 0, establishedPower: 0 },
    };

    const client = clientFromFixture(G);
    client.moves.resolveConflict();

    const state = client.getStateOrThrow();
    expect(state.G.conflictOutcome!.winner).toBe(SocialClass.WorkingClass);
    expect(state.G.players[SocialClass.CapitalistClass].wealth).toBe(10);
    expect(state.G.players[SocialClass.WorkingClass].wealth).toBe(5);
  });
});

describe('figure strike effect - labor_organizer captain', () => {
  test('labor_organizer captain sets maxStrikeLeaders to 3', () => {
    const laborOrganizer = playFigureCard('labor_organizer', { in_training: false });
    const G = makeActionPhaseState({ figures: [laborOrganizer] });
    const client = clientFromFixture(G);

    client.moves.planStrike('labor_organizer', 0);

    const state = client.getStateOrThrow();
    expect(state.G.activeConflict).toBeDefined();
    expect((state.G.activeConflict as Extract<typeof state.G.activeConflict, { conflictType: ConflictType.Strike }>)?.maxStrikeLeaders).toBe(3);
  });

  test('non-labor_organizer captain sets maxStrikeLeaders to 1', () => {
    const cashier = playFigureCard('cashier', { in_training: false });
    const G = makeActionPhaseState({ figures: [cashier] });
    const client = clientFromFixture(G);

    client.moves.planStrike('cashier', 0);

    const state = client.getStateOrThrow();
    expect((state.G.activeConflict as Extract<typeof state.G.activeConflict, { conflictType: ConflictType.Strike }>)?.maxStrikeLeaders).toBe(1);
  });
});

describe('figure passive - birdie_feathers election', () => {
  test('birdie_feathers is not exhausted after winning an election', () => {
    const birdie = playFigureCard('birdie_feathers', { in_training: false });
    const G = makeActionPhaseState({ figures: [birdie] });

    G.activeConflict = {
      conflictType: ConflictType.Election,
      targetOfficeIndex: 0,
      targetIncumbent: { ...G.politicalOffices[0] },
      workingClassCards: [{ ...birdie }],
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
    expect(state.G.conflictOutcome!.winner).toBe(SocialClass.WorkingClass);
    // birdie_feathers should be in the office and not exhausted
    const officeCard = state.G.politicalOffices[0];
    expect(officeCard.id).toBe('birdie_feathers');
    expect(officeCard.exhausted).toBe(false);
  });

  test('birdie_feathers is not exhausted after losing an election', () => {
    const birdie = playFigureCard('birdie_feathers', { in_training: false });
    const G = makeActionPhaseState({ figures: [birdie] });

    G.activeConflict = {
      conflictType: ConflictType.Election,
      targetOfficeIndex: 0,
      targetIncumbent: { ...G.politicalOffices[0] },
      workingClassCards: [{ ...birdie }],
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

    const state = client.getStateOrThrow();
    expect(state.G.conflictOutcome!.winner).toBe(SocialClass.CapitalistClass);
    // birdie_feathers loses and is returned to hand but NOT exhausted
    const birdieInFigures = state.G.players[SocialClass.WorkingClass].figures.find(f => f.id === 'birdie_feathers');
    expect(birdieInFigures).toBeDefined();
    expect(birdieInFigures!.exhausted).toBe(false);
  });
});

describe('figure passive - barnyard_rustin tie-breaking', () => {
  test('barnyard_rustin in WC cards converts a strike tie to WC victory', () => {
    const barnyardRustin = playFigureCard('barnyard_rustin', { in_training: false });
    const G = makeActionPhaseState({ figures: [] });
    // Zero out workplace established_power so CC gets no bonus from it
    const workplace = G.workplaces[0] as Exclude<typeof G.workplaces[0], string>;
    workplace.established_power = 0;

    G.activeConflict = {
      conflictType: ConflictType.Strike,
      targetWorkplaceIndex: 0,
      targetWorkplace: { ...workplace },
      maxStrikeLeaders: 1,
      workingClassCards: [{ ...barnyardRustin }],
      capitalistCards: [],
      active: true,
      phase: ConflictPhase.Resolving,
      initiatingClass: SocialClass.WorkingClass,
      activeConflictPlayer: SocialClass.WorkingClass,
      // Equal power → tie
      workingClassPower: { diceCount: 0, establishedPower: 5 },
      capitalistPower: { diceCount: 0, establishedPower: 5 },
    };

    const client = clientFromFixture(G);
    client.moves.resolveConflict();

    expect(client.getStateOrThrow().G.conflictOutcome!.winner).toBe(SocialClass.WorkingClass);
  });

  test('barnyard_rustin converts a legislation tie to WC victory', () => {
    const barnyardRustin = { ...playFigureCard('barnyard_rustin', { in_training: false }), card_type: CardType.Figure as const };
    const G = makeActionPhaseState({});
    G.politicalOffices[0] = { ...playFigureCard('cashier') };

    G.activeConflict = {
      conflictType: ConflictType.Legislation,
      demandCardId: 'wealth_tax',
      demandSlotIndex: 0,
      proposingOfficeIndex: 0,
      workingClassCards: [{ ...G.politicalOffices[0] }, { ...barnyardRustin }],
      capitalistCards: [],
      active: true,
      phase: ConflictPhase.Resolving,
      initiatingClass: SocialClass.WorkingClass,
      activeConflictPlayer: SocialClass.WorkingClass,
      workingClassPower: { diceCount: 0, establishedPower: 5 },
      capitalistPower: { diceCount: 0, establishedPower: 5 },
    };

    const client = clientFromFixture(G);
    client.moves.resolveConflict();

    expect(client.getStateOrThrow().G.conflictOutcome!.winner).toBe(SocialClass.WorkingClass);
    expect(client.getStateOrThrow().G.laws).toContain('wealth_tax');
  });
});

describe('tactic bonus - canvass', () => {
  test('canvass contributes 1 extra die per participating figure', () => {
    const fig1 = playFigureCard('cashier', { in_training: false });
    const fig2 = playFigureCard('cleaning_crew', { in_training: false });
    const canvass = { ...playTacticCard('canvass'), addedThisStep: false as const };
    const G = makeActionPhaseState({ figures: [fig1, fig2] });

    G.activeConflict = {
      conflictType: ConflictType.Strike,
      targetWorkplaceIndex: 0,
      targetWorkplace: { ...(G.workplaces[0] as Exclude<typeof G.workplaces[0], string>) },
      maxStrikeLeaders: 1,
      workingClassCards: [{ ...fig1 }, { ...fig2 }, canvass],
      capitalistCards: [],
      active: true,
      phase: ConflictPhase.Resolving,
      initiatingClass: SocialClass.WorkingClass,
      activeConflictPlayer: SocialClass.WorkingClass,
      // 2 figures (1 die each) + canvass (2 extra dice for 2 figures) = 4 total
      workingClassPower: { diceCount: 4, establishedPower: 0 },
      capitalistPower: { diceCount: 0, establishedPower: 0 },
    };

    const client = clientFromFixture(G);
    client.moves.resolveConflict();

    const outcome = client.getStateOrThrow().G.conflictOutcome!;
    expect(outcome.workingClassPower.diceCount).toBe(4);
    expect(outcome.workingClassPower.diceRolls).toHaveLength(4);
  });
});
