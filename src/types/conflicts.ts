/**
 * Conflict state types for Class War: International
 */

import { DemandCardID } from '../data/cards';
import { FigureCardInPlay, DefaultStateFigureCardInPlay, StateFigureCardInPlay, TacticCardInPlay, WorkplaceInPlay } from './cards';
import { SocialClass } from './cards';

export enum ConflictType {
  Election = 'Election',
  Strike = 'Strike',
  Legislation = 'Legislation',
}

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
export type ConflictCardInPlay = FigureCardInPlay | DefaultStateFigureCardInPlay | TacticCardInPlay;

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
  targetWorkplace: WorkplaceInPlay;
  strikeLeader: FigureCardInPlay;
}

export interface ElectionConflictState extends BaseConflictState {
  conflictType: ConflictType.Election;
  targetOfficeIndex: number;
  targetIncumbent: StateFigureCardInPlay;
  candidate: FigureCardInPlay;
}

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
    diceRolls: number[];
    establishedPower: number;
    total: number;
  };
  capitalistPower: {
    diceCount: number;
    diceRolls: number[];
    establishedPower: number;
    total: number;
  };
  /** Classes that have dismissed this outcome screen; cleared from GameState when both have dismissed */
  dismissedBy: SocialClass[];
}
