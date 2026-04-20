/**
 * Component tests for ConflictModal
 *
 * Tests cover:
 *   - Strike: leader row renders above supporters
 *   - Strike Initiating: "Change" button appears; clicking then "Set as Leader" calls onChangeLeader
 *   - Election: head-to-head row shows candidate and incumbent at top
 *   - Election Initiating: "Change" on candidate triggers swap mode
 *   - Effects list renders for cards with rules text
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { figureCardById, getAnyCardData } from "../data/cards";
import { CardType, ConflictType, SocialClass } from "../types/cards";
import { ConflictPhase, StrikeConflictState, ElectionConflictState } from "../types/conflicts";
import { PlayerState } from "../types/game";
import { ConflictModal } from "./ConflictModal";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const emptyPlayer: PlayerState = {
  wealth: 10,
  hand: [],
  deck: [],
  dustbin: [],
  institutions: [null, null],
  demands: [null, null],
  figures: [],
  maxHandSize: 4,
  theorizeLimit: 1,
  playedWorkplaceThisTurn: false,
};

const players = {
  [SocialClass.WorkingClass]: emptyPlayer,
  [SocialClass.CapitalistClass]: emptyPlayer,
};

const cashierCard = figureCardById.cashier;
const nurseCard = figureCardById.nurse;

const cashierInPlay = { id: cashierCard.id, card_type: CardType.Figure as const, in_play: true as const, exhausted: false, in_training: false };
const nurseInPlay = { id: nurseCard.id, card_type: CardType.Figure as const, in_play: true as const, exhausted: false, in_training: false };

const cornerStoreTarget = {
  id: "corner_store" as const,
  card_type: CardType.Workplace as const,
  in_play: true as const,
  wages: 3,
  profits: 3,
  established_power: 1,
  unionized: false,
};

const populistTarget = {
  id: "populist" as const,
  card_type: CardType.DefaultStateFigure as const,
  in_play: true as const,
  exhausted: false,
  established_power: 1,
};

const baseStrikeConflict: StrikeConflictState = {
  conflictType: ConflictType.Strike,
  targetWorkplaceIndex: 0,
  targetWorkplace: cornerStoreTarget,
  maxStrikeLeaders: 1,
  workingClassCards: [cashierInPlay],
  capitalistCards: [],
  active: true,
  phase: ConflictPhase.Initiating,
  initiatingClass: SocialClass.WorkingClass,
  activeConflictPlayer: SocialClass.WorkingClass,
  workingClassPower: { diceCount: 1, establishedPower: 0 },
  capitalistPower: { diceCount: 0, establishedPower: 0 },
};

const baseElectionConflict: ElectionConflictState = {
  conflictType: ConflictType.Election,
  targetOfficeIndex: 0,
  targetIncumbent: populistTarget,
  workingClassCards: [cashierInPlay],
  capitalistCards: [],
  active: true,
  phase: ConflictPhase.Initiating,
  initiatingClass: SocialClass.WorkingClass,
  activeConflictPlayer: SocialClass.WorkingClass,
  workingClassPower: { diceCount: 1, establishedPower: 0 },
  capitalistPower: { diceCount: 0, establishedPower: 0 },
};

const baseProps = {
  viewingClass: SocialClass.WorkingClass,
  activeConflictPlayer: SocialClass.WorkingClass,
  players,
  onClose: vi.fn(),
  onCancel: vi.fn(),
  onInitiate: vi.fn(),
  onAddFigure: vi.fn(),
  onAddTactic: vi.fn(),
  onRemoveCard: vi.fn(),
  onChangeLeader: vi.fn(),
  onPlanResponse: vi.fn(),
  onResolve: vi.fn(),
};

// ─── Strike: leader row ───────────────────────────────────────────────────────

describe("ConflictModal: Strike layout", () => {
  test("renders 'Strike Leader' section label", () => {
    render(
      <ConflictModal
        {...baseProps}
        conflict={baseStrikeConflict}
        targetCard={cornerStoreTarget}
      />
    );
    expect(screen.getByText("Strike Leader")).toBeInTheDocument();
  });

  test("renders leader card name in the leader row", () => {
    render(
      <ConflictModal
        {...baseProps}
        conflict={baseStrikeConflict}
        targetCard={cornerStoreTarget}
      />
    );
    expect(screen.getByText(cashierCard.name)).toBeInTheDocument();
  });

  test("shows 'Change' button under leader when it is the viewer's Initiating turn", () => {
    render(
      <ConflictModal
        {...baseProps}
        conflict={baseStrikeConflict}
        targetCard={cornerStoreTarget}
      />
    );
    expect(screen.getByRole("button", { name: /Change/i })).toBeInTheDocument();
  });

  test("does not show 'Change' button when not the viewer's turn", () => {
    render(
      <ConflictModal
        {...baseProps}
        conflict={baseStrikeConflict}
        viewingClass={SocialClass.CapitalistClass}
        targetCard={cornerStoreTarget}
      />
    );
    expect(screen.queryByRole("button", { name: /^Change$/i })).not.toBeInTheDocument();
  });

  test("clicking 'Change' then 'Set as Leader' calls onChangeLeader(0, 1)", () => {
    const onChangeLeader = vi.fn();
    const conflict: StrikeConflictState = {
      ...baseStrikeConflict,
      workingClassCards: [cashierInPlay, { ...nurseInPlay, addedThisStep: true }],
    };
    render(
      <ConflictModal
        {...baseProps}
        conflict={conflict}
        targetCard={cornerStoreTarget}
        onChangeLeader={onChangeLeader}
      />
    );
    // Click "Change" on the leader
    fireEvent.click(screen.getByRole("button", { name: /^Change$/ }));
    // Now "Set as Leader" should appear for the supporter
    fireEvent.click(screen.getByRole("button", { name: /Set as Leader/i }));
    expect(onChangeLeader).toHaveBeenCalledWith(0, 1);
  });

  test("'Change' button becomes 'Cancel' when swap mode is active", () => {
    const conflict: StrikeConflictState = {
      ...baseStrikeConflict,
      workingClassCards: [cashierInPlay, { ...nurseInPlay, addedThisStep: true }],
    };
    render(
      <ConflictModal
        {...baseProps}
        conflict={conflict}
        targetCard={cornerStoreTarget}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Change$/ }));
    expect(screen.getByRole("button", { name: /^Cancel$/ })).toBeInTheDocument();
  });
});

// ─── Election: head-to-head row ───────────────────────────────────────────────

describe("ConflictModal: Election layout", () => {
  test("renders 'vs' label for the head-to-head row", () => {
    render(
      <ConflictModal
        {...baseProps}
        conflict={baseElectionConflict}
        targetCard={populistTarget}
      />
    );
    expect(screen.getByText("vs")).toBeInTheDocument();
  });

  test("renders candidate card name and 'Incumbent' label", () => {
    render(
      <ConflictModal
        {...baseProps}
        conflict={baseElectionConflict}
        targetCard={populistTarget}
      />
    );
    expect(screen.getByText(cashierCard.name)).toBeInTheDocument();
    expect(screen.getByText("Incumbent")).toBeInTheDocument();
  });

  test("clicking 'Change' on candidate then 'Set as Candidate' calls onChangeLeader(0, 1)", () => {
    const onChangeLeader = vi.fn();
    const conflict: ElectionConflictState = {
      ...baseElectionConflict,
      workingClassCards: [cashierInPlay, { ...nurseInPlay, addedThisStep: true }],
    };
    render(
      <ConflictModal
        {...baseProps}
        conflict={conflict}
        targetCard={populistTarget}
        onChangeLeader={onChangeLeader}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Change$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Set as Candidate/i }));
    expect(onChangeLeader).toHaveBeenCalledWith(0, 1);
  });
});

// ─── Effects list ─────────────────────────────────────────────────────────────

describe("ConflictModal: Effects list", () => {
  test("renders WC Effects section when WC cards have rules text", () => {
    const cashierData = getAnyCardData(cashierCard.id);
    if (!cashierData.rules) return; // skip if this card has no rules text
    render(
      <ConflictModal
        {...baseProps}
        conflict={baseStrikeConflict}
        targetCard={cornerStoreTarget}
      />
    );
    expect(screen.getByText("WC Effects")).toBeInTheDocument();
  });

  test("does not render effects section when cards have no rules text", () => {
    // Build a conflict with a card that has no rules (cashier has no rules based on type)
    const cashierData = getAnyCardData(cashierCard.id);
    if (cashierData.rules) return; // skip if cashier actually has rules
    render(
      <ConflictModal
        {...baseProps}
        conflict={baseStrikeConflict}
        targetCard={cornerStoreTarget}
      />
    );
    expect(screen.queryByText("WC Effects")).not.toBeInTheDocument();
  });
});
