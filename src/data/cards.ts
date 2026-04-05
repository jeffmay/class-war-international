// Auto-generated from docs/cards.tsv by scripts/generate-cards.ts
// DO NOT EDIT MANUALLY — edit docs/cards.tsv and run: npm run generate

import type { ReadonlyDeep } from "type-fest";
import {
  AnyCardData,
  CardType,
  DemandCardData,
  DefaultStateFigureCardData,
  FigureCardData,
  InstitutionCardData,
  PlayableCardData,
  SocialClass,
  TacticCardData,
  WorkplaceCardData,
} from "../types/cards";

// ─── All cards parsed from docs/cards.tsv ─────────────────────────────────────

export const cardById = {
  tax_breaks: {
    id: "tax_breaks",
    name: "Tax Breaks",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Demand,
    cost: 0,
    qty: 1,
    rules: "When law: Cards and abilities that cost $15 or more now cost $5 less.",
    demand_power_basis: "Number of your hero Figures in play.",
    quote: "Go Galt -- without leaving the comfort of your mansion!",
  },
  welfare_reform: {
    id: "welfare_reform",
    name: "Welfare Reform",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Demand,
    cost: 0,
    qty: 1,
    rules: "When law: Any Figure that costs $6 or less becomes exhausted at the end of their class's turn.",
    demand_power_basis: "Number of your elected Figures.",
    quote: "This country's notorious bias in favor of the poor finally ends today.",
  },
  stop_voter_fraud: {
    id: "stop_voter_fraud",
    name: "Stop Voter Fraud",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Demand,
    cost: 0,
    qty: 1,
    rules: "When law: No class may roll more than 6 dice when running for office.",
    demand_power_basis: "Number of your elected Figures.",
    quote: "Please provide three forms of ID and a letter from your landlord.",
  },
  deregulation: {
    id: "deregulation",
    name: "Deregulation",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Demand,
    cost: 0,
    qty: 1,
    rules: "When law: All Workplaces become nonunion. Shift up to $2 from wages to profits at all Workplaces (onetime effect).",
    demand_power_basis: "Number of Workplaces with wages at $1.",
    quote: `"Look, friends -- the fact is, children want to work as uranium miners, and mine owners want to pay them in corn syrup. That's called the free market."`,
  },
  outlaw_strikes: {
    id: "outlaw_strikes",
    name: "Outlaw Strikes",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Demand,
    cost: 0,
    qty: 1,
    rules: `"When law: If a Workplace's owner wins a strike, the strike captain is put in the Dustbin."`,
    demand_power_basis: "Number of Workplaces with wages at $1.",
    quote: "How else can we create safe spaces so that we can come together to heal?",
  },
  manager: {
    id: "manager",
    name: "Manager",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Figure,
    cost: 7,
    qty: 3,
    dice: 1,
    hero: false,
    quote: `"When you can't come into the office because you took too many edibles, I'm the guy you email to lie about it."`,
  },
  consultant: {
    id: "consultant",
    name: "Consultant",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Figure,
    cost: 12,
    qty: 3,
    dice: 1,
    hero: false,
    rules: '"When first played, choose one: Shift up to $1 from wages to profits at a Workplace OR your opponent chooses 2 cards to discard."',
    quote: '"Helping corporations save an extra $17,000 a year by downgrading toilet paper quality since 1982."',
  },
  trust_fund_kid: {
    id: "trust_fund_kid",
    name: "Trust Fund Kid",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Figure,
    cost: 13,
    qty: 3,
    dice: 1,
    hero: false,
    rules: '"If you built a new Workplace this turn, you may play this Figure for free."',
    quote: "My dad owns a dealership.",
  },
  corporate_lawyer: {
    id: "corporate_lawyer",
    name: "Corporate Lawyer",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Figure,
    cost: 15,
    qty: 2,
    dice: 1,
    hero: false,
    rules: '"When supporting a conflict: You may pay $10 to reroll 1 die, or $16 to reroll any 2 dice."',
    quote: '"My heroes growing up? Toadies, lackeys, sharks, weasels -- oh, and Atticus Finch."',
  },
  steve_amphibannon: {
    id: "steve_amphibannon",
    name: "Steve Amphibannon",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Figure,
    cost: 20,
    qty: 1,
    dice: 2,
    hero: true,
    rules: '"When first played: You may search your deck or Dustbin for a Demand, shuffle, then put the card on top."',
    quote: `"I had just hopped out of the pool when it hit me: Let's reboot 'blood and soil,' but for the new generation."`,
  },
  sheryl_sandbar: {
    id: "sheryl_sandbar",
    name: "Sheryl Sandbar",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Figure,
    cost: 24,
    qty: 1,
    dice: 2,
    hero: true,
    rules: "When first played: Look at your opponent's hand. Choose a card and place it in their Dustbin.",
    quote: "I was back on the company Zoom while they were still stitching up my C-section -- what's your excuse?",
  },
  nelson_crockafeller: {
    id: "nelson_crockafeller",
    name: "Nelson Crockafeller",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Figure,
    cost: 36,
    qty: 1,
    dice: 3,
    hero: true,
    rules: '"When first played: You may search your deck for an Institution or Workplace, shuffle, then put the card on top."',
    quote: `"Win, lose, we're all equal in the grave. Though, I've already arranged to be buried with a supermodel."`,
  },
  think_tank: {
    id: "think_tank",
    name: "Think Tank",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Institution,
    cost: 12,
    qty: 1,
    established_power: 0,
    rules: "Ongoing: Increase your maximum hand size by 1 additional card.",
    quote: "Where to go to find an Ivy League-trained economist with a chart proving universal health care is speciesist.",
  },
  hedge_fund: {
    id: "hedge_fund",
    name: "Hedge Fund",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Institution,
    cost: 15,
    qty: 1,
    established_power: 0,
    rules: '"Choose one on your turn: Place up to $10 of your wealth on this card OR take back all money on this card, plus an equal amount from the bank."',
    quote: `"We're gods, Jeff. Emperors of capital. We make and break entire civilizations from this office. And even I don't know what the f--- we actually do."`,
  },
  tv_network: {
    id: "tv_network",
    name: "TV Network",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Institution,
    cost: 20,
    qty: 1,
    established_power: 0,
    rules: `"Ongoing: Your opponent's maximum hand size is reduced by 1 card. Once per turn, during a conflict: You may pay $15 to roll 2 extra dice."`,
  },
  capitalist_party: {
    id: "capitalist_party",
    name: "Capitalist Party",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Institution,
    cost: 35,
    qty: 1,
    established_power: 1,
    rules: `"When first played: Search your deck for any Demand, put it on your Platform tile then shuffle. During elections or legislation: Add this card's Established Power to your score."`,
  },
  hire_scabs: {
    id: "hire_scabs",
    name: "Hire Scabs",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Tactic,
    cost: 5,
    qty: 3,
    dice: 2,
    rules: '"React to a strike: Roll 2 extra dice. Bonus: If you win, shift $1 from wages to profits at the Workplace."',
    quote: '"Getting the job done for pennies on the dollar while driving a wedge into the working class? Fist bump, bro!"',
  },
  restructure: {
    id: "restructure",
    name: "Restructure",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Tactic,
    cost: 7,
    qty: 3,
    rules: "Upgrade a Workplace on your turn: Shift up to $1 from wages to profits.",
    quote: '"If 80 is too young to die, is it really too old to work?"',
  },
  call_the_police: {
    id: "call_the_police",
    name: "Call the Police",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Tactic,
    cost: 9,
    qty: 3,
    established_power: 2,
    rules: "Support a conflict on any turn: Add 2 extra points to your score.",
    quote: '"Officer! Officer! There are communists in my office, and they look aggrieved!"',
  },
  automate: {
    id: "automate",
    name: "Automate",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Tactic,
    cost: 12,
    qty: 2,
    rules: '"Upgrade a Workplace on your turn: Add $3 to its profits from the bank. Then, if possible, shift $1 from wages to profits."',
    quote: "This robot doesn't ask for bathroom breaks or sick days. Nor does it object to a good-natured pat on the behind for a job well done.",
  },
  hire_private_security: {
    id: "hire_private_security",
    name: "Hire Private Security",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Tactic,
    cost: 15,
    qty: 2,
    dice: 3,
    rules: `"Support a conflict on any turn: Roll 3 extra dice. Bonus: If you win by 3 points or more, put opponent's leader in the Dustbin."`,
    quote: "You know the guy's good when they have a bounty on him in both Iraq and Afghanistan.",
  },
  mafia_hit: {
    id: "mafia_hit",
    name: "Mafia Hit",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Tactic,
    cost: 40,
    qty: 1,
    rules: "Choose a Figure on your turn: Roll 3 dice. Your opponent rolls 2. - Win: Put targeted card in the Dustbin. - Tie: Reroll once.",
    quote: '"Buddy, I just binged three seasons of The Sopranos waiting for this moment."',
  },
  campaign_contribution: {
    id: "campaign_contribution",
    name: "Campaign Contribution",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Tactic,
    cost: 45,
    qty: 1,
    rules: "On your turn: Choose a State Figure or a nonhero Figure of another class. They will sponsor and support your Demand this turn.",
    quote: `"Cryptocurrency might be harder to track, but you can't snort cocaine through a rolled-up Bitcoin, can you?"`,
  },
  fast_food_chain: {
    id: "fast_food_chain",
    name: "Fast Food Chain",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Workplace,
    cost: 10,
    qty: 2,
    established_power: 1,
    starting_wages: 2,
    starting_profits: 10,
    quote: `"For a $2.99 lunch, you can't afford not to eat a burger that may or may not contain rodent feces and severed fingers."`,
  },
  superstore: {
    id: "superstore",
    name: "Superstore",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Workplace,
    cost: 20,
    qty: 2,
    established_power: 1,
    starting_wages: 2,
    starting_profits: 16,
    quote: '"Toilet paper, peanut butter, and semiautomatic ammunition -- in bulk and in stock, like God and George Washington intended."',
  },
  steel_mill: {
    id: "steel_mill",
    name: "Steel Mill",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Workplace,
    cost: 30,
    qty: 1,
    established_power: 2,
    starting_wages: 3,
    starting_profits: 22,
    quote: '"Once workplaces for millions, now spots for teens to listen to EDM."',
  },
  diamond_mine: {
    id: "diamond_mine",
    name: "Diamond Mine",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Workplace,
    cost: 50,
    qty: 1,
    established_power: 2,
    starting_wages: 2,
    starting_profits: 30,
    quote: "One of those Bond villain enterprises you can't believe is real.",
  },
  wealth_tax: {
    id: "wealth_tax",
    name: "Wealth Tax",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Demand,
    cost: 0,
    qty: 1,
    rules: "When law: Each class ending their turn with over $20 in wealth must give half of all their wealth to the bank.",
    demand_power_basis: "Number of your elected Figures.",
    quote: "Thomas Piketty says 'F--- you. Pay me.'",
  },
  free_health_care: {
    id: "free_health_care",
    name: "Free Health Care",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Demand,
    cost: 0,
    qty: 1,
    rules: "When law: All Figures cost $2 less.",
    demand_power_basis: "Number of your hero Figures in play.",
    quote: '"Medicare for All today, soviet democracy tomorrow!"',
  },
  jobs_program: {
    id: "jobs_program",
    name: "Jobs Program",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Demand,
    cost: 0,
    qty: 1,
    rules: '"When law: Shift $2 from profits to wages at all existing Workplaces, and at new Workplaces when they are built."',
    demand_power_basis: "Number of unionized Workplaces.",
    quote: "And make it one of those good jobs -- where you don't have to smile.",
  },
  anti_corruption: {
    id: "anti_corruption",
    name: "Anti-Corruption",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Demand,
    cost: 0,
    qty: 1,
    rules: "When law: Tactics and abilities cannot be used to target elected Figures. State Figures cannot be influenced with money.",
    demand_power_basis: "Number of your elected Figures.",
    quote: "Taking all the fun out of politics.",
  },
  nationalization: {
    id: "nationalization",
    name: "Nationalization",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Demand,
    cost: 0,
    qty: 1,
    rules: "When law: Choose a unionized Workplace. That Workplace is permanently owned by the Workers. Double the wages. Return all profits to the bank.",
    demand_power_basis: "Number of unionized Workplaces.",
    quote: "We're gonna get all Castro on your ass.",
  },
  cashier: {
    id: "cashier",
    name: "Cashier",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Figure,
    cost: 2,
    qty: 3,
    dice: 1,
    hero: false,
    quote: '"Sure, the pay sucks. But I shoplift a hundred batteries per week."',
  },
  cleaning_crew: {
    id: "cleaning_crew",
    name: "Cleaning Crew",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Figure,
    cost: 3,
    qty: 3,
    dice: 1,
    hero: false,
    rules: `"When leading a strike: If you lose, steal $1 directly from the Capitalists' wealth"`,
    quote: `"If you stare into a kombucha spill long enough, they say you can see the moment of your death. At least that's what my yoga instructor told me."`,
  },
  student_activist: {
    id: "student_activist",
    name: "Student Activist",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Figure,
    cost: 4,
    qty: 3,
    dice: 1,
    hero: false,
    rules: '"When first played: You may search your deck for the first Demand you see, put it on your Platform tile, and shuffle your deck."',
    quote: "I spent freshman year ordering bánh mì from the cafeteria. Then I spent my sophomore year protesting it for being racist.",
  },
  agitator: {
    id: "agitator",
    name: "Agitator",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Figure,
    cost: 4,
    qty: 2,
    dice: 1,
    hero: false,
    rules: "When leading a strike: Reduce the Workplace's Established Power by 1 point.",
    quote: "Shit's gonna get crazy on this factory floor once I tell them about dialectical materialism.",
  },
  union_thugs: {
    id: "union_thugs",
    name: "Union Thugs",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Figure,
    cost: 5,
    qty: 2,
    dice: 2,
    hero: false,
    rules: '"When leading a strike: If your opponent would roll dice, they roll 1 fewer."',
    quote: `"Hey pal, so you thinkn there's no such thing as anti-Italian racism, do ya?"`,
  },
  saboteur: {
    id: "saboteur",
    name: "Saboteur",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Figure,
    cost: 5,
    qty: 2,
    dice: 1,
    hero: false,
    rules: "When leading a conflict: You may flip 1 of your opponent's dice to its opposite side (once per conflict).",
    quote: `"I'm the turd in the punch bowl. I'm the sour note in the chord. I'm the bad apple in the bunch, baby. And I'm the reason your Wi-Fi is so spotty."`,
  },
  mechanic: {
    id: "mechanic",
    name: "Mechanic",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Figure,
    cost: 5,
    qty: 2,
    dice: 2,
    hero: false,
    rules: '"When leading a strike: If you win, move an extra $1 from profits to wages."',
    quote: "I'm afraid of heights. But I really like looking into strangers' windows.",
  },
  nurse: {
    id: "nurse",
    name: "Nurse",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Figure,
    cost: 6,
    qty: 2,
    dice: 1,
    hero: false,
    rules: '"During your Reproduction phase: If this Figure is not exhausted, you may unexhaust another Figure."',
    quote: `"Don't be shy; I see naked bodies every day. Usually, though, they're better looking."`,
  },
  labor_organizer: {
    id: "labor_organizer",
    name: "Labor Organizaer",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Figure,
    cost: 7,
    qty: 2,
    dice: 2,
    hero: false,
    rules: '"When leading a strike: If you win, unionize the targeted Workplace. You may colead the strike with up to 2 other Figures."',
    quote: "The days of milking us for all we've got are over!",
  },
  rosa_luxembear: {
    id: "rosa_luxembear",
    name: "Rosa Luxembear",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Figure,
    cost: 8,
    qty: 1,
    dice: 2,
    hero: true,
    rules: "When first played: You may retrieve a Tactic from your Dustbin to your hand.",
    quote: "Don't get the reference? I'm like Tupac for Jacobin readers.",
  },
  barnyard_rustin: {
    id: "barnyard_rustin",
    name: "Barnyard Rustin",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Figure,
    cost: 9,
    qty: 1,
    dice: 2,
    hero: true,
    rules: "When supporting a conflict: Ties result in your victory.",
    quote: `"They wanna shove this rotten contract down our throats like we'll eat any piece of trash! Well, I don't know about you, but that's not what I'm about!"`,
  },
  birdie_feathers: {
    id: "birdie_feathers",
    name: "Birdie Feathers",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Figure,
    cost: 12,
    qty: 1,
    dice: 3,
    hero: true,
    rules: "When running for office: Birdie does not become exhausted.",
    quote: `"Okay, now that we got the important stuff out of the way, I guess you kids will want to talk about 'cultural appropriation' now, huh?"`,
  },
  barx_and_eagels: {
    id: "barx_and_eagels",
    name: "Barx and Eagels",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Figure,
    cost: 12,
    qty: 1,
    dice: 3,
    hero: true,
    rules: "When first played: You may search your deck for a Demand or Institution. Shuffle and put the card on top.",
    quote: "Best duo since Michael Jordan and Scottie Pippen.",
  },
  political_education_group: {
    id: "political_education_group",
    name: "Political Education Group",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Institution,
    cost: 4,
    qty: 2,
    established_power: 0,
    rules: "Ongoing: Increase your maximum hand size by 1 additional card.",
    quote: "This is what working-class struggle is all about -- reading Jacobin with strangers twice a month.",
  },
  activist_organization: {
    id: "activist_organization",
    name: "Activist Organization",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Institution,
    cost: 8,
    qty: 1,
    established_power: 0,
    rules: "The first Figure you play on each turn does not need to be trained.",
    quote: "The erasure of the communist juggalo community stops today.",
  },
  labor_council: {
    id: "labor_council",
    name: "Labor Council",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Institution,
    cost: 9,
    qty: 1,
    established_power: 1,
    rules: `"When striking: Add this card's Established Power to your score. If you win by more than 2 points, unionize the Workplace."`,
    quote: "When you elect your fellow workers to meet twice a month in order to finally get peanut M&M's in the break room vending machine.",
  },
  workers_party: {
    id: "workers_party",
    name: "Workers Party",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Institution,
    cost: 14,
    qty: 1,
    established_power: 1,
    rules: `"When first played: Search your deck for any Demand, put it on your Platform tile, then shuffle. During elections or legislation: Add this card's Established Power to your score."`,
    quote: "The revolution starts with getting Jesse Ventura on the ballot in Nebraska.",
  },
  propagandize: {
    id: "propagandize",
    name: "Propagandize",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Tactic,
    cost: 3,
    qty: 2,
    dice: 2,
    rules: "Support a conflict on any turn: Roll 2 extra dice.",
    quote: '"How do you do, fellow worker? Have you ever read the work of Slavoj Žižek?"',
  },
  union_drive: {
    id: "union_drive",
    name: "Union Drive",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Tactic,
    cost: 4,
    qty: 2,
    dice: 3,
    rules: '"Support a strike on your turn: Roll 3 extra dice. If you win, unionize the Workplace."',
    quote: '"Remember when I asked you to replace my desk chair with a yoga ball and you said no? Well, buddy, tell it to the union!"',
  },
  canvass: {
    id: "canvass",
    name: "Canvass",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Tactic,
    cost: 4,
    qty: 2,
    rules: "Support a conflict on your turn: Roll 1 extra die for each of your participating Figures.",
    quote: `"If we can't organize slam poets, podcasters, and MSNBC pundits, we can't organize America!"`,
  },
  mass_rally: {
    id: "mass_rally",
    name: "Mass Rally",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Tactic,
    cost: 5,
    qty: 1,
    dice: 3,
    rules: "Support a conflict on any turn: Roll 3 extra dice.",
    quote: "Do you thinkn it's too much if I wear both my Guy Fawkes mask and my pussyhat at the same time?",
  },
  arson: {
    id: "arson",
    name: "Arson",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Tactic,
    cost: 5,
    qty: 1,
    rules: "Choose a Workplace or Institution on your turn: Roll 3 dice. Your opponent rolls 2. - Win: Put targeted card in the Dustbin. - Lose: Put one of your Figures in the Dustbin. - Tie: Do both.",
    quote: `"While all those nerds are sitting around reading Barx and Eagels, we're out here burning down a Jamba Juice!"`,
  },
  general_strike: {
    id: "general_strike",
    name: "General Strike",
    social_class: SocialClass.WorkingClass,
    card_type: CardType.Tactic,
    cost: 10,
    qty: 1,
    rules: "On your turn: Take an extra turn after this one. Do not take wages from the bank during the extra turn's Production phase.",
    quote: `"What if millions of people didn't show up for work one day, and it's all because you tweeted #GeneralStrikeNow?"`,
  },
} as const satisfies Record<string, AnyCardData>;

// ─── Default state figures (always in play, never in player decks) ────────────

export const defaultStateFigureCardById = {
  populist: {
    id: "populist",
    name: "The Populist",
    card_type: CardType.DefaultStateFigure,
    established_power: 1,
    rules: "Sides with the class that has more figures in play for a legislative contest",
  },
  centrist: {
    id: "centrist",
    name: "The Centrist",
    card_type: CardType.DefaultStateFigure,
    established_power: 3,
    rules: "Always supports the incumbent in elections",
  },
  opportunist: {
    id: "opportunist",
    name: "The Opportunist",
    card_type: CardType.DefaultStateFigure,
    established_power: 2,
    rules: "Can be influenced with money (not yet implemented)",
  },
} as const satisfies Record<string, DefaultStateFigureCardData>;

// ─── Default workplaces (always in play at game start, never in player decks) ─

export const defaultWorkplaceCardById = {
  corner_store: {
    id: "corner_store",
    name: "Corner Store",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Workplace,
    cost: 0,
    qty: 0,
    starting_wages: 2,
    starting_profits: 6,
    established_power: 1,
    quote: "Where dreams go to die, one scanning beep at a time.",
  },
  parts_producer: {
    id: "parts_producer",
    name: "Parts Producer",
    social_class: SocialClass.CapitalistClass,
    card_type: CardType.Workplace,
    cost: 0,
    qty: 0,
    starting_wages: 3,
    starting_profits: 9,
    established_power: 2,
    quote: "Making the little widgets that hold the big widgets together.",
  },
} as const satisfies Record<string, WorkplaceCardData>;

// ─── Capitalist subcategories ──────────────────────────────────────────────────

export const capitalistFigureCardById = {
  manager: cardById.manager,
  consultant: cardById.consultant,
  trust_fund_kid: cardById.trust_fund_kid,
  corporate_lawyer: cardById.corporate_lawyer,
  steve_amphibannon: cardById.steve_amphibannon,
  sheryl_sandbar: cardById.sheryl_sandbar,
  nelson_crockafeller: cardById.nelson_crockafeller,
} as const satisfies Record<string, FigureCardData>;

export const capitalistDemandCardById = {
  tax_breaks: cardById.tax_breaks,
  welfare_reform: cardById.welfare_reform,
  stop_voter_fraud: cardById.stop_voter_fraud,
  deregulation: cardById.deregulation,
  outlaw_strikes: cardById.outlaw_strikes,
} as const satisfies Record<string, DemandCardData>;

export const capitalistInstitutionCardById = {
  think_tank: cardById.think_tank,
  hedge_fund: cardById.hedge_fund,
  tv_network: cardById.tv_network,
  capitalist_party: cardById.capitalist_party,
} as const satisfies Record<string, InstitutionCardData>;

export const capitalistTacticCardById = {
  hire_scabs: cardById.hire_scabs,
  restructure: cardById.restructure,
  call_the_police: cardById.call_the_police,
  automate: cardById.automate,
  hire_private_security: cardById.hire_private_security,
  mafia_hit: cardById.mafia_hit,
  campaign_contribution: cardById.campaign_contribution,
} as const satisfies Record<string, TacticCardData>;

export const capitalistWorkplaceCardById = {
  fast_food_chain: cardById.fast_food_chain,
  superstore: cardById.superstore,
  steel_mill: cardById.steel_mill,
  diamond_mine: cardById.diamond_mine,
} as const satisfies Record<string, WorkplaceCardData>;

// ─── Working class subcategories ──────────────────────────────────────────────

export const workingClassFigureCardById = {
  cashier: cardById.cashier,
  cleaning_crew: cardById.cleaning_crew,
  student_activist: cardById.student_activist,
  agitator: cardById.agitator,
  union_thugs: cardById.union_thugs,
  saboteur: cardById.saboteur,
  mechanic: cardById.mechanic,
  nurse: cardById.nurse,
  labor_organizer: cardById.labor_organizer,
  rosa_luxembear: cardById.rosa_luxembear,
  barnyard_rustin: cardById.barnyard_rustin,
  birdie_feathers: cardById.birdie_feathers,
  barx_and_eagels: cardById.barx_and_eagels,
} as const satisfies Record<string, FigureCardData>;

export const workingClassDemandCardById = {
  wealth_tax: cardById.wealth_tax,
  free_health_care: cardById.free_health_care,
  jobs_program: cardById.jobs_program,
  anti_corruption: cardById.anti_corruption,
  nationalization: cardById.nationalization,
} as const satisfies Record<string, DemandCardData>;

export const workingClassInstitutionCardById = {
  political_education_group: cardById.political_education_group,
  activist_organization: cardById.activist_organization,
  labor_council: cardById.labor_council,
  workers_party: cardById.workers_party,
} as const satisfies Record<string, InstitutionCardData>;

export const workingClassTacticCardById = {
  propagandize: cardById.propagandize,
  union_drive: cardById.union_drive,
  canvass: cardById.canvass,
  mass_rally: cardById.mass_rally,
  arson: cardById.arson,
  general_strike: cardById.general_strike,
} as const satisfies Record<string, TacticCardData>;

// ─── Union groups ──────────────────────────────────────────────────────────────

export const figureCardById = {
  ...capitalistFigureCardById,
  ...workingClassFigureCardById,
} as const satisfies Record<string, FigureCardData>;

export const anyStateFigureCardById = {
  ...figureCardById,
  ...defaultStateFigureCardById,
} as const satisfies Record<string, FigureCardData | DefaultStateFigureCardData>;

export const demandCardById = {
  ...capitalistDemandCardById,
  ...workingClassDemandCardById,
} as const satisfies Record<string, DemandCardData>;

export const institutionCardById = {
  ...capitalistInstitutionCardById,
  ...workingClassInstitutionCardById,
} as const satisfies Record<string, InstitutionCardData>;

export const tacticCardById = {
  ...capitalistTacticCardById,
  ...workingClassTacticCardById,
} as const satisfies Record<string, TacticCardData>;

/** Any playable workplace card in the deck */
export const workplaceCardById = capitalistWorkplaceCardById;

/** Any playable or default workplace card (i.e. anything that can occupy a workplace slot on the board) */
export const anyWorkplaceCardById = {
  ...capitalistWorkplaceCardById,
  ...defaultWorkplaceCardById,
} as const satisfies Record<string, WorkplaceCardData>;

/**
 * All cards that are legal to include in a player's deck, hand, or figures.
 */
export { cardById as allDeckCardById };

/**
 * Every card that can be rendered by CardComponent, including board-only cards
 * (state figures) that are never in a player's deck, hand, or figures.
 */
export const allCards = {
  ...cardById,
  ...defaultStateFigureCardById,
  ...defaultWorkplaceCardById,
} as const satisfies Record<string, ReadonlyDeep<AnyCardData>>;

// ─── Backward-compatible aliases ───────────────────────────────────────────────
// These preserve old export names used throughout the codebase.

/** @deprecated Use defaultStateFigureCardById */
export const defaultStateFigureCards = defaultStateFigureCardById;
/** @deprecated Use defaultWorkplaceCardById */
export const defaultWorkplaceCards = defaultWorkplaceCardById;

// ─── Type definitions ──────────────────────────────────────────────────────────

export type DemandCardID = keyof typeof demandCardById;
export type FigureCardID = keyof typeof figureCardById;
export type AnyStateFigureCardID = keyof typeof anyStateFigureCardById;
export type InstitutionCardID = keyof typeof institutionCardById;
export type TacticCardID = keyof typeof tacticCardById;
export type WorkplaceCardID = keyof typeof workplaceCardById;
export type AnyWorkplaceCardID = keyof typeof anyWorkplaceCardById;

export type DefaultStateFigureID = keyof typeof defaultStateFigureCardById;
export type DefaultWorkplaceID = keyof typeof defaultWorkplaceCardById;

export type DeckCardID = keyof typeof cardById;
export type CardID = keyof typeof allCards;

// ─── Helper functions ──────────────────────────────────────────────────────────

export const getDemandDataById = (demandId: DemandCardID): DemandCardData => demandCardById[demandId];
export const getFigureDataById = (figureId: FigureCardID): FigureCardData => figureCardById[figureId];
export const getInstitutionById = (institutionId: InstitutionCardID): InstitutionCardData => institutionCardById[institutionId];
export const getTacticDataById = (tacticId: TacticCardID): TacticCardData => tacticCardById[tacticId];
export const getWorkplaceDataById = (workplaceId: WorkplaceCardID): WorkplaceCardData => workplaceCardById[workplaceId];

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
      for (let i = 0; i < (cardData as PlayableCardData).qty; i++) {
        deck.push(cardID);
      }
    }
  }

  return deck;
}
