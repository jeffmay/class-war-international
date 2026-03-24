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

import { buildDeck, getCardData } from '../data/cards';
import { CardType, SocialClass, type FigureCardInPlay } from '../types/cards';
import { TurnPhase } from '../types/game';
import {
  clientFromFixture,
  makeActionPhaseState,
  withCardInHand,
  withCardsInHand,
} from './generate';

describe('Action Phase - Playing Cards', () => {
  describe('playFigure', () => {
    test('successfully plays a figure card from hand', () => {
      // Pre-conditions: Action phase, WC has 'cashier' (cost $2) in hand,
      // wealth is $10 (well above cost).
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardInHand(wcDeck, 'cashier');
      const G = makeActionPhaseState({ wealth: 10, hand, deck });
      const client = clientFromFixture(G);

      const state = client.getState();
      if (!state) return;

      const player = state.G.players[SocialClass.WorkingClass];
      const initialHandSize = player.hand.length;
      const initialWealth = player.wealth;

      expect(player.hand[0]).toBe('cashier');
      expect(getCardData('cashier').card_type).toBe(CardType.Figure);
      expect(initialWealth).toBeGreaterThanOrEqual(getCardData('cashier').cost);

      client.moves.playFigure('cashier');
      const newState = client.getState();
      if (!newState) return;

      const newPlayer = newState.G.players[SocialClass.WorkingClass];

      // Drew a replacement – hand size is unchanged
      expect(newPlayer.hand.length).toBe(initialHandSize);

      // Figure is now in play
      const played = newPlayer.figures.find(f => f.id === 'cashier');
      expect(played).toBeDefined();
      expect(played?.in_training).toBe(true);
      expect(played?.exhausted).toBe(false);

      // Cost deducted
      expect(newPlayer.wealth).toBe(initialWealth - getCardData('cashier').cost);
    });

    test('cannot play figure without enough wealth', () => {
      // Pre-conditions: Action phase, WC has 'cashier' (cost $2) in hand but
      // wealth is set to $1 (one below the card's cost).
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardInHand(wcDeck, 'cashier');
      const cashierCost = getCardData('cashier').cost;
      const G = makeActionPhaseState({ wealth: cashierCost - 1, hand, deck });
      const client = clientFromFixture(G);

      const state = client.getState();
      if (!state) return;

      const player = state.G.players[SocialClass.WorkingClass];
      expect(player.hand[0]).toBe('cashier');
      expect(player.wealth).toBe(cashierCost - 1);

      client.moves.playFigure('cashier');
      const newState = client.getState();
      if (!newState) return;

      const newPlayer = newState.G.players[SocialClass.WorkingClass];

      // Move was rejected – nothing changed
      expect(newPlayer.figures.length).toBe(0);
      expect(newPlayer.hand[0]).toBe('cashier');
      expect(newPlayer.wealth).toBe(cashierCost - 1);
    });

    test('cannot play figure from hand that player does not have', () => {
      // Pre-conditions: Action phase, WC is the current player.
      const G = makeActionPhaseState({ wealth: 10 });
      const client = clientFromFixture(G);

      const state = client.getState();
      if (!state) return;

      const player = state.G.players[SocialClass.WorkingClass];
      const initialHandSize = player.hand.length;

      client.moves.playFigure('nonexistent_card_id');
      const newState = client.getState();
      if (!newState) return;

      const newPlayer = newState.G.players[SocialClass.WorkingClass];

      // Nothing changed
      expect(newPlayer.hand.length).toBe(initialHandSize);
      expect(newPlayer.figures.length).toBe(0);
    });

    test('cannot play figure outside Action phase', () => {
      // Pre-conditions: WC is in Reproduction phase (Action phase already ended).
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardInHand(wcDeck, 'cashier');
      const G = makeActionPhaseState({ wealth: 10, hand, deck });
      const client = clientFromFixture(G);

      client.moves.endActionPhase();

      const state = client.getState();
      if (!state) return;

      expect(state.G.turnPhase).toBe(TurnPhase.Reproduction);
      const initialFigures = state.G.players[SocialClass.WorkingClass].figures.length;

      client.moves.playFigure('cashier');
      const newState = client.getState();
      if (!newState) return;

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
        exhausted: false,
        in_training: true,
      };
      const G = makeActionPhaseState({ figures: [figureInPlay], hand, deck });
      const client = clientFromFixture(G);

      const state = client.getState();
      if (!state) return;

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
      client.moves.endReproductionPhase('1');

      // Back to Working Class – in_training should be cleared
      const finalState = client.getState();
      if (!finalState) return;

      const finalFigure = finalState.G.players[SocialClass.WorkingClass].figures.find(
        f => f.id === 'cashier',
      );
      expect(finalFigure).toBeDefined();
      expect(finalFigure?.in_training).toBe(false);
    });

    test('draws replacement card when playing figure', () => {
      // Pre-conditions: Action phase, WC has 'cashier' in hand, deck has cards
      // remaining so a replacement can be drawn.
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardInHand(wcDeck, 'cashier');
      const G = makeActionPhaseState({ wealth: 10, hand, deck });
      const client = clientFromFixture(G);

      const state = client.getState();
      if (!state) return;

      const player = state.G.players[SocialClass.WorkingClass];
      const initialHandSize = player.hand.length;
      const initialDeckSize = player.deck.length;

      expect(player.hand[0]).toBe('cashier');

      client.moves.playFigure('cashier');
      const newState = client.getState();
      if (!newState) return;

      const newPlayer = newState.G.players[SocialClass.WorkingClass];

      // Hand size is maintained (one card drawn to replace)
      expect(newPlayer.hand.length).toBe(initialHandSize);
      // Deck shrank by one
      expect(newPlayer.deck.length).toBe(initialDeckSize - 1);
      // Figure is in play
      expect(newPlayer.figures.find(f => f.id === 'cashier')).toBeDefined();
    });

    test('multiple figures can be played in same turn if affordable', () => {
      // Pre-conditions: Action phase, WC hand has two 'cashier' cards (each
      // costs $2), wealth is $10 (covers both).
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardsInHand(wcDeck, ['cashier', 'cashier']);
      const G = makeActionPhaseState({ wealth: 10, hand, deck });
      const client = clientFromFixture(G);

      const state = client.getState();
      if (!state) return;

      const player = state.G.players[SocialClass.WorkingClass];
      expect(player.hand[0]).toBe('cashier');
      expect(player.hand[1]).toBe('cashier');

      // Play first cashier
      client.moves.playFigure('cashier');
      let currentState = client.getState();
      if (!currentState) return;
      expect(currentState.G.players[SocialClass.WorkingClass].figures.length).toBe(1);

      // Play second cashier
      client.moves.playFigure('cashier');
      currentState = client.getState();
      if (!currentState) return;
      expect(currentState.G.players[SocialClass.WorkingClass].figures.length).toBe(2);
    });
  });
});
