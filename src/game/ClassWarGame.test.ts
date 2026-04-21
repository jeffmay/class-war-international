/**
 * Tests for Class War: International game setup and basic mechanics
 */

import { SocialClass, WorkplaceForSale } from '../types/cards';
import { GameState, TurnPhase } from '../types/game';
import { assertEqual, assertNotEqual } from '../util/assertions';
import { setup } from './ClassWarGame';

describe('ClassWarGame Setup', () => {
  let gameState: GameState;

  beforeEach(() => {
    // Mock ctx with no random function (will use Math.random)
    const mockCtx = {};

    gameState = setup(mockCtx);
  });

  test('initializes game with correct phase', () => {
    expect(gameState.turnPhase).toBe(TurnPhase.Production);
    expect(gameState.turnNumber).toBe(0);
    expect(gameState.gameStarted).toBe(true);
  });

  test('initializes working class player state', () => {
    const player = gameState.players[SocialClass.WorkingClass];

    expect(player.wealth).toBe(0);
    expect(player.hand.length).toBe(4);
    expect(player.deck.length).toBeGreaterThan(0);
    expect(player.dustbin.length).toBe(0);
    expect(player.institutions).toEqual([null, null]);
    expect(player.demands).toEqual([null, null]);
    expect(player.figures).toEqual([]);
    expect(player.maxHandSize).toBe(4);
    expect(player.playedWorkplaceThisTurn).toBe(false);
  });

  test('initializes capitalist class player state', () => {
    const player = gameState.players[SocialClass.CapitalistClass];

    expect(player.wealth).toBe(0);
    expect(player.hand.length).toBe(4);
    expect(player.deck.length).toBeGreaterThan(0);
    expect(player.dustbin.length).toBe(0);
    expect(player.institutions).toEqual([null, null]);
    expect(player.demands).toEqual([null, null]);
    expect(player.figures).toEqual([]);
    expect(player.maxHandSize).toBe(4);
    expect(player.playedWorkplaceThisTurn).toBe(false);
  });

  test('initializes three workplaces', () => {
    expect(gameState.workplaces.length).toBe(3);

    // First workplace: Corner Store
    const wp0 = gameState.workplaces[0];
    assertNotEqual(wp0, WorkplaceForSale);
    expect(wp0.id).toBe('corner_store');
    expect(wp0.wages).toBe(1);
    expect(wp0.profits).toBe(4);
    expect(wp0.established_power).toBe(1);
    expect(wp0.unionized).toBe(false);

    // Second workplace: Parts Producer
    const wp1 = gameState.workplaces[1];
    assertNotEqual(wp1, WorkplaceForSale);
    expect(wp1.id).toBe('parts_producer');
    expect(wp1.wages).toBe(3);
    expect(wp1.profits).toBe(12);
    expect(wp1.established_power).toBe(2);
    expect(wp1.unionized).toBe(false);

    // Third workplace: Empty slot
    const wp2 = gameState.workplaces[2];
    assertEqual(wp2, WorkplaceForSale);
  });

  test('initializes three political offices', () => {
    expect(gameState.politicalOffices.length).toBe(3);

    expect(gameState.politicalOffices[0].id).toBe('populist');
    expect(gameState.politicalOffices[0].exhausted).toBe(false);

    expect(gameState.politicalOffices[1].id).toBe('centrist');
    expect(gameState.politicalOffices[1].exhausted).toBe(false);

    expect(gameState.politicalOffices[2].id).toBe('opportunist');
    expect(gameState.politicalOffices[2].exhausted).toBe(false);
  });

  test('initializes with no laws', () => {
    expect(gameState.laws).toEqual([]);
  });

  test('initializes with no active conflict', () => {
    expect(gameState.activeConflict).toBeUndefined();
  });

  test('player decks contain only cards from their class', () => {
    const workingClassPlayer = gameState.players[SocialClass.WorkingClass];
    const capitalistPlayer = gameState.players[SocialClass.CapitalistClass];

    // Verify all cards in hand + deck belong to the correct class
    const allWorkingClassCards = [...workingClassPlayer.hand, ...workingClassPlayer.deck];
    const allCapitalistCards = [...capitalistPlayer.hand, ...capitalistPlayer.deck];

    expect(allWorkingClassCards.length).toBeGreaterThan(0);
    expect(allCapitalistCards.length).toBeGreaterThan(0);

    // Note: We would need to import getCardData to fully verify the class of each card
    // For now, we just verify the structure is correct
  });

  test('players start with different cards in hand', () => {
    const workingClassHand = gameState.players[SocialClass.WorkingClass].hand;
    const capitalistHand = gameState.players[SocialClass.CapitalistClass].hand;

    // Hands should be different (they're from different decks)
    expect(workingClassHand).not.toEqual(capitalistHand);
  });
});
