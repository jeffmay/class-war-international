/**
 * Main Board component for Class War: International
 */

import { BoardProps } from 'boardgame.io/react';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGameNav } from './contexts/GameNav';
import { Brand, make } from 'ts-brand';
import { ActionMenuBar, MenuOption } from './components/ActionMenuBar';
import { CardComponent } from './components/CardComponent';
import { ConflictModal } from './components/ConflictModal';
import { ConflictOutcomeModal } from './components/ConflictOutcomeModal';
import { DealResultModal } from './components/DealResultModal';
import { TurnStartModal, WaitingInterstitial } from './components/StartGameScreen';
import { anyWorkplaceCardById, DeckCardID, getAnyCardData, getAnyStateFigureDataById, getAnyWorkplaceCardData, getFigureDataById } from './data/cards';
import { CardSlotEntity, CardType, FigureCardInPlay, SocialClass, WorkplaceForSale } from './types/cards';
import { ConflictPhase, ConflictType } from './types/conflicts';
import { GameState, TurnPhase } from './types/game';
import { filterMap } from './util/fun';
import { STATUS_TEXT_ID, setStatusText } from './util/statusText';
import { pluralize } from './util/text';

/** Build a WorkplaceCardData for display by substituting current wages/profits from in-play state.
 *  Appends an expansion indicator (x2, x3, …) to the name when the workplace has been expanded. */
// TODO: Move to CardComponent
// function makeWorkplaceDisplayCard(wp: WorkplaceCardInPlay): WorkplaceCardData {
//   const expansionSuffix = wp.expansionCount ? ` (x${wp.expansionCount + 1})` : "";
//   return { ...card, name: card.name + expansionSuffix, starting_wages: wp.wages, starting_profits: wp.profits, established_power: wp.established_power };
// }

export type ClassWarBoardProps = BoardProps<GameState>;

// TODO: Use the slot type in the brand name? Validate using the number of slots in the game?
type SelectedSlotID = Brand<string, 'slot_id'>
const SelectedSlotID = make<SelectedSlotID>()

type BoardState =
  | { mode: 'normal'; selectedSlotId: SelectedSlotID | null }
  | { mode: 'selectStrikeTarget'; figure: FigureCardInPlay }
  | { mode: 'selectOfficeTarget'; figure: FigureCardInPlay }
  | { mode: 'selectLegislationOffice'; demandSlotIndex: number }
  | { mode: 'showingDealtCards'; theorizedCardIds: DeckCardID[]; newCardIds: DeckCardID[]; modalDismissed: boolean };

interface SlotData {
  cardId?: string;
  figureInPlay?: FigureCardInPlay;
  options: MenuOption[];
  /** Title shown in ActionMenuBar when no card is selected (e.g. for slot-first selection) */
  title?: string;
}

// ─── Hamburger menu ───────────────────────────────────────────────────────────

function HamburgerMenu() {
  const { onReturnToStart, onReturnToLobby, onLeaveMatch } = useGameNav();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside the menu
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!onReturnToStart && !onReturnToLobby && !onLeaveMatch) return null;

  return (
    <div className="game-menu" ref={menuRef}>
      <button
        className="game-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="Game menu"
        aria-expanded={open}
      >
        ☰
      </button>
      {open && (
        <div className="game-menu-panel" role="menu">
          {onReturnToLobby && (
            <button
              className="game-menu-item"
              role="menuitem"
              onClick={() => { setOpen(false); onReturnToLobby(); }}
            >
              ← Return to Lobby
            </button>
          )}
          {onReturnToStart && (
            <button
              className="game-menu-item"
              role="menuitem"
              onClick={() => { setOpen(false); onReturnToStart(); }}
            >
              ⌂ Return to Start Screen
            </button>
          )}
          {onLeaveMatch && (
            <button
              className="game-menu-item game-menu-item-danger"
              role="menuitem"
              onClick={() => { setOpen(false); void onLeaveMatch(); }}
            >
              ✕ Leave Match
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

export const ClassWarBoard: React.FC<ClassWarBoardProps> = ({ G, ctx, moves, playerID }) => {
  const { onHandoff } = useGameNav();
  const [boardState, setBoardState] = useState<BoardState>({ mode: 'normal', selectedSlotId: null });
  const [theorizeSelectedIndexes, setTheorizeSelectedIndexes] = useState<number[]>([]);
  // true = minimized (hidden); false = visible. Starts visible; un-minimizes when a new conflict begins.
  const [conflictModalMinimized, setConflictModalMinimized] = useState(false);
  // true = dismissed; false = needs to be shown.
  // Local mode: starts true so the game-start turn has no initial handoff.
  // Multiplayer: starts false so the non-active player immediately sees the WaitingInterstitial.
  // Resets to false on each player-switch or conflict phase advance that requires a handoff.
  const [handoffDismissed, setHandoffDismissed] = useState(() => !playerID);

  // Un-minimize conflict modal whenever a new conflict begins
  const prevConflictRef = React.useRef<typeof G.activeConflict>(G.activeConflict);
  React.useEffect(() => {
    if (G.activeConflict && !prevConflictRef.current) {
      setConflictModalMinimized(false);
    }
    prevConflictRef.current = G.activeConflict;
  }, [G.activeConflict]);

  // Require handoff whenever the current player changes (new turn in local mode)
  const prevCurrentPlayerRef = React.useRef(ctx.currentPlayer);
  React.useEffect(() => {
    if (ctx.currentPlayer !== prevCurrentPlayerRef.current) {
      setHandoffDismissed(false);
      prevCurrentPlayerRef.current = ctx.currentPlayer;
    }
  }, [ctx.currentPlayer]);

  // Require handoff whenever the conflict advances to Responding or Resolving phase
  const prevConflictPhaseRef = React.useRef<ConflictPhase | undefined>(undefined);
  React.useEffect(() => {
    const phase = G.activeConflict?.phase;
    const prev = prevConflictPhaseRef.current;
    if (
      (phase === ConflictPhase.Responding && prev !== ConflictPhase.Responding) ||
      (phase === ConflictPhase.Resolving && prev !== ConflictPhase.Resolving)
    ) {
      setHandoffDismissed(false);
    }
    prevConflictPhaseRef.current = phase;
  }, [G.activeConflict?.phase]);

  // Determine current class
  const isWorkingClass = ctx.currentPlayer === '0';
  const currentClass = isWorkingClass ? SocialClass.WorkingClass : SocialClass.CapitalistClass;
  // In local/debug mode playerID is undefined — treat it as always being the current player's turn
  const isMyTurn = !playerID || playerID === ctx.currentPlayer;

  // myClass: the class this client is playing as (falls back to currentClass in local/debug mode)
  const myClass =
    playerID === '0'
      ? SocialClass.WorkingClass
      : playerID === '1'
        ? SocialClass.CapitalistClass
        : currentClass;

  // Get player states
  const myPlayer = G.players[myClass];
  const myClassKey = myClass === SocialClass.WorkingClass ? 'wc' : 'cc';

  const handleCloseInspector = () => setBoardState({ mode: 'normal', selectedSlotId: null });

  // Escape key closes any open modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (G.conflictOutcome && !G.conflictOutcome.dismissedBy.includes(myClass)) {
          moves.dismissConflictOutcome(myClass);
        } else if (boardState.mode === 'showingDealtCards' && !boardState.modalDismissed) {
          setBoardState({ ...boardState, modalDismissed: true });
        } else if (!conflictModalMinimized && G.activeConflict) {
          setConflictModalMinimized(true);
        } else if (boardState.mode === 'normal' && boardState.selectedSlotId !== null) {
          handleCloseInspector();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [boardState, G.conflictOutcome, G.activeConflict, conflictModalMinimized, myClass, moves]);

  const handleSelectSlot = (slotId: string) => {
    if (boardState.mode === 'normal' && boardState.selectedSlotId === slotId) {
      setBoardState({ mode: 'normal', selectedSlotId: null });
    } else {
      setBoardState({ mode: 'normal', selectedSlotId: SelectedSlotID(slotId) });
    }
  };

  // Confirm strike target
  const handleSelectStrikeTarget = (workplaceIndex: number) => {
    if (boardState.mode !== 'selectStrikeTarget') return;
    moves.planStrike(boardState.figure.id, workplaceIndex);
    setBoardState({ mode: 'normal', selectedSlotId: null });
  };

  // Confirm election target
  const handleSelectOfficeTarget = (officeIndex: number) => {
    if (boardState.mode !== 'selectOfficeTarget') return;
    moves.planElection(boardState.figure.id, officeIndex);
    setBoardState({ mode: 'normal', selectedSlotId: null });
  };

  // Confirm legislation office
  const handleSelectLegislationOffice = (officeIndex: number) => {
    if (boardState.mode !== 'selectLegislationOffice') return;
    moves.planLegislation(officeIndex, boardState.demandSlotIndex);
    setBoardState({ mode: 'normal', selectedSlotId: null });
  };

  // Toggle a hand card in/out of the theorize selection
  const handleToggleTheorize = (idx: number) => {
    setTheorizeSelectedIndexes(indexes => {
      if (indexes.includes(idx)) {
        return indexes.filter(i => i !== idx);
      }
      if (indexes.length < myPlayer.theorizeLimit) {
        return [...indexes, idx];
      }
      return indexes;
    });
  };

  // Execute the reproduction move immediately so G is up-to-date, then show
  // the deal result modal as a summary of what just happened.
  const handleFinishTheorizing = () => {
    const remainingHand = myPlayer.hand.filter((_, i) => !theorizeSelectedIndexes.includes(i));
    const drawCount = myPlayer.maxHandSize - remainingHand.length;
    // Capture card IDs BEFORE the move mutates G
    const theorizedCardIds = theorizeSelectedIndexes.map(i => myPlayer.hand[i]);
    const newCardIds = myPlayer.deck.slice(0, drawCount);
    moves.endReproductionPhase(theorizeSelectedIndexes);
    setBoardState({ mode: 'showingDealtCards', theorizedCardIds, newCardIds, modalDismissed: false });
  };

  // Dismiss the deal result modal — move was already executed in handleFinishTheorizing
  const handleEndTurn = () => {
    setTheorizeSelectedIndexes([]);
    setBoardState({ mode: 'normal', selectedSlotId: null });
  };

  // --- Pre-compute slot data ---
  const slotData = new Map<string, SlotData>();

  if (G.turnPhase === TurnPhase.Action && isMyTurn) {
    // Hand cards: action options
    myPlayer.hand.forEach((cardId, idx) => {
      const card = getAnyCardData(cardId);
      const slotId = `hand-${myClassKey}-${idx}`;
      const options: MenuOption[] = [];

      if (card.card_type === CardType.Figure) {
        const canAfford = myPlayer.wealth >= card.cost;
        if (canAfford) {
          options.push([`Train ($${card.cost})`, () => { moves.playCardFromHand(idx, 'figures[-1]'); handleCloseInspector(); }]);
        } else {
          options.push([`Cannot Afford ($${card.cost})`, undefined]);
        }
      } else if (card.card_type === CardType.Demand) {
        const slot0 = myPlayer.demands[0];
        const slot1 = myPlayer.demands[1];
        const hasEmptySlot = slot0 === null || slot1 === null;
        if (hasEmptySlot) {
          options.push(['Make New Demand', () => { moves.playCardFromHand(idx, 'demands[-1]'); handleCloseInspector(); }]);
        }
        if (slot0 !== null) {
          options.push([`Replace ${getAnyCardData(slot0.id).name} Demand`, () => { moves.playCardFromHand(idx, 'demands[0]'); handleCloseInspector(); }]);
        }
        if (slot1 !== null) {
          options.push([`Replace ${getAnyCardData(slot1.id).name} Demand`, () => { moves.playCardFromHand(idx, 'demands[1]'); handleCloseInspector(); }]);
        }
      } else if (card.card_type === CardType.Institution) {
        const slot0 = myPlayer.institutions[0];
        const slot1 = myPlayer.institutions[1];
        const canAfford = myPlayer.wealth >= card.cost;
        if (!canAfford) {
          options.push([`Cannot Afford ($${card.cost})`, undefined]);
        } else {
          const hasEmptySlot = slot0 === null || slot1 === null;
          if (hasEmptySlot) {
            options.push([`Build New Institution ($${card.cost})`, () => { moves.playCardFromHand(idx, 'institutions[-1]'); handleCloseInspector(); }]);
          }
          if (slot0 !== null) {
            options.push([`Replace ${getAnyCardData(slot0.id).name} ($${card.cost})`, () => { moves.playCardFromHand(idx, 'institutions[0]'); handleCloseInspector(); }]);
          }
          if (slot1 !== null) {
            options.push([`Replace ${getAnyCardData(slot1.id).name} ($${card.cost})`, () => { moves.playCardFromHand(idx, 'institutions[1]'); handleCloseInspector(); }]);
          }
        }
      } else if (card.card_type === CardType.Workplace) {
        const canAfford = myPlayer.wealth >= card.cost;
        if (!canAfford) {
          options.push([`Cannot Afford ($${card.cost})`, undefined]);
        } else {
          const hasEmptySlot = G.workplaces.some(w => w === WorkplaceForSale);
          if (hasEmptySlot) {
            options.push([`Open New Workplace ($${card.cost})`, () => { moves.playCardFromHand(idx, 'workplaces[-1]'); handleCloseInspector(); }]);
          }
          G.workplaces.forEach((wp, wpIdx) => {
            if (wp === WorkplaceForSale) return;
            const wpData = getAnyWorkplaceCardData(wp.id);
            options.push([`Replace ${wpData.name} ($${card.cost})`, () => { moves.playCardFromHand(idx, `workplaces[${wpIdx}]`); handleCloseInspector(); }]);
            if (wp.id === card.id) {
              options.push([`Expand ${wpData.name} ($${card.cost})`, () => { moves.playCardFromHand(idx, `workplaces[${wpIdx}]/expand`); handleCloseInspector(); }]);
            }
          });
        }
      }

      slotData.set(slotId, { cardId, options });
    });

    // Activated Figures: conflict actions
    myPlayer.figures.forEach((figure, idx) => {
      const slotId = `figures-${myClassKey}-${idx}`;
      const options: MenuOption[] = [];
      if (figure.exhausted) {
        options.push(['Figure is exhausted', undefined]);
      } else if (figure.in_training) {
        options.push(['Figure is in training', undefined]);
      } else {
        if (myClass === SocialClass.WorkingClass) {
          options.push(['Lead Strike', () => setBoardState({ mode: 'selectStrikeTarget', figure })]);
        }
        options.push(['Run for Office', () => setBoardState({ mode: 'selectOfficeTarget', figure })]);
      }
      slotData.set(slotId, { cardId: figure.id, figureInPlay: figure, options });
    });

    // Institution slots: clicking opens hand picker (both empty and occupied for replacement)
    myPlayer.institutions.forEach((institution, i) => {
      const slotId = `institution-${myClassKey}-${i}`;
      const institutionHandCards = myPlayer.hand
        .map((cardId, handIdx) => ({ cardId, handIdx, card: getAnyCardData(cardId) }))
        .filter(({ card }) => card.card_type === CardType.Institution);
      const options: MenuOption[] = institutionHandCards.map(({ card, handIdx }) => {
        const cost = (card as { cost: number }).cost;
        const canAfford = myPlayer.wealth >= cost;
        const label = institution
          ? `Replace with ${card.name} ($${cost})`
          : `Build ${card.name} ($${cost})`;
        return [
          canAfford ? label : `Cannot Afford ($${cost})`,
          canAfford ? () => { moves.playCardFromHand(handIdx, `institutions[${i}]`); handleCloseInspector(); } : undefined,
          <CardComponent key={handIdx} card={card} borderVariant={canAfford ? "actionable" : "cannot-use"} />,
        ] as const satisfies MenuOption;
      });
      if (options.length === 0) {
        options.push(['No institution cards in hand', undefined]);
      }
      slotData.set(slotId, {
        cardId: institution?.id,
        title: institution ? undefined : "Choose an institution to build",
        options,
      });
    });

    // Empty demand slots: clicking opens hand picker
    myPlayer.demands.forEach((demand, i) => {
      if (demand !== null) return; // occupied slots handled in the demand section below
      const slotId = `demand-${myClassKey}-${i}`;
      const demandHandCards = myPlayer.hand
        .map((cardId, handIdx) => ({ cardId, handIdx, card: getAnyCardData(cardId) }))
        .filter(({ card }) => card.card_type === CardType.Demand);
      const options: MenuOption[] = demandHandCards.map(({ card, handIdx }) => [
        card.name,
        () => { moves.playCardFromHand(handIdx, `demands[${i}]`); handleCloseInspector(); },
        <CardComponent key={handIdx} card={card} borderVariant="actionable" />,
      ] as const satisfies MenuOption);
      if (options.length === 0) {
        options.push(['No demand cards in hand', undefined]);
      }
      slotData.set(slotId, { title: "Choose a demand to make", options });
    });

    // Workplace slots: clicking opens hand picker (FOR SALE and occupied)
    G.workplaces.forEach((workplace, workplaceIdx) => {
      const slotId = `workplace-${workplaceIdx}`;
      const workplaceHandCards = myPlayer.hand
        .map((cardId, handIdx) => ({ cardId, handIdx, card: getAnyCardData(cardId) }))
        .filter(({ card }) => card.card_type === CardType.Workplace);
      const options: MenuOption[] = workplaceHandCards.map(({ card, handIdx }) => {
        const cost = (card as { cost: number }).cost;
        const canAfford = myPlayer.wealth >= cost;
        const isForSale = workplace === WorkplaceForSale;
        const isExpansion = !isForSale && workplace.id === card.id;
        const label = isForSale
          ? `Open ${card.name} ($${cost})`
          : isExpansion
            ? `Expand ${card.name} ($${cost})`
            : `Replace with ${card.name} ($${cost})`;
        const target = isForSale
          ? 'workplaces[-1]'
          : isExpansion
            ? `workplaces[${workplaceIdx}]/expand`
            : `workplaces[${workplaceIdx}]`;
        return [
          canAfford ? label : `Cannot Afford ($${cost})`,
          canAfford ? () => { moves.playCardFromHand(handIdx, target); handleCloseInspector(); } : undefined,
          <CardComponent key={handIdx} card={card} borderVariant={canAfford ? "actionable" : "cannot-use"} />,
        ] as const satisfies MenuOption;
      });
      if (options.length === 0) {
        options.push(['No workplace cards in hand', undefined]);
      }
      slotData.set(slotId, {
        cardId: workplace !== WorkplaceForSale ? workplace.id : undefined,
        title: workplace === WorkplaceForSale ? "Choose a workplace to open" : undefined,
        options,
      });
    });

    // In-play demand cards: Propose Legislation if player holds an office with a non-exhausted figure
    const proposingOffices = G.politicalOffices
      .map((office, offIdx) => ({ office, offIdx }))
      .filter(({ office }) => {
        if (office.card_type === CardType.Figure && office.exhausted) return false;
        const figData = getAnyCardData(office.id);
        return figData.card_type === CardType.Figure && figData.social_class === myClass;
      });

    myPlayer.demands.forEach((demand, demandIdx) => {
      if (!demand) return;
      const slotId = `demand-${myClassKey}-${demandIdx}`;
      const options: MenuOption[] = [];
      if (proposingOffices.length > 0 && !G.laws.includes(demand.id)) {
        options.push([
          `Propose Legislation`,
          () => { setBoardState({ mode: 'selectLegislationOffice', demandSlotIndex: demandIdx }); handleCloseInspector(); },
        ]);
      } else if (G.laws.includes(demand.id)) {
        options.push(['Already law', undefined]);
      } else {
        options.push(['No office held to propose legislation', undefined]);
      }
      slotData.set(slotId, { cardId: demand.id, options });
    });
  } else if (!isMyTurn && playerID !== undefined) {
    // In multiplayer, clicking any hand/figure card shows a disabled "wait your turn" message
    myPlayer.hand.forEach((cardId, idx) => {
      const slotId = `hand-${myClassKey}-${idx}`;
      slotData.set(slotId, { cardId, options: [["Must wait for your turn", undefined]] });
    });
    myPlayer.figures.forEach((figure, idx) => {
      const slotId = `figures-${myClassKey}-${idx}`;
      slotData.set(slotId, { cardId: figure.id, figureInPlay: figure, options: [["Must wait for your turn", undefined]] });
    });
  }

  // Sidebar figures for both players — available in all phases for inspection
  Object.values(SocialClass).forEach((socialClass) => {
    const classKey = socialClass === SocialClass.WorkingClass ? 'wc' : 'cc';
    G.players[socialClass].figures.forEach((figure, idx) => {
      const slotId = `sidebar-${classKey}-${idx}`;
      slotData.set(slotId, { cardId: figure.id, figureInPlay: figure, options: [] });
    });
  });

  // Laws — clickable for inspection in all phases
  G.laws.forEach((lawId) => {
    slotData.set(`law-${lawId}`, { cardId: lawId, options: [] });
  });

  // Derive active menu content from selected slot
  const selectedSlot =
    boardState.mode === 'normal' && boardState.selectedSlotId !== null
      ? slotData.get(boardState.selectedSlotId)
      : undefined;

  const activeOptions: MenuOption[] = selectedSlot?.options ?? [];
  const activeCard = selectedSlot?.cardId ? getAnyCardData(selectedSlot.cardId) : undefined;

  // Hand navigation — only available when a hand card is selected in normal mode
  const selectedSlotId = boardState.mode === 'normal' ? boardState.selectedSlotId : null;
  const handNavMatch = selectedSlotId?.match(/^hand-(\w+)-(\d+)$/) ?? null;
  const handNavIdx = handNavMatch ? parseInt(handNavMatch[2]) : -1;
  const handNavKey = handNavMatch ? handNavMatch[1] : '';
  const onPrevCard = handNavIdx > 0
    ? () => handleSelectSlot(`hand-${handNavKey}-${handNavIdx - 1}`)
    : undefined;
  const onNextCard = handNavIdx >= 0 && handNavIdx < myPlayer.hand.length - 1
    ? () => handleSelectSlot(`hand-${handNavKey}-${handNavIdx + 1}`)
    : undefined;

  // Undo button — always shows "↩ Undo"; reason appears on hover in status text
  const canUndo = G.undoState?.canUndo ?? false;
  const undoHoverText = !G.undoState ? undefined
    : G.undoState.canUndo ? `Undo ${G.undoState.previousActionName}`
    : `Cannot Undo: ${G.undoState.reason}`;

  // Status text (default — synced to DOM via useLayoutEffect below)
  const statusText = (() => {
    if (!isMyTurn) return `Waiting for ${currentClass} player...`;
    if (boardState.mode === 'showingDealtCards' && boardState.modalDismissed) return 'Click "End Turn" to confirm new cards and switch players.';
    if (G.turnPhase === TurnPhase.Action && boardState.mode === 'normal' && boardState.selectedSlotId === null) {
      return 'Select a card to see available actions';
    }
    if (G.turnPhase === TurnPhase.Action && boardState.mode === 'selectStrikeTarget') {
      return 'Select a workplace to strike';
    }
    if (G.turnPhase === TurnPhase.Action && boardState.mode === 'selectOfficeTarget') {
      return 'Select an office to run for';
    }
    if (G.turnPhase === TurnPhase.Action && boardState.mode === 'selectLegislationOffice') {
      return 'Select the office from which to propose legislation';
    }
    if (G.turnPhase === TurnPhase.Reproduction && theorizeSelectedIndexes.length === 0) {
      return 'Select cards to send to the Dustbin';
    }
    if (G.turnPhase === TurnPhase.Reproduction && theorizeSelectedIndexes.length > 0) {
      return `Send ${theorizeSelectedIndexes.length} card${theorizeSelectedIndexes.length > 1 ? 's' : ''} to the Dustbin`;
    }
    return '';
  })();

  // Sync default status text to the DOM after each render.
  // Hover and error handlers may override it imperatively between renders.
  useLayoutEffect(() => {
    setStatusText(statusText);
  }, [statusText]);

  // Sidebar income calculation
  const calcIncome = (socialClass: SocialClass): number => {
    return G.workplaces.reduce((sum, wp) => {
      if (wp === WorkplaceForSale) return sum;
      return sum + (socialClass === SocialClass.WorkingClass ? wp.wages : wp.profits);
    }, 0);
  };

  // Sidebar
  const renderSidebar = () => (
    <div className="game-sidebar">
      {Object.values(SocialClass).map((socialClass) => {
        const player = G.players[socialClass];
        const isWC = socialClass === SocialClass.WorkingClass;
        const classKey = isWC ? 'wc' : 'cc';
        const income = calcIncome(socialClass);
        const incomeLabel = isWC ? `Wages: $${income}` : `Profits: $${income}`;

        return (
          <div key={socialClass} className={`sidebar-player-section sidebar-player-section-${classKey}`}>
            <div className="sidebar-player-section-header">
              {isWC ? 'Working Class' : 'Capitalist Class'}
            </div>
            <div className="sidebar-player-stat">Hand: {player.hand.length}/{player.maxHandSize}</div>
            <div className="sidebar-player-stat">${player.wealth} wealth</div>
            <div className="sidebar-player-stat">{incomeLabel}</div>
            {player.figures.length > 0 && (
              <div className="sidebar-figures-list">
                {player.figures.map((figure, idx) => {
                  const figureCard = getAnyCardData(figure.id);
                  const slotId = `sidebar-${classKey}-${idx}`;
                  return (
                    <div
                      key={idx}
                      className="sidebar-figure-row"
                      onClick={() => handleSelectSlot(slotId)}
                    >
                      <span className="sidebar-figure-name">{figureCard.name}</span>
                      {figure.in_training && <span className="sidebar-figure-status"> (T)</span>}
                      {figure.exhausted && <span className="sidebar-figure-status"> (X)</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Laws in Effect */}
      <div className="sidebar-laws-section">
        <div className="sidebar-laws-title">Laws in Effect</div>
        {G.laws.length === 0 ? (
          <div className="sidebar-laws-empty">No laws yet</div>
        ) : (
          <div className="sidebar-laws-list">
            {G.laws.map((lawId) => {
              const lawCard = getAnyCardData(lawId);
              const slotId = `law-${lawId}`;
              return (
                <div
                  key={lawId}
                  className="sidebar-law-row"
                  onClick={() => handleSelectSlot(slotId)}
                >
                  <span className="sidebar-law-name">{lawCard.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // My player area
  const renderMyPlayerArea = () => {
    const player = myPlayer;
    const isWC = myClass === SocialClass.WorkingClass;
    const classKey = myClassKey;
    const playerId = isWC ? '0' : '1';

    const isReproduction = G.turnPhase === TurnPhase.Reproduction && isMyTurn;
    const theorizeAtLimit = theorizeSelectedIndexes.length >= myPlayer.theorizeLimit;

    return (
      <div className={`player-area player-area-${isWC ? 'working-class' : 'capitalist-class'} ${ctx.currentPlayer === playerId ? 'current-player' : ''}`}>
        <div className={`player-area-title ${ctx.currentPlayer === playerId ? 'current-player' : ''}`}>
          {isWC ? 'Working Class' : 'Capitalist Class'}
        </div>

        {/* Hand Section */}
        <div className="player-area-section">
          <div className="player-area-section-title">
            Hand ({player.hand.length}/{player.maxHandSize})
          </div>
          <div className="player-area-card-row">
            {player.hand.map((cardId, idx) => {
              const card = getAnyCardData(cardId);
              const slotId = `hand-${classKey}-${idx}`;

              if (isReproduction) {
                // During Reproduction: click-to-theorize, no ActionBar
                const isSelected = theorizeSelectedIndexes.includes(idx);
                const theorizeClass = isSelected
                  ? 'card-theorize-selected'
                  : theorizeAtLimit
                    ? 'card-theorize-blocked'
                    : 'card-theorize-available';
                const banner = isSelected ? { line1: 'Send to Dustbin' } : undefined;
                return (
                  <CardComponent
                    key={idx}
                    card={card}
                    onClick={() => handleToggleTheorize(idx)}
                    statusBanner={banner}
                    className={theorizeClass}
                  />
                );
              }

              const slot = slotData.get(slotId);
              // Double-click performs single enabled option
              const enabledHandlers = slot?.options
                .map(([, handler]) => handler)
                .filter((h): h is () => void => h !== undefined) ?? [];
              const handleDoubleClick = enabledHandlers.length === 1 ? enabledHandlers[0] : undefined;
              return (
                <CardComponent
                  key={idx}
                  card={card}
                  onClick={() => handleSelectSlot(slotId)}
                  onDoubleClick={handleDoubleClick}
                  borderVariant="actionable"
                />
              );
            })}
          </div>
        </div>

        {/* Activated Figures */}
        <div className="player-area-section">
          <div className="player-area-section-title">
            Activated Figures ({player.figures.length})
          </div>
          <div className="player-area-card-row">
            {player.figures.map((figure, idx) => {
              const card = getAnyCardData(figure.id);
              const slotId = `figures-${classKey}-${idx}`;
              const statusBanner = figure.in_training
                ? { line1: 'In Training', line2: '(until end of turn)' }
                : figure.exhausted
                  ? { line1: 'Exhausted', line2: '(until next turn)' }
                  : undefined;
              const borderVariant = (figure.in_training || figure.exhausted) ? 'cannot-use' as const
                : 'actionable' as const;
              return (
                <CardComponent
                  key={idx}
                  card={card}
                  onClick={G.turnPhase === TurnPhase.Action ? () => handleSelectSlot(slotId) : undefined}
                  statusBanner={statusBanner}
                  borderVariant={borderVariant}
                />
              );
            })}
            <div className="card-slot">
              <div className="card-slot-placeholder card-slot-placeholder-add">
                <span className="card-slot-add-icon">+</span>
              </div>
            </div>
          </div>
        </div>

        {/* Institutions and Demands */}
        <div className="player-area-section-dual">
          <div className="player-area-section-column">
            <div className="player-area-section-title">Institutions</div>
            <div className="player-area-card-row">
              {player.institutions.map((institution, i) => {
                const institutionSlotId = G.turnPhase === TurnPhase.Action && isMyTurn
                  ? `institution-${classKey}-${i}`
                  : undefined;
                return (
                  <div key={i} className="card-slot">
                    {institution ? (
                      <CardComponent
                        card={getAnyCardData(institution.id)}
                        borderVariant={institutionSlotId ? "actionable" : "other"}
                        onClick={institutionSlotId ? () => handleSelectSlot(institutionSlotId) : undefined}
                      />
                    ) : (
                      <div
                        className={`card-slot-placeholder${institutionSlotId ? ' card-slot-placeholder-selectable' : ''}`}
                        onClick={institutionSlotId ? () => handleSelectSlot(institutionSlotId) : undefined}
                        role={institutionSlotId ? "button" : undefined}
                        aria-label={institutionSlotId ? `Institution slot ${i + 1}` : undefined}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="player-area-section-column">
            <div className="player-area-section-title">Demands</div>
            <div className="player-area-card-row">
              {player.demands.map((demand, i) => {
                if (!demand) {
                  const emptyDemandSlotId = G.turnPhase === TurnPhase.Action && isMyTurn
                    ? `demand-${classKey}-${i}`
                    : undefined;
                  return (
                    <div key={i} className="card-slot">
                      <div
                        className={`card-slot-placeholder${emptyDemandSlotId ? ' card-slot-placeholder-selectable' : ''}`}
                        onClick={emptyDemandSlotId ? () => handleSelectSlot(emptyDemandSlotId) : undefined}
                        role={emptyDemandSlotId ? "button" : undefined}
                        aria-label={emptyDemandSlotId ? `Demand slot ${i + 1}` : undefined}
                      />
                    </div>
                  );
                }
                const demandSlotId = `demand-${classKey}-${i}`;
                const isLaw = G.laws.includes(demand.id);
                return (
                  <div key={i} className="card-slot">
                    <CardComponent
                      card={getAnyCardData(demand.id)}
                      borderVariant={G.turnPhase === TurnPhase.Action && isMyTurn ? "actionable" : "other"}
                      statusBanner={isLaw ? { line1: "Law" } : undefined}
                      onClick={G.turnPhase === TurnPhase.Action && isMyTurn ? () => handleSelectSlot(demandSlotId) : undefined}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Compute conflict target card for ConflictModal
  const conflictTargetCard: CardSlotEntity | undefined = (() => {
    if (!G.activeConflict) return undefined;
    if (G.activeConflict.conflictType === ConflictType.Strike) {
      return G.workplaces[G.activeConflict.targetWorkplaceIndex];
    } else if (G.activeConflict.conflictType === ConflictType.Election) {
      return G.activeConflict.targetIncumbent;
    } else {
      // TODO: Return the DemandCardInPlay
      return getAnyCardData(G.activeConflict.demandCardId);
    }
  })();

  return (
    <div className="game-board">
      {/* Conflict Modal — sits lowest in the overlay stack; TurnStart and handoff render on top */}
      {G.activeConflict && conflictTargetCard && !conflictModalMinimized && (() => {
        // In local mode the device is always with the active conflict player after the handoff.
        // In multiplayer each client knows its own class via playerID.
        const conflictViewingClass: SocialClass = playerID
          ? myClass
          : G.activeConflict.activeConflictPlayer;
        return (
          <ConflictModal
            conflict={G.activeConflict}
            viewingClass={conflictViewingClass}
            activeConflictPlayer={G.activeConflict.activeConflictPlayer}
            players={G.players}
            targetCard={conflictTargetCard}
            onClose={() => setConflictModalMinimized(true)}
            onCancel={() => moves.cancelConflict()}
            onInitiate={() => { moves.initiateConflict(); setConflictModalMinimized(true); }}
            onAddFigure={(figureId) => moves.addFigureToConflict(figureId)}
            onAddTactic={(handIndex, forClass) => moves.addTacticToConflict(handIndex, forClass)}
            onRemoveCard={(cardIndex, forClass) => moves.removeCardFromConflict(cardIndex, forClass)}
            onChangeLeader={(leaderSlotIndex, conflictCardIndex) => moves.changeConflictLeader(leaderSlotIndex, conflictCardIndex)}
            onPlanResponse={() => { moves.planResponse(); setConflictModalMinimized(true); }}
            onEscalate={() => { moves.escalateConflict(); setConflictModalMinimized(true); }}
            onResolve={() => moves.resolveConflict()}
          />
        );
      })()}

      {/* Turn Start Modal — stacks over Conflict Modal */}
      {G.turnPhase === TurnPhase.Production && (!playerID ? handoffDismissed : isMyTurn) && (
        <TurnStartModal
          turnNumber={G.turnNumber}
          currentClass={currentClass}
          onStart={() => moves.collectProduction()}
        />
      )}

      {/* Conflict Outcome Modal */}
      {G.turnPhase !== TurnPhase.Production && G.conflictOutcome && !G.conflictOutcome.dismissedBy.includes(myClass) && (
        <ConflictOutcomeModal
          outcome={G.conflictOutcome}
          viewingClass={myClass}
          onDismiss={() => moves.dismissConflictOutcome(myClass)}
        />
      )}

      {/* Pass-and-play handoff interstitial — always renders last so it sits on top of everything.
          Local mode: shown after each player-switch (Production) and after conflict phase advances.
          Multiplayer: shown to the non-active player while the other player takes their turn. */}
      {(() => {
        const conflictPhase = G.activeConflict?.phase;
        // Suppress the handoff interstitial while the deal result modal is open —
        // the player is still reviewing their new cards and will see the handoff after dismissing.
        const needsLocalHandoff = !playerID && !handoffDismissed
          && boardState.mode !== 'showingDealtCards'
          && (
            G.turnPhase === TurnPhase.Production ||
            conflictPhase === ConflictPhase.Responding ||
            conflictPhase === ConflictPhase.Resolving
          );
        const needsMultiplayerWait = !!playerID && !isMyTurn && !handoffDismissed && boardState.mode !== 'showingDealtCards';

        if (needsLocalHandoff) {
          // The "waiting class" is whoever is handing off the device
          const handoffClass: SocialClass = (() => {
            if (conflictPhase === ConflictPhase.Responding && G.activeConflict) {
              return G.activeConflict.initiatingClass;
            }
            if (conflictPhase === ConflictPhase.Resolving && G.activeConflict) {
              return G.activeConflict.initiatingClass === SocialClass.WorkingClass
                ? SocialClass.CapitalistClass : SocialClass.WorkingClass;
            }
            // Production: the previous player (opposite of the one about to start)
            return currentClass === SocialClass.WorkingClass
              ? SocialClass.CapitalistClass : SocialClass.WorkingClass;
          })();
          return (
            <WaitingInterstitial
              waitingClass={handoffClass}
              onClose={() => { setHandoffDismissed(true); if (G.activeConflict) setConflictModalMinimized(false); }}
            />
          );
        }

        if (needsMultiplayerWait) {
          return (
            <WaitingInterstitial
              waitingClass={myClass}
              onClose={() => { setHandoffDismissed(true); onHandoff?.(); }}
            />
          );
        }

        return null;
      })()}

      {/* Deal Result Modal - shown after theorizing */}
      {boardState.mode === 'showingDealtCards' && !boardState.modalDismissed && (
        <DealResultModal
          theorizedCards={boardState.theorizedCardIds.map(id => getAnyCardData(id))}
          newCards={boardState.newCardIds.map(id => getAnyCardData(id))}
          onEndTurn={handleEndTurn}
          onClose={handleEndTurn}
        />
      )}

      {/* Action Menu Bar - normal card inspector */}
      {boardState.mode === 'normal' && (activeOptions.length > 0 || activeCard) && (
        <ActionMenuBar
          title={selectedSlot?.title}
          card={activeCard}
          options={activeOptions}
          playerClass={myClass}
          onClose={selectedSlot ? handleCloseInspector : undefined}
          onPrev={handNavMatch ? onPrevCard : undefined}
          onNext={handNavMatch ? onNextCard : undefined}
        />
      )}

      {/* Strike Target Selector — merged into ActionMenuBar */}
      {boardState.mode === 'selectStrikeTarget' && (
        <ActionMenuBar
          title={"Plan Strike"}
          options={filterMap(G.workplaces, (workplace, index) => {
            if (workplace === WorkplaceForSale) {
              return undefined;
            }
            const cardData = anyWorkplaceCardById[workplace.id];
            const preview = <CardComponent card={workplace} borderVariant="other" />;
            return [
              cardData.name,
              () => handleSelectStrikeTarget(index),
              preview,
            ] as const satisfies MenuOption;
          })}
          playerClass={myClass}
          onClose={handleCloseInspector}
        />
      )}

      {/* Office Target Selector — merged into ActionMenuBar */}
      {boardState.mode === 'selectOfficeTarget' && (
        <ActionMenuBar
          title={`Choose an office for ${getAnyCardData(boardState.figure.id).name} to run for`}
          options={G.politicalOffices.map((office, index) => {
            const stateCard = getAnyStateFigureDataById(office.id);
            const preview = <CardComponent card={stateCard} borderVariant="other" />;
            return [
              stateCard.name,
              () => handleSelectOfficeTarget(index),
              preview,
            ] as const satisfies MenuOption;
          })}
          playerClass={myClass}
          onClose={handleCloseInspector}
        />
      )}

      {/* Legislation Office Selector — merged into ActionMenuBar */}
      {boardState.mode === 'selectLegislationOffice' && (
        <ActionMenuBar
          title={`Choose an office to propose legislation from`}
          options={G.politicalOffices.map((office, index) => {
            const stateCard = getAnyStateFigureDataById(office.id);
            const preview = <CardComponent card={stateCard} borderVariant={office.card_type === CardType.DefaultStateFigure ? "other" : "actionable"} />;
            const canPropose = office.card_type === CardType.Figure && getFigureDataById(office.id).social_class === myClass && !office.exhausted;
            return [
              stateCard.name,
              canPropose ? () => handleSelectLegislationOffice(index) : undefined,
              preview,
            ] as const satisfies MenuOption;
          })}
          playerClass={myClass}
          onClose={handleCloseInspector}
        />
      )}

      {/* Top Bar */}
      <div className="game-top-controls">
        <div className="game-top-controls-left">
          <HamburgerMenu />
          <span className="game-title">Class War International</span>
        </div>
        <div className="game-top-controls-center">
          <span className="game-turn-info">Turn {G.turnNumber + 1}</span>
          {(G.turnPhase === TurnPhase.Action || G.turnPhase === TurnPhase.Reproduction) && (
            <span className="game-current-player-info">{currentClass}&apos;s Turn</span>
          )}
        </div>
        <div className="game-top-controls-right" />
      </div>

      {/* Current Player Controls Bar */}
      <div className="game-player-controls">
        <div className="game-player-controls-left">
          <div
            onMouseEnter={() => undoHoverText && setStatusText(undoHoverText, canUndo ? "info" : "warn")}
            onMouseLeave={() => setStatusText(statusText)}
          >
            <button
              className="game-undo-button"
              disabled={!canUndo}
              onClick={canUndo ? () => moves.undoMove() : undefined}
            >
              ↩ Undo
            </button>
          </div>
          {isMyTurn && G.turnPhase === TurnPhase.Action && !G.activeConflict && (
            <button
              className="game-end-turn-button"
              onClick={() => moves.endActionPhase()}
            >
              ⏭ End Action Phase
            </button>
          )}
          {isMyTurn && G.turnPhase === TurnPhase.Reproduction && boardState.mode !== 'showingDealtCards' && (
            <button
              className="game-finish-theorizing-button"
              onClick={handleFinishTheorizing}
            >
              {theorizeSelectedIndexes.length === 0
                ? '⏭ Skip Theorizing'
                : `⏭ Theorize Cards (${theorizeSelectedIndexes.length})`}
            </button>
          )}
          {G.activeConflict && conflictModalMinimized && (
            <button
              className="game-return-to-conflict-button"
              onClick={() => setConflictModalMinimized(false)}
            >
              ⚔ Return to Conflict
            </button>
          )}
          {isMyTurn && boardState.mode === 'showingDealtCards' && boardState.modalDismissed && !G.activeConflict && (
            <button
              className="game-end-turn-button"
              onClick={handleEndTurn}
            >
              ⏭ End Turn
            </button>
          )}
        </div>
        <div className="game-player-controls-center">
          <span id={STATUS_TEXT_ID} className="game-status-text" />
        </div>
        <div className="game-player-controls-right">
          <div className="game-player-info-right">
            <span className="game-player-class-label">{myClass}</span>
            <span className="game-player-wealth">${G.players[myClass].wealth}</span>
          </div>
        </div>
      </div>

      {/* Main Game Area: [sidebar][my-player-area][shared-area] */}
      <div className="game-main-area">
        {renderSidebar()}

        <div className="my-player-area-container">
          {renderMyPlayerArea()}
        </div>

        {/* Shared Board Area */}
        <div className="shared-area-container">
          <div className="shared-area">
            <div className="shared-area-sections">
              {/* Workplaces Section */}
              <div className="shared-area-section">
                <div className="shared-area-section-title">Workplaces</div>
                <div className="workplaces-section">
                  {G.workplaces.map((workplace, index) => {
                    const workplaceSlotId = G.turnPhase === TurnPhase.Action && isMyTurn
                      ? `workplace-${index}`
                      : undefined;
                    return (
                      <div key={index} className="card-slot">
                        {/* TODO: Move this to CardComponent */}
                        {workplace === WorkplaceForSale ? (
                          <div
                            className={`card-slot-placeholder${workplaceSlotId ? ' card-slot-placeholder-selectable' : ''}`}
                            onClick={workplaceSlotId ? () => handleSelectSlot(workplaceSlotId) : undefined}
                            role={workplaceSlotId ? "button" : undefined}
                            aria-label={workplaceSlotId ? `Workplace slot ${index + 1}` : undefined}
                          >
                            <div className="workplace-empty-text">FOR SALE</div>
                          </div>
                        ) : (
                          <CardComponent
                            card={workplace}
                            borderVariant="other"
                            onClick={workplaceSlotId ? () => handleSelectSlot(workplaceSlotId) : undefined}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Political Offices Section */}
              <div className="shared-area-section">
                <div className="shared-area-section-title">Political Offices</div>
                <div className="offices-section">
                  {G.politicalOffices.map((office, index) => {
                    // The election cooldown should be a status on the card. The banner should only be used when a card is unusable.
                    const cooldown = (office.card_type === CardType.Figure && office?.electionCooldownTurnsRemaining) || 0;
                    const effects = []
                    if (cooldown > 0) {
                      effects.push(`🔒 Safe for ${pluralize(cooldown, 'turn')}`);
                    }
                    const statusBanner = office.card_type === CardType.Figure && office.exhausted ? { line1: 'Exhausted' } : undefined;
                    return (
                      <div key={index} className="office-container">
                        <div className="card-slot">
                          <CardComponent
                            card={office}
                            statusBanner={statusBanner}
                            effects={effects}
                            borderVariant={office.card_type === CardType.Figure ? "actionable" : "other"}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
