/**
 * Card database for Class War: International
 *
 * This is a simplified version for initial implementation.
 * More cards can be added incrementally.
 */

import type { ReadonlyDeep } from 'type-fest';
import {
  AnyCardData,
  CardType,
  PlayableCardData,
  DemandCardData,
  FigureCardData,
  InstitutionCardData,
  SocialClass,
  DefaultStateFigureCardData,
  TacticCardData,
  WorkplaceCardData,
} from '../types/cards';

// ─── Default workplaces (always in play at start, qty: 0 keeps them out of decks) ─
// TODO: In the future, the choice of deck and default cards should be externalized from the cards themselves.

export const defaultWorkplaceCards = {
  corner_store: {
    id: 'corner_store',
    name: 'Corner Store',
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Workplace,
    cost: 0, // only used as a starting card
    qty: 0,
    starting_wages: 2,
    starting_profits: 6,
    established_power: 1,
    quote: "Where dreams go to die, one scanning beep at a time.",
  },
  parts_producer: {
    id: 'parts_producer',
    name: 'Parts Producer',
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Workplace,
    cost: 0, // only used as a starting card
    qty: 0,
    starting_wages: 3,
    starting_profits: 9,
    established_power: 2,
    quote: "Making the little widgets that hold the big widgets together.",
  },
} as const satisfies Record<string, WorkplaceCardData>;

// ─── Default state figures (always in play, never in decks) ──────────────────

export const defaultStateFigureCards = {
  populist: {
    id: 'populist',
    name: 'The Populist',
    card_type: CardType.DefaultStateFigure,
    established_power: 1,
    rules: 'Sides with the class that has more figures in play for a legislative contest',
  },
  centrist: {
    id: 'centrist',
    name: 'The Centrist',
    card_type: CardType.DefaultStateFigure,
    established_power: 3,
    rules: 'Always supports the incumbent in elections',
  },
  opportunist: {
    id: 'opportunist',
    name: 'The Opportunist',
    card_type: CardType.DefaultStateFigure,
    established_power: 2,
    rules: 'Can be influenced with money (not yet implemented)',
  },
} as const satisfies Record<string, DefaultStateFigureCardData>;

// ─── Working Class Cards ──────────────────────────────────────────────────────

const workingClassFigureCards = {
  cashier: {
    id: 'cashier',
    name: 'Cashier',
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Figure,
    cost: 2,
    dice: 1,
    hero: false,
    qty: 3,
    quote: 'Minimum wage? More like minimum effort, amirite?',
  },
  activist: {
    id: 'activist',
    name: 'Activist',
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Figure,
    cost: 5,
    dice: 1,
    hero: false,
    qty: 3,
    quote: 'I marched in a protest once. Well, I tweeted about marching.',
  },
  rosa_luxembear: {
    id: 'rosa_luxembear',
    name: 'Rosa Luxembear',
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Figure,
    cost: 8,
    dice: 2,
    hero: true,
    qty: 1,
    rules: 'When first played: You may retrieve a Tactic from your Dustbin to your hand.',
    quote: 'Freedom is always freedom for those who think differently.',
  },
} as const satisfies Record<string, FigureCardData>;

const workingClassDemandCards = {
  wealth_tax: {
    id: 'wealth_tax',
    name: 'Wealth Tax',
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Demand,
    cost: 0,
    qty: 1,
    demand_power_basis: 'Number of your Figures in play.',
    rules: 'When law: At the start of production, if a class has more than $20, they must give half to the bank (rounded down).',
    quote: 'Eat the rich? How about we just nibble on their wallets first.',
  },
  free_health_care: {
    id: 'free_health_care',
    name: 'Free Health Care',
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Demand,
    cost: 0,
    qty: 1,
    demand_power_basis: 'Number of your Figures in play.',
    rules: 'When law: Your Figures cannot be put in the Dustbin by card effects.',
    quote: 'It turns out you CAN put a price on human life -- but we\'re saying you shouldn\'t.',
  },
} as const satisfies Record<string, DemandCardData>;

const workingClassInstitutionCards = {
  political_education_group: {
    id: 'political_education_group',
    name: 'Political Education Group',
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Institution,
    cost: 5,
    established_power: 1,
    qty: 2,
    rules: 'When first played: Increase your max hand size by 1.',
    quote: 'Reading Marx so you don\'t have to.',
  },
} as const satisfies Record<string, InstitutionCardData>;

const workingClassTacticCards = {
  propagandize: {
    id: 'propagandize',
    name: 'Propagandize',
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Tactic,
    cost: 3,
    dice: 2,
    qty: 2,
    rules: 'Support a conflict on any turn: Roll 2 extra dice.',
    quote: 'How do you do, fellow worker?',
  },
} as const satisfies Record<string, TacticCardData>;

// ─── Capitalist Class Cards ───────────────────────────────────────────────────

const capitalistFigureCards = {
  manager: {
    id: 'manager',
    name: 'Manager',
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Figure,
    cost: 7,
    dice: 1,
    hero: false,
    qty: 3,
    quote: 'I\'m not saying I\'m important, but I once got invited to a meeting about scheduling meetings.',
  },
  consultant: {
    id: 'consultant',
    name: 'Consultant',
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Figure,
    cost: 12,
    dice: 1,
    hero: false,
    qty: 3,
    rules: 'When first played, choose one: Shift up to $1 from wages to profits at a Workplace OR your opponent chooses 2 cards to discard.',
    quote: 'Helping corporations save money by suggesting they fire you since 1982.',
  },
  steve_amphibannon: {
    id: 'steve_amphibannon',
    name: 'Steve Amphibannon',
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Figure,
    cost: 20,
    dice: 2,
    hero: true,
    qty: 1,
    rules: 'When first played: You may search your deck for a Demand, shuffle, then put the card on top.',
    quote: 'Let\'s reboot blood and soil for the new generation.',
  },
} as const satisfies Record<string, FigureCardData>;

const capitalistDemandCards = {
  tax_breaks: {
    id: 'tax_breaks',
    name: 'Tax Breaks',
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Demand,
    cost: 0,
    qty: 1,
    demand_power_basis: 'Number of your Workplaces.',
    rules: 'When law: Cards that cost $20 or more cost $5 less.',
    quote: 'Job creators deserve a break. You know, for all that job creating.',
  },
  deregulation: {
    id: 'deregulation',
    name: 'Deregulation',
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Demand,
    cost: 0,
    qty: 1,
    demand_power_basis: 'Number of your Institutions.',
    rules: 'When law: Shift $1 from wages to profits at all existing Workplaces.',
    quote: 'Safety standards are just suggestions anyway.',
  },
} as const satisfies Record<string, DemandCardData>;

const capitalistInstitutionCards = {
  think_tank: {
    id: 'think_tank',
    name: 'Think Tank',
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Institution,
    cost: 8,
    established_power: 1,
    qty: 2,
    rules: 'When first played: Increase your max hand size by 1.',
    quote: 'Where ideology goes to get a fancy PowerPoint presentation.',
  },
} as const satisfies Record<string, InstitutionCardData>;

const capitalistWorkplaceCardById = {
  fast_food_chain: {
    id: 'fast_food_chain',
    name: 'Fast Food Chain',
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Workplace,
    cost: 10,
    established_power: 1,
    starting_wages: 2,
    starting_profits: 10,
    qty: 2,
    quote: 'For a $2.99 lunch, you can\'t afford not to eat questionable meat.',
  },
  superstore: {
    id: 'superstore',
    name: 'Superstore',
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Workplace,
    cost: 20,
    established_power: 1,
    starting_wages: 2,
    starting_profits: 16,
    qty: 2,
    quote: 'Toilet paper and ammunition in bulk, as intended.',
  },
} as const satisfies Record<string, WorkplaceCardData>;

const capitalistTacticCards = {
  union_busting: {
    id: 'union_busting',
    name: 'Union Busting',
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Tactic,
    cost: 10,
    dice: 2,
    qty: 2,
    rules: 'Support a conflict on your turn: Roll 2 extra dice.',
    quote: 'Unions are just like families, except you can fire families.',
  },
} as const satisfies Record<string, TacticCardData>;

// ─── Aggregated lookups ───────────────────────────────────────────────────────

export const figureCardById = {
  ...workingClassFigureCards,
  ...capitalistFigureCards,
} as const satisfies Record<string, FigureCardData>;

export const anyStateFigureCardById = {
  ...figureCardById,
  ...defaultStateFigureCards,
} as const satisfies Record<string, FigureCardData | DefaultStateFigureCardData>;

export const demandCardById = {
  ...workingClassDemandCards,
  ...capitalistDemandCards,
} as const satisfies Record<string, DemandCardData>;

export const institutionCardById = {
  ...workingClassInstitutionCards,
  ...capitalistInstitutionCards,
} as const satisfies Record<string, InstitutionCardData>;

export const tacticCardById = {
  ...workingClassTacticCards,
  ...capitalistTacticCards,
} as const satisfies Record<string, TacticCardData>;

/** Any playable workplace card in the deck */
export const workplaceCardById = capitalistWorkplaceCardById;

/** Any playable or default workplace card (i.e. anything that can occupy a workplace slot on the board) */
export const anyWorkplaceCardById = {
  ...capitalistWorkplaceCardById,
  ...defaultWorkplaceCards,
} as const satisfies Record<string, WorkplaceCardData>

/**
 * All cards that are legal to include in a player's deck, hand, or figures.
 * Default workplaces are included but have qty: 0 so they never appear in
 * a generated deck.
 */
export const cardById = {
  ...figureCardById,
  ...demandCardById,
  ...institutionCardById,
  ...tacticCardById,
  ...workplaceCardById,
} as const satisfies Record<string, PlayableCardData>;

// TODO: The allDeckCards should not need to be distinct from allCards,
// it is just a convenience until we support other starting decks, since
// some of the default cards have no social class, qty, or cost.

/**
 * Every card that can be rendered by CardComponent, including board-only cards
 * (state figures) that are never in a player's deck, hand, or figures.
 */
export const allCards = {
  ...cardById,
  ...defaultStateFigureCards,
  ...defaultWorkplaceCards,
} as const satisfies Record<string, ReadonlyDeep<AnyCardData>>;

export type DemandCardID = keyof typeof demandCardById;
export type FigureCardID = keyof typeof figureCardById;
export type AnyStateFigureCardID = keyof typeof anyStateFigureCardById;
export type InstitutionCardID = keyof typeof institutionCardById;
export type TacticCardID = keyof typeof tacticCardById;
export type WorkplaceCardID = keyof typeof workplaceCardById;

export type DefaultStateFigureID = keyof typeof defaultStateFigureCards;

export type DeckCardID = keyof typeof cardById;
export type CardID = keyof typeof allCards;

export const getDemandDataById = (demandId: DemandCardID): DemandCardData => demandCardById[demandId]
export const getFigureDataById = (figureId: FigureCardID): FigureCardData => figureCardById[figureId]
export const getInstitutionById = (institutionId: InstitutionCardID): InstitutionCardData => institutionCardById[institutionId]
export const getTacticDataById = (tacticId: TacticCardID): TacticCardData => tacticCardById[tacticId]
export const getWorkplaceDataById = (workplaceId: WorkplaceCardID): WorkplaceCardData => workplaceCardById[workplaceId]

export const getAnyStateFigureDataById = (id: AnyStateFigureCardID): FigureCardData | DefaultStateFigureCardData => anyStateFigureCardById[id];

/** Look up any card (player or board-only) by ID. Throws if not found. */
export function getAnyCardData(id: string): AnyCardData {
  const card = allCards[id as keyof typeof allCards];
  if (!card) {
    throw new Error(`Card not found: ${id}`);
  }
  return card;
}

/** Build the initial deck for a player class (excludes qty: 0 cards). */
export function buildDeck(socialClass: SocialClass): DeckCardID[] {
  const deck: DeckCardID[] = [];

  let cardID: DeckCardID;
  for (cardID in cardById) {
    const cardData = cardById[cardID];
    if (cardData.social_class === socialClass) {
      for (let i = 0; i < cardData.qty; i++) {
        deck.push(cardID);
      }
    }
  }

  return deck;
}
