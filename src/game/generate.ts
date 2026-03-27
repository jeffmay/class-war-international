/**
 * Game state generators for use in tests.
 *
 * Helpers here build deterministic GameState / PlayerState values from the
 * real card database so generated fixtures stay in sync with production code.
 * None of these functions shuffle or otherwise randomise state.
 */

import { buildDeck, DeckCardID } from '../data/cards';
import { SocialClass } from '../types/cards';
import { type GameState, type PlayerState, TurnPhase } from '../types/game';
import { ClassWarGame, Moves, setup } from './ClassWarGame';
import { StrictClient, type StrictClientOf, type StrictGameOf } from '../util/typedboardgame';

/**
 * Builds a PlayerState for the given class using the unshuffled deck from
 * buildDeck(). The first 4 cards become the hand; the rest stay in the deck.
 * Pass `overrides` to set specific pre-conditions (e.g. a particular hand,
 * wealth amount, or figures already in play).
 */
export function makePlayerState(
  socialClass: SocialClass,
  overrides?: Partial<PlayerState>,
): PlayerState {
  const deck = buildDeck(socialClass);
  return {
    wealth: 0,
    hand: deck.slice(0, 4),
    deck: deck.slice(4),
    dustbin: [],
    institutions: [null, null],
    demands: [null, null],
    figures: [],
    maxHandSize: 4,
    theorizeLimit: 1,
    playedWorkplaceThisTurn: false,
    ...overrides,
  };
}

/**
 * Builds a full GameState in the Action phase. Workplaces and political
 * offices are taken from setup() so they stay in sync with production code.
 * Player states are generated via makePlayerState().
 */
export function makeActionPhaseState(
  wcOverrides?: Partial<PlayerState>,
  ccOverrides?: Partial<PlayerState>,
): GameState {
  const base = setup({});
  return {
    ...base,
    turnPhase: TurnPhase.Action,
    players: {
      [SocialClass.WorkingClass]: makePlayerState(SocialClass.WorkingClass, wcOverrides),
      [SocialClass.CapitalistClass]: makePlayerState(SocialClass.CapitalistClass, ccOverrides),
    },
  };
}

/**
 * Returns a hand/deck split for the given full deck that guarantees `cardId`
 * is in position 0 of the hand. One instance of `cardId` is moved to the
 * front; the remaining cards fill the rest of the hand (up to 4) and deck.
 *
 * Throws if `cardId` is not present in `fullDeck`.
 */
export function withCardInHand(
  fullDeck: DeckCardID[],
  cardId: DeckCardID,
): { hand: DeckCardID[]; deck: DeckCardID[] } {
  const cardIdx = fullDeck.indexOf(cardId);
  if (cardIdx === -1) {
    throw new Error(`Card "${cardId}" not found in deck`);
  }
  const remaining = [...fullDeck.slice(0, cardIdx), ...fullDeck.slice(cardIdx + 1)];
  return {
    hand: [cardId, ...remaining.slice(0, 3)],
    deck: remaining.slice(3),
  };
}

/**
 * Returns a hand/deck split that guarantees each card in `cardIds` (in order)
 * occupies the first positions of the hand. One instance of each card ID is
 * removed from the deck; remaining cards fill the rest of the hand and deck.
 *
 * Throws if any card ID is not present in the remaining deck at the time it
 * is processed (so duplicates are safe as long as enough copies exist).
 */
export function withCardsInHand(
  fullDeck: DeckCardID[],
  cardIds: DeckCardID[],
): { hand: DeckCardID[]; deck: DeckCardID[] } {
  let remaining = [...fullDeck];
  const handFront: DeckCardID[] = [];

  for (const cardId of cardIds) {
    const idx = remaining.indexOf(cardId);
    if (idx === -1) {
      throw new Error(`Card "${cardId}" not found in remaining deck`);
    }
    handFront.push(cardId);
    remaining = [...remaining.slice(0, idx), ...remaining.slice(idx + 1)];
  }

  const fillCount = 4 - handFront.length;
  return {
    hand: [...handFront, ...remaining.slice(0, fillCount)],
    deck: remaining.slice(fillCount),
  };
}

/**
 * Creates a StrictClient that starts from the provided GameState fixture
 * instead of a randomly-shuffled initial state.
 */
export function clientFromFixture(G: GameState): StrictClientOf<typeof ClassWarGame> {
  const gameWithFixture: StrictGameOf<typeof Moves> = {
    ...ClassWarGame,
    setup: () => G,
  };
  const client = StrictClient({
    game: gameWithFixture,
    numPlayers: 2,
  });
  client.start();
  return client;
}
