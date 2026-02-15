/**
 * Main Board component for Class War: International
 */

import React from 'react';
import { BoardProps } from 'boardgame.io/react';
import { GameState, TurnPhase } from './types/game';
import { SocialClass } from './types/cards';
import { getCardData } from './data/cards';

interface ClassWarBoardProps extends BoardProps<GameState> {}

export const ClassWarBoard: React.FC<ClassWarBoardProps> = ({ G, ctx, moves, playerID }) => {
  // Determine current class
  const isWorkingClass = ctx.currentPlayer === '0';
  const currentClass = isWorkingClass ? SocialClass.WorkingClass : SocialClass.CapitalistClass;
  const isMyTurn = playerID === ctx.currentPlayer;

  // Get player states
  const workingClassPlayer = G.players[SocialClass.WorkingClass];
  const capitalistPlayer = G.players[SocialClass.CapitalistClass];
  const myPlayer = playerID === '0' ? workingClassPlayer : capitalistPlayer;

  // Get current phase description
  const getPhaseDescription = () => {
    switch (G.turnPhase) {
      case TurnPhase.Production:
        return 'Production - Collect income from workplaces';
      case TurnPhase.Action:
        return 'Action - Play cards and initiate conflicts';
      case TurnPhase.Reproduction:
        return 'Reproduction - Theorize and end turn';
      default:
        return '';
    }
  };

  return (
    <div className="game-board">
      {/* Top Bar */}
      <div className="game-top-controls">
        <div className="game-top-controls-left">
          <span className="game-title">Class War: International</span>
        </div>
        <div className="game-top-controls-right">
          <div className="turn-info">
            Turn {G.turnNumber + 1} | {currentClass}
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="game-main-area">
        {/* Phase Info */}
        <div className="phase-info">
          <h3>{G.turnPhase} Phase</h3>
          <p>{getPhaseDescription()}</p>
          {!isMyTurn && <p className="waiting-text">Waiting for opponent...</p>}
        </div>

        {/* Shared Board Area */}
        <div className="shared-area">
          <h3>Shared Board</h3>

          {/* Workplaces */}
          <div className="workplaces-section">
            <h4>Workplaces</h4>
            <div className="workplaces-grid">
              {G.workplaces.map((workplace, index) => (
                <div key={index} className="workplace-card">
                  <div className="workplace-name">
                    {workplace.id.startsWith('empty') ? 'Empty Slot' : workplace.id}
                  </div>
                  {!workplace.id.startsWith('empty') && (
                    <>
                      <div>Wages: ${workplace.wages}</div>
                      <div>Profits: ${workplace.profits}</div>
                      <div>Power: {workplace.established_power}</div>
                      {workplace.unionized && <div className="unionized">★ UNIONIZED</div>}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Political Offices */}
          <div className="offices-section">
            <h4>Political Offices</h4>
            <div className="offices-grid">
              {G.politicalOffices.map((office, index) => (
                <div key={index} className="office-card">
                  <div className="office-name">{office.id}</div>
                  <div>{office.exhausted ? '(Exhausted)' : '(Ready)'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Laws */}
          {G.laws.length > 0 && (
            <div className="laws-section">
              <h4>Laws in Effect ({G.laws.length})</h4>
              <div className="laws-list">
                {G.laws.map((lawId) => (
                  <div key={lawId} className="law-card">
                    {getCardData(lawId).name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* My Player Area */}
        <div className="player-area my-player">
          <h3>
            {playerID === '0' ? 'Working Class' : 'Capitalist Class'} (You)
          </h3>

          <div className="player-stats">
            <div>Wealth: ${myPlayer.wealth}</div>
            <div>Hand: {myPlayer.hand.length}/{myPlayer.maxHandSize}</div>
            <div>Deck: {myPlayer.deck.length}</div>
          </div>

          {/* Hand */}
          <div className="hand-section">
            <h4>Hand</h4>
            <div className="cards-grid">
              {myPlayer.hand.map((cardId) => {
                const card = getCardData(cardId);
                return (
                  <div key={cardId} className="card-component">
                    <div className="card-header">{card.name}</div>
                    <div className="card-type">{card.card_type}</div>
                    <div className="card-cost">${card.cost}</div>
                    {isMyTurn && G.turnPhase === TurnPhase.Action && (
                      <button
                        onClick={() => moves.playFigure(cardId)}
                        disabled={myPlayer.wealth < card.cost || card.card_type !== 'Figure'}
                      >
                        Play
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Figures in Play */}
          {myPlayer.figures.length > 0 && (
            <div className="figures-section">
              <h4>Figures in Play ({myPlayer.figures.length})</h4>
              <div className="figures-grid">
                {myPlayer.figures.map((figure) => {
                  const card = getCardData(figure.id);
                  return (
                    <div key={figure.id} className="figure-card">
                      <div>{card.name}</div>
                      {figure.in_training && <div className="training">In Training</div>}
                      {figure.exhausted && <div className="exhausted">Exhausted</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Phase Actions */}
          {isMyTurn && (
            <div className="phase-actions">
              {G.turnPhase === TurnPhase.Production && (
                <button onClick={() => moves.collectProduction()}>Collect Production</button>
              )}
              {G.turnPhase === TurnPhase.Action && (
                <button onClick={() => moves.endActionPhase()}>End Action Phase</button>
              )}
              {G.turnPhase === TurnPhase.Reproduction && (
                <button onClick={() => moves.endReproductionPhase()}>End Turn</button>
              )}
            </div>
          )}
        </div>

        {/* Opponent Player Area (Summary) */}
        <div className="player-area opponent-player">
          <h3>
            {playerID === '0' ? 'Capitalist Class' : 'Working Class'} (Opponent)
          </h3>

          <div className="player-stats">
            <div>
              Wealth: $
              {playerID === '0'
                ? capitalistPlayer.wealth
                : workingClassPlayer.wealth}
            </div>
            <div>
              Hand:{' '}
              {playerID === '0'
                ? capitalistPlayer.hand.length
                : workingClassPlayer.hand.length}
            </div>
            <div>
              Figures:{' '}
              {playerID === '0'
                ? capitalistPlayer.figures.length
                : workingClassPlayer.figures.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
