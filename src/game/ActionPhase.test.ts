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

import { allCards, buildDeck } from '../data/cards';
import { CardType, SocialClass, type FigureCardInPlay } from '../types/cards';
import { TurnPhase } from '../types/game';
import {
  clientFromFixture,
  makeActionPhaseState,
  withCardInHand,
  withCardsInHand,
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
});
