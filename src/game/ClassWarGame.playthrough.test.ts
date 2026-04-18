/**
 * End-to-end playthrough tests for Class War: International.
 *
 * Each test uses a deterministic fixture (makeActionPhaseState + withCardInHand)
 * so the outcome is the same on every run. Expected values are derived from the
 * current game state rather than hardcoded constants so they stay valid if card
 * or workplace stats are tuned. Where dice matter, Math.random is mocked to
 * always return 0.9 (die value = Math.floor(0.9 * 3) = 2, the maximum).
 *
 * If a precondition cannot be met the test throws an explicit error rather than
 * silently passing or branching, so future rule changes surface immediately.
 */

import { describe, expect, it, vi } from "vitest";
import { buildDeck, cardById } from "../data/cards";
import { CardType, SocialClass, WorkplaceForSale } from "../types/cards";
import { ConflictPhase } from "../types/conflicts";
import { GameState, TurnPhase } from "../types/game";
import { playDemandCard, playFigureCard, playWorkplaceCard } from "../util/game";
import { clientFromFixture, makeActionPhaseState, withCardInHand } from "./generate";

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Total wages WC would collect from the current workplaces. */
function totalWages(G: GameState): number {
  return G.workplaces.reduce((sum, wp) => {
    if (wp === WorkplaceForSale) return sum;
    return sum + wp.wages;
  }, 0);
}

/** Total profits CC would collect from the current workplaces. */
function totalProfits(G: GameState): number {
  return G.workplaces.reduce((sum, wp) => {
    if (wp === WorkplaceForSale) return sum;
    return sum + wp.profits;
  }, 0);
}

/**
 * Advance through a complete WC turn (Action → Reproduction → CC Production).
 * Returns a client positioned at the start of CC's Action phase after collectProduction.
 */
function advanceToCCActionPhase(G: GameState) {
  const client = clientFromFixture({ ...G, turnPhase: TurnPhase.Action });
  client.moves.endActionPhase();
  client.moves.endReproductionPhase();
  client.moves.collectProduction();
  const state = client.getStateOrThrow();
  if (state.G.turnPhase !== TurnPhase.Action) {
    throw new Error("Expected CC Action phase after advancing WC turn");
  }
  return client;
}

// ─── Mock Math.random so dice always roll 2 (the maximum) ────────────────────
// die value = Math.floor(0.9 * 3) = 2.
// Applied only around resolveConflict() to avoid affecting boardgame.io's
// client initialization which also calls Math.random internally.
function resolveWithMaxDice(client: ReturnType<typeof clientFromFixture>) {
  const spy = vi.spyOn(Math, "random").mockReturnValue(0.9);
  client.moves.resolveConflict();
  spy.mockRestore();
}

// ─── Production phase ─────────────────────────────────────────────────────────

describe("collecting wages", () => {
  it("WC collects wages from all workplaces and transitions to Action phase", () => {
    const G: GameState = { ...makeActionPhaseState(), turnPhase: TurnPhase.Production };
    const client = clientFromFixture(G);

    const expectedWages = totalWages(G);
    if (expectedWages === 0) throw new Error("Precondition: workplaces must pay wages");
    const initialWealth = G.players[SocialClass.WorkingClass].wealth;

    client.moves.collectProduction();

    const state = client.getStateOrThrow().G;
    expect(state.players[SocialClass.WorkingClass].wealth).toBe(initialWealth + expectedWages);
    expect(state.turnPhase).toBe(TurnPhase.Action);
  });
});

describe("collecting profits", () => {
  it("CC collects profits from all workplaces and transitions to Action phase", () => {
    // Start in WC Production phase and advance through WC's full turn
    const baseG: GameState = { ...makeActionPhaseState(), turnPhase: TurnPhase.Production };
    const client = clientFromFixture(baseG);

    // WC's turn: collect wages → end action → end reproduction → CC's turn begins
    client.moves.collectProduction();
    client.moves.endActionPhase();
    client.moves.endReproductionPhase();

    // Now in CC's Production phase — read state before collection
    const beforeCollection = client.getStateOrThrow().G;
    if (beforeCollection.turnPhase !== TurnPhase.Production) {
      throw new Error("Precondition: expected CC Production phase");
    }
    const expectedProfits = totalProfits(beforeCollection);
    if (expectedProfits === 0) throw new Error("Precondition: workplaces must pay profits");
    const initialCCWealth = beforeCollection.players[SocialClass.CapitalistClass].wealth;

    client.moves.collectProduction();

    const state = client.getStateOrThrow().G;
    expect(state.players[SocialClass.CapitalistClass].wealth).toBe(initialCCWealth + expectedProfits);
    expect(state.turnPhase).toBe(TurnPhase.Action);
  });
});

// ─── Action phase — playing cards ─────────────────────────────────────────────

describe("playing a figure", () => {
  it("WC trains a figure from hand, paying the cost and marking it in training", () => {
    const wcDeck = buildDeck(SocialClass.WorkingClass);
    const { hand, deck } = withCardInHand(wcDeck, "cashier");
    const figureIdx = 0; // withCardInHand puts cashier at hand[0]
    const cost = cardById.cashier.cost; // $2

    const G = makeActionPhaseState({ hand, deck, wealth: 10 });
    const client = clientFromFixture(G);
    const initialWealth = G.players[SocialClass.WorkingClass].wealth;
    const initialFigures = G.players[SocialClass.WorkingClass].figures.length;

    client.moves.playCardFromHand(figureIdx, "figures[-1]");

    const state = client.getStateOrThrow().G;
    expect(state.players[SocialClass.WorkingClass].wealth).toBe(initialWealth - cost);
    expect(state.players[SocialClass.WorkingClass].figures).toHaveLength(initialFigures + 1);
    expect(state.players[SocialClass.WorkingClass].figures[initialFigures].id).toBe("cashier");
  });
});

describe("making a demand", () => {
  it("WC places a demand card onto an empty demand slot", () => {
    const wcDeck = buildDeck(SocialClass.WorkingClass);
    const { hand, deck } = withCardInHand(wcDeck, "wealth_tax");
    const demandIdx = 0; // wealth_tax is at hand[0]

    const G = makeActionPhaseState({ hand, deck });
    const client = clientFromFixture(G);
    if (G.players[SocialClass.WorkingClass].demands[0] !== null) {
      throw new Error("Precondition: demand slot 0 must be empty");
    }

    client.moves.playCardFromHand(demandIdx, "demands[-1]");

    const state = client.getStateOrThrow().G;
    expect(state.players[SocialClass.WorkingClass].demands[0]).not.toBeNull();
    expect(state.players[SocialClass.WorkingClass].demands[0]?.id).toBe("wealth_tax");
    // Demand was removed from hand
    expect(state.players[SocialClass.WorkingClass].hand).not.toContain("wealth_tax");
  });
});

describe("playing an institution", () => {
  it("WC builds a Political Education Group, paying the cost and increasing max hand size", () => {
    const wcDeck = buildDeck(SocialClass.WorkingClass);
    const { hand, deck } = withCardInHand(wcDeck, "political_education_group");
    const instIdx = 0;
    const cost = cardById.political_education_group.cost; // $4

    const G = makeActionPhaseState({ hand, deck, wealth: 20 });
    const client = clientFromFixture(G);
    const initialWealth = G.players[SocialClass.WorkingClass].wealth;
    const initialMaxHand = G.players[SocialClass.WorkingClass].maxHandSize;
    if (G.players[SocialClass.WorkingClass].institutions[0] !== null) {
      throw new Error("Precondition: institution slot 0 must be empty");
    }

    client.moves.playCardFromHand(instIdx, "institutions[-1]");

    const state = client.getStateOrThrow().G;
    expect(state.players[SocialClass.WorkingClass].wealth).toBe(initialWealth - cost);
    expect(state.players[SocialClass.WorkingClass].institutions[0]?.id).toBe("political_education_group");
    expect(state.players[SocialClass.WorkingClass].maxHandSize).toBe(initialMaxHand + 1);
  });
});

describe("opening a new workplace", () => {
  it("CC opens a Fast Food Chain in an empty workplace slot, paying the cost", () => {
    const ccDeck = buildDeck(SocialClass.CapitalistClass);
    const { hand, deck } = withCardInHand(ccDeck, "fast_food_chain");
    const wpIdx = 0;
    const cost = cardById.fast_food_chain.cost; // $10

    const G = makeActionPhaseState(undefined, { hand, deck, wealth: 30 });
    const client = advanceToCCActionPhase(G);

    const beforeState = client.getStateOrThrow().G;
    const emptySlotIdx = beforeState.workplaces.findIndex((wp) => wp === WorkplaceForSale);
    if (emptySlotIdx === -1) throw new Error("Precondition: must be an empty workplace slot");
    const initialWealth = beforeState.players[SocialClass.CapitalistClass].wealth;

    client.moves.playCardFromHand(wpIdx, "workplaces[-1]");

    const state = client.getStateOrThrow().G;
    const newWp = state.workplaces[emptySlotIdx];
    if (newWp === WorkplaceForSale) throw new Error("Workplace slot should now be filled");
    expect(newWp.id).toBe("fast_food_chain");
    expect(newWp.wages).toBe(cardById.fast_food_chain.starting_wages);
    expect(newWp.profits).toBe(cardById.fast_food_chain.starting_profits);
    expect(state.players[SocialClass.CapitalistClass].wealth).toBe(initialWealth - cost);
  });
});

describe("expanding a workplace", () => {
  it("CC expands an existing Fast Food Chain, increasing wages and profits", () => {
    const ccDeck = buildDeck(SocialClass.CapitalistClass);
    const { hand, deck } = withCardInHand(ccDeck, "fast_food_chain");
    const wpIdx = 0;
    const cost = cardById.fast_food_chain.cost; // $10

    // Pre-place a fast_food_chain at slot 2 (the normally-empty slot) so CC can expand it.
    const existingWp = playWorkplaceCard("fast_food_chain");
    const G = makeActionPhaseState(undefined, { hand, deck, wealth: 30 });
    const GWithWp: GameState = {
      ...G,
      workplaces: [G.workplaces[0], G.workplaces[1], existingWp],
    };

    const client = advanceToCCActionPhase(GWithWp);

    const beforeState = client.getStateOrThrow().G;
    const existingWpIdx = beforeState.workplaces.findIndex(
      (wp) => wp !== WorkplaceForSale && wp.id === "fast_food_chain",
    );
    if (existingWpIdx === -1) throw new Error("Precondition: fast_food_chain must be in a workplace slot");
    const existingWpBefore = beforeState.workplaces[existingWpIdx];
    if (existingWpBefore === WorkplaceForSale) throw new Error("Expected a real workplace, not a for-sale slot");
    const initialWealth = beforeState.players[SocialClass.CapitalistClass].wealth;
    const initialWages = existingWpBefore.wages;
    const initialProfits = existingWpBefore.profits;

    client.moves.playCardFromHand(wpIdx, `workplaces[${existingWpIdx}]/expand`);

    const state = client.getStateOrThrow().G;
    const expandedWp = state.workplaces[existingWpIdx];
    if (expandedWp === WorkplaceForSale) throw new Error("Workplace slot should still be filled after expansion");
    expect(expandedWp.wages).toBe(initialWages + cardById.fast_food_chain.starting_wages);
    expect(expandedWp.profits).toBe(initialProfits + cardById.fast_food_chain.starting_profits);
    expect(state.players[SocialClass.CapitalistClass].wealth).toBe(initialWealth - cost);
    expect(expandedWp.expansionCount).toBe(1);
  });
});

describe("undoing an action", () => {
  it("undoes training a figure, restoring wealth and hand", () => {
    const wcDeck = buildDeck(SocialClass.WorkingClass);
    const { hand, deck } = withCardInHand(wcDeck, "cashier");

    const G = makeActionPhaseState({ hand, deck, wealth: 10 });
    const client = clientFromFixture(G);

    client.moves.playCardFromHand(0, "figures[-1]");
    const afterPlay = client.getStateOrThrow().G;
    expect(afterPlay.players[SocialClass.WorkingClass].figures).toHaveLength(1);

    client.moves.undoMove();

    const afterUndo = client.getStateOrThrow().G;
    expect(afterUndo.players[SocialClass.WorkingClass].figures).toHaveLength(0);
    expect(afterUndo.players[SocialClass.WorkingClass].wealth).toBe(G.players[SocialClass.WorkingClass].wealth);
    expect(afterUndo.players[SocialClass.WorkingClass].hand).toContain("cashier");
  });
});

// ─── Conflict flows ───────────────────────────────────────────────────────────
// Math.random is mocked to 0.9 → die = 2 → initiating class always wins.

describe("strike conflict", () => {
  it("WC wins a strike, shifting $1 from profits to wages at the target workplace", () => {
    const wcDeck = buildDeck(SocialClass.WorkingClass);
    const { hand, deck } = withCardInHand(wcDeck, "union_drive");
    // cashier is already a ready figure (injected via figures override)
    const cashierFigure = playFigureCard("cashier", { in_training: false });
    const G = makeActionPhaseState({ hand, deck, figures: [cashierFigure], wealth: 10 });
    const client = clientFromFixture(G);

    // Workplace 0 is corner_store; read its stats before the conflict
    const initialWp = G.workplaces[0];
    if (initialWp === WorkplaceForSale) throw new Error("Precondition: workplace 0 must exist");
    const beforeWages = initialWp.wages;
    const beforeProfits = initialWp.profits;

    // WC plans strike and adds a tactic (union_drive, $4 cost, +3 dice, Strike only)
    client.moves.planStrike("cashier", 0);
    if (!client.getStateOrThrow().G.activeConflict) throw new Error("Precondition: strike must be initiated");

    const unionDriveIdx = client.getStateOrThrow().G.players[SocialClass.WorkingClass].hand.indexOf("union_drive");
    if (unionDriveIdx === -1) throw new Error("Precondition: union_drive must be in WC hand during conflict");
    client.moves.addTacticToConflict(unionDriveIdx);

    client.moves.initiateConflict(); // pass to CC

    // CC (responding player) skips adding cards
    const afterInitiate = client.getStateOrThrow().G;
    if (afterInitiate.activeConflict?.phase !== ConflictPhase.Responding) {
      throw new Error("Precondition: conflict should be in Responding phase");
    }
    client.moves.planResponse(); // pass back to WC

    resolveWithMaxDice(client);

    const state = client.getStateOrThrow().G;
    expect(state.conflictOutcome).toBeDefined();
    expect(state.conflictOutcome?.winner).toBe(SocialClass.WorkingClass);

    const afterWp = state.workplaces[0];
    if (afterWp === WorkplaceForSale) throw new Error("Workplace should still exist after strike");
    expect(afterWp.wages).toBeGreaterThan(beforeWages);
    expect(afterWp.profits).toBeLessThan(beforeProfits);
  });
});

describe("election conflict", () => {
  it("WC wins an election and places their candidate in a political office", () => {
    const cashierFigure = playFigureCard("cashier", { in_training: false });
    const G = makeActionPhaseState({ figures: [cashierFigure] });
    const client = clientFromFixture(G);

    // Target office 0 (populist) — no cooldown on first turn
    const targetOfficeIdx = 0;
    const targetOffice = G.politicalOffices[targetOfficeIdx];
    if (!targetOffice) throw new Error("Precondition: political office 0 must exist");

    client.moves.planElection("cashier", targetOfficeIdx);
    if (!client.getStateOrThrow().G.activeConflict) throw new Error("Precondition: election must be initiated");

    client.moves.initiateConflict(); // pass to CC
    client.moves.planResponse(); // CC skips, pass back to WC
    resolveWithMaxDice(client);

    const state = client.getStateOrThrow().G;
    expect(state.conflictOutcome?.winner).toBe(SocialClass.WorkingClass);

    // cashier now occupies office 0
    const electedOffice = state.politicalOffices[targetOfficeIdx];
    expect(electedOffice.id).toBe("cashier");
    expect(electedOffice.card_type).toBe(CardType.Figure);
  });
});

describe("legislative conflict", () => {
  it("WC passes a demand into law when they hold a political office and win the conflict", () => {
    // Pre-elect a cashier to office 0 so WC can propose legislation
    const electedFigure = playFigureCard("cashier", { in_training: false });
    const cashierInOffice = { ...electedFigure, electionCooldownTurnsRemaining: 0 };
    const wealthTaxDemand = playDemandCard("wealth_tax");

    const G = makeActionPhaseState({
      demands: [wealthTaxDemand, null],
    });
    const GWithOffice: GameState = {
      ...G,
      politicalOffices: [cashierInOffice, G.politicalOffices[1], G.politicalOffices[2]],
    };

    const client = clientFromFixture(GWithOffice);

    if (GWithOffice.laws.includes("wealth_tax")) {
      throw new Error("Precondition: wealth_tax must not already be law");
    }

    // Propose legislation from office 0, using demand slot 0
    client.moves.planLegislation(0, 0);
    if (!client.getStateOrThrow().G.activeConflict) throw new Error("Precondition: legislation conflict must start");

    client.moves.initiateConflict(); // pass to CC
    client.moves.planResponse(); // CC skips, pass back to WC
    resolveWithMaxDice(client);

    const state = client.getStateOrThrow().G;
    expect(state.conflictOutcome?.winner).toBe(SocialClass.WorkingClass);
    expect(state.laws).toContain("wealth_tax");
  });
});
