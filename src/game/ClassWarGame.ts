/**
 * Class War: International - boardgame.io game definition
 */

import { type MoveMap } from 'boardgame.io';
import { pick } from 'lodash';
import { buildDeck, defaultStateFigureCards, DefaultStateFigureID, defaultWorkplaceCards, getAnyCardData } from '../data/cards';
import { CardType, type FigureCardInPlay, SocialClass, type StateFigureCardInPlay, type WorkplaceInPlay } from '../types/cards';
import { ConflictCardInPlay, ConflictPhase, ConflictType, type ElectionConflictState, type PowerStats, type StrikeConflictState } from '../types/conflicts';
import { type GameState, type PlayerState, TurnPhase } from '../types/game';
import { isDemandCardID, isFigureCardID, isInstitutionCardID, isTacticCardID, isWorkplaceCardID, playDemandCard, playFigureCard, playInstitutionCard, playTacticCard } from '../util/game';
import { type StrictGameOf } from '../util/typedboardgame';

/**
 * Compute the power contribution of a set of conflict cards (figures + tactics).
 * Figures contribute dice; established_power is added separately at resolution.
 */
function powerStats(cards: ConflictCardInPlay[]): PowerStats {
  let diceCount = 0;
  for (const card of cards) {
    const data = getAnyCardData(card.id);
    if (data.card_type === CardType.Figure) {
      diceCount += data.dice;
    } else if (data.card_type === CardType.Tactic && data.dice) {
      diceCount += data.dice;
    }
  }
  return { diceCount, establishedPower: 0 };
}

/**
 * Roll N six-sided dice, returning the individual results.
 */
function rollDice(numDice: number, random: () => number): number[] {
  return Array.from({ length: numDice }, () => Math.floor(random() * 6) + 1);
}

/**
 * Sum of an array of numbers.
 */
function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
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
    const cardData = getAnyCardData(cardId);
    const cost = cardData?.cost ?? 0

    const expandMatch = targetSlot.match(/^workplaces\[(\d+)\]\/expand$/);
    if (expandMatch) {
      if (!isWorkplaceCardID(cardId)) return;
      if (player.wealth < cost) return;

      const wpIndex = parseInt(expandMatch[1], 10);
      const existing = G.workplaces[wpIndex];
      if (!existing || existing.id.startsWith('empty')) return;

      const wpData = getAnyCardData(cardId);
      if (wpData.card_type !== CardType.Workplace) return;

      player.wealth -= cost;
      player.hand.splice(handIndex, 1);
      player.dustbin.push(cardId);

      existing.wages += wpData.starting_wages;
      existing.profits += wpData.starting_profits;
      existing.established_power += wpData.established_power;
      existing.expansionCount = (existing.expansionCount ?? 0) + 1;
      return;
    }

    const slotMatch = targetSlot.match(/^(figures|demands|institutions|workplaces)\[(-?\d+)\]$/);
    if (!slotMatch) return;
    const slotType = slotMatch[1] as 'figures' | 'demands' | 'institutions' | 'workplaces';
    const slotIndex = parseInt(slotMatch[2], 10);

    if (slotType === 'figures') {
      if (!isFigureCardID(cardId)) return;
      if (player.wealth < cost) return;

      player.wealth -= cost;
      player.hand.splice(handIndex, 1);

      player.figures.push(playFigureCard(cardId));

    } else if (slotType === 'demands') {
      if (!isDemandCardID(cardId)) return;

      let resolvedDemandIndex = slotIndex;
      if (slotIndex === -1) {
        resolvedDemandIndex = player.demands.findIndex(s => s === null);
        if (resolvedDemandIndex === -1) return; // no empty slot
      }
      if (resolvedDemandIndex < 0 || resolvedDemandIndex > 1) return;

      player.hand.splice(handIndex, 1);

      const existing = player.demands[resolvedDemandIndex];
      if (existing) player.dustbin.push(existing.id);

      player.demands[resolvedDemandIndex] = playDemandCard(cardId);

    } else if (slotType === 'institutions') {
      if (!isInstitutionCardID(cardId)) return;

      let resolvedInstIndex = slotIndex;
      if (slotIndex === -1) {
        resolvedInstIndex = player.institutions.findIndex(s => s === null);
        if (resolvedInstIndex === -1) return; // no empty slot
      }
      if (resolvedInstIndex < 0 || resolvedInstIndex > 1) return;
      if (player.wealth < cost) return;

      player.wealth -= cost;
      player.hand.splice(handIndex, 1);

      const existing = player.institutions[resolvedInstIndex];
      if (existing) player.dustbin.push(existing.id);

      player.institutions[resolvedInstIndex] = playInstitutionCard(cardId);

      // "When first played" effect: increase max hand size
      player.maxHandSize += 1;

    } else if (slotType === 'workplaces') {
      if (!isWorkplaceCardID(cardId)) return;
      if (player.wealth < cost) return;

      const wpData = getAnyCardData(cardId);
      if (wpData.card_type !== CardType.Workplace) return;

      let resolvedWpIndex = slotIndex;
      if (slotIndex === -1) {
        resolvedWpIndex = G.workplaces.findIndex(w => w.id.startsWith('empty'));
        if (resolvedWpIndex === -1) return; // no empty slot
      }
      if (resolvedWpIndex < 0 || resolvedWpIndex >= G.workplaces.length) return;

      player.wealth -= cost;
      player.hand.splice(handIndex, 1);

      const existing = G.workplaces[resolvedWpIndex];
      // If replacing an occupied slot, send old workplace card to dustbin
      if (existing && !existing.id.startsWith('empty') && existing.workplaceId) {
        player.dustbin.push(existing.workplaceId);
      }

      G.workplaces[resolvedWpIndex] = {
        id: cardId,
        workplaceId: cardId,
        wages: wpData.starting_wages,
        profits: wpData.starting_profits,
        established_power: wpData.established_power,
        unionized: false,
      };
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

    const figureData = getAnyCardData(figure.id);
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
      activeConflictPlayer: SocialClass.WorkingClass,
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
      activeConflictPlayer: currentClass,
      workingClassPower: powerStats(workingClassCards),
      capitalistPower: powerStats(capitalistCards),
    };

    G.activeConflict = conflictState;
    G.errorMessage = undefined;
  },

  /**
   * Cancel a conflict that is still in the Initiating phase.
   * Returns all initiating-side cards back to the player's in-play area / hand.
   * Uses activeConflictPlayer from game state (not boardgame.io playerID) so this
   * works correctly in single-device mode where both players share the same client.
   */
  cancelConflict: ({ G }) => {
    if (!G.activeConflict) return;
    if (G.activeConflict.phase !== ConflictPhase.Initiating) return;

    const initiatingClass = G.activeConflict.initiatingClass;
    const player = G.players[initiatingClass];
    const conflict = G.activeConflict;

    // Return all initiating-side figures to the player's figures area (un-exhausted)
    const initiatingCards = initiatingClass === SocialClass.WorkingClass
      ? conflict.workingClassCards
      : conflict.capitalistCards;
    for (const card of initiatingCards) {
      if (card.card_type === CardType.Figure) {
        player.figures.push({ ...card, exhausted: false });
      }
      // Tactics during Initiating phase: none can be added yet, so nothing to refund
    }

    G.activeConflict = undefined;
    G.errorMessage = undefined;
  },

  /**
   * Confirm the initiating player's cards and move to the Responding phase.
   * The opposing player now gets to add their cards in secret.
   */
  initiateConflict: ({ G }) => {
    if (!G.activeConflict) return;
    if (G.activeConflict.phase !== ConflictPhase.Initiating) return;

    const opposingClass = G.activeConflict.initiatingClass === SocialClass.WorkingClass
      ? SocialClass.CapitalistClass
      : SocialClass.WorkingClass;

    G.activeConflict.phase = ConflictPhase.Responding;
    G.activeConflict.activeConflictPlayer = opposingClass;
    G.errorMessage = undefined;
  },

  /**
   * Add a figure from the activeConflictPlayer's in-play area to the conflict.
   * Uses activeConflictPlayer from game state so single-device play works correctly.
   */
  addFigureToConflict: ({ G }, figureId: string) => {
    if (!G.activeConflict) return;
    if (G.activeConflict.phase === ConflictPhase.Resolving) return;

    const actingClass = G.activeConflict.activeConflictPlayer;
    const player = G.players[actingClass];
    const figureIndex = player.figures.findIndex(f => f.id === figureId);
    if (figureIndex === -1) {
      G.errorMessage = `Figure ${figureId} is not in play.`;
      return;
    }

    const figure = player.figures[figureIndex];
    if (figure.exhausted) {
      G.errorMessage = `Figure ${figureId} is exhausted.`;
      return;
    }
    if (figure.in_training) {
      G.errorMessage = `Figure ${figureId} is in training.`;
      return;
    }

    player.figures.splice(figureIndex, 1);
    if (actingClass === SocialClass.WorkingClass) {
      G.activeConflict.workingClassCards.push({ ...figure });
      G.activeConflict.workingClassPower = powerStats(G.activeConflict.workingClassCards);
    } else {
      G.activeConflict.capitalistCards.push({ ...figure });
      G.activeConflict.capitalistPower = powerStats(G.activeConflict.capitalistCards);
    }
    G.errorMessage = undefined;
  },

  /**
   * Play a tactic card from the activeConflictPlayer's hand into the conflict (costs wealth).
   */
  addTacticToConflict: ({ G }, handIndex: number) => {
    if (!G.activeConflict) return;
    if (G.activeConflict.phase === ConflictPhase.Resolving) return;

    const actingClass = G.activeConflict.activeConflictPlayer;
    const player = G.players[actingClass];
    if (handIndex < 0 || handIndex >= player.hand.length) return;

    const cardId = player.hand[handIndex];
    if (!isTacticCardID(cardId)) {
      G.errorMessage = `Card ${cardId} is not a tactic.`;
      return;
    }

    const cardData = getAnyCardData(cardId);
    const cost = cardData.cost ?? 0;
    if (player.wealth < cost) {
      G.errorMessage = `Not enough wealth to play ${cardData.name} (costs $${cost}).`;
      return;
    }

    player.wealth -= cost;
    player.hand.splice(handIndex, 1);
    const tacticInPlay = playTacticCard(cardId);

    if (actingClass === SocialClass.WorkingClass) {
      G.activeConflict.workingClassCards.push(tacticInPlay);
      G.activeConflict.workingClassPower = powerStats(G.activeConflict.workingClassCards);
    } else {
      G.activeConflict.capitalistCards.push(tacticInPlay);
      G.activeConflict.capitalistPower = powerStats(G.activeConflict.capitalistCards);
    }
    G.errorMessage = undefined;
  },

  /**
   * The activeConflictPlayer is done adding cards.
   * During Responding: passes back to the initiating class (→ Resolving phase).
   */
  planResponse: ({ G }) => {
    if (!G.activeConflict) return;
    if (G.activeConflict.phase !== ConflictPhase.Responding) return;

    G.activeConflict.phase = ConflictPhase.Resolving;
    G.activeConflict.activeConflictPlayer = G.activeConflict.initiatingClass;
    G.errorMessage = undefined;
  },

  /**
   * Resolve the conflict: roll dice, apply effects, store outcome.
   * Only valid when phase === Resolving.
   */
  resolveConflict: ({ G }) => {
    if (!G.activeConflict) return;
    if (G.activeConflict.phase !== ConflictPhase.Resolving) return;

    const conflict = G.activeConflict;
    const rng = Math.random;

    // Roll dice for both sides
    const wcRolls = rollDice(conflict.workingClassPower.diceCount, rng);
    const ccRolls = rollDice(conflict.capitalistPower.diceCount, rng);

    let wcEstablished = conflict.workingClassPower.establishedPower;
    let ccEstablished = conflict.capitalistPower.establishedPower;

    let winner: SocialClass;

    if (conflict.conflictType === ConflictType.Strike) {
      const workplace = G.workplaces[conflict.targetWorkplaceIndex];
      // Workplace's established_power goes to the capitalist side
      ccEstablished += workplace.established_power ?? 0;

      const wcTotal = sum(wcRolls) + wcEstablished;
      const ccTotal = sum(ccRolls) + ccEstablished;

      if (wcTotal > ccTotal) {
        // Workers win: shift $1 from profits to wages
        const shift = Math.min(1, workplace.profits - 1);
        workplace.wages = Math.max(1, workplace.wages + shift);
        workplace.profits = Math.max(1, workplace.profits - shift);
        workplace.unionized = true;
        winner = SocialClass.WorkingClass;
      } else {
        winner = SocialClass.CapitalistClass;
      }

      // Exhaust all participating figures and return them; send tactics to dustbin
      for (const socialClass of [SocialClass.WorkingClass, SocialClass.CapitalistClass] as const) {
        const cards = socialClass === SocialClass.WorkingClass
          ? conflict.workingClassCards
          : conflict.capitalistCards;
        const clasPlayer = G.players[socialClass];
        for (const card of cards) {
          if (card.card_type === CardType.Figure) {
            clasPlayer.figures.push({ ...card, exhausted: true });
          } else if (card.card_type === CardType.Tactic) {
            clasPlayer.dustbin.push(card.id);
          }
        }
      }

      G.conflictOutcome = {
        conflict: { ...conflict },
        winner,
        workingClassPower: { diceCount: conflict.workingClassPower.diceCount, diceRolls: wcRolls, establishedPower: wcEstablished, total: sum(wcRolls) + wcEstablished },
        capitalistPower: { diceCount: conflict.capitalistPower.diceCount, diceRolls: ccRolls, establishedPower: ccEstablished, total: sum(ccRolls) + ccEstablished },
        dismissedBy: [],
      };

    } else {
      // Election
      const wcTotal = sum(wcRolls) + wcEstablished;
      const ccTotal = sum(ccRolls) + ccEstablished;

      const challengerWins = conflict.initiatingClass === SocialClass.WorkingClass
        ? wcTotal > ccTotal
        : ccTotal > wcTotal;

      if (challengerWins) {
        winner = conflict.initiatingClass;
        // Place elected candidate in the office; exhaust them
        const electedCandidate: FigureCardInPlay = { ...conflict.candidate, exhausted: true };
        G.politicalOffices[conflict.targetOfficeIndex] = {
          ...G.politicalOffices[conflict.targetOfficeIndex],
          figureId: electedCandidate.id,
          exhausted: true,
        };
        // Loser (incumbent represented by state figure) stays in office slot (already replaced)
      } else {
        winner = conflict.initiatingClass === SocialClass.WorkingClass
          ? SocialClass.CapitalistClass
          : SocialClass.WorkingClass;
      }

      // Return all figures (except winner's candidate if they won); send tactics to dustbin
      for (const socialClass of [SocialClass.WorkingClass, SocialClass.CapitalistClass] as const) {
        const cards = socialClass === SocialClass.WorkingClass
          ? conflict.workingClassCards
          : conflict.capitalistCards;
        const clasPlayer = G.players[socialClass];
        for (const card of cards) {
          if (card.card_type === CardType.Figure) {
            // Winning candidate stays in the office slot (not returned to figures)
            const isWinningCandidate = challengerWins && card.id === conflict.candidate.id;
            if (!isWinningCandidate) {
              clasPlayer.figures.push({ ...card, exhausted: true });
            }
          } else if (card.card_type === CardType.Tactic) {
            clasPlayer.dustbin.push(card.id);
          }
        }
      }

      G.conflictOutcome = {
        conflict: { ...conflict },
        winner,
        workingClassPower: { diceCount: conflict.workingClassPower.diceCount, diceRolls: wcRolls, establishedPower: wcEstablished, total: wcTotal },
        capitalistPower: { diceCount: conflict.capitalistPower.diceCount, diceRolls: ccRolls, establishedPower: ccEstablished, total: ccTotal },
        dismissedBy: [],
      };
    }

    G.activeConflict = undefined;
    G.errorMessage = undefined;
  },

  /**
   * Acknowledge the conflict outcome for a given class. Once both classes have
   * dismissed it, conflictOutcome is cleared from game state.
   * The dismissingClass must be passed explicitly because this move may be called
   * by either player on a single device without changing the boardgame.io turn.
   */
  dismissConflictOutcome: ({ G }, dismissingClass: SocialClass) => {
    if (!G.conflictOutcome) return;
    if (G.conflictOutcome.dismissedBy.includes(dismissingClass)) return;

    G.conflictOutcome.dismissedBy.push(dismissingClass);

    if (G.conflictOutcome.dismissedBy.length >= 2) {
      G.conflictOutcome = undefined;
    }
    G.errorMessage = undefined;
  },

  /**
   * End Reproduction Phase and move to next player's Production
   */
  endReproductionPhase: ({ G, ctx, events }, handIndexesToTheorize?: number[]) => {
    if (G.turnPhase !== TurnPhase.Reproduction) return;

    const currentClass = ctx.currentPlayer === '0' ? SocialClass.WorkingClass : SocialClass.CapitalistClass;
    const player = G.players[currentClass];

    // Theorize: move selected cards to dustbin (sort descending to avoid index drift)
    const unique = (handIndexesToTheorize ?? []).filter((v, i, arr) => arr.indexOf(v) === i);
    const sortedIndexes = unique.sort((a, b) => b - a);
    for (const idx of sortedIndexes) {
      if (idx >= 0 && idx < player.hand.length) {
        const [cardId] = player.hand.splice(idx, 1);
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
      wages: defaultWorkplaceCards.corner_store.starting_wages,
      profits: defaultWorkplaceCards.corner_store.starting_profits,
      established_power: defaultWorkplaceCards.corner_store.established_power,
      unionized: false,
    },
    {
      id: 'parts_producer',
      wages: defaultWorkplaceCards.parts_producer.starting_wages,
      profits: defaultWorkplaceCards.parts_producer.starting_profits,
      established_power: defaultWorkplaceCards.parts_producer.established_power,
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

  const playStateFigure = (stateFigureID: DefaultStateFigureID): StateFigureCardInPlay => ({
    ...pick(defaultStateFigureCards[stateFigureID], 'id', 'card_type', 'established_power'),
    exhausted: false,
    in_play: true,
  })

  // Initialize political offices (3 state figures)
  const politicalOffices: StateFigureCardInPlay[] = [
    playStateFigure('populist'),
    playStateFigure('centrist'),
    playStateFigure('opportunist'),
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
