/**
 * Conflict state types for Class War: International
 */

import { DemandCardID } from '../data/cards';
import { ConflictType, DefaultStateFigureCardInPlay, FigureCardInPlay, SocialClass, StateFigureCardInPlay, TacticCardInPlay, WorkplaceCardInPlay } from './cards';

export { ConflictType };

export enum ConflictPhase {
  Initiating = 'initiating',
  Responding = 'responding',
  Resolving = 'resolving',
}

export interface PowerStats {
  diceCount: number;
  establishedPower: number;
}

/** Cards that can participate in a conflict */
export type ConflictCardInPlay = (FigureCardInPlay | DefaultStateFigureCardInPlay | TacticCardInPlay) & {
  /** True when this card was added during the current step (Initiating or Responding); cleared on initiateConflict/planResponse */
  addedThisStep?: boolean;
};

export interface BaseConflictState {
  conflictType: ConflictType;
  workingClassCards: ConflictCardInPlay[];
  capitalistCards: ConflictCardInPlay[];
  active: boolean;
  phase: ConflictPhase;
  initiatingClass: SocialClass;
  /** Whose turn it is within the conflict (may differ from the boardgame.io current player) */
  activeConflictPlayer: SocialClass;
  workingClassPower: PowerStats;
  capitalistPower: PowerStats;
}

export interface StrikeConflictState extends BaseConflictState {
  conflictType: ConflictType.Strike;
  targetWorkplaceIndex: number;
  targetWorkplace: WorkplaceCardInPlay;
  /** Number of leader slots; first maxStrikeLeaders entries of workingClassCards are the leaders */
  maxStrikeLeaders: number;
}

export interface ElectionConflictState extends BaseConflictState {
  conflictType: ConflictType.Election;
  targetOfficeIndex: number;
  targetIncumbent: StateFigureCardInPlay;
  /** First card of the initiating class's conflict cards is the candidate */
}

// TODO: Pass the DemandCardInPlay instead of the ID to track the mutable effects.
export interface LegislationConflictState extends BaseConflictState {
  conflictType: ConflictType.Legislation;
  /** The demand card being proposed as law */
  demandCardId: DemandCardID;
  /** Index in the proposing class's demands array */
  demandSlotIndex: number;
  /** Office index from which this legislation is being proposed */
  proposingOfficeIndex: number;
}

export type ConflictState = StrikeConflictState | ElectionConflictState | LegislationConflictState;

export interface ConflictOutcome {
  conflict: ConflictState;
  winner?: SocialClass;
  workingClassPower: {
    diceCount: number;
    /** Dice results as face sides (0–5). Map through DIE_FACES to get values. */
    diceRolls: number[];
    establishedPower: number;
    total: number;
  };
  capitalistPower: {
    diceCount: number;
    /** Dice results as face sides (0–5). Map through DIE_FACES to get values. */
    diceRolls: number[];
    establishedPower: number;
    total: number;
  };
  /** Classes that have dismissed this outcome screen; cleared from GameState when both have dismissed */
  dismissedBy: SocialClass[];
}
