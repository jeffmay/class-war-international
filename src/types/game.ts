/**
 * Game state types for Class War: International
 */

import { DeckCardID, DemandCardID } from '../data/cards';
import { DemandCardInPlay, FigureCardInPlay, InstitutionCardInPlay, SocialClass, StateFigureCardInPlay, WorkplaceInPlay } from './cards';
import { ConflictOutcome, ConflictState } from './conflicts';

export enum TurnPhase {
  Production = 'Production',
  Action = 'Action',
  Reproduction = 'Reproduction'
}

export interface PlayerState {
  wealth: number;
  hand: DeckCardID[];
  deck: DeckCardID[];
  dustbin: DeckCardID[]; // Discard pile
  institutions: (InstitutionCardInPlay | null)[]; // 2 slots
  demands: (DemandCardInPlay | null)[]; // 2 slots for demand cards
  figures: FigureCardInPlay[];
  maxHandSize: number; // Base 4, can be increased by institutions
  theorizeLimit: number;
  playedWorkplaceThisTurn: boolean;
}

export type UndoState =
  | { canUndo: true; previousActionName: string; previousState: GameState }
  | { canUndo: false; reason: string };

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
  politicalOffices: StateFigureCardInPlay[]; // 3 political offices
  laws: DemandCardID[]; // Passed legislation

  // Conflict state
  activeConflict?: ConflictState;
  conflictOutcome?: ConflictOutcome;
  errorMessage?: string;
  undoState?: UndoState;

  // Game state
  gameStarted: boolean;
}
