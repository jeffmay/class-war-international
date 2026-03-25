/**
 * Game state types for Class War: International
 */

import { CardId, DemandId, FigureCardInPlay, InstitutionCardInPlay, DemandCardInPlay, WorkplaceInPlay, StateFigureInPlay, SocialClass } from './cards';
import { ConflictOutcome, ConflictState } from './conflicts';

export enum TurnPhase {
  Production = 'Production',
  Action = 'Action',
  Reproduction = 'Reproduction'
}

export interface PlayerState {
  wealth: number;
  hand: CardId[];
  deck: CardId[];
  dustbin: CardId[]; // Discard pile
  institutions: (InstitutionCardInPlay | null)[]; // 2 slots
  demands: (DemandCardInPlay | null)[]; // 2 slots for demand cards
  figures: FigureCardInPlay[];
  maxHandSize: number; // Base 4, can be increased by institutions
  playedWorkplaceThisTurn: boolean;
}

export interface GameState {
  // Turn management
  turnPhase: TurnPhase;
  turnNumber: number; // Increments when Working Class starts their turn

  // Player states
  players: {
    [SocialClass.WorkingClass]: PlayerState;
    [SocialClass.CapitalistClass]: PlayerState;
  };

  // Shared board state
  workplaces: WorkplaceInPlay[]; // 3 workplace slots
  politicalOffices: StateFigureInPlay[]; // 3 political offices
  laws: DemandId[]; // Passed legislation

  // Conflict state
  activeConflict?: ConflictState;
  conflictOutcome?: ConflictOutcome;
  errorMessage?: string;

  // Game state
  gameStarted: boolean;
}
