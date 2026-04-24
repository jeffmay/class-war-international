/**
 * Tests for Group 3: Figure Activation Effects
 *
 * When a figure is played, many figures trigger "when first played" effects.
 * Simple effects fire immediately; choice-based effects set pendingActivation
 * and require a follow-up move.
 */

import { SocialClass } from '../types/cards';
import { playDemandCard } from '../util/game';
import { clientFromFixture, DEFAULT_CC_INCOME_FROM_WORKPLACES, makeActionPhaseState } from './generate';

// Helper: advance from WC's Action phase to CC's Action phase.
// Sets G with given WC/CC overrides, then advances turns.
function advanceToCCAction(G: ReturnType<typeof makeActionPhaseState>) {
  const client = clientFromFixture(G);
  client.moves.endActionPhase();
  client.moves.endReproductionPhase();
  client.moves.collectProduction();
  return client;
}

// ── trust_fund_kid ────────────────────────────────────────────────────────────

describe('trust_fund_kid cost reduction', () => {
  test('trust_fund_kid costs 0 after CC builds a workplace the same turn', () => {
    // fast_food_chain costs 10, trust_fund_kid costs 13 (0 after workplace).
    // CC needs 10+ wealth. After collectProduction, CC gains DEFAULT_CC_INCOME from workplaces.
    const G = makeActionPhaseState(
      undefined,
      { hand: ['fast_food_chain', 'trust_fund_kid', 'manager', 'consultant'], deck: [], wealth: 0 },
    );
    const client = advanceToCCAction(G);
    // After production, CC has DEFAULT_CC_INCOME_FROM_WORKPLACES wealth (15)
    expect(client.getStateOrThrow().G.players[SocialClass.CapitalistClass].wealth).toBe(DEFAULT_CC_INCOME_FROM_WORKPLACES);

    client.moves.playCardFromHand(0, 'workplaces[-1]'); // fast_food_chain costs 10 → wealth = 5
    const afterWp = client.getStateOrThrow();
    expect(afterWp.G.players[SocialClass.CapitalistClass].playedWorkplaceThisTurn).toBe(true);

    client.moves.playCardFromHand(0, 'figures[-1]'); // trust_fund_kid costs 0 → wealth stays 5
    const afterFigure = client.getStateOrThrow();
    expect(afterFigure.G.players[SocialClass.CapitalistClass].figures.some(f => f.id === 'trust_fund_kid')).toBe(true);
    expect(afterFigure.G.players[SocialClass.CapitalistClass].wealth).toBe(DEFAULT_CC_INCOME_FROM_WORKPLACES - 10);
  });

  test('trust_fund_kid fails when no workplace was built and wealth insufficient', () => {
    // 12 total wealth after production — enough for consultant (12) but not trust_fund_kid (13)
    const initialWealth = 12 - DEFAULT_CC_INCOME_FROM_WORKPLACES;
    const G = makeActionPhaseState(
      undefined,
      { hand: ['trust_fund_kid', 'manager', 'consultant', 'hire_scabs'], deck: [], wealth: initialWealth },
    );
    const client = advanceToCCAction(G);
    expect(client.getStateOrThrow().G.players[SocialClass.CapitalistClass].wealth).toBe(12);

    client.moves.playCardFromHand(0, 'figures[-1]'); // trust_fund_kid costs 13 — not enough
    const state = client.getStateOrThrow();
    expect(state.G.players[SocialClass.CapitalistClass].figures.some(f => f.id === 'trust_fund_kid')).toBe(false);
  });
});

// ── student_activist ──────────────────────────────────────────────────────────

describe('student_activist activation', () => {
  test('student_activist moves first demand from deck to platform', () => {
    // Use a minimal deck with exactly one demand so the search is deterministic
    const G = makeActionPhaseState({
      hand: ['student_activist'],
      deck: ['wealth_tax'], // only one demand in deck
      wealth: 10,
    });
    const client = clientFromFixture(G);

    client.moves.playCardFromHand(0, 'figures[-1]');
    const state = client.getStateOrThrow();

    expect(state.G.players[SocialClass.WorkingClass].demands.some(d => d?.id === 'wealth_tax')).toBe(true);
    expect(state.G.players[SocialClass.WorkingClass].deck).not.toContain('wealth_tax');
  });

  test('student_activist does nothing if no demands in deck', () => {
    const G = makeActionPhaseState({
      hand: ['student_activist'],
      deck: [], // empty deck — no demands to find
      wealth: 10,
    });
    const client = clientFromFixture(G);

    client.moves.playCardFromHand(0, 'figures[-1]');
    const state = client.getStateOrThrow();
    expect(state.G.players[SocialClass.WorkingClass].demands).toEqual([null, null]);
  });

  test('student_activist returns demand to top of deck if platform is full', () => {
    const G = makeActionPhaseState({
      hand: ['student_activist'],
      deck: ['wealth_tax'],
      demands: [playDemandCard('free_health_care'), playDemandCard('jobs_program')],
      wealth: 10,
    });
    const client = clientFromFixture(G);

    client.moves.playCardFromHand(0, 'figures[-1]');
    const state = client.getStateOrThrow();
    // Platform full → demand goes back to top of deck
    expect(state.G.players[SocialClass.WorkingClass].deck[0]).toBe('wealth_tax');
  });
});

// ── rosa_luxembear ────────────────────────────────────────────────────────────

describe('rosa_luxembear activation', () => {
  test('sets pendingActivation when dustbin has a tactic', () => {
    const G = makeActionPhaseState({
      hand: ['rosa_luxembear'],
      dustbin: ['canvass'],
      wealth: 10,
    });
    const client = clientFromFixture(G);

    client.moves.playCardFromHand(0, 'figures[-1]');
    const state = client.getStateOrThrow();
    expect(state.G.pendingActivation?.type).toBe('rosa_luxembear');
  });

  test('rosaRetrieveTactic moves selected tactic from dustbin to hand', () => {
    const G = makeActionPhaseState({
      hand: ['rosa_luxembear'],
      dustbin: ['canvass', 'propagandize'],
      wealth: 10,
    });
    const client = clientFromFixture(G);

    client.moves.playCardFromHand(0, 'figures[-1]');
    client.moves.rosaRetrieveTactic(0); // pick canvass

    const state = client.getStateOrThrow();
    expect(state.G.pendingActivation).toBeUndefined();
    expect(state.G.players[SocialClass.WorkingClass].hand).toContain('canvass');
    expect(state.G.players[SocialClass.WorkingClass].dustbin).not.toContain('canvass');
    expect(state.G.players[SocialClass.WorkingClass].dustbin).toContain('propagandize');
  });

  test('rosaRetrieveTactic rejects non-tactic dustbin index', () => {
    const G = makeActionPhaseState({
      hand: ['rosa_luxembear'],
      dustbin: ['wealth_tax', 'canvass'], // demand then tactic
      wealth: 10,
    });
    const client = clientFromFixture(G);

    client.moves.playCardFromHand(0, 'figures[-1]');
    client.moves.rosaRetrieveTactic(0); // wealth_tax is not a tactic

    const state = client.getStateOrThrow();
    expect(state.G.pendingActivation?.type).toBe('rosa_luxembear');
    expect(state.G.errorMessage).toBeDefined();
  });
});

// ── barx_and_eagels ───────────────────────────────────────────────────────────

describe('barx_and_eagels activation', () => {
  test('moves first demand from deck to top (deck has only that demand)', () => {
    const G = makeActionPhaseState({
      hand: ['barx_and_eagels'],
      deck: ['wealth_tax'], // only one card — a demand
      wealth: 20,
    });
    const client = clientFromFixture(G);

    client.moves.playCardFromHand(0, 'figures[-1]');
    const state = client.getStateOrThrow();
    // wealth_tax moved to top (it was already at position 0 in a 1-card deck, now still there)
    expect(state.G.players[SocialClass.WorkingClass].deck[0]).toBe('wealth_tax');
  });

  test('finds demand or institution buried in deck and moves to top', () => {
    // Deck: two non-matching cards then a demand
    const G = makeActionPhaseState({
      hand: ['barx_and_eagels'],
      deck: ['cashier', 'agitator', 'wealth_tax'], // figures then demand
      wealth: 20,
    });
    const client = clientFromFixture(G);

    client.moves.playCardFromHand(0, 'figures[-1]');
    const state = client.getStateOrThrow();
    expect(state.G.players[SocialClass.WorkingClass].deck[0]).toBe('wealth_tax');
  });
});

// ── steve_amphibannon ─────────────────────────────────────────────────────────

describe('steve_amphibannon activation', () => {
  // steve_amphibannon costs 20; CC needs 20 wealth after production (gains 15, so start with 5)
  const STEVE_INITIAL_WEALTH = 20 - DEFAULT_CC_INCOME_FROM_WORKPLACES;

  test('moves demand from deck to top of deck', () => {
    const G = makeActionPhaseState(
      undefined,
      { hand: ['steve_amphibannon', 'manager', 'consultant', 'hire_scabs'], deck: ['tax_breaks'], wealth: STEVE_INITIAL_WEALTH },
    );
    const client = advanceToCCAction(G);

    client.moves.playCardFromHand(0, 'figures[-1]');
    const state = client.getStateOrThrow();
    expect(state.G.players[SocialClass.CapitalistClass].deck[0]).toBe('tax_breaks');
  });

  test('retrieves demand from dustbin to top of deck when deck has none', () => {
    const G = makeActionPhaseState(
      undefined,
      { hand: ['steve_amphibannon', 'manager', 'consultant', 'hire_scabs'], deck: [], dustbin: ['tax_breaks'], wealth: STEVE_INITIAL_WEALTH },
    );
    const client = advanceToCCAction(G);

    client.moves.playCardFromHand(0, 'figures[-1]');
    const state = client.getStateOrThrow();
    expect(state.G.players[SocialClass.CapitalistClass].deck[0]).toBe('tax_breaks');
    expect(state.G.players[SocialClass.CapitalistClass].dustbin).not.toContain('tax_breaks');
  });
});

// ── nelson_crockafeller ───────────────────────────────────────────────────────

describe('nelson_crockafeller activation', () => {
  // nelson_crockafeller costs 36; CC needs 36 after production (gains 15, so start with 21)
  const NELSON_INITIAL_WEALTH = 36 - DEFAULT_CC_INCOME_FROM_WORKPLACES;

  test('moves first institution or workplace from deck to top', () => {
    // Deck: two non-matching cards then an institution
    const G = makeActionPhaseState(
      undefined,
      { hand: ['nelson_crockafeller', 'manager', 'consultant', 'hire_scabs'], deck: ['hire_scabs', 'manager', 'think_tank'], wealth: NELSON_INITIAL_WEALTH },
    );
    const client = advanceToCCAction(G);

    client.moves.playCardFromHand(0, 'figures[-1]');
    const state = client.getStateOrThrow();
    expect(state.G.players[SocialClass.CapitalistClass].deck[0]).toBe('think_tank');
  });
});

// ── sheryl_sandbar ────────────────────────────────────────────────────────────

describe('sheryl_sandbar activation', () => {
  // sheryl_sandbar costs 24; CC needs 24 after production (gains 15, so start with 9)
  const SHERYL_INITIAL_WEALTH = 24 - DEFAULT_CC_INCOME_FROM_WORKPLACES;

  test('sets pendingActivation when opponent has hand cards', () => {
    const G = makeActionPhaseState(
      { hand: ['canvass', 'propagandize', 'general_strike', 'mass_rally'], deck: [] },
      { hand: ['sheryl_sandbar', 'manager', 'consultant', 'hire_scabs'], deck: [], wealth: SHERYL_INITIAL_WEALTH },
    );
    const client = advanceToCCAction(G);

    client.moves.playCardFromHand(0, 'figures[-1]');
    const state = client.getStateOrThrow();
    expect(state.G.pendingActivation?.type).toBe('sheryl_sandbar');
  });

  test('sherylDiscardCard moves chosen opponent card to their dustbin', () => {
    const G = makeActionPhaseState(
      { hand: ['canvass', 'propagandize', 'general_strike', 'mass_rally'], deck: [] },
      { hand: ['sheryl_sandbar', 'manager', 'consultant', 'hire_scabs'], deck: [], wealth: SHERYL_INITIAL_WEALTH },
    );
    const client = advanceToCCAction(G);

    client.moves.playCardFromHand(0, 'figures[-1]'); // sheryl_sandbar
    // WC hand is [canvass, propagandize, general_strike, mass_rally]
    // sherylDiscardCard(0) discards WC's hand[0] = canvass
    client.moves.sherylDiscardCard(0);

    const state = client.getStateOrThrow();
    expect(state.G.pendingActivation).toBeUndefined();
    expect(state.G.players[SocialClass.WorkingClass].dustbin).toContain('canvass');
    expect(state.G.players[SocialClass.WorkingClass].hand).not.toContain('canvass');
    expect(state.G.players[SocialClass.WorkingClass].hand).toHaveLength(3);
  });
});

// ── consultant ────────────────────────────────────────────────────────────────

describe('consultant activation', () => {
  // consultant costs 12; CC gains 15 from production, so starting wealth 0 is fine

  test('sets pendingActivation when played', () => {
    const G = makeActionPhaseState(
      undefined,
      { hand: ['consultant', 'manager', 'hire_scabs', 'restructure'], deck: [], wealth: 0 },
    );
    const client = advanceToCCAction(G);

    client.moves.playCardFromHand(0, 'figures[-1]');
    const state = client.getStateOrThrow();
    expect(state.G.pendingActivation?.type).toBe('consultant_choose');
  });

  test('wage_shift option reduces wages and increases profits at workplace', () => {
    const G = makeActionPhaseState(
      undefined,
      { hand: ['consultant', 'manager', 'hire_scabs', 'restructure'], deck: [], wealth: 0 },
    );
    const workplace = G.workplaces[0] as Exclude<typeof G.workplaces[0], string>;
    const initialWages = workplace.wages;
    const initialProfits = workplace.profits;
    const client = advanceToCCAction(G);

    client.moves.playCardFromHand(0, 'figures[-1]');
    client.moves.consultantChoose('wage_shift', 0);

    const state = client.getStateOrThrow();
    expect(state.G.pendingActivation).toBeUndefined();
    if (initialWages > 1) {
      const wp = state.G.workplaces[0] as Exclude<typeof state.G.workplaces[0], string>;
      expect(wp.wages).toBe(initialWages - 1);
      expect(wp.profits).toBe(initialProfits + 1);
    }
  });

  test('discard option makes WC discard 2 cards via consultantDiscard', () => {
    const G = makeActionPhaseState(
      { hand: ['canvass', 'propagandize', 'general_strike', 'mass_rally'], deck: [] },
      { hand: ['consultant', 'manager', 'hire_scabs', 'restructure'], deck: [], wealth: 0 },
    );
    const client = advanceToCCAction(G);

    client.moves.playCardFromHand(0, 'figures[-1]');
    client.moves.consultantChoose('discard');

    const stateAfterChoose = client.getStateOrThrow();
    expect(stateAfterChoose.G.pendingActivation?.type).toBe('consultant_discard');

    client.moves.consultantDiscard(0);
    const stateAfter1 = client.getStateOrThrow();
    expect(stateAfter1.G.pendingActivation?.type).toBe('consultant_discard');

    client.moves.consultantDiscard(0);
    const stateAfter2 = client.getStateOrThrow();
    expect(stateAfter2.G.pendingActivation).toBeUndefined();
    // WC started with 4 cards, should have 2 after 2 discards
    expect(stateAfter2.G.players[SocialClass.WorkingClass].hand).toHaveLength(2);
    expect(stateAfter2.G.players[SocialClass.WorkingClass].dustbin).toHaveLength(2);
  });
});
