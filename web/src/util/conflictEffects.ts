/**
 * Utilities for deriving human-readable conflict effects from cards and active laws.
 */

import { ConflictType, SocialClass } from "@shared/types/cards";
import { ConflictCardInPlay } from "@shared/types/conflicts";
import { DemandCardID, demandCardById, getAnyCardData } from "@shared/data/cards";

export interface ConflictEffect {
  cardId: string;
  cardName: string;
  ownerClass: SocialClass;
  /** Which side's column to render this effect in */
  displaySide: "own" | "opponent";
  diceDelta?: number;
  powerDelta?: number;
  summary: string;
  isAbility?: boolean;
}

type EffectTemplate = Omit<ConflictEffect, "cardId" | "cardName" | "ownerClass">;

const CARD_CONFLICT_EFFECTS: Partial<Record<string, EffectTemplate>> = {
  // Working Class Figures
  agitator: { displaySide: "opponent", powerDelta: -1, summary: "−1 ⚫ Workplace power" },
  union_thugs: { displaySide: "opponent", diceDelta: -1, summary: "−1 🎲 for opponent" },
  saboteur: { displaySide: "opponent", summary: "Flip 1 opponent die", isAbility: true },
  mechanic: { displaySide: "own", summary: "Win: +$1 wages from profits" },
  barnyard_rustin: { displaySide: "own", summary: "Ties count as your victory" },
  birdie_feathers: { displaySide: "own", summary: "Does not exhaust after running for office" },
  cleaning_crew: { displaySide: "own", summary: "Lose: steal $1 from opponent" },
  // Capitalist Class Figures
  corporate_lawyer: { displaySide: "own", summary: "Pay $10: reroll 1 die | $16: reroll 2 dice", isAbility: true },
  // Capitalist Class Tactics
  hire_scabs: { displaySide: "own", summary: "Win: shift $1 wages→profits" },
  hire_private_security: { displaySide: "own", summary: "Win by 3+: opponent leader to Dustbin" },
  // Working Class Tactics
  union_drive: { displaySide: "own", summary: "Win: unionize the Workplace" },
  canvass: { displaySide: "own", summary: "+1 🎲 per participating Figure" },
};

type LawEffectTemplate = EffectTemplate & {
  conflictTypes?: ConflictType[];
};

const LAW_CONFLICT_EFFECTS: Partial<Record<DemandCardID, LawEffectTemplate>> = {
  stop_voter_fraud: {
    displaySide: "own",
    summary: "Max 6 🎲 per side in elections",
    conflictTypes: [ConflictType.Election],
  },
  outlaw_strikes: {
    displaySide: "opponent",
    summary: "CC wins: WC strike captain to Dustbin",
    conflictTypes: [ConflictType.Strike],
  },
};

export function getConflictCardEffects(
  cards: ConflictCardInPlay[],
  ownerClass: SocialClass,
): ConflictEffect[] {
  const effects: ConflictEffect[] = [];
  for (const card of cards) {
    const template = CARD_CONFLICT_EFFECTS[card.id];
    if (!template) continue;
    const cardData = getAnyCardData(card.id);
    effects.push({
      cardId: card.id,
      cardName: cardData.name,
      ownerClass,
      ...template,
    });
  }
  return effects;
}

export function getConflictLawEffects(
  laws: DemandCardID[],
  conflictType: ConflictType,
): ConflictEffect[] {
  const effects: ConflictEffect[] = [];
  for (const lawId of laws) {
    const template = LAW_CONFLICT_EFFECTS[lawId];
    if (!template) continue;
    if (template.conflictTypes && !template.conflictTypes.includes(conflictType)) continue;
    const cardData = demandCardById[lawId];
    effects.push({
      cardId: lawId,
      cardName: cardData.name,
      ownerClass: cardData.social_class,
      displaySide: template.displaySide,
      summary: template.summary,
      ...(template.diceDelta !== undefined ? { diceDelta: template.diceDelta } : {}),
      ...(template.powerDelta !== undefined ? { powerDelta: template.powerDelta } : {}),
      ...(template.isAbility !== undefined ? { isAbility: template.isAbility } : {}),
    });
  }
  return effects;
}

/**
 * Returns all effects to display in a given side's column.
 * Includes own-class beneficial effects and opponent-class cross-side detrimental effects.
 */
export function getEffectsForColumn(
  columnClass: SocialClass,
  allEffects: ConflictEffect[],
): ConflictEffect[] {
  return allEffects.filter(effect => {
    const isOwner = effect.ownerClass === columnClass;
    return (isOwner && effect.displaySide === "own") ||
      (!isOwner && effect.displaySide === "opponent");
  });
}
