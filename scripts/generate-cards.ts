#!/usr/bin/env node
// scripts/generate-cards.ts
// Generates src/data/cards.ts from docs/cards.tsv
// Usage: node --experimental-strip-types scripts/generate-cards.ts

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TSV_PATH = path.join(ROOT, "docs", "cards.tsv");
const OUT_PATH = path.join(ROOT, "src", "data", "cards.ts");

// ─── Parse TSV ────────────────────────────────────────────────────────────────

type CardRow = Record<string, string>;

const tsvContent = fs.readFileSync(TSV_PATH, "utf-8");
const rows = tsvContent.trim().split("\n");
const headers = rows[0].split("\t").map((h) => h.trim());

const cards: CardRow[] = rows.slice(1).map((row) => {
  const cols = row.split("\t");
  const obj: CardRow = {};
  headers.forEach((h, i) => {
    obj[h] = (cols[i] || "").trim();
  });
  return obj;
});

// ─── Value transformations ────────────────────────────────────────────────────

function parseMoney(value: string): number | null {
  if (!value) return null;
  const n = parseFloat(value.replace("$", "").replace(",", ""));
  return isNaN(n) ? null : Math.round(n);
}

function parseDice(value: string): number | null {
  if (!value) return null;
  const n = parseInt(value.replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function parsePower(value: string): number | null {
  if (!value) return null;
  const n = parseInt(value.replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function parseBool(value: string): boolean | null {
  if (value === "TRUE") return true;
  if (value === "FALSE") return false;
  return null;
}

function socialClassExpr(cls: string): string {
  if (cls === "Capitalist") return "SocialClass.CapitalistClass";
  if (cls === "Labor") return "SocialClass.WorkingClass";
  throw new Error(`Unknown class: ${cls}`);
}

function cardTypeExpr(type: string): string {
  switch (type) {
    case "Figure":
      return "CardType.Figure";
    case "Demand":
      return "CardType.Demand";
    case "Institution":
      return "CardType.Institution";
    case "Tactic":
      return "CardType.Tactic";
    case "Workplace":
      return "CardType.Workplace";
    default:
      throw new Error(`Unknown card type: ${type}`);
  }
}

/**
 * Quote a string value per CLAUDE.md rules:
 * - Double quotes by default
 * - Single quotes if string contains double quotes
 * - Backticks if string contains both double and single quotes
 */
function quoteString(s: string): string {
  const hasDouble = s.includes('"');
  const hasSingle = s.includes("'");
  if (!hasDouble) {
    return '"' + s.replace(/\\/g, "\\\\") + '"';
  }
  if (!hasSingle) {
    return "'" + s.replace(/\\/g, "\\\\") + "'";
  }
  // Contains both — use backtick, escape backtick and template literal syntax
  return "`" + s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") + "`";
}

// ─── Card property builders ───────────────────────────────────────────────────

function buildCardProps(card: CardRow): string[] {
  const id = card["ID"].toLowerCase();
  const name = card["Name"];
  const cls = card["Class"];
  const type = card["Type"];
  const qty = parseInt(card["Qty"], 10);
  const cost = parseMoney(card["Cost"]);
  const dice = parseDice(card["Dice"]);
  const power = parsePower(card["Power"]);
  const hero = parseBool(card["Hero"]);
  const wage = parseMoney(card["Wage"]);
  const profit = parseMoney(card["Profit"]);
  const rules = card["Rules"];
  const demandSupport = card["Demand Support"];
  const quote = card["Quote"];

  const props: string[] = [];
  props.push(`id: ${quoteString(id)}`);
  props.push(`name: ${quoteString(name)}`);
  props.push(`social_class: ${socialClassExpr(cls)}`);
  props.push(`card_type: ${cardTypeExpr(type)}`);

  if (type === "Demand") {
    props.push(`cost: 0`);
  } else {
    props.push(`cost: ${cost}`);
  }

  props.push(`qty: ${qty}`);

  if (type === "Figure") {
    if (dice !== null) props.push(`dice: ${dice}`);
    props.push(`hero: ${hero !== null ? hero : false}`);
  }
  if (type === "Institution") {
    // established_power is required; default to 0 if not in TSV
    props.push(`established_power: ${power !== null ? power : 0}`);
  }
  if (type === "Tactic") {
    if (dice !== null) props.push(`dice: ${dice}`);
    if (power !== null) props.push(`established_power: ${power}`);
    const conflictsRaw = card["Conflicts"];
    if (conflictsRaw) {
      const conflictList = conflictsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((c) => `ConflictType.${c}`);
      if (conflictList.length > 0) {
        props.push(`enabled_by_conflict: [${conflictList.join(", ")}]`);
      }
    }
  }
  if (type === "Workplace") {
    props.push(`established_power: ${power !== null ? power : 0}`);
    if (wage !== null) props.push(`starting_wages: ${wage}`);
    if (profit !== null) props.push(`starting_profits: ${profit}`);
  }
  if (rules) props.push(`rules: ${quoteString(rules)}`);
  if (demandSupport) props.push(`demand_power_basis: ${quoteString(demandSupport)}`);
  if (quote) props.push(`quote: ${quoteString(quote)}`);

  return props;
}

function renderCardEntry(card: CardRow, indent = "  "): string {
  const id = card["ID"].toLowerCase();
  const props = buildCardProps(card);
  const lines = props.map((p) => `${indent}  ${p},`).join("\n");
  return `${indent}${id}: {\n${lines}\n${indent}}`;
}

// ─── Group cards by class and type ───────────────────────────────────────────

const byClass = {
  capitalist: cards.filter((c) => c["Class"] === "Capitalist"),
  labor: cards.filter((c) => c["Class"] === "Labor"),
};

const groups = {
  capitalistFigure: byClass.capitalist.filter((c) => c["Type"] === "Figure"),
  capitalistDemand: byClass.capitalist.filter((c) => c["Type"] === "Demand"),
  capitalistInstitution: byClass.capitalist.filter((c) => c["Type"] === "Institution"),
  capitalistTactic: byClass.capitalist.filter((c) => c["Type"] === "Tactic"),
  capitalistWorkplace: byClass.capitalist.filter((c) => c["Type"] === "Workplace"),
  workingClassFigure: byClass.labor.filter((c) => c["Type"] === "Figure"),
  workingClassDemand: byClass.labor.filter((c) => c["Type"] === "Demand"),
  workingClassInstitution: byClass.labor.filter((c) => c["Type"] === "Institution"),
  workingClassTactic: byClass.labor.filter((c) => c["Type"] === "Tactic"),
};

function renderCardEntries(groupCards: CardRow[], indent = "  "): string {
  return groupCards.map((c) => renderCardEntry(c, indent)).join(",\n");
}

function renderSubcategoryRefs(groupCards: CardRow[], indent = "  "): string {
  return groupCards
    .map((c) => `${indent}${c["ID"].toLowerCase()}: cardById.${c["ID"].toLowerCase()},`)
    .join("\n");
}

// ─── Generate output ──────────────────────────────────────────────────────────

const output = `\
// Auto-generated from docs/cards.tsv by scripts/generate-cards.ts
// DO NOT EDIT MANUALLY — edit docs/cards.tsv and run: npm run generate

import type { ReadonlyDeep } from "type-fest";
import {
  AnyCardData,
  CardType,
  ConflictType,
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
${renderCardEntries(cards)},
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
${renderSubcategoryRefs(groups.capitalistFigure)}
} as const satisfies Record<string, FigureCardData>;

export const capitalistDemandCardById = {
${renderSubcategoryRefs(groups.capitalistDemand)}
} as const satisfies Record<string, DemandCardData>;

export const capitalistInstitutionCardById = {
${renderSubcategoryRefs(groups.capitalistInstitution)}
} as const satisfies Record<string, InstitutionCardData>;

export const capitalistTacticCardById = {
${renderSubcategoryRefs(groups.capitalistTactic)}
} as const satisfies Record<string, TacticCardData>;

export const capitalistWorkplaceCardById = {
${renderSubcategoryRefs(groups.capitalistWorkplace)}
} as const satisfies Record<string, WorkplaceCardData>;

// ─── Working class subcategories ──────────────────────────────────────────────

export const workingClassFigureCardById = {
${renderSubcategoryRefs(groups.workingClassFigure)}
} as const satisfies Record<string, FigureCardData>;

export const workingClassDemandCardById = {
${renderSubcategoryRefs(groups.workingClassDemand)}
} as const satisfies Record<string, DemandCardData>;

export const workingClassInstitutionCardById = {
${renderSubcategoryRefs(groups.workingClassInstitution)}
} as const satisfies Record<string, InstitutionCardData>;

export const workingClassTacticCardById = {
${renderSubcategoryRefs(groups.workingClassTactic)}
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

// ─── Type definitions ──────────────────────────────────────────────────────────

export type DemandCardID = keyof typeof demandCardById;
export type FigureCardID = keyof typeof figureCardById;
export type AnyStateFigureCardID = keyof typeof anyStateFigureCardById;
export type InstitutionCardID = keyof typeof institutionCardById;
export type TacticCardID = keyof typeof tacticCardById;
export type WorkplaceCardID = keyof typeof workplaceCardById;

export type DefaultStateFigureID = keyof typeof defaultStateFigureCardById;

export type DeckCardID = keyof typeof cardById;
export type CardID = keyof typeof allCards;
export type AnyWorkplaceCardID = keyof typeof anyWorkplaceCardById;
export type DefaultWorkplaceID = keyof typeof defaultWorkplaceCardById;

// ─── Helper functions ──────────────────────────────────────────────────────────

export const getDemandDataById = (demandId: DemandCardID): DemandCardData => demandCardById[demandId];
export const getFigureDataById = (figureId: FigureCardID): FigureCardData => figureCardById[figureId];
export const getInstitutionById = (institutionId: InstitutionCardID): InstitutionCardData => institutionCardById[institutionId];
export const getTacticDataById = (tacticId: TacticCardID): TacticCardData => tacticCardById[tacticId];
export const getWorkplaceDataById = (workplaceId: WorkplaceCardID): WorkplaceCardData => workplaceCardById[workplaceId];
export const getAnyWorkplaceCardData = (id: AnyWorkplaceCardID): WorkplaceCardData => anyWorkplaceCardById[id];

export const getAnyStateFigureDataById = (id: AnyStateFigureCardID): FigureCardData | DefaultStateFigureCardData => anyStateFigureCardById[id];

/** Look up any card (player or board-only) by ID. Throws if not found. */
export function getAnyCardData(id: string): AnyCardData {
  const card = allCards[id as keyof typeof allCards];
  if (!card) {
    throw new Error(\`Card not found: \${id}\`);
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
`;

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, output, "utf-8");
console.log(`Generated ${OUT_PATH}`);
