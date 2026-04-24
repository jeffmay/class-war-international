/**
 * Tests for Group 6: Institution Effects
 */

import { CardType, SocialClass } from '../types/cards';
import { ConflictPhase, ConflictType } from '../types/conflicts';
import { playFigureCard, playInstitutionCard } from '../util/game';
import { clientFromFixture, DEFAULT_CC_INCOME_FROM_WORKPLACES, makeActionPhaseState } from './generate';

function advanceToCCAction(G: ReturnType<typeof makeActionPhaseState>) {
  const client = clientFromFixture(G);
  client.moves.endActionPhase();
  client.moves.endReproductionPhase();
  client.moves.collectProduction();
  return client;
}

// ── activist_organization ──────────────────────────────────────────────────────

describe('activist_organization - first figure needs no training', () => {
  test('first figure played enters without in_training when activist_org is in play', () => {
    const G = makeActionPhaseState({
      hand: ['cashier'],
      institutions: [playInstitutionCard('activist_organization'), null],
      wealth: 20,
    });
    const client = clientFromFixture(G);

    client.moves.playCardFromHand(0, 'figures[-1]');
    const state = client.getStateOrThrow();
    const cashier = state.G.players[SocialClass.WorkingClass].figures.find(f => f.id === 'cashier');
    expect(cashier).toBeDefined();
    expect(cashier!.in_training).toBe(false);
  });

  test('second figure played this turn still goes in_training even with activist_org', () => {
    const G = makeActionPhaseState({
      hand: ['cashier', 'agitator'],
      institutions: [playInstitutionCard('activist_organization'), null],
      wealth: 20,
    });
    const client = clientFromFixture(G);

    client.moves.playCardFromHand(0, 'figures[-1]'); // cashier — first figure, no training
    client.moves.playCardFromHand(0, 'figures[-1]'); // agitator — second figure, still in_training
    const state = client.getStateOrThrow();
    const agitator = state.G.players[SocialClass.WorkingClass].figures.find(f => f.id === 'agitator');
    expect(agitator!.in_training).toBe(true);
  });

  test('figures go in_training normally without activist_org', () => {
    const G = makeActionPhaseState({
      hand: ['cashier'],
      wealth: 20,
    });
    const client = clientFromFixture(G);

    client.moves.playCardFromHand(0, 'figures[-1]');
    const state = client.getStateOrThrow();
    expect(state.G.players[SocialClass.WorkingClass].figures.find(f => f.id === 'cashier')!.in_training).toBe(true);
  });
});

// ── tv_network ────────────────────────────────────────────────────────────────

describe('tv_network - opponent max hand size', () => {
  test('reduces opponent maxHandSize by 1 when played', () => {
    const initialWcHandSize = 4;
    const G = makeActionPhaseState(
      { maxHandSize: initialWcHandSize },
      { hand: ['tv_network', 'manager', 'hire_scabs', 'restructure'], deck: [], wealth: 20 - DEFAULT_CC_INCOME_FROM_WORKPLACES },
    );
    const client = advanceToCCAction(G);

    client.moves.playCardFromHand(0, 'institutions[-1]');
    const state = client.getStateOrThrow();
    expect(state.G.players[SocialClass.WorkingClass].maxHandSize).toBe(initialWcHandSize - 1);
  });

  test('restores opponent maxHandSize when tv_network is replaced', () => {
    // CC already has tv_network in slot 0
    const G = makeActionPhaseState(
      { maxHandSize: 3 }, // already reduced by existing tv_network
      { hand: ['tv_network', 'manager', 'hire_scabs', 'restructure'], deck: [], wealth: 20 - DEFAULT_CC_INCOME_FROM_WORKPLACES, institutions: [playInstitutionCard('tv_network'), null] },
    );
    const client = advanceToCCAction(G);

    // CC plays a second tv_network into slot 0 (replacing existing one)
    client.moves.playCardFromHand(0, 'institutions[0]');
    const state = client.getStateOrThrow();
    // Replacing restores +1 then reduces -1 → net 0 change from WC's perspective
    expect(state.G.players[SocialClass.WorkingClass].maxHandSize).toBe(3);
  });
});

// ── workers_party / capitalist_party ──────────────────────────────────────────

describe('workers_party activation - deck search', () => {
  test('workers_party first played moves first demand from deck to platform', () => {
    const G = makeActionPhaseState({
      hand: ['workers_party'],
      deck: ['wealth_tax'],
      wealth: 20,
    });
    const client = clientFromFixture(G);

    client.moves.playCardFromHand(0, 'institutions[-1]');
    const state = client.getStateOrThrow();
    expect(state.G.players[SocialClass.WorkingClass].demands.some(d => d?.id === 'wealth_tax')).toBe(true);
  });
});

describe('workers_party established power in elections', () => {
  test('workers_party adds established power to WC side in elections', () => {
    const candidate = playFigureCard('cashier', { in_training: false });
    const G = makeActionPhaseState({
      figures: [candidate],
      institutions: [playInstitutionCard('workers_party'), null],
    });

    G.activeConflict = {
      conflictType: ConflictType.Election,
      targetOfficeIndex: 0,
      targetIncumbent: { ...G.politicalOffices[0] },
      workingClassCards: [{ ...candidate }],
      capitalistCards: [],
      active: true,
      phase: ConflictPhase.Resolving,
      initiatingClass: SocialClass.WorkingClass,
      activeConflictPlayer: SocialClass.WorkingClass,
      workingClassPower: { diceCount: 0, establishedPower: 0 },
      capitalistPower: { diceCount: 0, establishedPower: 0 },
    };
    const client = clientFromFixture(G);
    client.moves.resolveConflict();

    const outcome = client.getStateOrThrow().G.conflictOutcome!;
    // workers_party has established_power: 1
    expect(outcome.workingClassPower.establishedPower).toBeGreaterThanOrEqual(1);
  });
});

describe('capitalist_party established power in legislation', () => {
  test('capitalist_party adds established power to CC side in legislation', () => {
    const G = makeActionPhaseState(
      undefined,
      { institutions: [playInstitutionCard('capitalist_party'), null] },
    );
    G.politicalOffices[0] = { ...playFigureCard('cashier') };

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
      // WC has huge power advantage; CC party should still add its EP
      workingClassPower: { diceCount: 0, establishedPower: 100 },
      capitalistPower: { diceCount: 0, establishedPower: 0 },
    };
    const client = clientFromFixture(G);
    client.moves.resolveConflict();

    const outcome = client.getStateOrThrow().G.conflictOutcome!;
    // capitalist_party has established_power: 1
    expect(outcome.capitalistPower.establishedPower).toBeGreaterThanOrEqual(1);
  });
});

// ── labor_council ─────────────────────────────────────────────────────────────

describe('labor_council in strikes', () => {
  test('labor_council adds its established power to WC strike score', () => {
    const wcCaptain = playFigureCard('cashier', { in_training: false });
    const G = makeActionPhaseState({ figures: [wcCaptain], institutions: [playInstitutionCard('labor_council'), null] });
    const workplace = G.workplaces[0] as Exclude<typeof G.workplaces[0], string>;
    workplace.established_power = 0; // remove workplace EP to isolate labor_council EP

    G.activeConflict = {
      conflictType: ConflictType.Strike,
      targetWorkplaceIndex: 0,
      targetWorkplace: { ...workplace },
      maxStrikeLeaders: 1,
      workingClassCards: [{ ...wcCaptain }],
      capitalistCards: [],
      active: true,
      phase: ConflictPhase.Resolving,
      initiatingClass: SocialClass.WorkingClass,
      activeConflictPlayer: SocialClass.WorkingClass,
      workingClassPower: { diceCount: 0, establishedPower: 0 },
      capitalistPower: { diceCount: 0, establishedPower: 0 },
    };
    const client = clientFromFixture(G);
    client.moves.resolveConflict();

    const outcome = client.getStateOrThrow().G.conflictOutcome!;
    // labor_council established_power: 1
    expect(outcome.workingClassPower.establishedPower).toBeGreaterThanOrEqual(1);
    expect(outcome.workingClassPower.total).toBeGreaterThanOrEqual(1);
  });

  test('labor_council win by 2+ unionizes workplace even with deregulation active', () => {
    const wcCaptain = playFigureCard('cashier', { in_training: false });
    const G = makeActionPhaseState({ figures: [wcCaptain], institutions: [playInstitutionCard('labor_council'), null] });
    G.laws = ['deregulation']; // deregulation active
    const workplace = G.workplaces[0] as Exclude<typeof G.workplaces[0], string>;
    workplace.established_power = 0;
    workplace.unionized = false;

    G.activeConflict = {
      conflictType: ConflictType.Strike,
      targetWorkplaceIndex: 0,
      targetWorkplace: { ...workplace },
      maxStrikeLeaders: 1,
      workingClassCards: [{ ...wcCaptain }],
      capitalistCards: [],
      active: true,
      phase: ConflictPhase.Resolving,
      initiatingClass: SocialClass.WorkingClass,
      activeConflictPlayer: SocialClass.WorkingClass,
      // WC wins by ≥2 margin via established power
      workingClassPower: { diceCount: 0, establishedPower: 10 },
      capitalistPower: { diceCount: 0, establishedPower: 0 },
    };
    const client = clientFromFixture(G);
    client.moves.resolveConflict();

    const state = client.getStateOrThrow();
    expect(state.G.conflictOutcome!.winner).toBe(SocialClass.WorkingClass);
    const wp = state.G.workplaces[0] as Exclude<typeof state.G.workplaces[0], string>;
    expect(wp.unionized).toBe(true);
  });
});

// ── hedge_fund ────────────────────────────────────────────────────────────────

describe('hedge_fund', () => {
  test('deposit moves wealth onto card (max 10)', () => {
    const G = makeActionPhaseState({
      institutions: [playInstitutionCard('hedge_fund'), null],
      wealth: 20,
    });
    const client = clientFromFixture(G);

    client.moves.hedgeFundAction('deposit', 7);
    const state = client.getStateOrThrow();
    const hedgeFund = state.G.players[SocialClass.WorkingClass].institutions.find(i => i?.id === 'hedge_fund');
    expect(hedgeFund?.storedWealth).toBe(7);
    expect(state.G.players[SocialClass.WorkingClass].wealth).toBe(13);
  });

  test('deposit is capped at 10 total', () => {
    const G = makeActionPhaseState({
      institutions: [{ id: 'hedge_fund' as const, card_type: CardType.Institution, in_play: true, storedWealth: 8 }, null],
      wealth: 20,
    });
    const client = clientFromFixture(G);

    client.moves.hedgeFundAction('deposit', 5); // only 2 more fits
    const state = client.getStateOrThrow();
    const hedgeFund = state.G.players[SocialClass.WorkingClass].institutions.find(i => i?.id === 'hedge_fund');
    expect(hedgeFund?.storedWealth).toBe(10);
    expect(state.G.players[SocialClass.WorkingClass].wealth).toBe(18);
  });

  test('withdraw returns stored wealth plus equal from bank', () => {
    const G = makeActionPhaseState({
      institutions: [{ id: 'hedge_fund' as const, card_type: CardType.Institution, in_play: true, storedWealth: 6 }, null],
      wealth: 5,
    });
    const client = clientFromFixture(G);

    client.moves.hedgeFundAction('withdraw');
    const state = client.getStateOrThrow();
    const hedgeFund = state.G.players[SocialClass.WorkingClass].institutions.find(i => i?.id === 'hedge_fund');
    expect(hedgeFund?.storedWealth).toBe(0);
    expect(state.G.players[SocialClass.WorkingClass].wealth).toBe(5 + 6 * 2); // 17
  });
});
