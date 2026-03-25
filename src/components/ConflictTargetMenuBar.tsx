/**
 * Conflict Target Menu Bar
 *
 * Shown after a player clicks "Lead Strike" or "Run for Office" on a figure in play.
 * Lets the player choose the target workplace (for strikes) or political office (for elections).
 * Does not trigger any game state moves — callers pass the selection handler.
 */

import React from 'react';
import { SocialClass, StateFigureInPlay, WorkplaceInPlay } from '../types/cards';
import { ConflictType } from '../types/conflicts';

export interface ConflictTargetMenuBarProps {
  conflictType: ConflictType.Strike | ConflictType.Election;
  figureName: string;
  playerClass: SocialClass;
  /** Populated when conflictType === ConflictType.Strike */
  workplaces?: WorkplaceInPlay[];
  /** Populated when conflictType === ConflictType.Election */
  politicalOffices?: StateFigureInPlay[];
  onSelectTarget: (index: number) => void;
  onCancel: () => void;
}

const OFFICE_NAMES: Record<string, string> = {
  populist: 'The Populist',
  centrist: 'The Centrist',
  opportunist: 'The Opportunist',
};

export const ConflictTargetMenuBar: React.FC<ConflictTargetMenuBarProps> = ({
  conflictType,
  figureName,
  playerClass,
  workplaces,
  politicalOffices,
  onSelectTarget,
  onCancel,
}) => {
  const classModifier = playerClass === SocialClass.WorkingClass ? 'working' : 'capitalist';
  const isStrike = conflictType === ConflictType.Strike;
  const title = isStrike
    ? `Choose a workplace for ${figureName} to strike`
    : `Choose an office for ${figureName} to run for`;

  return (
    <div
      className={`menu-bar menu-bar-${classModifier}`}
      role="region"
      aria-label="Conflict target selector"
    >
      <div className="menu-bar-header">
        <span className="menu-bar-title">{title}</span>
        <button className="menu-bar-close" onClick={onCancel} aria-label="Cancel conflict">
          ✕
        </button>
      </div>

      <div className="menu-bar-actions">
        {isStrike &&
          workplaces?.map((workplace, index) => {
            const isEmpty = workplace.id.startsWith('empty');
            return (
              <button
                key={index}
                className="menu-bar-action-button"
                disabled={isEmpty}
                onClick={() => onSelectTarget(index)}
              >
                {isEmpty
                  ? 'Empty Slot'
                  : `${workplace.id.replace(/_/g, ' ')} (wages $${workplace.wages} / profits $${workplace.profits})`}
              </button>
            );
          })}

        {!isStrike &&
          politicalOffices?.map((office, index) => (
            <button
              key={index}
              className="menu-bar-action-button"
              onClick={() => onSelectTarget(index)}
            >
              {OFFICE_NAMES[office.id] ?? office.id}
            </button>
          ))}
      </div>
    </div>
  );
};
