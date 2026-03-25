/**
 * Main Board component for Class War: International
 */

import React, { useState } from 'react';
import { BoardProps } from 'boardgame.io/react';
import { GameState, TurnPhase } from './types/game';
import { CardType, FigureCardInPlay, SocialClass } from './types/cards';
import { ConflictType } from './types/conflicts';
import { getCardData } from './data/cards';
import { TurnStartModal } from './components/StartGameScreen';
import { CardComponent } from './components/CardComponent';
import { CardInspectorMenuBar, MenuOption } from './components/CardInspectorMenuBar';
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
    // Hand cards: Train option
    myPlayer.hand.forEach((cardId, idx) => {
      const card = getCardData(cardId);
      const slotId = `hand-${myClassKey}-${idx}`;
      const options: MenuOption[] = [];
      if (card.card_type === CardType.Figure) {
        const canAfford = myPlayer.wealth >= card.cost;
        options.push([
          `Train ($${card.cost})`,
          canAfford ? () => { moves.playFigure(cardId); handleCloseInspector(); } : undefined,
        ]);
      }
      slotData.set(slotId, { cardId, options });
    });

    // Figures in play: conflict actions
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

  // Player area ordering: current player first
  const wcFirst = ctx.currentPlayer === '0';

  const renderPlayerArea = (
    socialClass: SocialClass,
    orderClass: 'player-area-container-first' | 'player-area-container-second',
  ) => {
    const player = G.players[socialClass];
    const isWC = socialClass === SocialClass.WorkingClass;
    const classKey = isWC ? 'wc' : 'cc';
    const playerId = isWC ? '0' : '1';
    const isMe = playerID === playerId || (!playerID && socialClass === myClass);

    return (
      <div key={socialClass} className={`player-area-container ${orderClass}`}>
        <div
          className={`player-area player-area-${isWC ? 'working-class' : 'capitalist-class'} ${ctx.currentPlayer === playerId ? 'current-player' : ''}`}
        >
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
                const isTheorizeSelected = isMe && G.turnPhase === TurnPhase.Reproduction && theorizeSelectedIds.includes(cardId);
                return isMe ? (
                  <CardComponent
                    key={idx}
                    card={card}
                    onClick={() => handleSelectSlot(slotId)}
                    className={isTheorizeSelected ? 'card-theorize-selected' : undefined}
                  />
                ) : (
                  <CardComponent key={idx} card={card} showAsCardBack />
                );
              })}
            </div>
          </div>

          {/* Figures in Play */}
          <div className="player-area-section">
            <div className="player-area-section-title">
              Figures in Play ({player.figures.length})
            </div>
            <div className="player-area-card-row">
              {player.figures.map((figure, idx) => {
                const card = getCardData(figure.id);
                const slotId = `figures-${classKey}-${idx}`;
                return (
                  <CardComponent
                    key={idx}
                    card={card}
                    onClick={isMe && G.turnPhase === TurnPhase.Action ? () => handleSelectSlot(slotId) : undefined}
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
                {[0, 1].map((i) => (
                  <div key={i} className="card-slot">
                    <div className="card-slot-placeholder" />
                  </div>
                ))}
              </div>
            </div>
            <div className="player-area-section-column">
              <div className="player-area-section-title">Demands</div>
              <div className="player-area-card-row">
                {[0, 1].map((i) => (
                  <div key={i} className="card-slot">
                    <div className="card-slot-placeholder" />
                  </div>
                ))}
              </div>
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
        <CardInspectorMenuBar
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
      <div className="game-top-controls">
        <div className="game-top-controls-left">
          <span className="game-title">Class War International</span>
        </div>
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
          <span className="game-phase-info">{currentClass}</span>
          <span className="game-player-info">Turn {G.turnNumber + 1}</span>
          <span className="game-player-wealth">${G.players[currentClass].wealth}</span>
        </div>
        <div className="game-player-controls-right" />
      </div>

      {/* Main Game Area */}
      <div className="game-main-area">
        {/* Player Areas Container */}
        <div className="player-areas-container">
          {renderPlayerArea(
            wcFirst ? SocialClass.WorkingClass : SocialClass.CapitalistClass,
            'player-area-container-first',
          )}
          {renderPlayerArea(
            wcFirst ? SocialClass.CapitalistClass : SocialClass.WorkingClass,
            'player-area-container-second',
          )}
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
