/**
 * Card Inspector Menu Bar
 *
 * A fixed panel that appears below the two header bars when a card is selected.
 * Shows a zoomed view of the card and available action buttons.
 * Does not trigger any game state moves directly — callers pass action handlers.
 */

import React from 'react';
import { CardData, CardType, FigureCardInPlay, SocialClass } from '../types/cards';
import { TurnPhase } from '../types/game';
import { CardComponent } from './CardComponent';

export interface CardInspectorMenuBarProps {
  card: CardData;
  playerClass: SocialClass;
  turnPhase: TurnPhase;
  playerWealth: number;
  isMyTurn: boolean;
  cardLocation: 'hand' | 'figures';
  /** Provided when cardLocation === 'figures' to reflect exhausted/in_training state */
  figureInPlay?: FigureCardInPlay;
  onClose: () => void;
  /** Called when the player clicks Train on a figure card in hand */
  onTrainFigure?: (cardId: string) => void;
  /** Called when the player wants to lead a strike with this figure */
  onLeadStrike?: () => void;
  /** Called when the player wants to run for office with this figure */
  onRunForOffice?: () => void;
}

export const CardInspectorMenuBar: React.FC<CardInspectorMenuBarProps> = ({
  card,
  playerClass,
  turnPhase,
  playerWealth,
  isMyTurn,
  cardLocation,
  figureInPlay,
  onClose,
  onTrainFigure,
  onLeadStrike,
  onRunForOffice,
}) => {
  const classModifier = playerClass === SocialClass.WorkingClass ? 'working' : 'capitalist';
  const isFigureCard = card.card_type === CardType.Figure;

  // --- Actions for figures in hand ---
  const canTrain =
    isFigureCard && cardLocation === 'hand' && turnPhase === TurnPhase.Action && isMyTurn;
  const canAffordTraining = canTrain && playerWealth >= card.cost;

  // --- Actions for figures in play ---
  const isExhausted = figureInPlay?.exhausted ?? false;
  const isInTraining = figureInPlay?.in_training ?? false;
  const canInitiateConflict =
    isFigureCard &&
    cardLocation === 'figures' &&
    turnPhase === TurnPhase.Action &&
    isMyTurn &&
    !isExhausted &&
    !isInTraining;

  return (
    <div className={`menu-bar menu-bar-${classModifier}`} role="region" aria-label="Card inspector">
      <div className="menu-bar-header">
        <span className="menu-bar-title">{card.name}</span>
        <button className="menu-bar-close" onClick={onClose} aria-label="Close card inspector">
          ✕
        </button>
      </div>
      <div className="menu-bar-card-display">
        <CardComponent card={card} />
      </div>

      {/* Figure in hand: Train action */}
      {canTrain && (
        <div className="menu-bar-actions">
          <button
            className="menu-bar-action-button"
            disabled={!canAffordTraining}
            onClick={() => onTrainFigure?.(card.id)}
          >
            Train (${card.cost})
          </button>
        </div>
      )}

      {/* Figure in play: conflict actions or disabled status */}
      {isFigureCard && cardLocation === 'figures' && (
        <div className="menu-bar-actions">
          {isExhausted && (
            <button className="menu-bar-action-button" disabled>
              Figure is exhausted
            </button>
          )}
          {!isExhausted && isInTraining && (
            <button className="menu-bar-action-button" disabled>
              Figure is in training
            </button>
          )}
          {canInitiateConflict && playerClass === SocialClass.WorkingClass && (
            <button className="menu-bar-action-button" onClick={onLeadStrike}>
              Lead Strike
            </button>
          )}
          {canInitiateConflict && (
            <button className="menu-bar-action-button" onClick={onRunForOffice}>
              Run for Office
            </button>
          )}
        </div>
      )}
    </div>
  );
};
