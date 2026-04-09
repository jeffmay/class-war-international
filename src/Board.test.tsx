/**
 * Component tests for ClassWarBoard
 *
 * Renders the board with mocked boardgame.io props and minimal GameState
 * fixtures to verify slot-selection behavior triggers the ActionMenuBar.
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClassWarBoard, ClassWarBoardProps } from "./Board";
import { SocialClass } from "./types/cards";
import { TurnPhase } from "./types/game";
import { makeActionPhaseState, withCardInHand } from "./game/generate";
import { buildDeck } from "./data/cards";

// Minimal mock for boardgame.io context — only the fields Board.tsx actually reads
const mockCtx = {
  currentPlayer: "0", // WC's turn
  numPlayers: 2,
  playOrder: ["0", "1"],
  playOrderPos: 0,
  phase: null,
  activePlayers: null,
  turn: 1,
};

const mockMoves = {
  collectProduction: vi.fn(),
  playCardFromHand: vi.fn(),
  endActionPhase: vi.fn(),
  endReproductionPhase: vi.fn(),
  planStrike: vi.fn(),
  initiateConflict: vi.fn(),
  cancelConflict: vi.fn(),
  addFigureToConflict: vi.fn(),
  addTacticToConflict: vi.fn(),
  planResponse: vi.fn(),
  resolveConflict: vi.fn(),
  dismissConflictOutcome: vi.fn(),
  planElection: vi.fn(),
  planLegislation: vi.fn(),
  undoMove: vi.fn(),
  sealReproductionPreview: vi.fn(),
};

const mockEvents = { endGame: vi.fn() };

// Board.tsx only destructures { G, ctx, moves, playerID } from BoardProps.
// All other boardgame.io state fields are unused by the component.
// These fields satisfy ClassWarBoardProps without reaching into boardgame.io internals.
function makeBoardProps(G = makeActionPhaseState(), currentPlayer = "0"): ClassWarBoardProps {
  return {
    G,
    ctx: { ...mockCtx, currentPlayer },
    moves: mockMoves,
    events: mockEvents,
    playerID: null,
    matchID: "test",
    isActive: true,
    isMultiplayer: false,
    isConnected: true,
    plugins: {},
    // boardgame.io internal fields — not read by Board.tsx
  } as unknown as ClassWarBoardProps;
}

function renderBoard(G = makeActionPhaseState(), currentPlayer = "0") {
  return render(<ClassWarBoard {...makeBoardProps(G, currentPlayer)} />);
}

beforeEach(() => vi.clearAllMocks());

// ─── Cannot Afford label ───────────────────────────────────────────────────────

describe("cannot afford label", () => {
  test("figure card shows 'Cannot Afford' when wealth is too low", () => {
    const wcDeck = buildDeck(SocialClass.WorkingClass);
    const { hand, deck } = withCardInHand(wcDeck, "cashier"); // costs $2
    const G = makeActionPhaseState({ hand, deck, wealth: 0 });
    renderBoard(G);

    fireEvent.click(screen.getByText("Cashier"));
    expect(screen.getByRole("button", { name: /Cannot Afford/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Train/ })).not.toBeInTheDocument();
  });

  test("figure card shows 'Train' label when player can afford it", () => {
    const wcDeck = buildDeck(SocialClass.WorkingClass);
    const { hand, deck } = withCardInHand(wcDeck, "cashier"); // costs $2
    const G = makeActionPhaseState({ hand, deck, wealth: 10 });
    renderBoard(G);

    fireEvent.click(screen.getByText("Cashier"));
    expect(screen.getByRole("button", { name: /Train/ })).not.toBeDisabled();
    expect(screen.queryByRole("button", { name: /Cannot Afford/ })).not.toBeInTheDocument();
  });

  test("institution shows single 'Cannot Afford' when wealth is too low", () => {
    const wcDeck = buildDeck(SocialClass.WorkingClass);
    const { hand, deck } = withCardInHand(wcDeck, "political_education_group"); // costs $4
    const G = makeActionPhaseState({ hand, deck, wealth: 0 });
    renderBoard(G);

    fireEvent.click(screen.getByText("Political Education Group"));
    const cannotAffordButtons = screen.getAllByRole("button", { name: /Cannot Afford/ });
    expect(cannotAffordButtons).toHaveLength(1);
    expect(cannotAffordButtons[0]).toBeDisabled();
  });
});

// ─── Institution slots ─────────────────────────────────────────────────────────

describe("institution slot selection", () => {
  test("empty institution slot is a button during Action phase", () => {
    renderBoard();
    expect(screen.getByRole("button", { name: "Institution slot 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Institution slot 2" })).toBeInTheDocument();
  });

  test("clicking empty institution slot opens ActionMenuBar with 'Choose an institution to build' title", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Institution slot 1" }));
    expect(screen.getByRole("region", { name: "Action menu" })).toBeInTheDocument();
    expect(screen.getByText("Choose an institution to build")).toBeInTheDocument();
  });

  test("clicking empty institution slot shows institution hand cards as options", () => {
    const wcDeck = buildDeck(SocialClass.WorkingClass);
    const { hand, deck } = withCardInHand(wcDeck, "political_education_group");
    const G = makeActionPhaseState({ hand, deck, wealth: 100 });
    renderBoard(G);

    fireEvent.click(screen.getByRole("button", { name: "Institution slot 1" }));

    // The option label should include the card name and cost
    expect(screen.getByText(/Build Political Education Group/)).toBeInTheDocument();
  });

  test("institution slot option is disabled when player cannot afford the card", () => {
    const wcDeck = buildDeck(SocialClass.WorkingClass);
    const { hand, deck } = withCardInHand(wcDeck, "political_education_group");
    // political_education_group costs $4; wealth = 0
    const G = makeActionPhaseState({ hand, deck, wealth: 0 });
    renderBoard(G);

    fireEvent.click(screen.getByRole("button", { name: "Institution slot 1" }));

    expect(screen.getByText(/Cannot Afford/)).toBeDisabled();
  });

  test("institution slot option calls playCardFromHand when clicked", () => {
    const wcDeck = buildDeck(SocialClass.WorkingClass);
    const { hand, deck } = withCardInHand(wcDeck, "political_education_group");
    const G = makeActionPhaseState({ hand, deck, wealth: 100 });
    renderBoard(G);

    fireEvent.click(screen.getByRole("button", { name: "Institution slot 1" }));
    fireEvent.click(screen.getByText(/Build Political Education Group/));

    expect(mockMoves.playCardFromHand).toHaveBeenCalledWith(0, "institutions[0]");
  });

  test("empty institution slots are not buttons outside Action phase", () => {
    const G = { ...makeActionPhaseState(), turnPhase: TurnPhase.Reproduction };
    renderBoard(G, "0");
    expect(screen.queryByRole("button", { name: "Institution slot 1" })).not.toBeInTheDocument();
  });
});

// ─── Demand slots ─────────────────────────────────────────────────────────────

describe("demand slot selection", () => {
  test("empty demand slot is a button during Action phase", () => {
    renderBoard();
    expect(screen.getByRole("button", { name: "Demand slot 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Demand slot 2" })).toBeInTheDocument();
  });

  test("clicking empty demand slot opens ActionMenuBar with 'Choose a demand to make' title", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Demand slot 1" }));
    expect(screen.getByRole("region", { name: "Action menu" })).toBeInTheDocument();
    expect(screen.getByText("Choose a demand to make")).toBeInTheDocument();
  });

  test("clicking empty demand slot shows demand hand cards as options", () => {
    const wcDeck = buildDeck(SocialClass.WorkingClass);
    const { hand, deck } = withCardInHand(wcDeck, "wealth_tax");
    const G = makeActionPhaseState({ hand, deck });
    renderBoard(G);

    fireEvent.click(screen.getByRole("button", { name: "Demand slot 1" }));

    // The option button has the card name as its label
    expect(screen.getByRole("button", { name: "Wealth Tax" })).toBeInTheDocument();
  });

  test("demand slot option calls playCardFromHand when clicked", () => {
    const wcDeck = buildDeck(SocialClass.WorkingClass);
    const { hand, deck } = withCardInHand(wcDeck, "wealth_tax");
    const G = makeActionPhaseState({ hand, deck });
    renderBoard(G);

    fireEvent.click(screen.getByRole("button", { name: "Demand slot 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Wealth Tax" }));

    expect(mockMoves.playCardFromHand).toHaveBeenCalledWith(0, "demands[0]");
  });
});

// ─── Workplace slots ───────────────────────────────────────────────────────────

describe("workplace slot selection", () => {
  test("FOR SALE workplace slot is a button during Action phase", () => {
    renderBoard();
    // The default state has some FOR SALE slots
    const forSaleButtons = screen.getAllByRole("button", { name: /Workplace slot/ });
    expect(forSaleButtons.length).toBeGreaterThan(0);
  });

  test("clicking FOR SALE slot opens ActionMenuBar with 'Choose a workplace to open' title", () => {
    renderBoard();
    fireEvent.click(screen.getAllByRole("button", { name: /Workplace slot/ })[0]);
    expect(screen.getByRole("region", { name: "Action menu" })).toBeInTheDocument();
    expect(screen.getByText("Choose a workplace to open")).toBeInTheDocument();
  });

  test("clicking FOR SALE slot shows workplace hand cards as options", () => {
    const ccDeck = buildDeck(SocialClass.CapitalistClass);
    const { hand, deck } = withCardInHand(ccDeck, "fast_food_chain");
    const G = makeActionPhaseState(undefined, { hand, deck, wealth: 100 });
    renderBoard(G, "1");

    fireEvent.click(screen.getAllByRole("button", { name: /Workplace slot/ })[0]);
    expect(screen.getByText(/Open Fast Food Chain/)).toBeInTheDocument();
  });

  test("workplace slot option calls playCardFromHand for FOR SALE slot", () => {
    const ccDeck = buildDeck(SocialClass.CapitalistClass);
    const { hand, deck } = withCardInHand(ccDeck, "fast_food_chain");
    const G = makeActionPhaseState(undefined, { hand, deck, wealth: 100 });
    renderBoard(G, "1");

    fireEvent.click(screen.getAllByRole("button", { name: /Workplace slot/ })[0]);
    fireEvent.click(screen.getByText(/Open Fast Food Chain/));

    expect(mockMoves.playCardFromHand).toHaveBeenCalledWith(0, "workplaces[-1]");
  });
});
