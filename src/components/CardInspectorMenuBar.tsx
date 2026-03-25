/**
 * Card Inspector Menu Bar
 *
 * A fixed panel that appears below the two header bars when a card is selected.
 * Shows a zoomed view of the card and available action buttons.
 * Does not trigger any game state moves directly — callers pass action handlers.
 */

import React from 'react';
import { CardData, CardType, SocialClass } from '../types/cards';
import { TurnPhase } from '../types/game';
import { CardComponent } from './CardComponent';

export interface CardInspectorMenuBarProps {
  card: CardData;
  playerClass: SocialClass;
  turnPhase: TurnPhase;
  playerWealth: number;
  isMyTurn: boolean;
  cardLocation: 'hand' | 'figures';
  onClose: () => void;
  onPlayFigure?: (cardId: string) => void;
}

export const CardInspectorMenuBar: React.FC<CardInspectorMenuBarProps> = ({
  card,
  playerClass,
  turnPhase,
  playerWealth,
  isMyTurn,
  cardLocation,
  onClose,
  onPlayFigure,
}) => {
  const classModifier = playerClass === SocialClass.WorkingClass ? 'working' : 'capitalist';

  const canPlayFigure =
    card.card_type === CardType.Figure &&
    cardLocation === 'hand' &&
    turnPhase === TurnPhase.Action &&
    isMyTurn;

  const canAffordFigure = canPlayFigure && playerWealth >= card.cost;

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
      {canPlayFigure && (
        <div className="menu-bar-actions">
          <button
            className="menu-bar-action-button"
            disabled={!canAffordFigure}
            onClick={() => onPlayFigure?.(card.id)}
          >
            Play Figure (${card.cost})
          </button>
        </div>
      )}
    </div>
  );
};
