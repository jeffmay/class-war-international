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

const MIN_WAGE = 1;
/** Base maximum dice per class. WC has higher cap to reflect solidarity. */
const WC_MAX_DICE = 9;
const CC_MAX_DICE = 6;

/**
 * Compute the power contribution of a set of conflict cards (figures + tactics).
 * - Figures contribute dice.
 * - Tactics with `dice` contribute extra dice; `canvass` contributes 1 die per figure instead.
 * - Tactics with `established_power` (e.g. call_the_police) add to established power.
 */
function powerStats(cards: ConflictCardInPlay[]): PowerStats {
  let diceCount = 0;
  let establishedPower = 0;
  const figureCount = cards.filter(c => c.card_type === CardType.Figure).length;
  for (const card of cards) {
    const data = getAnyCardData(card.id);
    if (data.card_type === CardType.Figure) {
      diceCount += data.dice;
    } else if (data.card_type === CardType.Tactic) {
      if (data.id === 'canvass') {
        diceCount += figureCount;
      } else if (data.dice) {
        diceCount += data.dice;
      }
      if (data.established_power) {
        establishedPower += data.established_power;
      }
    }
  }
  return { diceCount, establishedPower };
}

/**
 * Die face map: 6 sides → values.
 * Sides 0,2 = value 0 (2-in-6); sides 1,3,4 = value 1 (3-in-6); side 5 = value 2 (1-in-6).
 */
export const DIE_FACES = [0, 1, 0, 1, 1, 2] as const;

/** Convert a rolled die side (0–5) to its point value. */
export function sideToValue(side: number): number {
  return DIE_FACES[side] ?? 0;
}

/** Flip a die side to its physical opposite: flipSide(s) = (s + 3) % 6 */
export function flipSide(side: number): number {
  return (side + 3) % 6;
}

/**
 * Roll N custom dice; returns face sides (0–5).
 * Use sideToValue() to convert sides to point values.
 */
function rollDice(numDice: number, random: () => number): number[] {
  return Array.from({ length: numDice }, () => Math.floor(random() * 6));
}

/** Sum point values from an array of die sides. */
function sumSides(sides: number[]): number {
  return sides.reduce((a, s) => a + sideToValue(s), 0);
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
    for (const wp of G.workplaces) {
      if (wp === WorkplaceForSale) continue;
      wp.unionized = false;
      if (wp.wages > MIN_WAGE) {
        wp.wages -= 1;
        wp.profits += 1;
      }
    }
  }
  // wealth_tax and free_health_care effects are checked each production phase
  // tax_breaks cost reduction is checked when cards are played
}

/** True when deregulation law prevents new unions from forming */
function canUnionize(G: GameState): boolean {
  return !G.laws.includes('deregulation');
}

/**
 * Compute the effective cost of a card after applying active law effects.
 * - tax_breaks: cards/abilities costing $15+ cost $5 less
 * - free_health_care: all figures cost $2 less
 * - trust_fund_kid: costs 0 if a workplace was played this turn by the current class
 */
function effectiveCost(G: GameState, cardData: ReturnType<typeof getAnyCardData>, currentClass?: SocialClass): number {
  if (cardData.id === 'trust_fund_kid' && currentClass !== undefined) {
    if (G.players[currentClass].playedWorkplaceThisTurn) return 0;
  }
  let cost = cardData.cost ?? 0;
  if (G.laws.includes('free_health_care') && cardData.card_type === CardType.Figure) {
    cost = Math.max(0, cost - 2);
  }
  if (G.laws.includes('tax_breaks') && cost >= 15) {
    cost = Math.max(0, cost - 5);
  }
  return cost;
}

/**
 * Apply figure activation effects when a figure is first played.
 * Simple deterministic effects fire immediately; choice-based effects set pendingActivation.
 */
function triggerFigureActivation(figureId: string, G: GameState, actingClass: SocialClass): void {
  const player = G.players[actingClass];
  const opponentClass = actingClass === SocialClass.WorkingClass
    ? SocialClass.CapitalistClass
    : SocialClass.WorkingClass;

  switch (figureId) {
    case 'student_activist': {
      // Search deck for first Demand → put in first empty demand slot
      const demandIdx = player.deck.findIndex(id => isDemandCardID(id));
      if (demandIdx !== -1) {
        const demandId = player.deck.splice(demandIdx, 1)[0];
        if (!demandId || !isDemandCardID(demandId)) break;
        const emptySlot = player.demands.findIndex(d => d === null);
        if (emptySlot !== -1) {
          player.demands[emptySlot] = playDemandCard(demandId);
        } else {
          // Demand slots full — put back on top of deck
          player.deck.unshift(demandId);
        }
      }
      break;
    }
    case 'rosa_luxembear': {
      // Player picks any tactic from their dustbin to add to hand
      const hasTactic = player.dustbin.some(id => isTacticCardID(id));
      if (hasTactic) {
        G.pendingActivation = { type: 'rosa_luxembear', actingClass };
      }
      break;
    }
    case 'barx_and_eagels': {
      // Search deck for first Demand or Institution → put on top of deck
      const matchIdx = player.deck.findIndex(id => isDemandCardID(id) || isInstitutionCardID(id));
      if (matchIdx !== -1) {
        const [cardId] = player.deck.splice(matchIdx, 1);
        if (cardId) player.deck.unshift(cardId);
      }
      break;
    }
    case 'steve_amphibannon': {
      // Search deck or dustbin for a Demand → put on top of deck
      const deckIdx = player.deck.findIndex(id => isDemandCardID(id));
      if (deckIdx !== -1) {
        const [cardId] = player.deck.splice(deckIdx, 1);
        if (cardId) player.deck.unshift(cardId);
      } else {
        const dustbinIdx = player.dustbin.findIndex(id => isDemandCardID(id));
        if (dustbinIdx !== -1) {
          const [cardId] = player.dustbin.splice(dustbinIdx, 1);
          if (cardId) player.deck.unshift(cardId);
        }
      }
      break;
    }
    case 'sheryl_sandbar': {
      // CC looks at WC's hand; picks one card to discard — requires opponent interaction
      const opponent = G.players[opponentClass];
      if (opponent.hand.length > 0) {
        G.pendingActivation = { type: 'sheryl_sandbar', actingClass };
      }
      break;
    }
    case 'nelson_crockafeller': {
      // Search deck for first Institution or Workplace → put on top of deck
      const matchIdx = player.deck.findIndex(id => isInstitutionCardID(id) || isWorkplaceCardID(id));
      if (matchIdx !== -1) {
        const [cardId] = player.deck.splice(matchIdx, 1);
        if (cardId) player.deck.unshift(cardId);
      }
      break;
    }
    case 'consultant': {
      // CC chooses: shift $1 wages→profits at a workplace OR WC discards 2 cards
      G.pendingActivation = { type: 'consultant_choose', actingClass };
      break;
    }
    default:
      break;
  }
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
    const cost = effectiveCost(G, cardData, currentClass);

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
      triggerFigureActivation(cardId, G, currentClass);

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
      player.playedWorkplaceThisTurn = true;
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
  endActionPhase: ({ G, ctx }) => {
    if (G.turnPhase !== TurnPhase.Action) {
      return;
    }
    saveUndo(G, 'End Action Phase');

    // welfare_reform: figures costing $6 or less become exhausted at end of their class's turn
    if (G.laws.includes('welfare_reform')) {
      const currentClass = ctx.currentPlayer === '0' ? SocialClass.WorkingClass : SocialClass.CapitalistClass;
      for (const figure of G.players[currentClass].figures) {
        const figData = getAnyCardData(figure.id);
        if (figData.cost !== undefined && figData.cost <= 6) {
          figure.exhausted = true;
        }
      }
    }

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
    // labor_organizer as captain allows up to 3 strike leaders
    const maxStrikeLeaders = figure.id === 'labor_organizer' ? 3 : 1;
    const conflictState: StrikeConflictState = {
      conflictType: ConflictType.Strike,
      targetWorkplaceIndex: workplaceIndex,
      targetWorkplace: { ...targetWorkplace },
      maxStrikeLeaders,
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
    // Clear step tracking so initiating class's cards are committed (visible to both sides)
    for (const card of G.activeConflict.workingClassCards) { card.addedThisStep = false; }
    for (const card of G.activeConflict.capitalistCards) { card.addedThisStep = false; }

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
   * Valid during Initiating, Responding, and Resolving phases.
   */
  addFigureToConflict: ({ G }, figureId: string) => {
    if (!G.activeConflict) return;

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

    saveUndo(G, 'Add Figure to Conflict');
    player.figures.splice(figureIndex, 1);
    const conflictFigure = { ...figure, addedThisStep: true };
    if (actingClass === SocialClass.WorkingClass) {
      G.activeConflict.workingClassCards.push(conflictFigure);
      G.activeConflict.workingClassPower = powerStats(G.activeConflict.workingClassCards);
    } else {
      G.activeConflict.capitalistCards.push(conflictFigure);
      G.activeConflict.capitalistPower = powerStats(G.activeConflict.capitalistCards);
    }
    G.errorMessage = undefined;
  },

  /**
   * Play a tactic card from the activeConflictPlayer's hand into the conflict (costs wealth).
   * Valid during Initiating, Responding, and Resolving phases.
   */
  addTacticToConflict: ({ G }, handIndex: number, forClass?: SocialClass) => {
    if (!G.activeConflict) return;

    const actingClass = forClass ?? G.activeConflict.activeConflictPlayer;
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

    saveUndo(G, 'Add Tactic to Conflict');
    player.wealth -= cost;
    player.hand.splice(handIndex, 1);
    const tacticInPlay = { ...playTacticCard(cardId), addedThisStep: true };

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
   * Remove a card that was added this step from the conflict, returning it to the player.
   * Figures return to player.figures; tactics return to hand with a wealth refund.
   */
  removeCardFromConflict: ({ G }, cardIndex: number, forClass: SocialClass) => {
    if (!G.activeConflict) return;

    const cards = forClass === SocialClass.WorkingClass
      ? G.activeConflict.workingClassCards
      : G.activeConflict.capitalistCards;

    if (cardIndex < 0 || cardIndex >= cards.length) return;
    const card = cards[cardIndex];
    if (!card.addedThisStep) return;

    saveUndo(G, 'Remove Card from Conflict');
    cards.splice(cardIndex, 1);

    const player = G.players[forClass];
    if (card.card_type === CardType.Figure) {
      player.figures.push({
        id: card.id,
        card_type: CardType.Figure,
        in_play: true,
        exhausted: card.exhausted,
        in_training: card.in_training,
      });
    } else if (card.card_type === CardType.Tactic) {
      player.hand.push(card.id);
      const tacticData = getTacticDataById(card.id);
      player.wealth += tacticData.cost ?? 0;
    }

    if (forClass === SocialClass.WorkingClass) {
      G.activeConflict.workingClassPower = powerStats(G.activeConflict.workingClassCards);
    } else {
      G.activeConflict.capitalistPower = powerStats(G.activeConflict.capitalistCards);
    }
    G.errorMessage = undefined;
  },

  /**
   * Swap a leader slot card with another card already in the conflict.
   * Only valid during the Initiating phase.
   * For strikes: leaderSlotIndex must be < maxStrikeLeaders; conflictCardIndex must be >= maxStrikeLeaders.
   * For elections: leaderSlotIndex must be 0; conflictCardIndex must be >= 1.
   * The two cards exchange positions in the relevant cards array; power stats are recomputed.
   */
  changeConflictLeader: ({ G }, leaderSlotIndex: number, conflictCardIndex: number) => {
    if (!G.activeConflict) return;
    if (G.activeConflict.phase !== ConflictPhase.Initiating) {
      G.errorMessage = 'Can only change leader during the initiating phase.';
      return;
    }

    const conflict = G.activeConflict;

    if (conflict.conflictType === ConflictType.Strike) {
      if (leaderSlotIndex < 0 || leaderSlotIndex >= conflict.maxStrikeLeaders) {
        G.errorMessage = 'Invalid leader slot index.';
        return;
      }
      if (conflictCardIndex < conflict.maxStrikeLeaders || conflictCardIndex >= conflict.workingClassCards.length) {
        G.errorMessage = 'Invalid conflict card index: must point to a supporter slot.';
        return;
      }
      saveUndo(G, 'Change Strike Leader');
      const cards = conflict.workingClassCards;
      [cards[leaderSlotIndex], cards[conflictCardIndex]] = [cards[conflictCardIndex], cards[leaderSlotIndex]];
      conflict.workingClassPower = powerStats(cards);

    } else if (conflict.conflictType === ConflictType.Election) {
      const initiatingCards = conflict.initiatingClass === SocialClass.WorkingClass
        ? conflict.workingClassCards
        : conflict.capitalistCards;

      if (leaderSlotIndex !== 0) {
        G.errorMessage = 'Candidate slot is always index 0.';
        return;
      }
      if (conflictCardIndex < 1 || conflictCardIndex >= initiatingCards.length) {
        G.errorMessage = 'Invalid conflict card index: must point to a supporter slot.';
        return;
      }
      saveUndo(G, 'Change Election Candidate');
      [initiatingCards[0], initiatingCards[conflictCardIndex]] = [initiatingCards[conflictCardIndex], initiatingCards[0]];
      if (conflict.initiatingClass === SocialClass.WorkingClass) {
        conflict.workingClassPower = powerStats(conflict.workingClassCards);
      } else {
        conflict.capitalistPower = powerStats(conflict.capitalistCards);
      }

    } else {
      G.errorMessage = 'Leader change is not applicable for legislation conflicts.';
      return;
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
    // Clear step tracking so all cards are now committed (visible to both sides)
    for (const card of G.activeConflict.workingClassCards) { card.addedThisStep = false; }
    for (const card of G.activeConflict.capitalistCards) { card.addedThisStep = false; }
    G.activeConflict.phase = ConflictPhase.Resolving;
    G.activeConflict.activeConflictPlayer = G.activeConflict.initiatingClass;
    G.errorMessage = undefined;

    // Return move rights to the initiating player so they can resolve the conflict.
    const initiatingPlayerID = G.activeConflict.initiatingClass === SocialClass.WorkingClass ? '0' : '1';
    events?.endTurn?.({ next: initiatingPlayerID });
  },

  /**
   * The initiating class commits their escalation cards and returns move rights
   * to the responding class for another Responding round (ping-pong escalation).
   * Only valid when phase === Resolving.
   */
  escalateConflict: ({ G, events }) => {
    if (!G.activeConflict) return;
    if (G.activeConflict.phase !== ConflictPhase.Resolving) return;

    clearUndo(G, 'Cannot undo after escalating conflict');
    for (const card of G.activeConflict.workingClassCards) { card.addedThisStep = false; }
    for (const card of G.activeConflict.capitalistCards) { card.addedThisStep = false; }

    const respondingClass = G.activeConflict.initiatingClass === SocialClass.WorkingClass
      ? SocialClass.CapitalistClass
      : SocialClass.WorkingClass;

    G.activeConflict.phase = ConflictPhase.Responding;
    G.activeConflict.activeConflictPlayer = respondingClass;
    G.errorMessage = undefined;

    const respondingPlayerID = respondingClass === SocialClass.WorkingClass ? '0' : '1';
    events?.endTurn?.({ next: respondingPlayerID });
  },

  /**
   * Resolve the conflict: roll dice, apply effects, store outcome.
   * Valid from both Responding and Resolving phases so either class can end the conflict.
   */
  resolveConflict: ({ G }) => {
    if (!G.activeConflict) return;
    if (
      G.activeConflict.phase !== ConflictPhase.Resolving &&
      G.activeConflict.phase !== ConflictPhase.Responding
    ) return;

    clearUndo(G, 'Cannot undo after resolving conflict');
    const conflict = G.activeConflict;
    const rng = Math.random;

    // Apply per-class max dice caps; stop_voter_fraud reduces both to 6 in elections
    const isElection = conflict.conflictType === ConflictType.Election;
    const svfActive = isElection && G.laws.includes('stop_voter_fraud');
    const wcMaxDice = svfActive ? 6 : WC_MAX_DICE;
    const ccMaxDice = svfActive ? 6 : CC_MAX_DICE;
    const wcDice = Math.min(conflict.workingClassPower.diceCount, wcMaxDice);
    const ccDice = Math.min(conflict.capitalistPower.diceCount, ccMaxDice);

    let wcEstablished = conflict.workingClassPower.establishedPower;
    let ccEstablished = conflict.capitalistPower.establishedPower;

    let winner: SocialClass;

    if (conflict.conflictType === ConflictType.Strike) {
      const workplace = G.workplaces[conflict.targetWorkplaceIndex];
      if (workplace === WorkplaceForSale) {
        G.errorMessage = 'Target workplace does not exist.';
        return;
      }

      // Helper: check if a figure is in a strike leader slot
      const strikeLeaderIds = new Set(
        conflict.workingClassCards
          .slice(0, conflict.maxStrikeLeaders)
          .filter(c => c.card_type === CardType.Figure)
          .map(c => c.id)
      );

      // agitator: reduce workplace established_power by 1 before dice
      if (strikeLeaderIds.has('agitator')) {
        workplace.established_power = Math.max(0, workplace.established_power - 1);
      }

      // Workplace's established_power goes to the capitalist side
      ccEstablished += workplace.established_power ?? 0;

      // union_thugs: opponent rolls 1 fewer die
      const strikeCcDice = strikeLeaderIds.has('union_thugs') ? Math.max(0, ccDice - 1) : ccDice;
      const wcRolls = rollDice(wcDice, rng);
      const ccRolls = rollDice(strikeCcDice, rng);

      const wcTotal = sumSides(wcRolls) + wcEstablished;
      const ccTotal = sumSides(ccRolls) + ccEstablished;

      // barnyard_rustin: ties count as WC victory
      const hasBarnyard = conflict.workingClassCards.some(c => c.id === 'barnyard_rustin');
      const margin = wcTotal - ccTotal;
      if (margin > 0 || (margin === 0 && hasBarnyard)) {
        // Workers win: shift $1 from profits to wages
        const shift = Math.min(1, workplace.profits - MIN_WAGE);
        workplace.wages = Math.max(MIN_WAGE, workplace.wages + shift);
        workplace.profits = Math.max(MIN_WAGE, workplace.profits - shift);
        if (canUnionize(G)) workplace.unionized = true;

        // mechanic: extra $1 shift profits→wages on strike win
        if (strikeLeaderIds.has('mechanic')) {
          const mechShift = Math.min(1, workplace.profits - MIN_WAGE);
          workplace.wages = Math.max(MIN_WAGE, workplace.wages + mechShift);
          workplace.profits = Math.max(MIN_WAGE, workplace.profits - mechShift);
        }

        winner = SocialClass.WorkingClass;
      } else {
        winner = SocialClass.CapitalistClass;

        // hire_scabs bonus: CC wins → shift $1 from wages to profits
        const hasHireScabs = conflict.capitalistCards.some(c => c.id === 'hire_scabs');
        if (hasHireScabs && workplace.wages > MIN_WAGE) {
          workplace.wages -= 1;
          workplace.profits += 1;
        }

        // cleaning_crew: WC loss → steal $1 from CC wealth
        if (strikeLeaderIds.has('cleaning_crew')) {
          const ccPlayer = G.players[SocialClass.CapitalistClass];
          const wcPlayer = G.players[SocialClass.WorkingClass];
          if (ccPlayer.wealth > 0) {
            ccPlayer.wealth -= 1;
            wcPlayer.wealth += 1;
          }
        }
      }

      // hire_private_security: CC wins by 3+ → WC captain to dustbin (handled in cleanup below)
      const hpsBonus = winner === SocialClass.CapitalistClass
        && Math.abs(margin) >= 3
        && conflict.capitalistCards.some(c => c.id === 'hire_private_security');
      // outlaw_strikes: CC wins → WC captain to dustbin
      const outlawStrikes = winner === SocialClass.CapitalistClass && G.laws.includes('outlaw_strikes');
      const captainTodustbin = hpsBonus || outlawStrikes;
      const wcCaptainId = conflict.workingClassCards[0]?.card_type === CardType.Figure
        ? conflict.workingClassCards[0].id
        : undefined;

      // Exhaust all participating figures and return them; send tactics to dustbin
      for (const socialClass of [SocialClass.WorkingClass, SocialClass.CapitalistClass] as const) {
        const cards = socialClass === SocialClass.WorkingClass
          ? conflict.workingClassCards
          : conflict.capitalistCards;
        const clasPlayer = G.players[socialClass];
        for (const card of cards) {
          if (card.card_type === CardType.Figure) {
            if (captainTodustbin && card.id === wcCaptainId) {
              clasPlayer.dustbin.push(card.id);
            } else {
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
        workingClassPower: { diceCount: wcDice, diceRolls: wcRolls, establishedPower: wcEstablished, total: sumSides(wcRolls) + wcEstablished },
        capitalistPower: { diceCount: ccDice, diceRolls: ccRolls, establishedPower: ccEstablished, total: sumSides(ccRolls) + ccEstablished },
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

      const wcRolls = rollDice(wcDice, rng);
      const ccRolls = rollDice(ccDice, rng);
      const wcTotal = sumSides(wcRolls) + wcEstablished;
      const ccTotal = sumSides(ccRolls) + ccEstablished;

      // barnyard_rustin: ties count as WC victory
      const hasBarnyard = conflict.workingClassCards.some(c => c.id === 'barnyard_rustin');
      const effectiveWcTotal = (wcTotal === ccTotal && hasBarnyard) ? ccTotal + 1 : wcTotal;
      const challengerWins = conflict.initiatingClass === SocialClass.WorkingClass
        ? effectiveWcTotal > ccTotal
        : ccTotal > effectiveWcTotal;

      // The candidate is the first card of the initiating class's conflict cards
      const initiatingCards = conflict.initiatingClass === SocialClass.WorkingClass
        ? conflict.workingClassCards
        : conflict.capitalistCards;
      const candidateCard = initiatingCards[0];

      if (challengerWins) {
        winner = conflict.initiatingClass;
        if (!candidateCard || candidateCard.card_type !== CardType.Figure) {
          G.errorMessage = 'Invalid election: no figure candidate at index 0 of initiating class cards.';
          return;
        }
        // Place elected candidate in the office; exhaust them (birdie_feathers never exhausts); set cooldown
        G.politicalOffices[conflict.targetOfficeIndex] = {
          ...candidateCard,
          exhausted: candidateCard.id !== 'birdie_feathers',
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
            const isWinningCandidate = challengerWins && card.id === candidateCard?.id;
            if (!isWinningCandidate) {
              // birdie_feathers never becomes exhausted from elections
              clasPlayer.figures.push({ ...card, exhausted: card.id !== 'birdie_feathers' });
            }
          } else if (card.card_type === CardType.Tactic) {
            clasPlayer.dustbin.push(card.id);
          }
        }
      }

      G.conflictOutcome = {
        conflict: { ...conflict },
        winner,
        workingClassPower: { diceCount: wcDice, diceRolls: wcRolls, establishedPower: wcEstablished, total: wcTotal },
        capitalistPower: { diceCount: ccDice, diceRolls: ccRolls, establishedPower: ccEstablished, total: ccTotal },
        dismissedBy: [],
      };

    } else {
      // Legislation
      const wcRolls = rollDice(wcDice, rng);
      const ccRolls = rollDice(ccDice, rng);
      const wcTotal = sumSides(wcRolls) + wcEstablished;
      const ccTotal = sumSides(ccRolls) + ccEstablished;

      // barnyard_rustin: ties count as WC victory
      const hasBarnyard = conflict.workingClassCards.some(c => c.id === 'barnyard_rustin');
      const effectiveWcTotal = (wcTotal === ccTotal && hasBarnyard) ? ccTotal + 1 : wcTotal;
      const proposerWins = conflict.initiatingClass === SocialClass.WorkingClass
        ? effectiveWcTotal > ccTotal
        : ccTotal > effectiveWcTotal;

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
        workingClassPower: { diceCount: wcDice, diceRolls: wcRolls, establishedPower: wcEstablished, total: wcTotal },
        capitalistPower: { diceCount: ccDice, diceRolls: ccRolls, establishedPower: ccEstablished, total: ccTotal },
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
   * rosa_luxembear: Acting player picks a tactic from their dustbin to retrieve to hand.
   */
  rosaRetrieveTactic: ({ G }, dustbinIndex: number) => {
    if (!G.pendingActivation || G.pendingActivation.type !== 'rosa_luxembear') return;
    const { actingClass } = G.pendingActivation;
    const player = G.players[actingClass];
    if (dustbinIndex < 0 || dustbinIndex >= player.dustbin.length) return;
    const cardId = player.dustbin[dustbinIndex];
    if (!cardId || !isTacticCardID(cardId)) {
      G.errorMessage = 'Selected card is not a tactic.';
      return;
    }
    player.dustbin.splice(dustbinIndex, 1);
    player.hand.push(cardId);
    G.pendingActivation = undefined;
    G.errorMessage = undefined;
  },

  /**
   * sheryl_sandbar: CC picks one card from the opponent's hand to discard.
   */
  sherylDiscardCard: ({ G }, opponentHandIndex: number) => {
    if (!G.pendingActivation || G.pendingActivation.type !== 'sheryl_sandbar') return;
    const { actingClass } = G.pendingActivation;
    const opponentClass = actingClass === SocialClass.WorkingClass
      ? SocialClass.CapitalistClass
      : SocialClass.WorkingClass;
    const opponent = G.players[opponentClass];
    if (opponentHandIndex < 0 || opponentHandIndex >= opponent.hand.length) return;
    const [cardId] = opponent.hand.splice(opponentHandIndex, 1);
    if (cardId) opponent.dustbin.push(cardId);
    G.pendingActivation = undefined;
    G.errorMessage = undefined;
  },

  /**
   * consultant: CC picks effect option.
   * 'wage_shift' — shift $1 from wages to profits at the given workplace index.
   * 'discard' — WC must discard 2 cards (sets pendingActivation to consultant_discard).
   */
  consultantChoose: ({ G }, option: 'wage_shift' | 'discard', workplaceIndex?: number) => {
    if (!G.pendingActivation || G.pendingActivation.type !== 'consultant_choose') return;
    const { actingClass } = G.pendingActivation;
    if (option === 'wage_shift') {
      if (workplaceIndex === undefined) {
        G.errorMessage = 'workplaceIndex is required for wage_shift.';
        return;
      }
      const workplace = G.workplaces[workplaceIndex];
      if (!workplace || workplace === WorkplaceForSale) {
        G.errorMessage = 'No workplace at that index.';
        return;
      }
      if (workplace.wages > MIN_WAGE) {
        workplace.wages -= 1;
        workplace.profits += 1;
      }
      G.pendingActivation = undefined;
    } else {
      const opponentClass = actingClass === SocialClass.WorkingClass
        ? SocialClass.CapitalistClass
        : SocialClass.WorkingClass;
      const discardCount = Math.min(2, G.players[opponentClass].hand.length);
      if (discardCount === 0) {
        G.pendingActivation = undefined;
      } else {
        G.pendingActivation = { type: 'consultant_discard', actingClass: opponentClass, remaining: discardCount };
      }
    }
    G.errorMessage = undefined;
  },

  /**
   * consultant: Opponent discards one card at a time until remaining reaches 0.
   */
  consultantDiscard: ({ G }, handIndex: number) => {
    if (!G.pendingActivation || G.pendingActivation.type !== 'consultant_discard') return;
    const { actingClass, remaining } = G.pendingActivation;
    const player = G.players[actingClass];
    if (handIndex < 0 || handIndex >= player.hand.length) return;
    const [cardId] = player.hand.splice(handIndex, 1);
    if (cardId) player.dustbin.push(cardId);
    if (remaining <= 1) {
      G.pendingActivation = undefined;
    } else {
      G.pendingActivation = { type: 'consultant_discard', actingClass, remaining: remaining - 1 };
    }
    G.errorMessage = undefined;
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
