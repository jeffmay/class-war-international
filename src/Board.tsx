/**
 * Main Board component for Class War: International
 */

import React, { useState, useEffect } from 'react';
import { BoardProps } from 'boardgame.io/react';
import { GameState, TurnPhase } from './types/game';
import { CardType, FigureCardInPlay, SocialClass } from './types/cards';
import { ConflictType } from './types/conflicts';
import { getCardData } from './data/cards';
import { TurnStartModal } from './components/StartGameScreen';
import { CardComponent } from './components/CardComponent';
import { ActionMenuBar, MenuOption } from './components/ActionMenuBar';
import { ConflictTargetMenuBar } from './components/ConflictTargetMenuBar';

interface ClassWarBoardProps extends BoardProps<GameState> {}

type BoardState =
  | { mode: 'normal'; selectedSlotId: string | null }
  | { mode: 'selectStrikeTarget'; figure: FigureCardInPlay }
  | { mode: 'selectOfficeTarget'; figure: FigureCardInPlay };

interface SlotData {
  cardId?: string;
  figureInPlay?: FigureCardInPlay;
  options: MenuOption[];
  /** If set, clicking the card calls this directly instead of opening the action menu */
  directAction?: () => void;
}

export const ClassWarBoard: React.FC<ClassWarBoardProps> = ({ G, ctx, moves, playerID }) => {
  const [boardState, setBoardState] = useState<BoardState>({ mode: 'normal', selectedSlotId: null });
  const [theorizeSelectedIds, setTheorizeSelectedIds] = useState<string[]>([]);

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

  // Change 1: Escape key closes ActionMenuBar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && boardState.mode === 'normal' && boardState.selectedSlotId !== null) {
        handleCloseInspector();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [boardState]);

  const handleSelectSlot = (slotId: string) => {
    if (boardState.mode === 'normal' && boardState.selectedSlotId === slotId) {
      setBoardState({ mode: 'normal', selectedSlotId: null });
    } else {
      setBoardState({ mode: 'normal', selectedSlotId: slotId });
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

  // Finish theorizing: discard selected cards and end reproduction phase
  const handleFinishTheorizing = () => {
    moves.endReproductionPhase(theorizeSelectedIds);
    setTheorizeSelectedIds([]);
    setBoardState({ mode: 'normal', selectedSlotId: null });
  };

  // --- Pre-compute slot data ---
  const slotData = new Map<string, SlotData>();

  if (G.turnPhase === TurnPhase.Action && isMyTurn) {
    // Hand cards: action options
    myPlayer.hand.forEach((cardId, idx) => {
      const card = getCardData(cardId);
      const slotId = `hand-${myClassKey}-${idx}`;
      const options: MenuOption[] = [];
      let directAction: (() => void) | undefined;

      if (card.card_type === CardType.Figure) {
        const canAfford = myPlayer.wealth >= card.cost;
        options.push([
          `Train ($${card.cost})`,
          canAfford ? () => { moves.playCardFromHand(idx, 'figures[-1]'); handleCloseInspector(); } : undefined,
        ]);
      } else if (card.card_type === CardType.Demand) {
        // Change 3: updated demand slot logic
        const slot0 = myPlayer.demands[0];
        const slot1 = myPlayer.demands[1];
        const bothEmpty = slot0 === null && slot1 === null;
        if (bothEmpty) {
          // Auto-play to first empty slot
          directAction = () => moves.playCardFromHand(idx, 'demands[-1]');
        } else {
          // Show inspector with options
          const hasEmptySlot = slot0 === null || slot1 === null;
          if (hasEmptySlot) {
            options.push(['Make New Demand', () => { moves.playCardFromHand(idx, 'demands[-1]'); handleCloseInspector(); }]);
          }
          if (slot0 !== null) {
            options.push([`Replace ${getCardData(slot0.id).name} Demand`, () => { moves.playCardFromHand(idx, 'demands[0]'); handleCloseInspector(); }]);
          }
          if (slot1 !== null) {
            options.push([`Replace ${getCardData(slot1.id).name} Demand`, () => { moves.playCardFromHand(idx, 'demands[1]'); handleCloseInspector(); }]);
          }
        }
      } else if (card.card_type === CardType.Institution) {
        // Change 3: updated institution slot logic
        const slot0 = myPlayer.institutions[0];
        const slot1 = myPlayer.institutions[1];
        const canAfford = myPlayer.wealth >= card.cost;
        const bothEmpty = slot0 === null && slot1 === null;
        if (bothEmpty) {
          if (canAfford) {
            directAction = () => moves.playCardFromHand(idx, 'institutions[-1]');
          } else {
            options.push([`Build New Institution ($${card.cost})`, undefined]);
          }
        } else {
          const hasEmptySlot = slot0 === null || slot1 === null;
          if (hasEmptySlot) {
            options.push([
              `Build New Institution ($${card.cost})`,
              canAfford ? () => { moves.playCardFromHand(idx, 'institutions[-1]'); handleCloseInspector(); } : undefined,
            ]);
          }
          if (slot0 !== null) {
            options.push([
              `Replace ${getCardData(slot0.id).name} ($${card.cost})`,
              canAfford ? () => { moves.playCardFromHand(idx, 'institutions[0]'); handleCloseInspector(); } : undefined,
            ]);
          }
          if (slot1 !== null) {
            options.push([
              `Replace ${getCardData(slot1.id).name} ($${card.cost})`,
              canAfford ? () => { moves.playCardFromHand(idx, 'institutions[1]'); handleCloseInspector(); } : undefined,
            ]);
          }
        }
      }

      slotData.set(slotId, { cardId, options, directAction });
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

    // Sidebar figures for both players (inspect only)
    Object.values(SocialClass).forEach((socialClass) => {
      const classKey = socialClass === SocialClass.WorkingClass ? 'wc' : 'cc';
      G.players[socialClass].figures.forEach((figure, idx) => {
        const slotId = `sidebar-${classKey}-${idx}`;
        slotData.set(slotId, { cardId: figure.id, figureInPlay: figure, options: [] });
      });
    });
  }

  if (G.turnPhase === TurnPhase.Reproduction && isMyTurn) {
    // Hand cards: Theorize option
    myPlayer.hand.forEach((cardId, idx) => {
      const slotId = `hand-${myClassKey}-${idx}`;
      const isSelected = theorizeSelectedIds.includes(cardId);
      const canAdd = !isSelected && theorizeSelectedIds.length < myPlayer.theorizeLimit;
      const options: MenuOption[] = isSelected
        ? [['Remove from Theorize', () => { setTheorizeSelectedIds(ids => ids.filter(id => id !== cardId)); handleCloseInspector(); }]]
        : [['Theorize', canAdd ? () => { setTheorizeSelectedIds(ids => [...ids, cardId]); handleCloseInspector(); } : undefined]];
      slotData.set(slotId, { cardId, options });
    });
  }

  // Derive active menu content from selected slot
  const selectedSlot =
    boardState.mode === 'normal' && boardState.selectedSlotId !== null
      ? slotData.get(boardState.selectedSlotId)
      : undefined;

  const activeOptions: MenuOption[] = selectedSlot?.options ?? [];
  const activeCard = selectedSlot?.cardId ? getCardData(selectedSlot.cardId) : undefined;

  // Undo label
  const undoLabel = !G.undoState
    ? '↩️ Undo'
    : G.undoState.canUndo
      ? `↩️ Undo ${G.undoState.previousActionName}`
      : `Cannot Undo: ${G.undoState.reason}`;
  const canUndo = G.undoState?.canUndo ?? false;

  // Change 7: Status text logic
  const statusText = (() => {
    if (!isMyTurn) return `Waiting for ${currentClass} player...`;
    if (G.turnPhase === TurnPhase.Action && boardState.mode === 'normal' && boardState.selectedSlotId === null) {
      return 'Select a card to see available actions';
    }
    if (G.turnPhase === TurnPhase.Action && boardState.mode === 'selectStrikeTarget') {
      return 'Select a workplace to strike';
    }
    if (G.turnPhase === TurnPhase.Action && boardState.mode === 'selectOfficeTarget') {
      return 'Select an office to run for';
    }
    if (G.turnPhase === TurnPhase.Reproduction && theorizeSelectedIds.length === 0) {
      return 'Select cards to send to the Dustbin';
    }
    if (G.turnPhase === TurnPhase.Reproduction && theorizeSelectedIds.length > 0) {
      return `Send ${theorizeSelectedIds.length} card${theorizeSelectedIds.length > 1 ? 's' : ''} to the Dustbin`;
    }
    return '';
  })();

  // Change 8: Sidebar income calculation
  const calcIncome = (socialClass: SocialClass): number => {
    return G.workplaces.reduce((sum, wp) => {
      if (wp.id.startsWith('empty')) return sum;
      return sum + (socialClass === SocialClass.WorkingClass ? wp.wages : wp.profits);
    }, 0);
  };

  // Change 8: renderSidebar function
  const renderSidebar = () => {
    return (
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
              <div className="sidebar-player-stat">
                Hand: {player.hand.length}/{player.maxHandSize} cards
              </div>
              <div className="sidebar-player-stat">
                ${player.wealth} wealth
              </div>
              <div className="sidebar-player-stat">
                {incomeLabel}
              </div>
              {player.figures.length > 0 && (
                <div className="sidebar-figures-list">
                  {player.figures.map((figure, idx) => {
                    const figureCard = getCardData(figure.id);
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
      </div>
    );
  };

  // Change 8: renderMyPlayerArea - renders only the current player's area
  const renderMyPlayerArea = () => {
    const player = myPlayer;
    const isWC = myClass === SocialClass.WorkingClass;
    const classKey = myClassKey;
    const playerId = isWC ? '0' : '1';

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
              const card = getCardData(cardId);
              const slotId = `hand-${classKey}-${idx}`;
              const isTheorizeSelected = G.turnPhase === TurnPhase.Reproduction && theorizeSelectedIds.includes(cardId);
              const slot = slotData.get(slotId);
              const handleClick = slot?.directAction ?? (() => handleSelectSlot(slotId));
              return (
                <CardComponent
                  key={idx}
                  card={card}
                  onClick={handleClick}
                  className={isTheorizeSelected ? 'card-theorize-selected' : undefined}
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
              const card = getCardData(figure.id);
              const slotId = `figures-${classKey}-${idx}`;
              // Change 4 & 5: status banner for in_training and exhausted figures
              const statusBanner = figure.in_training
                ? { line1: 'In Training', line2: '(until end of turn)' }
                : figure.exhausted
                  ? { line1: 'Exhausted', line2: '(until next turn)' }
                  : undefined;
              return (
                <CardComponent
                  key={idx}
                  card={card}
                  onClick={G.turnPhase === TurnPhase.Action ? () => handleSelectSlot(slotId) : undefined}
                  statusBanner={statusBanner}
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
              {player.institutions.map((institution, i) => (
                <div key={i} className="card-slot">
                  {institution ? (
                    <CardComponent card={getCardData(institution.id)} />
                  ) : (
                    <div className="card-slot-placeholder" />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="player-area-section-column">
            <div className="player-area-section-title">Demands</div>
            <div className="player-area-card-row">
              {player.demands.map((demand, i) => (
                <div key={i} className="card-slot">
                  {demand ? (
                    <CardComponent card={getCardData(demand.id)} />
                  ) : (
                    <div className="card-slot-placeholder" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="game-board">
      {/* Turn Start Modal - shown during Production phase */}
      {G.turnPhase === TurnPhase.Production && (
        <TurnStartModal
          turnNumber={G.turnNumber}
          currentClass={currentClass}
          onStart={() => moves.collectProduction()}
        />
      )}

      {/* Card Inspector Menu Bar - shown during normal play when a card is selected */}
      {boardState.mode === 'normal' && (activeOptions.length > 0 || activeCard) && (
        <ActionMenuBar
          card={activeCard}
          options={activeOptions}
          playerClass={myClass}
          onClose={selectedSlot ? handleCloseInspector : undefined}
        />
      )}

      {/* Strike Target Selector */}
      {boardState.mode === 'selectStrikeTarget' && (
        <ConflictTargetMenuBar
          conflictType={ConflictType.Strike}
          figureName={getCardData(boardState.figure.id).name}
          playerClass={myClass}
          workplaces={G.workplaces}
          onSelectTarget={handleSelectStrikeTarget}
          onCancel={handleCloseInspector}
        />
      )}

      {/* Office Target Selector */}
      {boardState.mode === 'selectOfficeTarget' && (
        <ConflictTargetMenuBar
          conflictType={ConflictType.Election}
          figureName={getCardData(boardState.figure.id).name}
          playerClass={myClass}
          politicalOffices={G.politicalOffices}
          onSelectTarget={handleSelectOfficeTarget}
          onCancel={handleCloseInspector}
        />
      )}

      {/* Top Bar */}
      {/* Change 6: Add centered turn/player info to top bar */}
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
      {/* Change 7: Status text center + player info right */}
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
              🔄 End Turn
            </button>
          )}
          {isMyTurn && G.turnPhase === TurnPhase.Reproduction && (
            <button
              className="game-finish-theorizing-button"
              onClick={handleFinishTheorizing}
            >
              Finish Theorizing
              {theorizeSelectedIds.length > 0 && ` (${theorizeSelectedIds.length})`}
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

      {/* Main Game Area */}
      {/* Change 8: [sidebar][my-player-area][shared-area] layout */}
      <div className="game-main-area">
        {/* Sidebar */}
        {renderSidebar()}

        {/* My Player Area */}
        <div className="my-player-area-container">
          {renderMyPlayerArea()}
        </div>

        {/* Shared Board Area */}
        <div className="shared-area-container">
          <div className="shared-area">
            <div className="shared-area-section-title">Class War International</div>

            <div className="shared-area-sections">
              {/* Workplaces Section */}
              <div className="shared-area-section">
                <div className="shared-area-section-title">Workplaces</div>
                <div className="workplaces-section">
                  {G.workplaces.map((workplace, index) => (
                    <div key={index} className="card-slot">
                      {workplace.id.startsWith('empty') ? (
                        <div className="card-slot-placeholder">
                          <div className="workplace-empty-text">FOR SALE</div>
                        </div>
                      ) : (
                        <div className="card-component card-color-default">
                          <div className="card-top-left-block">
                            <div className="card-name">{workplace.id.replace(/_/g, ' ')}</div>
                            <div className="card-cost-icon">{workplace.established_power} ⚫️</div>
                          </div>
                          <div className="card-bottom-block">
                            <div className="card-workplace-revenue-container">
                              <div className="workplace-wages">
                                <div>Wages: ${workplace.wages}</div>
                              </div>
                              <div className="workplace-profits">
                                <div>Profits: ${workplace.profits}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Political Offices Section */}
              <div className="shared-area-section">
                <div className="shared-area-section-title">Political Offices</div>
                <div className="offices-section">
                  {G.politicalOffices.map((office, index) => (
                    <div key={index} className="office-container">
                      <div className="office-header">
                        <div className="office-name">{office.id}</div>
                        <div className="office-power">{office.exhausted ? '(Exhausted)' : '(Ready)'}</div>
                      </div>
                      <div className="card-slot">
                        <div className="card-component card-color-default">
                          <div className="card-top-left-block">
                            <div className="card-name">
                              {office.id === 'populist' && 'The Populist'}
                              {office.id === 'centrist' && 'The Centrist'}
                              {office.id === 'opportunist' && 'The Opportunist'}
                            </div>
                          </div>
                          <div className="card-top-right-float power-color-established">
                            <span>
                              {office.id === 'populist' && '1 ⚫️'}
                              {office.id === 'centrist' && '3 ⚫️'}
                              {office.id === 'opportunist' && '2 ⚫️'}
                            </span>
                          </div>
                          <div className="card-bottom-block">
                            <div className="card-rules rules-color-state-figure">
                              {office.id === 'populist' && 'Sides with the class that has more figures in play for a legislative contest'}
                              {office.id === 'centrist' && 'Opposes all legislation from either class'}
                              {office.id === 'opportunist' && 'Opposes all legislation, unless paid $15 to support it'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
