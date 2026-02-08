/**
 * Card type definitions for Class War: International
 */

export enum SocialClass {
  CapitalistClass = 'Capitalist Class',
  WorkingClass = 'Working Class'
}

export enum CardType {
  Figure = 'Figure',
  Institution = 'Institution',
  Demand = 'Demand',
  Workplace = 'Workplace',
  Tactic = 'Tactic',
}

export type CardId = string;
export type FigureId = string;
export type InstitutionId = string;
export type DemandId = string;
export type WorkplaceId = string;
export type TacticId = string;

// Base card data (immutable card definitions)
export interface BaseCardData {
  id: CardId;
  name: string;
  social_class: SocialClass;
  card_type: CardType;
  cost: number;
  quote: string;
  rules?: string;
  qty: number;
}

// Figure cards
export interface FigureCardData extends BaseCardData {
  card_type: CardType.Figure;
  dice: number;
  hero: boolean;
}

export interface FigureCardInPlay {
  id: FigureId;
  card_type: CardType.Figure;
  exhausted: boolean;
  in_training: boolean;
  state_office_index?: number; // If elected to office
}

// Institution cards
export interface InstitutionCardData extends BaseCardData {
  card_type: CardType.Institution;
  established_power: number;
}

export interface InstitutionCardInPlay {
  id: InstitutionId;
  card_type: CardType.Institution;
}

// Demand cards (legislation)
export interface DemandCardData extends BaseCardData {
  card_type: CardType.Demand;
  cost: 0;
  demand_power_basis: string;
}

export interface DemandCardInPlay {
  id: DemandId;
  card_type: CardType.Demand;
}

// Workplace cards
export interface WorkplaceCardData extends BaseCardData {
  card_type: CardType.Workplace;
  starting_wages: number;
  starting_profits: number;
  established_power: number;
}

export interface WorkplaceCardInPlay {
  id: WorkplaceId;
  card_type: CardType.Workplace;
  wages: number;
  profits: number;
  unionized: boolean;
  established_power: number;
}

// Tactic cards
export interface TacticCardData extends BaseCardData {
  card_type: CardType.Tactic;
  dice?: number;
  established_power?: number;
}

export interface TacticCardInPlay {
  id: TacticId;
  card_type: CardType.Tactic;
}

// Union types
export type CardData =
  | FigureCardData
  | InstitutionCardData
  | DemandCardData
  | WorkplaceCardData
  | TacticCardData;

export type CardInPlay =
  | FigureCardInPlay
  | InstitutionCardInPlay
  | DemandCardInPlay
  | WorkplaceCardInPlay
  | TacticCardInPlay;

// Default entities (non-card entities)
export interface DefaultStateFigureData {
  id: string;
  name: string;
  established_power: number;
  rules: string;
}

export interface StateFigureInPlay {
  id: string;
  figureId?: FigureId; // If a player figure was elected
  exhausted: boolean;
}

export interface DefaultWorkplaceData {
  id: string;
  name: string;
  starting_wages: number;
  starting_profits: number;
  established_power: number;
  quote: string;
}

export interface WorkplaceInPlay {
  id: string;
  workplaceId?: WorkplaceId; // If a workplace card was played here
  wages: number;
  profits: number;
  unionized: boolean;
  established_power: number;
}
