/**
 * Action Menu Bar
 *
 * A fixed panel that appears below the two header bars when a card is selected or
 * when player actions are available. Accepts pre-computed options from the parent.
 * Does not trigger any game state moves directly — callers pass action handlers.
 */

import React from 'react';
import { CardData, SocialClass } from '../types/cards';
import { CardComponent } from './CardComponent';

/**
 * [label, handler, preview?]
 * - label: button text
 * - handler: click handler; undefined = disabled button
 * - preview: optional React node rendered above the button (e.g. a card or target display)
 */
export type MenuOption = readonly [label: string, handler: (() => void) | undefined, preview?: React.ReactNode];

export interface ActionMenuBarProps {
  /** Optional title shown above the actions */
  title?: string;
  /** Card to display in the inspector (optional) */
  card?: CardData;
  /** Pre-computed list of [label, handler, preview?] tuples */
  options: MenuOption[];
  playerClass: SocialClass;
  /** If provided, a floating close button is shown on the left */
  onClose?: () => void;
  /** If provided, a ‹ prev button is shown for hand navigation */
  onPrev?: () => void;
  /** If provided, a › next button is shown for hand navigation */
  onNext?: () => void;
}

export const ActionMenuBar: React.FC<ActionMenuBarProps> = ({
  title,
  card,
  options,
  playerClass,
  onClose,
  onPrev,
  onNext,
}) => {
  const classModifier = playerClass === SocialClass.WorkingClass ? 'working' : 'capitalist';

  const hasNav = onPrev !== undefined || onNext !== undefined;

  return (
    <div className={`menu-bar menu-bar-${classModifier}`} role="region" aria-label="Action menu">
      {onClose && (
        <button className="menu-bar-close-float" onClick={onClose} aria-label="Close action menu">
          ✕
        </button>
      )}
      {/* Nav buttons without a card: render in a standalone row */}
      {hasNav && !card && (
        <div className="menu-bar-nav">
          <button
            className="menu-bar-nav-button"
            onClick={onPrev}
            disabled={onPrev === undefined}
            aria-label="Previous card"
          >
            ‹
          </button>
          <button
            className="menu-bar-nav-button"
            onClick={onNext}
            disabled={onNext === undefined}
            aria-label="Next card"
          >
            ›
          </button>
        </div>
      )}
      {title && <div className="menu-bar-title">{title}</div>}
      {/* Card display: nav buttons flank the card when navigation is available */}
      {card && (
        <div className="menu-bar-card-area" data-testid="menu-bar-card-area">
          {hasNav && (
            <button
              className="menu-bar-nav-button"
              onClick={onPrev}
              disabled={onPrev === undefined}
              aria-label="Previous card"
            >
              ‹
            </button>
          )}
          <div className="menu-bar-card-display">
            <CardComponent card={card} />
          </div>
          {hasNav && (
            <button
              className="menu-bar-nav-button"
              onClick={onNext}
              disabled={onNext === undefined}
              aria-label="Next card"
            >
              ›
            </button>
          )}
        </div>
      )}
      {options.length > 0 && (
        <div className="menu-bar-actions">
          {options.map(([label, handler, preview], i) => (
            <div key={i} className="menu-bar-option-group">
              {preview && <div className="menu-bar-option-preview">{preview}</div>}
              <button
                className="menu-bar-action-button"
                disabled={handler === undefined}
                onClick={handler}
              >
                {label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
