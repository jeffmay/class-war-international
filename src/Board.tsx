/**
 * Main Board component for Class War: International
 */

import { BoardProps } from 'boardgame.io/react';
import React, { useEffect, useState } from 'react';
import { ActionMenuBar, MenuOption } from './components/ActionMenuBar';
import { CardComponent } from './components/CardComponent';
import { ConflictModal } from './components/ConflictModal';
import { ConflictOutcomeModal } from './components/ConflictOutcomeModal';
import { DealResultModal } from './components/DealResultModal';
import { TurnStartModal } from './components/StartGameScreen';
import { DeckCardID, getAnyCardData, getAnyStateFigureDataById, getFigureDataById } from './data/cards';
import { CardType, CardSlotEntity, FigureCardInPlay, SocialClass, WorkplaceCardData, WorkplaceInPlay, WorkplaceForSale } from './types/cards';
import { ConflictType } from './types/conflicts';
import { GameState, TurnPhase } from './types/game';
import { Brand, make } from 'ts-brand';
import { pluralize } from './util/text';

/** Build a WorkplaceCardData for display by substituting current wages/profits from in-play state.
 *  Appends an expansion indicator (x2, x3, …) to the name when the workplace has been expanded. */
function makeWorkplaceDisplayCard(wp: WorkplaceInPlay): WorkplaceCardData {
  const card = getAnyCardData(wp.id);
  if (card.card_type !== CardType.Workplace) {
    throw new Error(`Expected workplace card for id "${wp.id}", got ${card.card_type}`);
  }
  const expansionSuffix = wp.expansionCount ? ` (x${wp.expansionCount + 1})` : "";
  return { ...card, name: card.name + expansionSuffix, starting_wages: wp.wages, starting_profits: wp.profits, established_power: wp.established_power };
}

export interface ClassWarBoardProps extends BoardProps<GameState> { }

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

export const ClassWarBoard: React.FC<ClassWarBoardProps> = ({ G, ctx, moves, playerID }) => {
  const [boardState, setBoardState] = useState<BoardState>({ mode: 'normal', selectedSlotId: null });
  const [theorizeSelectedIndexes, setTheorizeSelectedIndexes] = useState<number[]>([]);
  const [conflictModalOpen, setConflictModalOpen] = useState(true);

  // Reopen the modal automatically whenever a new conflict begins
  const prevConflictRef = React.useRef<typeof G.activeConflict>(G.activeConflict);
  React.useEffect(() => {
    if (G.activeConflict && !prevConflictRef.current) {
      setConflictModalOpen(true);
    }
    prevConflictRef.current = G.activeConflict;
  }, [G.activeConflict]);

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

  // Escape key closes ActionMenuBar, DealResultModal, or ConflictOutcomeModal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (G.conflictOutcome && !G.conflictOutcome.dismissedBy.includes(myClass)) {
          moves.dismissConflictOutcome(myClass);
        } else if (boardState.mode === 'showingDealtCards' && !boardState.modalDismissed) {
          setBoardState({ ...boardState, modalDismissed: true });
        } else if (boardState.mode === 'normal' && boardState.selectedSlotId !== null) {
          handleCloseInspector();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [boardState, G.conflictOutcome, myClass, moves]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Show the deal result modal — does NOT yet execute the move
  const handleFinishTheorizing = () => {
    const remainingHand = myPlayer.hand.filter((_, i) => !theorizeSelectedIndexes.includes(i));
    const drawCount = myPlayer.maxHandSize - remainingHand.length;
    const theorizedCardIds = theorizeSelectedIndexes.map(i => myPlayer.hand[i]);
    const newCardIds = myPlayer.deck.slice(0, drawCount);
    setBoardState({ mode: 'showingDealtCards', theorizedCardIds, newCardIds, modalDismissed: false });
  };

  // Actually end the turn: discard theorize cards, draw, switch players
  const handleEndTurn = () => {
    moves.endReproductionPhase(theorizeSelectedIndexes);
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
        options.push([
          `Train ($${card.cost})`,
          canAfford ? () => { moves.playCardFromHand(idx, 'figures[-1]'); handleCloseInspector(); } : undefined,
        ]);
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
        const hasEmptySlot = slot0 === null || slot1 === null;
        if (hasEmptySlot) {
          options.push([
            `Build New Institution ($${card.cost})`,
            canAfford ? () => { moves.playCardFromHand(idx, 'institutions[-1]'); handleCloseInspector(); } : undefined,
          ]);
        }
        if (slot0 !== null) {
          options.push([
            `Replace ${getAnyCardData(slot0.id).name} ($${card.cost})`,
            canAfford ? () => { moves.playCardFromHand(idx, 'institutions[0]'); handleCloseInspector(); } : undefined,
          ]);
        }
        if (slot1 !== null) {
          options.push([
            `Replace ${getAnyCardData(slot1.id).name} ($${card.cost})`,
            canAfford ? () => { moves.playCardFromHand(idx, 'institutions[1]'); handleCloseInspector(); } : undefined,
          ]);
        }
      } else if (card.card_type === CardType.Workplace) {
        const canAfford = myPlayer.wealth >= card.cost;
        const hasEmptySlot = G.workplaces.some(w => w === WorkplaceForSale);
        if (hasEmptySlot) {
          options.push([
            `Open New Workplace ($${card.cost})`,
            canAfford ? () => { moves.playCardFromHand(idx, 'workplaces[-1]'); handleCloseInspector(); } : undefined,
          ]);
        }
        G.workplaces.forEach((wp, wpIdx) => {
          if (wp === WorkplaceForSale) return;
          const wpDisplayCard = makeWorkplaceDisplayCard(wp);
          options.push([
            `Replace ${wpDisplayCard.name} ($${card.cost})`,
            canAfford ? () => { moves.playCardFromHand(idx, `workplaces[${wpIdx}]`); handleCloseInspector(); } : undefined,
          ]);
          if (wp.workplaceId === card.id) {
            options.push([
              `Expand ${wpDisplayCard.name} ($${card.cost})`,
              canAfford ? () => { moves.playCardFromHand(idx, `workplaces[${wpIdx}]/expand`); handleCloseInspector(); } : undefined,
            ]);
          }
        });
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
          <CardComponent key={handIdx} card={card} borderVariant="hand" />,
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
        <CardComponent key={handIdx} card={card} borderVariant="hand" />,
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
        const isExpansion = !isForSale && workplace.workplaceId === card.id;
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
          <CardComponent key={handIdx} card={card} borderVariant="hand" />,
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

  // Undo label
  const undoLabel = !G.undoState
    ? '↩ Undo'
    : G.undoState.canUndo
      ? `↩ Undo ${G.undoState.previousActionName}`
      : `X Cannot Undo: ${G.undoState.reason}`;
  const canUndo = G.undoState?.canUndo ?? false;

  // Status text
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
                  borderVariant="hand"
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
              const borderVariant = figure.in_training ? 'training' as const
                : figure.exhausted ? 'exhausted' as const
                  : 'in-play' as const;
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
                        borderVariant="in-play"
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
                      borderVariant="in-play"
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
      const workplaceSlot = G.workplaces[G.activeConflict.targetWorkplaceIndex];
      if (workplaceSlot === WorkplaceForSale) return undefined;
      else return makeWorkplaceDisplayCard(workplaceSlot);
    }
    if (G.activeConflict.conflictType === ConflictType.Election) {
      return getAnyCardData(G.activeConflict.targetIncumbent.id);
    }
    // Legislation: show the demand card being proposed
    return getAnyCardData(G.activeConflict.demandCardId);
  })();

  return (
    <div className="game-board">
      {/* Turn Start Modal - shown during Production phase */}
      {G.turnPhase === TurnPhase.Production && !G.conflictOutcome && (
        <TurnStartModal
          turnNumber={G.turnNumber}
          currentClass={currentClass}
          onStart={() => moves.collectProduction()}
        />
      )}

      {/* Conflict Outcome Modal — shown after resolution; each player dismisses independently */}
      {G.conflictOutcome && !G.conflictOutcome.dismissedBy.includes(myClass) && (
        <ConflictOutcomeModal
          outcome={G.conflictOutcome}
          viewingClass={myClass}
          onDismiss={() => moves.dismissConflictOutcome(myClass)}
        />
      )}

      {/* Active Conflict Modal — shown during Initiating / Responding / Resolving phases */}
      {G.activeConflict && conflictTargetCard && conflictModalOpen && (
        <ConflictModal
          conflict={G.activeConflict}
          activeConflictPlayer={G.activeConflict.activeConflictPlayer}
          players={G.players}
          targetCard={conflictTargetCard}
          onClose={() => setConflictModalOpen(false)}
          onCancel={() => moves.cancelConflict()}
          onInitiate={() => moves.initiateConflict()}
          onAddFigure={(figureId) => moves.addFigureToConflict(figureId)}
          onAddTactic={(handIndex) => moves.addTacticToConflict(handIndex)}
          onPlanResponse={() => moves.planResponse()}
          onResolve={() => moves.resolveConflict()}
        />
      )}

      {/* Deal Result Modal - shown after theorizing */}
      {boardState.mode === 'showingDealtCards' && !boardState.modalDismissed && (
        <DealResultModal
          theorizedCards={boardState.theorizedCardIds.map(id => getAnyCardData(id))}
          newCards={boardState.newCardIds.map(id => getAnyCardData(id))}
          onEndTurn={handleEndTurn}
          onClose={() => setBoardState({ ...boardState, modalDismissed: true })}
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
          options={G.workplaces.map((workplace, index) => {
            const isEmpty = workplace === WorkplaceForSale;
            const card = isEmpty ? null : makeWorkplaceDisplayCard(workplace);
            const preview = card && <CardComponent card={card} borderVariant="other" />;
            return [
              isEmpty ? 'Empty Slot' : card!.name,
              isEmpty ? undefined : () => handleSelectStrikeTarget(index),
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
            const preview = <CardComponent card={stateCard} borderVariant={office.card_type === CardType.DefaultStateFigure ? "other" : "in-play"} />;
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
          <button className="game-undo-button" disabled={!canUndo}>
            {undoLabel}
          </button>
          {isMyTurn && G.turnPhase === TurnPhase.Action && (
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
          {G.activeConflict && !conflictModalOpen && (
            <button
              className="game-return-to-conflict-button"
              onClick={() => setConflictModalOpen(true)}
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
          <span className="game-status-text">{statusText}</span>
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
                            card={makeWorkplaceDisplayCard(workplace)}
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
                    const cooldown = office.card_type === CardType.Figure && office?.electionCooldownTurnsRemaining || 0;
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
                            borderVariant={office.card_type === CardType.Figure ? "in-play" : "other"}
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
