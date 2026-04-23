/**
 * Card type definitions for Class War: International
 */

import { AnyWorkplaceCardID, CardID, DefaultStateFigureID, DemandCardID, FigureCardID, InstitutionCardID, TacticCardID } from "../data/cards";

export enum SocialClass {
  CapitalistClass = 'Capitalist Class',
  WorkingClass = 'Working Class'
}

export enum ConflictType {
  Election = 'Election',
  Strike = 'Strike',
  Legislation = 'Legislation',
}

export enum CardType {
  Figure = 'Figure',
  Institution = 'Institution',
  Demand = 'Demand',
  Workplace = 'Workplace',
  Tactic = 'Tactic',
  /** Political offices and other default state entities — never in a player's deck/hand/figures */
  DefaultStateFigure = 'StateFigure',
}

// TODO: Use string literal types here?
// export type CardId = string;
// export type FigureId = string;
// export type InstitutionId = string;
// export type DemandId = string;
// export type WorkplaceId = string;
// export type TacticId = string;

/** The base card type that contains properties that both cards in play and card data must implement. */
export interface BaseCard {
  id: string;
  card_type: CardType;
  social_class?: SocialClass;
  in_play?: boolean;
}

// Mutable qualities attached to a card that has been activated (aka "in play")
export interface BaseCardInPlay extends BaseCard {
  id: CardID;
  in_play: true;
}

// Base card data (immutable card definitions)
export interface BaseCardData extends BaseCard {
  /** This card can never be in play */
  in_play?: undefined;
  /** The name of a card must be defined for the card data */
  name: string;
  /** A humorous quote related to what is on the card */
  quote?: string;
  /** A description of the rules associated with this card */
  rules?: string;
  /** The cost to activate the card, if playable */
  cost?: number;
}

// TODO: This type is really more for convenience. The game should be able to handle these properties being empty.
export interface BaseDeckCardData extends BaseCardData {
  /** Social class must be defined for a deck card to know which player it can belong to */
  social_class: SocialClass
  /** A deck card must be playable from a player's hand */
  cost: number;
  /**
   * The quantity of cards in the standard deck.
   * 
   * @TODO externalize this to allow for different starting decks.
   */
  qty: number;
}

// Figure cards
export interface FigureCardData extends BaseDeckCardData {
  card_type: CardType.Figure;
  dice: number;
  hero: boolean;
}

export interface FigureCardInPlay extends BaseStateFigureInPlay {
  id: FigureCardID;
  card_type: CardType.Figure;
  exhausted: boolean;
  in_training: boolean;
}

// Institution cards
export interface InstitutionCardData extends BaseDeckCardData {
  card_type: CardType.Institution;
  established_power: number;
}

export interface InstitutionCardInPlay extends BaseCardInPlay {
  id: InstitutionCardID;
  card_type: CardType.Institution;
  /** hedge_fund only: wealth stored on the card */
  storedWealth?: number;
}

// Demand cards (legislation)
export interface DemandCardData extends BaseDeckCardData {
  card_type: CardType.Demand;
  cost: 0; // demands are always free to make
  demand_power_basis: string;
}

export interface DemandCardInPlay extends BaseCardInPlay {
  id: DemandCardID;
  card_type: CardType.Demand;
}

// Workplace cards — all workplaces (player-purchased and default board workplaces)
// belong to the Capitalist Class.  Default workplaces use qty: 0 so they never
// appear in a generated deck, but they are structurally valid WorkplaceCardData.
export interface WorkplaceCardData extends BaseDeckCardData {
  card_type: CardType.Workplace;
  starting_wages: number;
  starting_profits: number;
  established_power: number;
}

export interface WorkplaceCardInPlay extends BaseCardInPlay {
  id: AnyWorkplaceCardID;
  card_type: CardType.Workplace;
  wages: number;
  profits: number;
  unionized: boolean;
  established_power: number;
  /** Number of times this workplace has been expanded (0 = base, 1 = x2, 2 = x3, …) */
  expansionCount?: number;
}

// Tactic cards
export interface TacticCardData extends BaseDeckCardData {
  card_type: CardType.Tactic;
  dice?: number;
  established_power?: number;
  /** Whitelist of conflict types this tactic can be played in. Empty/absent means non-combat only. */
  enabled_by_conflict?: ConflictType[];
}

export interface TacticCardInPlay extends BaseCardInPlay {
  id: TacticCardID;
  card_type: CardType.Tactic;
}

// Union of all player-deck-legal card data types
export type PlayableCardData =
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

// ─── Board-only card types (never in a player's area: either hand or played cards) ───────

export interface BaseBoardCardData extends BaseCardData {
  id: string;
  name: string;
}

/**
 * Properties of any entity in play that can hold political office.
 */
export interface BaseStateFigureInPlay extends BaseCardInPlay {
  /**
   * Turns remaining before this office can be targeted by another election.
   * Set to 1 when a challenger wins an election. Decremented at the start
   * of each WC turn. Undefined (or 0) means the office is open to challenge.
   */
  electionCooldownTurnsRemaining?: number;

  /**
   * If elected to office, the index of the political office.
   */
  state_office_index?: number;
}

/**
 * A political office or other default state figure that is always on the board.
 * Uses card_type: CardType.StateFigure to distinguish it from all player card types.
 */
export interface DefaultStateFigureCardData extends BaseBoardCardData {
  card_type: CardType.DefaultStateFigure;
  established_power: number;
  rules: string;
}

export interface DefaultStateFigureCardInPlay extends BaseStateFigureInPlay {
  id: DefaultStateFigureID;
  card_type: CardType.DefaultStateFigure;
  exhausted: boolean;
}

/** Any card (State Figure) that can run for a Political Office (or occupy) */
export type StateFigureCardData = DefaultStateFigureCardData | FigureCardData;

/** Any card (State Figure) in play that can occupy a Political Office Card Slot */
export type StateFigureCardInPlay = DefaultStateFigureCardInPlay | FigureCardInPlay;

/** All board-only card data types */
export type DefaultCardData = DefaultStateFigureCardData;

/** All board-only cards in play */
export type DefaultCardInPlay = DefaultStateFigureCardInPlay;

/** Every card that can be rendered by CardComponent */
export type AnyCardData = PlayableCardData | DefaultCardData;

/** Every card that can possibly be in play, whether by default or activated by a player */
export type AnyCardInPlay = CardInPlay | DefaultCardInPlay;

/** Anything that can be viewed like a card */
export type AnyCard = AnyCardData | AnyCardInPlay;

// export const WorkplaceForSale = { id: 'workplace_for_sale', card_type: CardType.Workplace } as const;
export const WorkplaceForSale = 'workplace_for_sale' as const;
export type WorkplaceForSale = typeof WorkplaceForSale;

/** A valid entity for a card slot: either a card or a placeholder for a workplace */
export type CardSlotEntity = AnyCard | WorkplaceForSale;
