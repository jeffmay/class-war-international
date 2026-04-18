/**
 * Class War: International - boardgame.io game definition
 */

import { type MoveMap } from 'boardgame.io';
import { pick } from 'lodash';
import { buildDeck, defaultStateFigureCardById, DefaultStateFigureID, getAnyCardData, getAnyStateFigureDataById, getTacticDataById, getWorkplaceDataById } from '../data/cards';
import { CardType, ConflictType, type DefaultStateFigureCardInPlay, type FigureCardInPlay, SocialClass, WorkplaceCardInPlay, WorkplaceForSale } from '../types/cards';
import { ConflictCardInPlay, ConflictPhase, type ElectionConflictState, type LegislationConflictState, type PowerStats, type StrikeConflictState } from '../types/conflicts';
import { type GameState, type PlayerState, TurnPhase } from '../types/game';
import { isAnyWorkplaceCardID, isDefaultWorkplaceCard, isDemandCardID, isFigureCardID, isInstitutionCardID, isTacticCardID, isWorkplaceCardID, playDemandCard, playFigureCard, playInstitutionCard, playTacticCard, playWorkplaceCard } from '../util/game';
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
 * Roll N custom dice, each with equal odds of rolling 0 (❌), 1 (•), or 2 (••).
 */
function rollDice(numDice: number, random: () => number): number[] {
  return Array.from({ length: numDice }, () => Math.floor(random() * 3));
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
 * Snapshot the current game state so the player can undo the next action.
 * Call this at the very start of any undoable move, before mutating G.
 *
 * Moves that involve randomness (resolveConflict), the opponent's decisions
 * (initiateConflict, planResponse), or card draws (endReproductionPhase,
 * collectProduction) must NOT call saveUndo — undo is not permitted after those.
 */
function saveUndo(G: GameState, actionName: string): void {
  // Deep-clone via JSON round-trip (all GameState values are JSON-serializable).
  // The snapshot preserves any prior undoState so the player can continue undoing
  // further back through a chain of actions.
  const snapshot: GameState = JSON.parse(JSON.stringify(G));
  G.undoState = { canUndo: true, previousActionName: actionName, previousState: snapshot };
}

/**
 * Replace the entire GameState with the given snapshot in-place, deleting any
 * keys absent from the snapshot so optional fields are properly cleared.
 */
function restoreSnapshot(G: GameState, snapshot: GameState): void {
  for (const key of Object.keys(G)) {
    delete (G as unknown as Record<string, unknown>)[key];
  }
  Object.assign(G, snapshot);
}

/**
 * Clear undo after an action that cannot be reversed (randomness, opponent
 * decisions, or card draws).
 */
function clearUndo(G: GameState, reason: string): void {
  G.undoState = { canUndo: false, reason };
}

/**
 * Apply the immediate effect of a demand card becoming law.
 * Some laws have immediate board effects (e.g. deregulation); others
 * are checked each production phase (e.g. wealth_tax).
 */
function applyLawEffect(demandCardId: string, G: GameState): void {
  if (demandCardId === 'deregulation') {
    // Shift $1 from wages to profits at every existing workplace
    for (const wp of G.workplaces) {
      if (wp === WorkplaceForSale) continue;
      if (wp.wages > 1) {
        wp.wages -= 1;
        wp.profits += 1;
      }
    }
  }
  // wealth_tax and free_health_care effects are checked each production phase
  // tax_breaks cost reduction is checked when cards are played
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
  playCardFromHand: ({ G, ctx }, handIndex: number, targetSlot: string) => {
    if (G.turnPhase !== TurnPhase.Action) return;

    const currentClass = ctx.currentPlayer === '0' ? SocialClass.WorkingClass : SocialClass.CapitalistClass;
    const player = G.players[currentClass];

    if (handIndex < 0 || handIndex >= player.hand.length) return;

    const cardId = player.hand[handIndex];
    const cardData = getAnyCardData(cardId);
    const cost = cardData?.cost ?? 0

    const expandMatch = targetSlot.match(/^workplaces\[(\d+)\]\/expand$/);
    if (expandMatch) {
      // TODO: Allow expanding default workplaces?
      if (!isAnyWorkplaceCardID(cardId)) return;
      if (player.wealth < cost) return;

      const wpIndex = parseInt(expandMatch[1], 10);
      const existing = G.workplaces[wpIndex];
      if (!existing || existing === WorkplaceForSale) return;
      if (existing.id !== cardId) return;

      const wpData = getWorkplaceDataById(cardId);
      if (wpData.card_type !== CardType.Workplace) return;

      saveUndo(G, 'Expand Workplace');
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

      saveUndo(G, 'Train Figure');
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

      saveUndo(G, 'Make Demand');
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

      saveUndo(G, 'Build Institution');
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
        resolvedWpIndex = G.workplaces.findIndex(w => w === WorkplaceForSale);
        if (resolvedWpIndex === -1) return; // no empty slot
      }
      if (resolvedWpIndex < 0 || resolvedWpIndex >= G.workplaces.length) return;

      saveUndo(G, 'Open Workplace');
      player.wealth -= cost;
      player.hand.splice(handIndex, 1);

      const existing = G.workplaces[resolvedWpIndex];
      // If replacing an occupied slot, send old workplace card to dustbin
      if (existing && existing !== WorkplaceForSale && !isDefaultWorkplaceCard(existing.id)) {
        player.dustbin.push(existing.id);
      }

      G.workplaces[resolvedWpIndex] = {
        id: cardId,
        card_type: CardType.Workplace,
        in_play: true,
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
  collectProduction: ({ G, ctx }) => {
    if (G.turnPhase !== TurnPhase.Production) {
      return; // Can only collect during production phase
    }

    // Determine current player's class by ctx.currentPlayer (not playerID, which is undefined in local/debug mode)
    const currentClass = ctx.currentPlayer === '0' ? SocialClass.WorkingClass : SocialClass.CapitalistClass;
    const player = G.players[currentClass];

    clearUndo(G, 'Cannot undo after collecting production');

    // Collect wages (Working Class) or profits (Capitalist Class) from all workplaces
    let totalIncome = 0;
    G.workplaces.forEach((workplace) => {
      if (workplace === WorkplaceForSale) {
        return; // Skip empty slots
      }
      if (currentClass === SocialClass.WorkingClass) {
        totalIncome += workplace.wages;
      } else {
        totalIncome += workplace.profits;
      }
    });

    player.wealth += totalIncome;

    // Apply wealth_tax law: if a class has >$20, they give half to the bank
    if (G.laws.includes('wealth_tax')) {
      const WEALTH_TAX_THRESHOLD = 20;
      for (const sc of [SocialClass.WorkingClass, SocialClass.CapitalistClass] as const) {
        const p = G.players[sc];
        if (p.wealth > WEALTH_TAX_THRESHOLD) {
          p.wealth = Math.floor(p.wealth / 2);
        }
      }
    }

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
  endActionPhase: ({ G }) => {
    if (G.turnPhase !== TurnPhase.Action) {
      return;
    }
    saveUndo(G, 'End Action Phase');
    G.turnPhase = TurnPhase.Reproduction;
  },

  /**
   * Plan a Strike conflict: validates the strike leader and target workplace,
   * then creates the conflict state. The figure is removed from play and placed
   * into the conflict. Resolution happens separately.
   */
  planStrike: ({ G, ctx }, figureId: string, workplaceIndex: number) => {
    if (G.turnPhase !== TurnPhase.Action) return;

    const currentClass = ctx.currentPlayer === '0' ? SocialClass.WorkingClass : SocialClass.CapitalistClass;
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
    if (!targetWorkplace || targetWorkplace === WorkplaceForSale) {
      G.errorMessage = `No workplace at index ${workplaceIndex}.`;
      return;
    }

    // Remove figure from player's figures — it's now in the conflict
    saveUndo(G, 'Plan Strike');
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
  planElection: ({ G, ctx }, figureId: string, officeIndex: number) => {
    if (G.turnPhase !== TurnPhase.Action) return;

    const currentClass = ctx.currentPlayer === '0' ? SocialClass.WorkingClass : SocialClass.CapitalistClass;
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

    if (targetOffice.electionCooldownTurnsRemaining && targetOffice.electionCooldownTurnsRemaining > 0) {
      G.errorMessage = `This office cannot be challenged for ${targetOffice.electionCooldownTurnsRemaining} more turn(s).`;
      return;
    }

    // Remove figure from player's figures — it's now in the conflict
    saveUndo(G, 'Plan Election');
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
   * Propose Legislation: starts a Legislative conflict from a political office
   * held by the current player's class. The demand card is proposed as a law.
   * State figures are automatically assigned to sides based on their rules:
   *   - Populist: sides with the class that has more figures in play
   *   - Centrist: always opposes legislation (sides with the opposing class)
   *   - Opportunist: opposes unless the proposing class pays $15
   *   - Opposing class offices: automatically oppose
   * Exhausted state figures can participate but cannot propose legislation.
   *
   * @param officeIndex - Index of the political office the figure holds
   * @param demandSlotIndex - Index in the proposing player's demands array (0 or 1)
   */
  planLegislation: ({ G, ctx }, officeIndex: number, demandSlotIndex: number) => {
    if (G.turnPhase !== TurnPhase.Action) return;

    const currentClass = ctx.currentPlayer === '0' ? SocialClass.WorkingClass : SocialClass.CapitalistClass;
    const opposingClass = currentClass === SocialClass.WorkingClass ? SocialClass.CapitalistClass : SocialClass.WorkingClass;
    const player = G.players[currentClass];

    // Validate the office exists and is held by the current class
    const office = G.politicalOffices[officeIndex];
    if (!office) {
      G.errorMessage = `No political office at index ${officeIndex}.`;
      return;
    }

    // The office must have a player figure from the current class elected
    if (office.card_type !== CardType.Figure) {
      G.errorMessage = `No elected figure in that office.`;
      return;
    }

    // The elected figure must belong to the current class
    const electedFigureData = getAnyCardData(office.id);
    if (electedFigureData.card_type !== CardType.Figure || electedFigureData.social_class !== currentClass) {
      G.errorMessage = `The figure in that office does not belong to your class.`;
      return;
    }

    // The office figure cannot be exhausted to initiate (but can participate)
    if (office.exhausted) {
      G.errorMessage = `The elected figure is exhausted and cannot propose legislation this turn.`;
      return;
    }

    // Validate the demand card slot
    if (demandSlotIndex < 0 || demandSlotIndex > 1) {
      G.errorMessage = `Invalid demand slot index ${demandSlotIndex}.`;
      return;
    }
    const demandInPlay = player.demands[demandSlotIndex];
    if (!demandInPlay) {
      G.errorMessage = `No demand card in slot ${demandSlotIndex}.`;
      return;
    }

    const demandCardId = demandInPlay.id;

    // Auto-assign state figures to sides
    saveUndo(G, 'Propose Legislation');
    const proposingSideCards: ConflictCardInPlay[] = [];
    const opposingSideCards: ConflictCardInPlay[] = [];

    const wcFigureCount = G.players[SocialClass.WorkingClass].figures.length;
    const ccFigureCount = G.players[SocialClass.CapitalistClass].figures.length;

    for (const stateOffice of G.politicalOffices) {
      // The proposing office's figure is on the proposing side
      if (G.politicalOffices.indexOf(stateOffice) === officeIndex) {
        proposingSideCards.push({ ...stateOffice });
        continue;
      }

      // If a player figure was elected to this office, align by their social class
      if (stateOffice.card_type === CardType.Figure) {
        const figData = getAnyCardData(stateOffice.id);
        if (figData.card_type === CardType.Figure && figData.social_class === opposingClass) {
          opposingSideCards.push({ ...stateOffice });
        } else if (figData.card_type === CardType.Figure && figData.social_class === currentClass) {
          proposingSideCards.push({ ...stateOffice });
        }
        continue;
      }

      // Default state figure behavior
      if (stateOffice.id === 'populist') {
        // Sides with the class that has more figures in play
        const proposingCount = currentClass === SocialClass.WorkingClass ? wcFigureCount : ccFigureCount;
        const opposingCount = currentClass === SocialClass.WorkingClass ? ccFigureCount : wcFigureCount;
        if (proposingCount >= opposingCount) {
          proposingSideCards.push({ ...stateOffice });
        } else {
          opposingSideCards.push({ ...stateOffice });
        }
      } else if (stateOffice.id === 'centrist') {
        // Always opposes legislation
        opposingSideCards.push({ ...stateOffice });
      } else if (stateOffice.id === 'opportunist') {
        // Opposes unless paid $15
        const OPPORTUNIST_BRIBE = 15;
        if (player.wealth >= OPPORTUNIST_BRIBE) {
          player.wealth -= OPPORTUNIST_BRIBE;
          proposingSideCards.push({ ...stateOffice });
        } else {
          opposingSideCards.push({ ...stateOffice });
        }
      } else {
        // Unknown state figure — default to opposing
        opposingSideCards.push({ ...stateOffice });
      }
    }

    const workingClassCards = currentClass === SocialClass.WorkingClass ? proposingSideCards : opposingSideCards;
    const capitalistCards = currentClass === SocialClass.CapitalistClass ? proposingSideCards : opposingSideCards;

    // Exhaust the proposing office
    office.exhausted = true;

    const conflictState: LegislationConflictState = {
      conflictType: ConflictType.Legislation,
      demandCardId,
      demandSlotIndex,
      proposingOfficeIndex: officeIndex,
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
   * Restores the game state snapshot saved when the conflict was planned, which
   * returns all figures and other state to exactly what it was before the plan.
   * This is equivalent to clicking Undo on the plan-conflict action.
   */
  cancelConflict: ({ G }) => {
    if (!G.activeConflict) return;
    if (G.activeConflict.phase !== ConflictPhase.Initiating) return;
    if (!G.undoState?.canUndo) return;

    restoreSnapshot(G, G.undoState.previousState);
    G.errorMessage = undefined;
  },

  /**
   * Confirm the initiating player's cards and move to the Responding phase.
   * The opposing player now gets to add their cards in secret.
   * Calls endTurn({ next }) to transfer boardgame.io move rights to the opposing player.
   * This works in both local (single-device) and multiplayer modes.
   */
  initiateConflict: ({ G, ctx, events }) => {
    if (!G.activeConflict) return;
    if (G.activeConflict.phase !== ConflictPhase.Initiating) return;

    clearUndo(G, 'Cannot undo after initiating conflict');

    const opposingClass = G.activeConflict.initiatingClass === SocialClass.WorkingClass
      ? SocialClass.CapitalistClass
      : SocialClass.WorkingClass;

    G.activeConflict.phase = ConflictPhase.Responding;
    G.activeConflict.activeConflictPlayer = opposingClass;
    G.errorMessage = undefined;

    // Pass boardgame.io move rights to the opposing player so they can respond.
    // endTurn({ next }) switches currentPlayer without advancing the game-level turn.
    const opposingPlayerID = ctx.currentPlayer === '0' ? '1' : '0';
    events?.endTurn?.({ next: opposingPlayerID });
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

    // No saveUndo here — the plan-conflict snapshot covers the whole setup phase.
    // Cancel conflict restores that snapshot, undoing all figure/tactic additions at once.
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

    const cardData = getTacticDataById(cardId);
    const enabledConflicts = cardData.enabled_by_conflict;
    if (!enabledConflicts || !enabledConflicts.includes(G.activeConflict.conflictType)) {
      G.errorMessage = `${cardData.name} cannot be played in a ${G.activeConflict.conflictType} conflict.`;
      return;
    }
    const cost = cardData.cost ?? 0;
    if (player.wealth < cost) {
      G.errorMessage = `Not enough wealth to play ${cardData.name} (costs $${cost}).`;
      return;
    }

    // No saveUndo here — the plan-conflict snapshot covers the whole setup phase.
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
   * Calls endTurn({ next }) to transfer boardgame.io move rights back to the initiating player.
   */
  planResponse: ({ G, events }) => {
    if (!G.activeConflict) return;
    if (G.activeConflict.phase !== ConflictPhase.Responding) return;

    clearUndo(G, 'Cannot undo after responding to conflict');
    G.activeConflict.phase = ConflictPhase.Resolving;
    G.activeConflict.activeConflictPlayer = G.activeConflict.initiatingClass;
    G.errorMessage = undefined;

    // Return move rights to the initiating player so they can resolve the conflict.
    const initiatingPlayerID = G.activeConflict.initiatingClass === SocialClass.WorkingClass ? '0' : '1';
    events?.endTurn?.({ next: initiatingPlayerID });
  },

  /**
   * Resolve the conflict: roll dice, apply effects, store outcome.
   * Only valid when phase === Resolving.
   */
  resolveConflict: ({ G }) => {
    if (!G.activeConflict) return;
    if (G.activeConflict.phase !== ConflictPhase.Resolving) return;

    clearUndo(G, 'Cannot undo after resolving conflict');
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
      if (workplace === WorkplaceForSale) {
        G.errorMessage = 'Target workplace does not exist.';
        return;
      }
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

    } else if (conflict.conflictType === ConflictType.Election) {
      // The incumbent sides with the class defending the seat (opposing the initiating class).
      const incumbentData = getAnyStateFigureDataById(conflict.targetIncumbent.id);
      const incumbentPower = incumbentData.card_type === CardType.DefaultStateFigure
        ? incumbentData.established_power
        : 0;
      if (conflict.initiatingClass === SocialClass.WorkingClass) {
        ccEstablished += incumbentPower;
      } else {
        wcEstablished += incumbentPower;
      }

      const wcTotal = sum(wcRolls) + wcEstablished;
      const ccTotal = sum(ccRolls) + ccEstablished;

      const challengerWins = conflict.initiatingClass === SocialClass.WorkingClass
        ? wcTotal > ccTotal
        : ccTotal > wcTotal;

      if (challengerWins) {
        winner = conflict.initiatingClass;
        // Place elected candidate in the office; exhaust them; set cooldown
        G.politicalOffices[conflict.targetOfficeIndex] = {
          ...conflict.candidate,
          exhausted: true,
          electionCooldownTurnsRemaining: 1,
        };
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

    } else {
      // Legislation
      const wcTotal = sum(wcRolls) + wcEstablished;
      const ccTotal = sum(ccRolls) + ccEstablished;

      const proposerWins = conflict.initiatingClass === SocialClass.WorkingClass
        ? wcTotal > ccTotal
        : ccTotal > wcTotal;

      if (proposerWins) {
        winner = conflict.initiatingClass;
        // Demand becomes law — add to laws list if not already present
        if (!G.laws.includes(conflict.demandCardId)) {
          G.laws.push(conflict.demandCardId);
        }
        // Apply immediate law effects
        applyLawEffect(conflict.demandCardId, G);
      } else {
        winner = conflict.initiatingClass === SocialClass.WorkingClass
          ? SocialClass.CapitalistClass
          : SocialClass.WorkingClass;
      }

      // Exhaust all state figures that participated (they are not removed, just exhausted)
      for (const card of [...conflict.workingClassCards, ...conflict.capitalistCards]) {
        if (card.card_type === CardType.DefaultStateFigure) {
          const officeIdx = G.politicalOffices.findIndex(o => o.id === card.id);
          if (officeIdx !== -1) {
            G.politicalOffices[officeIdx].exhausted = true;
          }
        } else if (card.card_type === CardType.Figure) {
          // Player figures that joined the conflict are returned exhausted
          const socialClass = (() => {
            const data = getAnyCardData(card.id);
            return data.card_type === CardType.Figure ? data.social_class : null;
          })();
          if (socialClass) {
            G.players[socialClass].figures.push({ ...card, exhausted: true });
          }
        } else if (card.card_type === CardType.Tactic) {
          const data = getAnyCardData(card.id);
          if (data.card_type === CardType.Tactic && data.social_class) {
            G.players[data.social_class].dustbin.push(card.id);
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
   * Dismissal is undoable so the opposing player can reopen the outcome screen.
   */
  dismissConflictOutcome: ({ G }, dismissingClass: SocialClass) => {
    if (!G.conflictOutcome) return;
    if (G.conflictOutcome.dismissedBy.includes(dismissingClass)) return;

    saveUndo(G, 'Dismiss Conflict Outcome');
    G.conflictOutcome.dismissedBy.push(dismissingClass);

    if (G.conflictOutcome.dismissedBy.length >= 2) {
      G.conflictOutcome = undefined;
    }
    G.errorMessage = undefined;
  },

  /**
   * Lock undo when the player has previewed the dealt cards in the DealResultModal.
   * Once the new cards are visible, the end-of-turn sequence cannot be reversed.
   */
  sealReproductionPreview: ({ G }) => {
    clearUndo(G, 'Cannot undo after viewing new cards');
  },

  /**
   * Undo the last undoable action by restoring the saved snapshot.
   */
  undoMove: ({ G }) => {
    if (!G.undoState?.canUndo) return;
    restoreSnapshot(G, G.undoState.previousState);
  },

  /**
   * End Reproduction Phase and move to next player's Production
   */
  endReproductionPhase: ({ G, ctx, events }, handIndexesToTheorize?: number[]) => {
    if (G.turnPhase !== TurnPhase.Reproduction) return;

    clearUndo(G, 'Cannot undo after ending turn');
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

    // Decrement election cooldowns only for offices held by the current class's elected figure.
    // This ensures the opposing class cannot challenge before the winner takes their full turns.
    G.politicalOffices.forEach(office => {
      if (!office.electionCooldownTurnsRemaining || office.electionCooldownTurnsRemaining <= 0) return;
      if (office.card_type !== CardType.Figure) return;
      const officeData = getAnyCardData(office.id);
      if (officeData.card_type === CardType.Figure && officeData.social_class === currentClass) {
        office.electionCooldownTurnsRemaining -= 1;
      }
    });

    // Turn number increments after both players complete their turns (at the end of CC's turn)
    if (ctx.currentPlayer === '1') {
      G.turnNumber += 1;
    }

    events?.endTurn?.();
  },
} as const satisfies MoveMap<GameState, PluginAPIs>

export type PluginAPIs = Record<string, unknown>

interface SetupContext {
  random?: { Number: () => number };
}

/**
 * Setup function - initializes the game state
 */
export function setup(ctx: SetupContext): GameState {
  // Use Math.random by default, or ctx.random if available
  const randomPlugin = ctx.random;
  const random = randomPlugin ? () => randomPlugin.Number() : Math.random;

  // Initialize workplaces (3 slots: 2 default + 1 empty)
  const workplaces: (WorkplaceCardInPlay | WorkplaceForSale)[] = [
    playWorkplaceCard('corner_store'),
    playWorkplaceCard('parts_producer'),
    WorkplaceForSale, // empty slot
  ];

  const playStateFigure = (stateFigureID: DefaultStateFigureID): DefaultStateFigureCardInPlay => ({
    ...pick(defaultStateFigureCardById[stateFigureID], 'id', 'card_type', 'established_power'),
    exhausted: false,
    in_play: true,
  })

  // Initialize political offices (3 state figures)
  const politicalOffices: DefaultStateFigureCardInPlay[] = [
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

  playerView: ({ G }) => {
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

  endIf: () => {
    // Win conditions will be implemented later
    // For now, the game continues indefinitely
    return undefined;
  },
};
