/**
 * Class War: International - boardgame.io game definition
 */

import { Game } from 'boardgame.io';
import { GameState, TurnPhase, PlayerState } from '../types/game';
import { SocialClass, StateFigureInPlay, WorkplaceInPlay } from '../types/cards';
import { defaultWorkplaces, defaultStateFigures, buildDeck } from '../data/cards';

/**
 * Shuffle an array in place using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[], random: () => number): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Initialize a player's state
 */
function createPlayerState(socialClass: SocialClass, random: () => number): PlayerState {
  const deck = buildDeck(socialClass);
  const shuffledDeck = shuffleArray(deck, random);

  // Deal initial hand (4 cards)
  const hand = shuffledDeck.slice(0, 4);
  const remainingDeck = shuffledDeck.slice(4);

  return {
    wealth: 0,
    hand,
    deck: remainingDeck,
    dustbin: [],
    institutions: [null, null], // 2 institution slots
    demands: [null, null], // 2 demand slots
    figures: [],
    maxHandSize: 4,
    playedWorkplaceThisTurn: false,
  };
}

/**
 * Setup function - initializes the game state
 */
export function setup(ctx: any): GameState {
  const random = ctx.random?.() ?? Math.random;

  // Initialize workplaces (3 slots: 2 default + 1 empty)
  const workplaces: WorkplaceInPlay[] = [
    {
      id: 'corner_store',
      wages: defaultWorkplaces.corner_store.starting_wages,
      profits: defaultWorkplaces.corner_store.starting_profits,
      established_power: defaultWorkplaces.corner_store.established_power,
      unionized: false,
    },
    {
      id: 'parts_producer',
      wages: defaultWorkplaces.parts_producer.starting_wages,
      profits: defaultWorkplaces.parts_producer.starting_profits,
      established_power: defaultWorkplaces.parts_producer.established_power,
      unionized: false,
    },
    {
      id: 'empty_slot_2',
      wages: 0,
      profits: 0,
      established_power: 0,
      unionized: false,
    },
  ];

  // Initialize political offices (3 state figures)
  const politicalOffices: StateFigureInPlay[] = [
    {
      id: 'populist',
      exhausted: false,
    },
    {
      id: 'centrist',
      exhausted: false,
    },
    {
      id: 'opportunist',
      exhausted: false,
    },
  ];

  return {
    turnPhase: TurnPhase.Production,
    turnNumber: 0,
    players: {
      [SocialClass.WorkingClass]: createPlayerState(SocialClass.WorkingClass, random),
      [SocialClass.CapitalistClass]: createPlayerState(SocialClass.CapitalistClass, random),
    },
    workplaces,
    politicalOffices,
    laws: [],
    gameStarted: true,
  };
}

/**
 * Class War: International game definition
 */
export const ClassWarGame: Game<GameState> = {
  name: 'class-war-international',

  setup,

  playerView: ({ G, playerID }) => {
    // Both players can see all game state (local play)
    return G;
  },

  turn: {
    onBegin: ({ G, ctx }) => {
      // Reset played workplace flag at start of turn
      const currentClass = ctx.currentPlayer === '0' ? SocialClass.WorkingClass : SocialClass.CapitalistClass;
      G.players[currentClass].playedWorkplaceThisTurn = false;
    },

    stages: {
      // Production Phase
      production: {
        moves: {},
      },
      // Action Phase
      action: {
        moves: {},
      },
      // Reproduction Phase
      reproduction: {
        moves: {},
      },
    },
  },

  moves: {},

  endIf: ({ G, ctx }) => {
    // Win conditions will be implemented later
    // For now, the game continues indefinitely
    return undefined;
  },
};
