/**
 * Class War: International - boardgame.io game definition
 */

import { type MoveMap } from 'boardgame.io';
import { buildDeck, defaultWorkplaces, getCardData } from '../data/cards';
import { CardType, type DemandCardInPlay, type FigureCardInPlay, type InstitutionCardInPlay, SocialClass, type StateFigureInPlay, type WorkplaceInPlay } from '../types/cards';
import { ConflictPhase, ConflictType, type ElectionConflictState, type PowerStats, type StrikeConflictState } from '../types/conflicts';
import { type GameState, type PlayerState, TurnPhase } from '../types/game';
import { type StrictGameOf } from '../util/typedboardgame';

/**
 * Compute the power contribution of a set of figure cards.
 * Figures contribute dice; established_power from workplaces/institutions
 * is added at resolution time.
 */
function powerStats(figures: FigureCardInPlay[]): PowerStats {
  let diceCount = 0;
  for (const figure of figures) {
    const data = getCardData(figure.id);
    if (data.card_type === CardType.Figure) {
      diceCount += data.dice;
    }
  }
  return { diceCount, establishedPower: 0 };
}

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
 * Draw cards from deck to fill hand up to max hand size
 */
function drawCards(player: PlayerState): void {
  while (player.hand.length < player.maxHandSize && player.deck.length > 0) {
    const card = player.deck.shift();
    if (card) {
      player.hand.push(card);
    }
  }
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
    theorizeLimit: 1,
    playedWorkplaceThisTurn: false,
  };
}

export const Moves = {

  /**
   * Play a card from hand to a target slot.
   *
   * @param handIndex - Index of the card in the player's hand
   * @param targetSlot - Destination slot, e.g. "figures[-1]", "demands[0]", "institutions[1]"
   *
   * For figures, use index -1 to append to the figures array.
   * For demands and institutions, use index 0 or 1 to target a specific slot;
   * if a card already occupies that slot it is moved to the dustbin.
   */
  playCardFromHand: ({ G, playerID }, handIndex: number, targetSlot: string) => {
    if (G.turnPhase !== TurnPhase.Action) return;

    const currentClass = playerID === '0' ? SocialClass.WorkingClass : SocialClass.CapitalistClass;
    const player = G.players[currentClass];

    if (handIndex < 0 || handIndex >= player.hand.length) return;

    const cardId = player.hand[handIndex];
    const cardData = getCardData(cardId);

    const slotMatch = targetSlot.match(/^(figures|demands|institutions)\[(-?\d+)\]$/);
    if (!slotMatch) return;
    const slotType = slotMatch[1] as 'figures' | 'demands' | 'institutions';
    const slotIndex = parseInt(slotMatch[2], 10);

    if (slotType === 'figures') {
      if (cardData.card_type !== CardType.Figure) return;
      if (player.wealth < cardData.cost) return;

      player.wealth -= cardData.cost;
      player.hand.splice(handIndex, 1);

      const figureInPlay: FigureCardInPlay = {
        id: cardId,
        card_type: CardType.Figure,
        exhausted: false,
        in_training: true,
      };
      player.figures.push(figureInPlay);

    } else if (slotType === 'demands') {
      if (cardData.card_type !== CardType.Demand) return;

      let resolvedDemandIndex = slotIndex;
      if (slotIndex === -1) {
        resolvedDemandIndex = player.demands.findIndex(s => s === null);
        if (resolvedDemandIndex === -1) return; // no empty slot
      }
      if (resolvedDemandIndex < 0 || resolvedDemandIndex > 1) return;

      player.hand.splice(handIndex, 1);

      const existing = player.demands[resolvedDemandIndex];
      if (existing) player.dustbin.push(existing.id);

      const demandInPlay: DemandCardInPlay = {
        id: cardId,
        card_type: CardType.Demand,
      };
      player.demands[resolvedDemandIndex] = demandInPlay;

    } else if (slotType === 'institutions') {
      if (cardData.card_type !== CardType.Institution) return;

      let resolvedInstIndex = slotIndex;
      if (slotIndex === -1) {
        resolvedInstIndex = player.institutions.findIndex(s => s === null);
        if (resolvedInstIndex === -1) return; // no empty slot
      }
      if (resolvedInstIndex < 0 || resolvedInstIndex > 1) return;
      if (player.wealth < cardData.cost) return;

      player.wealth -= cardData.cost;
      player.hand.splice(handIndex, 1);

      const existing = player.institutions[resolvedInstIndex];
      if (existing) player.dustbin.push(existing.id);

      const institutionInPlay: InstitutionCardInPlay = {
        id: cardId,
        card_type: CardType.Institution,
      };
      player.institutions[resolvedInstIndex] = institutionInPlay;

      // "When first played" effect: increase max hand size
      player.maxHandSize += 1;
    }
  },

  /**
   * Production Phase: Collect wages/profits and unexhaust figures
   */
  collectProduction: ({ G, ctx, playerID }) => {
    if (G.turnPhase !== TurnPhase.Production) {
      return; // Can only collect during production phase
    }

    // Determine current player's class
    const currentClass = playerID === '0' ? SocialClass.WorkingClass : SocialClass.CapitalistClass;
    const player = G.players[currentClass];

    // Collect wages (Working Class) or profits (Capitalist Class) from all workplaces
    let totalIncome = 0;
    G.workplaces.forEach((workplace) => {
      if (workplace.id.startsWith('empty_slot')) {
        return; // Skip empty slots
      }
      if (currentClass === SocialClass.WorkingClass) {
        totalIncome += workplace.wages;
      } else {
        totalIncome += workplace.profits;
      }
    });

    player.wealth += totalIncome;

    // Unexhaust all figures for this player
    player.figures.forEach((figure) => {
      figure.exhausted = false;
    });

    // Unexhaust all state figures
    G.politicalOffices.forEach((office) => {
      office.exhausted = false;
    });

    // Transition to Action phase
    G.turnPhase = TurnPhase.Action;
  },

  /**
   * End Action Phase and move to Reproduction
   */
  endActionPhase: ({ G, ctx }) => {
    if (G.turnPhase !== TurnPhase.Action) {
      return;
    }
    G.turnPhase = TurnPhase.Reproduction;
  },

  /**
   * Plan a Strike conflict: validates the strike leader and target workplace,
   * then creates the conflict state. The figure is removed from play and placed
   * into the conflict. Resolution happens separately.
   */
  planStrike: ({ G, playerID }, figureId: string, workplaceIndex: number) => {
    if (G.turnPhase !== TurnPhase.Action) return;

    const currentClass = playerID === '0' ? SocialClass.WorkingClass : SocialClass.CapitalistClass;
    if (currentClass !== SocialClass.WorkingClass) {
      // Only Working Class can initiate strikes
      G.errorMessage = 'Only Working Class figures can initiate strikes.';
      return;
    }

    const player = G.players[currentClass];
    const figureIndex = player.figures.findIndex(f => f.id === figureId);
    if (figureIndex === -1) {
      G.errorMessage = `Figure ${figureId} is not in play.`;
      return;
    }

    const figure = player.figures[figureIndex];
    if (figure.in_training) {
      G.errorMessage = 'Strike leader must not be in training.';
      return;
    }
    if (figure.exhausted) {
      G.errorMessage = 'Strike leader must not be exhausted.';
      return;
    }

    const figureData = getCardData(figure.id);
    if (figureData.card_type !== CardType.Figure || figureData.social_class !== SocialClass.WorkingClass) {
      G.errorMessage = 'Only Working Class figures can lead strikes.';
      return;
    }

    const targetWorkplace = G.workplaces[workplaceIndex];
    if (!targetWorkplace || targetWorkplace.id.startsWith('empty')) {
      G.errorMessage = `No workplace at index ${workplaceIndex}.`;
      return;
    }

    // Remove figure from player's figures — it's now in the conflict
    player.figures.splice(figureIndex, 1);

    const strikeLeader: FigureCardInPlay = { ...figure };
    const workingClassCards = [strikeLeader];
    const conflictState: StrikeConflictState = {
      conflictType: ConflictType.Strike,
      targetWorkplaceIndex: workplaceIndex,
      targetWorkplace: { ...targetWorkplace },
      strikeLeader,
      workingClassCards,
      capitalistCards: [],
      active: true,
      phase: ConflictPhase.Initiating,
      initiatingClass: SocialClass.WorkingClass,
      workingClassPower: powerStats(workingClassCards),
      capitalistPower: { diceCount: 0, establishedPower: 0 },
    };

    G.activeConflict = conflictState;
    G.errorMessage = undefined;
  },

  /**
   * Plan an Election conflict: validates the candidate and target office,
   * then creates the conflict state. The figure is removed from play and placed
   * into the conflict.
   */
  planElection: ({ G, playerID }, figureId: string, officeIndex: number) => {
    if (G.turnPhase !== TurnPhase.Action) return;

    const currentClass = playerID === '0' ? SocialClass.WorkingClass : SocialClass.CapitalistClass;
    const player = G.players[currentClass];

    const figureIndex = player.figures.findIndex(f => f.id === figureId);
    if (figureIndex === -1) {
      G.errorMessage = `Figure ${figureId} is not in play.`;
      return;
    }

    const figure = player.figures[figureIndex];
    if (figure.in_training) {
      G.errorMessage = 'Candidate must not be in training.';
      return;
    }
    if (figure.exhausted) {
      G.errorMessage = 'Candidate must not be exhausted.';
      return;
    }

    const targetOffice = G.politicalOffices[officeIndex];
    if (!targetOffice) {
      G.errorMessage = `No political office at index ${officeIndex}.`;
      return;
    }

    // Remove figure from player's figures — it's now in the conflict
    player.figures.splice(figureIndex, 1);

    const candidate: FigureCardInPlay = { ...figure };
    const currentPlayerCards = [candidate];
    const workingClassCards = currentClass === SocialClass.WorkingClass ? currentPlayerCards : [];
    const capitalistCards = currentClass === SocialClass.CapitalistClass ? currentPlayerCards : [];

    const conflictState: ElectionConflictState = {
      conflictType: ConflictType.Election,
      targetOfficeIndex: officeIndex,
      targetIncumbent: { ...targetOffice },
      candidate,
      workingClassCards,
      capitalistCards,
      active: true,
      phase: ConflictPhase.Initiating,
      initiatingClass: currentClass,
      workingClassPower: powerStats(workingClassCards),
      capitalistPower: powerStats(capitalistCards),
    };

    G.activeConflict = conflictState;
    G.errorMessage = undefined;
  },

  /**
   * End Reproduction Phase and move to next player's Production
   */
  endReproductionPhase: ({ G, ctx, events }, cardIdsToTheorize?: string[]) => {
    if (G.turnPhase !== TurnPhase.Reproduction) return;

    const currentClass = ctx.currentPlayer === '0' ? SocialClass.WorkingClass : SocialClass.CapitalistClass;
    const player = G.players[currentClass];

    // Theorize: move selected cards from hand to dustbin
    for (const cardId of (cardIdsToTheorize ?? [])) {
      const idx = player.hand.indexOf(cardId);
      if (idx !== -1) {
        player.hand.splice(idx, 1);
        player.dustbin.push(cardId);
      }
    }

    // Remove in_training status from all figures
    player.figures.forEach(figure => {
      figure.in_training = false;
    });

    // Draw cards to fill hand
    drawCards(player);

    G.turnPhase = TurnPhase.Production;

    if (ctx.currentPlayer === '0') {
      G.turnNumber += 1;
    }

    events?.endTurn?.();
  },
} as const satisfies MoveMap<GameState, PluginAPIs>

export type PluginAPIs = Record<string, unknown>

/**
 * Setup function - initializes the game state
 */
export function setup(ctx: any): GameState {
  // Use Math.random by default, or ctx.random if available
  const random = ctx.random ? () => ctx.random.Number() : Math.random;

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
export const ClassWarGame: StrictGameOf<typeof Moves> = {
  name: 'class-war-international',

  minPlayers: 2,
  maxPlayers: 2,

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
  },

  moves: Moves,

  endIf: ({ G, ctx }) => {
    // Win conditions will be implemented later
    // For now, the game continues indefinitely
    return undefined;
  },
};
