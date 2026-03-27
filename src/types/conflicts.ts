/**
 * Conflict state types for Class War: International
 */

import { FigureCardInPlay, StateFigureCardInPlay, WorkplaceInPlay } from './cards';
import { SocialClass } from './cards';

export enum ConflictType {
  Election = 'Election',
  Strike = 'Strike',
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
export type ConflictCardInPlay = FigureCardInPlay | StateFigureCardInPlay;

export interface BaseConflictState {
  conflictType: ConflictType;
  workingClassCards: ConflictCardInPlay[];
  capitalistCards: ConflictCardInPlay[];
  active: boolean;
  phase: ConflictPhase;
  initiatingClass: SocialClass;
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

export type ConflictState = StrikeConflictState | ElectionConflictState;

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
}
