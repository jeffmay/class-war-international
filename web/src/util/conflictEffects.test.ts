/**
 * Tests for conflictEffects utility
 */

import { ConflictType, SocialClass } from "@shared/types/cards";
import { playFigureCard, playTacticCard } from "@shared/util/game";
import { getConflictCardEffects, getConflictLawEffects, getEffectsForColumn } from "./conflictEffects";

// ── getConflictCardEffects ──────────────────────────────────────────────────────

describe("getConflictCardEffects", () => {
  test("returns empty array for cards with no registered effects", () => {
    const cashier = playFigureCard("cashier");
    const effects = getConflictCardEffects([cashier], SocialClass.WorkingClass);
    expect(effects).toEqual([]);
  });

  test("returns effect for agitator with correct shape", () => {
    const agitator = playFigureCard("agitator");
    const effects = getConflictCardEffects([agitator], SocialClass.WorkingClass);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      cardId: "agitator",
      cardName: "Agitator",
      ownerClass: SocialClass.WorkingClass,
      displaySide: "opponent",
      powerDelta: -1,
    });
  });

  test("returns effect for union_thugs with diceDelta", () => {
    const unionThugs = playFigureCard("union_thugs");
    const effects = getConflictCardEffects([unionThugs], SocialClass.WorkingClass);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      cardId: "union_thugs",
      diceDelta: -1,
      displaySide: "opponent",
    });
  });

  test("returns ability effect for saboteur", () => {
    const saboteur = playFigureCard("saboteur");
    const effects = getConflictCardEffects([saboteur], SocialClass.WorkingClass);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      cardId: "saboteur",
      displaySide: "opponent",
      isAbility: true,
    });
  });

  test("returns CC effect for corporate_lawyer with correct ownerClass", () => {
    const lawyer = playFigureCard("corporate_lawyer");
    const effects = getConflictCardEffects([lawyer], SocialClass.CapitalistClass);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      cardId: "corporate_lawyer",
      ownerClass: SocialClass.CapitalistClass,
      displaySide: "own",
      isAbility: true,
    });
  });

  test("returns effect for tactic cards like hire_scabs", () => {
    const hireScabs = playTacticCard("hire_scabs");
    const effects = getConflictCardEffects([hireScabs], SocialClass.CapitalistClass);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      cardId: "hire_scabs",
      ownerClass: SocialClass.CapitalistClass,
      displaySide: "own",
    });
  });

  test("returns effects for multiple cards", () => {
    const agitator = playFigureCard("agitator");
    const mechanic = playFigureCard("mechanic");
    const effects = getConflictCardEffects([agitator, mechanic], SocialClass.WorkingClass);
    expect(effects).toHaveLength(2);
    const ids = effects.map(e => e.cardId);
    expect(ids).toContain("agitator");
    expect(ids).toContain("mechanic");
  });
});

// ── getConflictLawEffects ──────────────────────────────────────────────────────

describe("getConflictLawEffects", () => {
  test("returns empty array when no laws are active", () => {
    const effects = getConflictLawEffects([], ConflictType.Strike);
    expect(effects).toEqual([]);
  });

  test("returns stop_voter_fraud effect for Election conflicts", () => {
    const effects = getConflictLawEffects(["stop_voter_fraud"], ConflictType.Election);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      cardId: "stop_voter_fraud",
      ownerClass: SocialClass.CapitalistClass,
      displaySide: "own",
    });
  });

  test("filters out stop_voter_fraud for non-Election conflicts", () => {
    const strikeEffects = getConflictLawEffects(["stop_voter_fraud"], ConflictType.Strike);
    expect(strikeEffects).toEqual([]);
    const legEffects = getConflictLawEffects(["stop_voter_fraud"], ConflictType.Legislation);
    expect(legEffects).toEqual([]);
  });

  test("returns outlaw_strikes effect for Strike conflicts", () => {
    const effects = getConflictLawEffects(["outlaw_strikes"], ConflictType.Strike);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      cardId: "outlaw_strikes",
      ownerClass: SocialClass.CapitalistClass,
      displaySide: "opponent",
    });
  });

  test("filters out outlaw_strikes for non-Strike conflicts", () => {
    const effects = getConflictLawEffects(["outlaw_strikes"], ConflictType.Election);
    expect(effects).toEqual([]);
  });

  test("returns effects for multiple relevant laws", () => {
    const effects = getConflictLawEffects(["stop_voter_fraud", "outlaw_strikes"], ConflictType.Election);
    expect(effects).toHaveLength(1);
    expect(effects[0].cardId).toBe("stop_voter_fraud");
  });

  test("ignores laws with no registered conflict effects", () => {
    const effects = getConflictLawEffects(["wealth_tax", "free_health_care"], ConflictType.Strike);
    expect(effects).toEqual([]);
  });
});

// ── getEffectsForColumn ────────────────────────────────────────────────────────

describe("getEffectsForColumn", () => {
  test("returns own-side effects for column class", () => {
    const wcEffect = {
      cardId: "mechanic",
      cardName: "Mechanic",
      ownerClass: SocialClass.WorkingClass,
      displaySide: "own" as const,
      summary: "Win: +$1 wages from profits",
    };
    const result = getEffectsForColumn(SocialClass.WorkingClass, [wcEffect]);
    expect(result).toContain(wcEffect);
  });

  test("excludes own-side effects from opponent column", () => {
    const wcEffect = {
      cardId: "mechanic",
      cardName: "Mechanic",
      ownerClass: SocialClass.WorkingClass,
      displaySide: "own" as const,
      summary: "Win: +$1 wages from profits",
    };
    const result = getEffectsForColumn(SocialClass.CapitalistClass, [wcEffect]);
    expect(result).toHaveLength(0);
  });

  test("shows opponent-side CC effect in WC column", () => {
    const ccEffect = {
      cardId: "outlaw_strikes",
      cardName: "Outlaw Strikes",
      ownerClass: SocialClass.CapitalistClass,
      displaySide: "opponent" as const,
      summary: "CC wins: WC strike captain to Dustbin",
    };
    const result = getEffectsForColumn(SocialClass.WorkingClass, [ccEffect]);
    expect(result).toContain(ccEffect);
  });

  test("does not show opponent-side CC effect in CC column", () => {
    const ccEffect = {
      cardId: "outlaw_strikes",
      cardName: "Outlaw Strikes",
      ownerClass: SocialClass.CapitalistClass,
      displaySide: "opponent" as const,
      summary: "CC wins: WC strike captain to Dustbin",
    };
    const result = getEffectsForColumn(SocialClass.CapitalistClass, [ccEffect]);
    expect(result).toHaveLength(0);
  });

  test("returns combined effects from both sides for a column", () => {
    const wcOwnEffect = {
      cardId: "barnyard_rustin",
      cardName: "Barnyard Rustin",
      ownerClass: SocialClass.WorkingClass,
      displaySide: "own" as const,
      summary: "Ties count as your victory",
    };
    const ccCrossEffect = {
      cardId: "outlaw_strikes",
      cardName: "Outlaw Strikes",
      ownerClass: SocialClass.CapitalistClass,
      displaySide: "opponent" as const,
      summary: "CC wins: WC strike captain to Dustbin",
    };
    const ccOwnEffect = {
      cardId: "hire_private_security",
      cardName: "Hire Private Security",
      ownerClass: SocialClass.CapitalistClass,
      displaySide: "own" as const,
      summary: "Win by 3+: opponent leader to Dustbin",
    };
    const allEffects = [wcOwnEffect, ccCrossEffect, ccOwnEffect];
    const wcColumn = getEffectsForColumn(SocialClass.WorkingClass, allEffects);
    expect(wcColumn).toContain(wcOwnEffect);
    expect(wcColumn).toContain(ccCrossEffect);
    expect(wcColumn).not.toContain(ccOwnEffect);
  });
});
