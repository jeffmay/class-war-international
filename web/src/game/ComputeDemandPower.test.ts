/**
 * Tests for computeDemandPower
 */

import { SocialClass } from "@shared/types/cards";
import { computeDemandPower } from "@shared/util/game";
import { playFigureCard, playWorkplaceCard } from "@shared/util/game";
import { makeActionPhaseState } from "./generate";

// ── "Number of your hero Figures in play." ────────────────────────────────────

describe("computeDemandPower: hero figures (tax_breaks, free_health_care)", () => {
  test("returns 0 when proposing class has no hero figures", () => {
    const G = makeActionPhaseState({ figures: [] });
    expect(computeDemandPower(G, "free_health_care", SocialClass.WorkingClass)).toBe(0);
  });

  test("counts 1 hero figure in the figures area", () => {
    const rosa = playFigureCard("rosa_luxembear", { in_training: false });
    const G = makeActionPhaseState({ figures: [rosa] });
    expect(computeDemandPower(G, "free_health_care", SocialClass.WorkingClass)).toBe(1);
  });

  test("counts multiple hero figures", () => {
    const rosa = playFigureCard("rosa_luxembear", { in_training: false });
    const birdie = playFigureCard("birdie_feathers", { in_training: false });
    const G = makeActionPhaseState({ figures: [rosa, birdie] });
    expect(computeDemandPower(G, "free_health_care", SocialClass.WorkingClass)).toBe(2);
  });

  test("does not count non-hero figures", () => {
    const cashier = playFigureCard("cashier", { in_training: false });
    const G = makeActionPhaseState({ figures: [cashier] });
    expect(computeDemandPower(G, "free_health_care", SocialClass.WorkingClass)).toBe(0);
  });

  test("counts CC hero figures for tax_breaks", () => {
    const nelson = playFigureCard("nelson_crockafeller", { in_training: false });
    const G = makeActionPhaseState(
      undefined,
      { figures: [nelson] },
    );
    expect(computeDemandPower(G, "tax_breaks", SocialClass.CapitalistClass)).toBe(1);
  });

  test("does not count WC heroes for CC demand", () => {
    const rosa = playFigureCard("rosa_luxembear", { in_training: false });
    const G = makeActionPhaseState({ figures: [rosa] });
    expect(computeDemandPower(G, "tax_breaks", SocialClass.CapitalistClass)).toBe(0);
  });
});

// ── "Number of your elected Figures." ────────────────────────────────────────

describe("computeDemandPower: elected figures (wealth_tax, anti_corruption, welfare_reform, stop_voter_fraud)", () => {
  test("returns 0 when no figures are in political offices", () => {
    const G = makeActionPhaseState();
    expect(computeDemandPower(G, "wealth_tax", SocialClass.WorkingClass)).toBe(0);
  });

  test("counts WC figure elected to office", () => {
    const cashier = playFigureCard("cashier", { in_training: false, state_office_index: 0 });
    const G = makeActionPhaseState();
    // Manually place in politicalOffices
    G.politicalOffices[0] = cashier;
    expect(computeDemandPower(G, "wealth_tax", SocialClass.WorkingClass)).toBe(1);
  });

  test("does not count CC elected figures for WC demand", () => {
    const manager = playFigureCard("manager", { in_training: false, state_office_index: 0 });
    const G = makeActionPhaseState();
    G.politicalOffices[0] = manager;
    expect(computeDemandPower(G, "wealth_tax", SocialClass.WorkingClass)).toBe(0);
  });

  test("counts multiple WC elected figures", () => {
    const cashier = playFigureCard("cashier", { in_training: false, state_office_index: 0 });
    const agitator = playFigureCard("agitator", { in_training: false, state_office_index: 1 });
    const G = makeActionPhaseState();
    G.politicalOffices[0] = cashier;
    G.politicalOffices[1] = agitator;
    expect(computeDemandPower(G, "wealth_tax", SocialClass.WorkingClass)).toBe(2);
  });

  test("does not count default state figures (populist, centrist)", () => {
    const G = makeActionPhaseState();
    // Default state figures are CardType.DefaultStateFigure, not Figure
    expect(computeDemandPower(G, "anti_corruption", SocialClass.WorkingClass)).toBe(0);
  });
});

// ── "Number of Workplaces with wages at $1." ──────────────────────────────────

describe("computeDemandPower: workplaces at min wage (deregulation, outlaw_strikes)", () => {
  test("returns 1 when corner_store starts at wages $1 (default)", () => {
    const G = makeActionPhaseState();
    // corner_store starts with wages=1; parts_producer starts with wages=3
    expect(computeDemandPower(G, "deregulation", SocialClass.CapitalistClass)).toBe(1);
  });

  test("counts workplaces with wages === 1", () => {
    const G = makeActionPhaseState();
    const wp = G.workplaces[0];
    if (typeof wp !== "string") {
      wp.wages = 1;
    }
    expect(computeDemandPower(G, "deregulation", SocialClass.CapitalistClass)).toBe(1);
  });

  test("counts multiple workplaces at min wage", () => {
    const G = makeActionPhaseState();
    for (const wp of G.workplaces) {
      if (typeof wp !== "string") {
        wp.wages = 1;
      }
    }
    const workplaceCount = G.workplaces.filter(w => typeof w !== "string").length;
    expect(computeDemandPower(G, "deregulation", SocialClass.CapitalistClass)).toBe(workplaceCount);
  });

  test("works for CC demand outlaw_strikes (same basis as deregulation)", () => {
    const G = makeActionPhaseState();
    // corner_store starts at wages=1, so returns 1
    expect(computeDemandPower(G, "outlaw_strikes", SocialClass.CapitalistClass)).toBe(1);
  });
});

// ── "Number of unionized Workplaces." ────────────────────────────────────────

describe("computeDemandPower: unionized workplaces (jobs_program, nationalization)", () => {
  test("returns 0 when no workplaces are unionized", () => {
    const G = makeActionPhaseState();
    expect(computeDemandPower(G, "jobs_program", SocialClass.WorkingClass)).toBe(0);
  });

  test("counts one unionized workplace", () => {
    const G = makeActionPhaseState();
    const wp = G.workplaces[0];
    if (typeof wp !== "string") {
      wp.unionized = true;
    }
    expect(computeDemandPower(G, "jobs_program", SocialClass.WorkingClass)).toBe(1);
  });

  test("counts multiple unionized workplaces", () => {
    const G = makeActionPhaseState();
    for (const wp of G.workplaces) {
      if (typeof wp !== "string") {
        wp.unionized = true;
      }
    }
    const workplaceCount = G.workplaces.filter(w => typeof w !== "string").length;
    expect(computeDemandPower(G, "nationalization", SocialClass.WorkingClass)).toBe(workplaceCount);
  });

  test("does not count non-unionized workplaces", () => {
    const G = makeActionPhaseState();
    // Add a non-unionized player workplace
    G.workplaces[2] = playWorkplaceCard("fast_food_chain", { unionized: false });
    expect(computeDemandPower(G, "jobs_program", SocialClass.WorkingClass)).toBe(0);
  });
});
