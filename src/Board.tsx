/**
 * Main Board component for Class War: International
 */

import React, { useState } from 'react';
import { BoardProps } from 'boardgame.io/react';
import { GameState, TurnPhase } from './types/game';
import { SocialClass } from './types/cards';
import { getCardData } from './data/cards';
import { StartGameScreen } from './components/StartGameScreen';
import { CardComponent } from './components/CardComponent';
import { CardInspectorMenuBar } from './components/CardInspectorMenuBar';

interface ClassWarBoardProps extends BoardProps<GameState> {}

export const ClassWarBoard: React.FC<ClassWarBoardProps> = ({ G, ctx, moves, playerID }) => {
  const [gameStarted, setGameStarted] = useState(G.gameStarted);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedCardLocation, setSelectedCardLocation] = useState<'hand' | 'figures'>('hand');

  // Determine current class
  const isWorkingClass = ctx.currentPlayer === '0';
  const currentClass = isWorkingClass ? SocialClass.WorkingClass : SocialClass.CapitalistClass;
  const isMyTurn = playerID === ctx.currentPlayer;

  const handleCardClick = (cardId: string, location: 'hand' | 'figures') => {
    if (selectedCardId === cardId && selectedCardLocation === location) {
      setSelectedCardId(null);
    } else {
      setSelectedCardId(cardId);
      setSelectedCardLocation(location);
    }
  };

  const handleCloseInspector = () => {
    setSelectedCardId(null);
  };

  const handlePlayFigure = (cardId: string) => {
    moves.playFigure(cardId);
    setSelectedCardId(null);
  };

  // Get player states
  const workingClassPlayer = G.players[SocialClass.WorkingClass];
  const capitalistPlayer = G.players[SocialClass.CapitalistClass];

  const handleStartGame = () => {
    setGameStarted(true);
  };

  // Show start screen if game hasn't started
  if (!gameStarted) {
    return <StartGameScreen onStart={handleStartGame} />;
  }

  const selectedCard = selectedCardId ? getCardData(selectedCardId) : null;
  const myClass = playerID === '0'
    ? SocialClass.WorkingClass
    : playerID === '1'
      ? SocialClass.CapitalistClass
      : currentClass;

  return (
    <div className="game-board">
      {/* Card Inspector Menu Bar */}
      {selectedCard && (
        <CardInspectorMenuBar
          card={selectedCard}
          playerClass={myClass}
          turnPhase={G.turnPhase}
          playerWealth={G.players[myClass].wealth}
          isMyTurn={isMyTurn}
          cardLocation={selectedCardLocation}
          onClose={handleCloseInspector}
          onPlayFigure={handlePlayFigure}
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
                  <span className="player-area-section-subtitle">
                    (Drag figure here to start training. Figures cannot participate in conflicts until the end of turn.)
                  </span>
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
                  <span className="player-area-section-subtitle">
                    (Drag figure here to start training. Figures cannot participate in conflicts until the end of turn.)
                  </span>
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
