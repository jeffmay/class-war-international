/**
 * Main Board component for Class War: International
 */

import React, { useState } from 'react';
import { BoardProps } from 'boardgame.io/react';
import { GameState, TurnPhase } from './types/game';
import { FigureCardInPlay, SocialClass } from './types/cards';
import { ConflictType } from './types/conflicts';
import { getCardData } from './data/cards';
import { StartGameScreen } from './components/StartGameScreen';
import { CardComponent } from './components/CardComponent';
import { CardInspectorMenuBar } from './components/CardInspectorMenuBar';
import { ConflictTargetMenuBar } from './components/ConflictTargetMenuBar';

interface ClassWarBoardProps extends BoardProps<GameState> {}

type InspectorState =
  | null
  | { mode: 'card'; cardId: string; location: 'hand' | 'figures'; figureInPlay?: FigureCardInPlay }
  | { mode: 'selectStrikeTarget'; figure: FigureCardInPlay }
  | { mode: 'selectOfficeTarget'; figure: FigureCardInPlay };

export const ClassWarBoard: React.FC<ClassWarBoardProps> = ({ G, ctx, moves, playerID }) => {
  const [gameStarted, setGameStarted] = useState(G.gameStarted);
  const [inspectorState, setInspectorState] = useState<InspectorState>(null);

  // Determine current class
  const isWorkingClass = ctx.currentPlayer === '0';
  const currentClass = isWorkingClass ? SocialClass.WorkingClass : SocialClass.CapitalistClass;
  const isMyTurn = playerID === ctx.currentPlayer;

  // myClass: the class this client is playing as (falls back to currentClass in local/debug mode)
  const myClass =
    playerID === '0'
      ? SocialClass.WorkingClass
      : playerID === '1'
        ? SocialClass.CapitalistClass
        : currentClass;

  // Get player states
  const workingClassPlayer = G.players[SocialClass.WorkingClass];
  const capitalistPlayer = G.players[SocialClass.CapitalistClass];

  const handleStartGame = () => {
    setGameStarted(true);
  };

  // --- Card / figure click handlers ---

  const handleCardClick = (cardId: string, location: 'hand' | 'figures', figureInPlay?: FigureCardInPlay) => {
    const current = inspectorState;
    if (
      current?.mode === 'card' &&
      current.cardId === cardId &&
      current.location === location
    ) {
      setInspectorState(null); // Toggle off
    } else {
      setInspectorState({ mode: 'card', cardId, location, figureInPlay });
    }
  };

  const handleCloseInspector = () => setInspectorState(null);

  // Train (play figure from hand)
  const handleTrainFigure = (cardId: string) => {
    moves.playFigure(cardId);
    setInspectorState(null);
  };

  // Lead Strike: transition to target selection
  const handleLeadStrike = (figure: FigureCardInPlay) => {
    setInspectorState({ mode: 'selectStrikeTarget', figure });
  };

  // Run for Office: transition to target selection
  const handleRunForOffice = (figure: FigureCardInPlay) => {
    setInspectorState({ mode: 'selectOfficeTarget', figure });
  };

  // Confirm strike target
  const handleSelectStrikeTarget = (workplaceIndex: number) => {
    if (inspectorState?.mode !== 'selectStrikeTarget') return;
    moves.planStrike(inspectorState.figure.id, workplaceIndex);
    setInspectorState(null);
  };

  // Confirm election target
  const handleSelectOfficeTarget = (officeIndex: number) => {
    if (inspectorState?.mode !== 'selectOfficeTarget') return;
    moves.planElection(inspectorState.figure.id, officeIndex);
    setInspectorState(null);
  };

  // Show start screen if game hasn't started
  if (!gameStarted) {
    return <StartGameScreen onStart={handleStartGame} />;
  }

  const selectedCard =
    inspectorState?.mode === 'card' ? getCardData(inspectorState.cardId) : null;

  return (
    <div className="game-board">
      {/* Card Inspector Menu Bar */}
      {inspectorState?.mode === 'card' && selectedCard && (
        <CardInspectorMenuBar
          card={selectedCard}
          playerClass={myClass}
          turnPhase={G.turnPhase}
          playerWealth={G.players[myClass].wealth}
          isMyTurn={isMyTurn}
          cardLocation={inspectorState.location}
          figureInPlay={inspectorState.figureInPlay}
          onClose={handleCloseInspector}
          onTrainFigure={handleTrainFigure}
          onLeadStrike={
            inspectorState.figureInPlay
              ? () => handleLeadStrike(inspectorState.figureInPlay!)
              : undefined
          }
          onRunForOffice={
            inspectorState.figureInPlay
              ? () => handleRunForOffice(inspectorState.figureInPlay!)
              : undefined
          }
        />
      )}

      {/* Strike Target Selector */}
      {inspectorState?.mode === 'selectStrikeTarget' && (
        <ConflictTargetMenuBar
          conflictType={ConflictType.Strike}
          figureName={getCardData(inspectorState.figure.id).name}
          playerClass={myClass}
          workplaces={G.workplaces}
          onSelectTarget={handleSelectStrikeTarget}
          onCancel={handleCloseInspector}
        />
      )}

      {/* Office Target Selector */}
      {inspectorState?.mode === 'selectOfficeTarget' && (
        <ConflictTargetMenuBar
          conflictType={ConflictType.Election}
          figureName={getCardData(inspectorState.figure.id).name}
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
          <span className="game-phase-info">{currentClass}</span>
        </div>
      </div>

      {/* Current Player Controls Bar */}
      <div className="game-player-controls">
        <div className="game-player-controls-left">
          <span className="game-player-wealth">${G.players[currentClass].wealth}</span>
        </div>
        <div className="game-player-controls-right">
          <span className="game-player-info">Turn {G.turnNumber + 1}</span>
          <button className="game-undo-button" disabled>
            Undo
          </button>
          <button
            className="game-end-turn-button"
            onClick={() => {
              if (G.turnPhase === TurnPhase.Production) moves.collectProduction();
              else if (G.turnPhase === TurnPhase.Action) moves.endActionPhase();
              else if (G.turnPhase === TurnPhase.Reproduction) moves.endReproductionPhase();
            }}
            disabled={!isMyTurn}
          >
            End Turn
          </button>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="game-main-area">
        {/* Player Areas Container */}
        <div className="player-areas-container">
          {/* Working Class Player Area */}
          <div className="player-area-container">
            <div className={`player-area player-area-working-class ${ctx.currentPlayer === '0' ? 'current-player' : ''}`}>
              <div className={`player-area-title ${ctx.currentPlayer === '0' ? 'current-player' : ''}`}>
                Working Class
              </div>

              {/* Hand Section */}
              <div className="player-area-section">
                <div className="player-area-section-title">
                  Hand ({workingClassPlayer.hand.length}/{workingClassPlayer.maxHandSize})
                </div>
                <div className="player-area-card-row">
                  {workingClassPlayer.hand.map((cardId, idx) => {
                    const card = getCardData(cardId);
                    return playerID === '0' ? (
                      <CardComponent
                        key={idx}
                        card={card}
                        onClick={() => handleCardClick(cardId, 'hand')}
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
                  Figures in Play ({workingClassPlayer.figures.length})
                </div>
                <div className="player-area-card-row">
                  {workingClassPlayer.figures.map((figure, idx) => {
                    const card = getCardData(figure.id);
                    return (
                      <CardComponent
                        key={idx}
                        card={card}
                        onClick={
                          playerID === '0'
                            ? () => handleCardClick(figure.id, 'figures', figure)
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              </div>

              {/* Institutions and Demands */}
              <div className="player-area-section-dual">
                <div className="player-area-section-column">
                  <div className="player-area-section-title">Institutions (2 max)</div>
                </div>
                <div className="player-area-section-column">
                  <div className="player-area-section-title">Demands (2 max)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Capitalist Class Player Area */}
          <div className="player-area-container">
            <div className={`player-area player-area-capitalist-class ${ctx.currentPlayer === '1' ? 'current-player' : ''}`}>
              <div className={`player-area-title ${ctx.currentPlayer === '1' ? 'current-player' : ''}`}>
                Capitalist Class
              </div>

              {/* Hand Section */}
              <div className="player-area-section">
                <div className="player-area-section-title">
                  Hand ({capitalistPlayer.hand.length}/{capitalistPlayer.maxHandSize})
                </div>
                <div className="player-area-card-row">
                  {capitalistPlayer.hand.map((cardId, idx) => {
                    const card = getCardData(cardId);
                    return playerID === '1' ? (
                      <CardComponent
                        key={idx}
                        card={card}
                        onClick={() => handleCardClick(cardId, 'hand')}
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
                  Figures in Play ({capitalistPlayer.figures.length})
                </div>
                <div className="player-area-card-row">
                  {capitalistPlayer.figures.map((figure, idx) => {
                    const card = getCardData(figure.id);
                    return (
                      <CardComponent
                        key={idx}
                        card={card}
                        onClick={
                          playerID === '1'
                            ? () => handleCardClick(figure.id, 'figures', figure)
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              </div>

              {/* Institutions and Demands */}
              <div className="player-area-section-dual">
                <div className="player-area-section-column">
                  <div className="player-area-section-title">Institutions (2 max)</div>
                </div>
                <div className="player-area-section-column">
                  <div className="player-area-section-title">Demands (2 max)</div>
                </div>
              </div>
            </div>
          </div>
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
