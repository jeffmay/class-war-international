/**
 * Game state types for Class War: International
 */

import { DeckCardID, DemandCardID } from '../data/cards';
import { DemandCardInPlay, FigureCardInPlay, InstitutionCardInPlay, SocialClass, StateFigureCardInPlay, WorkplaceCardInPlay, WorkplaceForSale } from './cards';
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

/**
 * Represents an activation effect that requires a follow-up player action.
 * Set on GameState when a figure is played whose effect needs a choice.
 */
export type PendingActivation =
  /** rosa_luxembear: WC picks any tactic from their dustbin to add to hand */
  | { type: 'rosa_luxembear'; actingClass: SocialClass }
  /** sheryl_sandbar: CC picks one card from WC's hand to discard */
  | { type: 'sheryl_sandbar'; actingClass: SocialClass }
  /** consultant step 1: CC picks the effect (wage shift or opponent discards) */
  | { type: 'consultant_choose'; actingClass: SocialClass; workplaceIndex?: number }
  /** consultant step 2: WC discards remaining cards */
  | { type: 'consultant_discard'; actingClass: SocialClass; remaining: number };

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
  workplaces: (WorkplaceCardInPlay | WorkplaceForSale)[]; // 3 workplace slots
  politicalOffices: StateFigureCardInPlay[]; // 3 political offices
  laws: DemandCardID[]; // Passed legislation

  // Conflict state
  activeConflict?: ConflictState;
  conflictOutcome?: ConflictOutcome;
  errorMessage?: string;
  undoState?: UndoState;

  // Activation state: requires player follow-up before next action
  pendingActivation?: PendingActivation;

  // Game state
  gameStarted: boolean;
}
