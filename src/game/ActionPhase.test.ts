/**
 * Tests for Action Phase mechanics - Playing cards
 *
 * Every test builds its own GameState fixture that explicitly satisfies the
 * test's pre-conditions, so no test is ever skipped or branched on randomly
 * generated values (e.g. deck shuffle order).
 *
 * Hand/deck arrangements are assembled per-test using buildDeck() and the
 * withCardInHand / withCardsInHand helpers from generate.ts.
 */

import { allCards, buildDeck, defaultWorkplaceCards } from '../data/cards';
import { CardType, SocialClass, type FigureCardInPlay } from '../types/cards';
import { TurnPhase } from '../types/game';
import {
  clientFromFixture,
  makeCCActionPhaseClient,
  makeActionPhaseState,
  withCardInHand,
  withCardsInHand,
  DEFAULT_CC_INCOME_FROM_WORKPLACES as CC_INCOME,
} from './generate';

describe('Action Phase - Playing Cards', () => {
  describe('playCardFromHand - figure cards', () => {
    test('successfully plays a figure card from hand', () => {
      // Pre-conditions: Action phase, WC has 'cashier' (cost $2) in hand,
      // wealth is $10 (well above cost).
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardInHand(wcDeck, 'cashier');
      const G = makeActionPhaseState({ wealth: 10, hand, deck });
      const client = clientFromFixture(G);

      const state = client.getStateOrThrow();
      const player = state.G.players[SocialClass.WorkingClass];
      const initialHandSize = player.hand.length;
      const initialWealth = player.wealth;

      expect(player.hand[0]).toBe('cashier');
      expect(allCards.cashier.card_type).toBe(CardType.Figure);
      expect(initialWealth).toBeGreaterThanOrEqual(allCards.cashier.cost);

      client.moves.playCardFromHand(0, 'figures[-1]');
      const newState = client.getStateOrThrow();
      const newPlayer = newState.G.players[SocialClass.WorkingClass];

      // Figure is removed from the player's hand
      expect(newPlayer.hand.length).toBe(initialHandSize - 1);

      // Figure is now in play
      const played = newPlayer.figures.find(f => f.id === 'cashier');
      expect(played).toBeDefined();
      expect(played?.in_training).toBe(true);
      expect(played?.exhausted).toBe(false);

      // Cost deducted
      expect(newPlayer.wealth).toBe(initialWealth - allCards.cashier.cost);
    });

    test('cannot play figure without enough wealth', () => {
      // Pre-conditions: Action phase, WC has 'cashier' (cost $2) in hand but
      // wealth is set to $1 (one below the card's cost).
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardInHand(wcDeck, 'cashier');
      const cashierCost = allCards.cashier.cost;
      const G = makeActionPhaseState({ wealth: cashierCost - 1, hand, deck });
      const client = clientFromFixture(G);

      const state = client.getStateOrThrow();
      const player = state.G.players[SocialClass.WorkingClass];
      expect(player.hand[0]).toBe('cashier');
      expect(player.wealth).toBe(cashierCost - 1);

      client.moves.playCardFromHand(0, 'figures[-1]');
      const newState = client.getStateOrThrow();
      const newPlayer = newState.G.players[SocialClass.WorkingClass];

      // Move was rejected – nothing changed
      expect(newPlayer.figures.length).toBe(0);
      expect(newPlayer.hand[0]).toBe('cashier');
      expect(newPlayer.wealth).toBe(cashierCost - 1);
    });

    test('cannot play card at invalid hand index', () => {
      // Pre-conditions: Action phase, WC is the current player.
      const G = makeActionPhaseState({ wealth: 10 });
      const client = clientFromFixture(G);

      const state = client.getStateOrThrow();
      const player = state.G.players[SocialClass.WorkingClass];
      const initialHandSize = player.hand.length;

      client.moves.playCardFromHand(999, 'figures[-1]'); // out of bounds
      const newState = client.getStateOrThrow();
      const newPlayer = newState.G.players[SocialClass.WorkingClass];

      // Nothing changed
      expect(newPlayer.hand.length).toBe(initialHandSize);
      expect(newPlayer.figures.length).toBe(0);
    });

    test('cannot play card with mismatched slot type', () => {
      // Demand card played to figures slot — should be rejected
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardInHand(wcDeck, 'wealth_tax');
      const G = makeActionPhaseState({ hand, deck });
      const client = clientFromFixture(G);

      expect(client.getStateOrThrow().G.players[SocialClass.WorkingClass].hand[0]).toBe('wealth_tax');

      client.moves.playCardFromHand(0, 'figures[-1]');
      const newState = client.getStateOrThrow();
      const newPlayer = newState.G.players[SocialClass.WorkingClass];

      expect(newPlayer.figures.length).toBe(0);
      expect(newPlayer.hand[0]).toBe('wealth_tax');
    });

    test('cannot play figure outside Action phase', () => {
      // Pre-conditions: WC is in Reproduction phase (Action phase already ended).
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardInHand(wcDeck, 'cashier');
      const G = makeActionPhaseState({ wealth: 10, hand, deck });
      const client = clientFromFixture(G);

      client.moves.endActionPhase();

      const state = client.getStateOrThrow();
      expect(state.G.turnPhase).toBe(TurnPhase.Reproduction);
      const initialFigures = state.G.players[SocialClass.WorkingClass].figures.length;

      client.moves.playCardFromHand(0, 'figures[-1]');
      const newState = client.getStateOrThrow();
      // Move was rejected – figure count unchanged
      expect(newState.G.players[SocialClass.WorkingClass].figures.length).toBe(initialFigures);
    });

    test('figures lose in_training status at end of reproduction phase', () => {
      // Pre-conditions: Action phase, WC already has a 'cashier' figure in play
      // with in_training=true (simulating a card played earlier this turn).
      // One 'cashier' copy is reserved for figures; the rest form hand/deck.
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardInHand(wcDeck, 'cashier');
      const figureInPlay: FigureCardInPlay = {
        id: 'cashier',
        card_type: CardType.Figure,
        in_play: true,
        exhausted: false,
        in_training: true,
      };
      const G = makeActionPhaseState({ figures: [figureInPlay], hand, deck });
      const client = clientFromFixture(G);

      const state = client.getStateOrThrow();
      const initialFigure = state.G.players[SocialClass.WorkingClass].figures.find(
        f => f.id === 'cashier',
      );
      expect(initialFigure).toBeDefined();
      expect(initialFigure?.in_training).toBe(true);

      // End WC's turn
      client.moves.endActionPhase();
      client.moves.endReproductionPhase();

      // Complete Capitalist's full turn
      client.moves.collectProduction('1');
      client.moves.endActionPhase('1');
      client.moves.endReproductionPhase();

      // Back to Working Class – in_training should be cleared
      const finalState = client.getStateOrThrow();
      const finalFigure = finalState.G.players[SocialClass.WorkingClass].figures.find(
        f => f.id === 'cashier',
      );
      expect(finalFigure).toBeDefined();
      expect(finalFigure?.in_training).toBe(false);
    });

    test('multiple figures can be played in same turn if affordable', () => {
      // Pre-conditions: Action phase, WC hand has two 'cashier' cards (each
      // costs $2), wealth is $10 (covers both).
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardsInHand(wcDeck, ['cashier', 'cashier']);
      const G = makeActionPhaseState({ wealth: 10, hand, deck });
      const client = clientFromFixture(G);

      const state = client.getStateOrThrow();
      const player = state.G.players[SocialClass.WorkingClass];
      expect(player.hand[0]).toBe('cashier');
      expect(player.hand[1]).toBe('cashier');

      // Play first cashier (index 0)
      client.moves.playCardFromHand(0, 'figures[-1]');
      let currentState = client.getStateOrThrow();
      expect(currentState.G.players[SocialClass.WorkingClass].figures.length).toBe(1);

      // Play second cashier (now at index 0 after removal)
      client.moves.playCardFromHand(0, 'figures[-1]');
      currentState = client.getStateOrThrow();
      expect(currentState.G.players[SocialClass.WorkingClass].figures.length).toBe(2);
    });
  });

  describe('playCardFromHand - demand cards', () => {
    test('successfully plays a demand to slot 0 when both slots empty', () => {
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardInHand(wcDeck, 'wealth_tax');
      const G = makeActionPhaseState({ hand, deck });
      const client = clientFromFixture(G);

      expect(client.getStateOrThrow().G.players[SocialClass.WorkingClass].hand[0]).toBe('wealth_tax');
      expect(client.getStateOrThrow().G.players[SocialClass.WorkingClass].demands[0]).toBeNull();

      client.moves.playCardFromHand(0, 'demands[-1]');
      const newState = client.getStateOrThrow();
      const newPlayer = newState.G.players[SocialClass.WorkingClass];

      expect(newPlayer.demands[0]).toEqual({ id: 'wealth_tax', card_type: CardType.Demand, in_play: true });
      expect(newPlayer.hand).not.toContain('wealth_tax');
    });

    test('successfully plays a demand to slot 1', () => {
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardInHand(wcDeck, 'wealth_tax');
      const G = makeActionPhaseState({ hand, deck });
      const client = clientFromFixture(G);

      client.moves.playCardFromHand(0, 'demands[1]');
      const newPlayer = client.getStateOrThrow().G.players[SocialClass.WorkingClass];

      expect(newPlayer.demands[1]).toEqual({ id: 'wealth_tax', card_type: CardType.Demand, in_play: true });
      expect(newPlayer.demands[0]).toBeNull();
    });

    test('replaces existing demand and moves it to dustbin', () => {
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardsInHand(wcDeck, ['wealth_tax', 'free_health_care']);
      const G = makeActionPhaseState({ hand, deck });
      const client = clientFromFixture(G);

      // Play wealth_tax to slot 0
      client.moves.playCardFromHand(0, 'demands[0]');
      expect(client.getStateOrThrow().G.players[SocialClass.WorkingClass].demands[0]?.id).toBe('wealth_tax');

      // Play free_health_care to slot 0, replacing wealth_tax
      client.moves.playCardFromHand(0, 'demands[0]');
      const newPlayer = client.getStateOrThrow().G.players[SocialClass.WorkingClass];

      expect(newPlayer.demands[0]).toEqual({ id: 'free_health_care', card_type: CardType.Demand, in_play: true });
      expect(newPlayer.dustbin).toContain('wealth_tax');
    });

    test('cannot play demand with invalid slot index', () => {
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardInHand(wcDeck, 'wealth_tax');
      const G = makeActionPhaseState({ hand, deck });
      const client = clientFromFixture(G);

      client.moves.playCardFromHand(0, 'demands[5]');
      const newPlayer = client.getStateOrThrow().G.players[SocialClass.WorkingClass];

      expect(newPlayer.demands[0]).toBeNull();
      expect(newPlayer.hand).toContain('wealth_tax');
    });
  });

  describe('playCardFromHand - institution cards', () => {
    test('successfully plays an institution to slot 0 when both slots empty', () => {
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardInHand(wcDeck, 'political_education_group');
      const institutionCost = allCards.political_education_group.cost;
      const G = makeActionPhaseState({ wealth: institutionCost, hand, deck });
      const client = clientFromFixture(G);

      const initialMaxHandSize = client.getStateOrThrow().G.players[SocialClass.WorkingClass].maxHandSize;

      client.moves.playCardFromHand(0, 'institutions[-1]');
      const newPlayer = client.getStateOrThrow().G.players[SocialClass.WorkingClass];

      expect(newPlayer.institutions[0]).toEqual({
        id: 'political_education_group',
        card_type: CardType.Institution,
        in_play: true,
      });
      expect(newPlayer.hand).not.toContain('political_education_group');
      expect(newPlayer.wealth).toBe(0);
      // "When first played" effect: max hand size increases by 1
      expect(newPlayer.maxHandSize).toBe(initialMaxHandSize + 1);
    });

    test('cannot play institution without enough wealth', () => {
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardInHand(wcDeck, 'political_education_group');
      const institutionCost = allCards.political_education_group.cost;
      const G = makeActionPhaseState({ wealth: institutionCost - 1, hand, deck });
      const client = clientFromFixture(G);

      client.moves.playCardFromHand(0, 'institutions[0]');
      const newPlayer = client.getStateOrThrow().G.players[SocialClass.WorkingClass];

      expect(newPlayer.institutions[0]).toBeNull();
      expect(newPlayer.hand).toContain('political_education_group');
    });

    test('replaces existing institution and moves it to dustbin', () => {
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardsInHand(wcDeck, ['political_education_group', 'political_education_group']);
      const institutionCost = allCards.political_education_group.cost;
      const G = makeActionPhaseState({ wealth: institutionCost * 2, hand, deck });
      const client = clientFromFixture(G);

      // Play first to slot 0
      client.moves.playCardFromHand(0, 'institutions[0]');
      expect(client.getStateOrThrow().G.players[SocialClass.WorkingClass].institutions[0]?.id).toBe('political_education_group');

      // Play second to slot 0, replacing the first
      client.moves.playCardFromHand(0, 'institutions[0]');
      const newPlayer = client.getStateOrThrow().G.players[SocialClass.WorkingClass];

      expect(newPlayer.institutions[0]).toEqual({
        id: 'political_education_group',
        card_type: CardType.Institution,
        in_play: true,
      });
      expect(newPlayer.dustbin).toContain('political_education_group');
    });
  });

  describe('playCardFromHand - workplace cards', () => {
    // Workplace cards belong to CC (player '1').
    // Use makeCCActionPhaseClient so currentPlayer === '1' when moves are made.

    test('opens a new workplace in the empty slot', () => {
      // Pre-conditions: CC has 'fast_food_chain' (cost $10) in hand.
      // CC starts with $0 wealth and collects CC_INCOME ($15) from production.
      // Default board has one empty slot (index 2).
      const ccDeck = buildDeck(SocialClass.CapitalistClass);
      const { hand, deck } = withCardInHand(ccDeck, 'fast_food_chain');
      const cost = allCards.fast_food_chain.cost;
      const client = makeCCActionPhaseClient(0, { hand, deck });

      const state = client.getStateOrThrow();
      const ccPlayer = state.G.players[SocialClass.CapitalistClass];
      expect(ccPlayer.hand[0]).toBe('fast_food_chain');
      expect(ccPlayer.wealth).toBe(CC_INCOME);
      expect(state.G.workplaces[2].id).toMatch(/^empty/);

      client.moves.playCardFromHand(0, 'workplaces[-1]');
      const newState = client.getStateOrThrow();
      const newCcPlayer = newState.G.players[SocialClass.CapitalistClass];

      // Card removed from hand and cost deducted
      expect(newCcPlayer.hand).not.toContain('fast_food_chain');
      expect(newCcPlayer.wealth).toBe(CC_INCOME - cost);

      // Workplace slot filled with new card
      const newWp = newState.G.workplaces[2];
      expect(newWp.workplaceId).toBe('fast_food_chain');
      expect(newWp.wages).toBe(allCards.fast_food_chain.starting_wages);
      expect(newWp.profits).toBe(allCards.fast_food_chain.starting_profits);
      expect(newWp.established_power).toBe(allCards.fast_food_chain.established_power);
    });

    test('cannot open new workplace without enough wealth', () => {
      // superstore costs $20; CC_INCOME is $15, so CC can never afford it from a $0 start.
      const ccDeck = buildDeck(SocialClass.CapitalistClass);
      const { hand, deck } = withCardInHand(ccDeck, 'superstore');
      const cost = allCards.superstore.cost;
      const client = makeCCActionPhaseClient(0, { hand, deck });

      const state = client.getStateOrThrow();
      expect(state.G.players[SocialClass.CapitalistClass].wealth).toBe(CC_INCOME);
      expect(CC_INCOME).toBeLessThan(cost); // sanity check

      client.moves.playCardFromHand(0, 'workplaces[-1]');
      const newState = client.getStateOrThrow();
      const newCcPlayer = newState.G.players[SocialClass.CapitalistClass];

      // Move rejected — nothing changed
      expect(newCcPlayer.hand[0]).toBe('superstore');
      expect(newCcPlayer.wealth).toBe(CC_INCOME);
      expect(newState.G.workplaces[2].id).toMatch(/^empty/);
    });

    test('cannot open new workplace when no empty slots exist', () => {
      // Fill the empty slot (index 2) before handing to the client
      const ccDeck = buildDeck(SocialClass.CapitalistClass);
      const { hand, deck } = withCardInHand(ccDeck, 'fast_food_chain');
      const G = makeActionPhaseState(undefined, { wealth: 30, hand, deck });
      G.workplaces[2] = {
        id: 'extra_corner_store',
        wages: defaultWorkplaceCards.corner_store.starting_wages,
        profits: defaultWorkplaceCards.corner_store.starting_profits,
        established_power: defaultWorkplaceCards.corner_store.established_power,
        unionized: false,
      };
      const client = clientFromFixture(G);
      // Advance through WC's turn so currentPlayer === '1'
      client.moves.endActionPhase();
      client.moves.endReproductionPhase();
      client.moves.collectProduction();

      const state = client.getStateOrThrow();
      expect(state.G.workplaces.every(w => !w.id.startsWith('empty'))).toBe(true);

      client.moves.playCardFromHand(0, 'workplaces[-1]');
      const newState = client.getStateOrThrow();
      const newCcPlayer = newState.G.players[SocialClass.CapitalistClass];

      // Move rejected — hand and workplaces unchanged
      expect(newCcPlayer.hand[0]).toBe('fast_food_chain');
      expect(newState.G.workplaces.every(w => !w.id.startsWith('empty'))).toBe(true);
    });

    test('replaces an existing workplace and moves old workplaceId to dustbin', () => {
      // Play fast_food_chain ($10) to the empty slot, then replace it with superstore ($20).
      // CC_INCOME ($15) covers fast_food_chain; add extra pre-income wealth to cover superstore.
      const ccDeck = buildDeck(SocialClass.CapitalistClass);
      const { hand, deck } = withCardsInHand(ccDeck, ['fast_food_chain', 'superstore']);
      // Start with enough pre-income wealth that after CC_INCOME we can afford both cards
      const client = makeCCActionPhaseClient(
        allCards.fast_food_chain.cost + allCards.superstore.cost,
        { hand, deck },
      );

      // Play fast_food_chain into the empty slot (index 2)
      client.moves.playCardFromHand(0, 'workplaces[-1]');
      expect(client.getStateOrThrow().G.workplaces[2].workplaceId).toBe('fast_food_chain');

      // Now replace slot 2 with superstore
      client.moves.playCardFromHand(0, 'workplaces[2]');
      const newState = client.getStateOrThrow();
      const newCcPlayer = newState.G.players[SocialClass.CapitalistClass];

      expect(newState.G.workplaces[2].workplaceId).toBe('superstore');
      expect(newState.G.workplaces[2].wages).toBe(allCards.superstore.starting_wages);
      expect(newState.G.workplaces[2].profits).toBe(allCards.superstore.starting_profits);
      // Old card goes to dustbin
      expect(newCcPlayer.dustbin).toContain('fast_food_chain');
    });

    test('replacing a default workplace (no workplaceId) does not add to dustbin', () => {
      // Default workplaces (corner_store, parts_producer) have no workplaceId.
      // CC_INCOME ($15) > fast_food_chain cost ($10), so $0 pre-income is fine.
      const ccDeck = buildDeck(SocialClass.CapitalistClass);
      const { hand, deck } = withCardInHand(ccDeck, 'fast_food_chain');
      const client = makeCCActionPhaseClient(0, { hand, deck });

      // Replace the corner_store (index 0, no workplaceId) with fast_food_chain
      client.moves.playCardFromHand(0, 'workplaces[0]');
      const newState = client.getStateOrThrow();
      const newCcPlayer = newState.G.players[SocialClass.CapitalistClass];

      expect(newState.G.workplaces[0].workplaceId).toBe('fast_food_chain');
      // No card in dustbin since the replaced workplace had no workplaceId
      expect(newCcPlayer.dustbin).not.toContain('corner_store');
    });

    test('expands an existing workplace — stacks wages, profits, established_power, and increments expansionCount', () => {
      // Two fast_food_chain cards at $10 each. CC_INCOME ($15) < $20 total,
      // so start with enough pre-income wealth to cover both.
      const ccDeck = buildDeck(SocialClass.CapitalistClass);
      const { hand, deck } = withCardsInHand(ccDeck, ['fast_food_chain', 'fast_food_chain']);
      const cost = allCards.fast_food_chain.cost;
      const client = makeCCActionPhaseClient(cost, { hand, deck });
      // After CC_INCOME: wealth = cost + CC_INCOME; after first play: CC_INCOME; after expand: CC_INCOME - cost

      // Play fast_food_chain into empty slot (index 2)
      client.moves.playCardFromHand(0, 'workplaces[-1]');
      const afterOpen = client.getStateOrThrow().G.workplaces[2];
      const baseWages = afterOpen.wages;
      const baseProfits = afterOpen.profits;
      const baseEstablishedPower = afterOpen.established_power;
      expect(afterOpen.expansionCount).toBeUndefined();

      // Expand slot 2 with the second fast_food_chain
      client.moves.playCardFromHand(0, 'workplaces[2]/expand');
      const newState = client.getStateOrThrow();
      const expandedWp = newState.G.workplaces[2];
      const newCcPlayer = newState.G.players[SocialClass.CapitalistClass];

      expect(expandedWp.wages).toBe(baseWages + allCards.fast_food_chain.starting_wages);
      expect(expandedWp.profits).toBe(baseProfits + allCards.fast_food_chain.starting_profits);
      expect(expandedWp.established_power).toBe(baseEstablishedPower + allCards.fast_food_chain.established_power);
      expect(expandedWp.expansionCount).toBe(1);
      // Card consumed (goes to dustbin)
      expect(newCcPlayer.dustbin).toContain('fast_food_chain');
      expect(newCcPlayer.hand).not.toContain('fast_food_chain');
    });

    test('cannot expand an empty workplace slot', () => {
      // CC_INCOME ($15) > fast_food_chain cost ($10), $0 pre-income is fine.
      const ccDeck = buildDeck(SocialClass.CapitalistClass);
      const { hand, deck } = withCardInHand(ccDeck, 'fast_food_chain');
      const client = makeCCActionPhaseClient(0, { hand, deck });

      // Attempt to expand the empty slot (index 2) — should be rejected
      client.moves.playCardFromHand(0, 'workplaces[2]/expand');
      const newState = client.getStateOrThrow();
      const newCcPlayer = newState.G.players[SocialClass.CapitalistClass];

      expect(newCcPlayer.hand[0]).toBe('fast_food_chain');
      expect(newState.G.workplaces[2].id).toMatch(/^empty/);
    });

    test('cannot expand workplace without enough wealth', () => {
      // Use superstore ($20): after CC_INCOME ($15) CC has $15, not enough to expand.
      // First play superstore by giving enough pre-income wealth, then attempt expand
      // with a second superstore card when wealth is insufficient.
      const ccDeck = buildDeck(SocialClass.CapitalistClass);
      const { hand, deck } = withCardsInHand(ccDeck, ['superstore', 'superstore']);
      const cost = allCards.superstore.cost; // $20
      // Pre-income wealth = cost so after CC_INCOME ($15) we have cost + CC_INCOME = $35;
      // after first play we have $15 (CC_INCOME), which is less than cost ($20).
      const client = makeCCActionPhaseClient(cost, { hand, deck });

      // Play first superstore to fill the empty slot
      client.moves.playCardFromHand(0, 'workplaces[-1]');
      const afterOpen = client.getStateOrThrow();
      const ccAfterOpen = afterOpen.G.players[SocialClass.CapitalistClass];
      // Remaining wealth = CC_INCOME = $15, which is less than $20
      expect(ccAfterOpen.wealth).toBe(CC_INCOME);
      expect(CC_INCOME).toBeLessThan(cost); // sanity check

      // Attempt expand — should be rejected
      client.moves.playCardFromHand(0, 'workplaces[2]/expand');
      const newState = client.getStateOrThrow();
      const newCcPlayer = newState.G.players[SocialClass.CapitalistClass];

      // Hand still has the card and wealth unchanged
      expect(newCcPlayer.hand[0]).toBe('superstore');
      expect(newCcPlayer.wealth).toBe(CC_INCOME);
      expect(newState.G.workplaces[2].expansionCount).toBeUndefined();
    });
  });
});
