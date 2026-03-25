/**
 * Card Inspector Menu Bar
 *
 * A fixed panel that appears below the two header bars when a card is selected or
 * when player actions are available. Accepts pre-computed options from the parent.
 * Does not trigger any game state moves directly — callers pass action handlers.
 */

import React from 'react';
import { CardData, SocialClass } from '../types/cards';
import { CardComponent } from './CardComponent';

export type MenuOption = [label: string, handler: (() => void) | undefined];

export interface CardInspectorMenuBarProps {
  /** Card to display in the inspector (optional) */
  card?: CardData;
  /** Pre-computed list of [label, handler] tuples; undefined handler = disabled */
  options: MenuOption[];
  playerClass: SocialClass;
  /** If provided, a floating close button is shown on the left */
  onClose?: () => void;
}

export const CardInspectorMenuBar: React.FC<CardInspectorMenuBarProps> = ({
  card,
  options,
  playerClass,
  onClose,
}) => {
  const classModifier = playerClass === SocialClass.WorkingClass ? 'working' : 'capitalist';

  return (
    <div className={`menu-bar menu-bar-${classModifier}`} role="region" aria-label="Card inspector">
      {onClose && (
        <button className="menu-bar-close-float" onClick={onClose} aria-label="Close card inspector">
          ✕
        </button>
      )}
      {card && (
        <div className="menu-bar-card-display">
          <CardComponent card={card} />
        </div>
      )}
      {options.length > 0 && (
        <div className="menu-bar-actions">
          {options.map(([label, handler], i) => (
            <button
              key={i}
              className="menu-bar-action-button"
              disabled={handler === undefined}
              onClick={handler}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
