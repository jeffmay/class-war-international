/**
 * Card database for Class War: International
 *
 * This is a simplified version for initial implementation.
 * More cards can be added incrementally.
 */

import {
  CardData,
  CardType,
  SocialClass,
  DefaultStateFigureData,
  DefaultWorkplaceData,
  FigureCardData,
  InstitutionCardData,
  DemandCardData,
  WorkplaceCardData,
  TacticCardData,
} from '../types/cards';

// Default workplaces (always in play at start)
export const defaultWorkplaces: Record<string, DefaultWorkplaceData> = {
  corner_store: {
    id: 'corner_store',
    name: 'Corner Store',
    starting_wages: 2,
    starting_profits: 6,
    established_power: 1,
    quote: 'Where dreams go to die, one scanning beep at a time.',
  },
  parts_producer: {
    id: 'parts_producer',
    name: 'Parts Producer',
    starting_wages: 3,
    starting_profits: 9,
    established_power: 2,
    quote: 'Making the little widgets that hold the big widgets together.',
  },
};

// Default state figures (always in play at start)
export const defaultStateFigures: Record<string, DefaultStateFigureData> = {
  populist: {
    id: 'populist',
    name: 'The Populist',
    established_power: 1,
    rules: 'Sides with the class that has more figures in play for a legislative contest',
  },
  centrist: {
    id: 'centrist',
    name: 'The Centrist',
    established_power: 2,
    rules: 'Always supports the incumbent in elections',
  },
  opportunist: {
    id: 'opportunist',
    name: 'The Opportunist',
    established_power: 2,
    rules: 'Can be influenced with money (not yet implemented)',
  },
};

// Working Class Cards
const workingClassFigures: Record<string, FigureCardData> = {
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
};

const workingClassDemands: Record<string, DemandCardData> = {
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
};

const workingClassInstitutions: Record<string, InstitutionCardData> = {
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
};

const workingClassTactics: Record<string, TacticCardData> = {
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
};

// Capitalist Class Cards
const capitalistFigures: Record<string, FigureCardData> = {
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
};

const capitalistDemands: Record<string, DemandCardData> = {
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
};

const capitalistInstitutions: Record<string, InstitutionCardData> = {
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
};

const capitalistWorkplaces: Record<string, WorkplaceCardData> = {
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
};

const capitalistTactics: Record<string, TacticCardData> = {
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
};

// Combine all cards
export const allCards: Record<string, CardData> = {
  ...workingClassFigures,
  ...workingClassDemands,
  ...workingClassInstitutions,
  ...workingClassTactics,
  ...capitalistFigures,
  ...capitalistDemands,
  ...capitalistInstitutions,
  ...capitalistWorkplaces,
  ...capitalistTactics,
};

// Helper to get card by ID
export function getCardData(id: string): CardData {
  const card = allCards[id];
  if (!card) {
    throw new Error(`Card not found: ${id}`);
  }
  return card;
}

// Helper to build initial deck for a class
export function buildDeck(socialClass: SocialClass): string[] {
  const deck: string[] = [];

  Object.values(allCards).forEach((card) => {
    if (card.social_class === socialClass) {
      // Add multiple copies based on qty
      for (let i = 0; i < card.qty; i++) {
        deck.push(card.id);
      }
    }
  });

  return deck;
}
