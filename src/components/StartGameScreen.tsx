/**
 * Turn Start Modal
 *
 * Shown as a full-screen overlay at the start of the game (turn 0, Working Class)
 * and at the start of each subsequent turn after the previous player theorizes.
 * Clicking the button calls collectProduction() to advance from Production to Action.
 */

import React from 'react';
import { SocialClass } from '../types/cards';

interface TurnStartModalProps {
  turnNumber: number;
  currentClass: SocialClass;
  onStart: () => void;
}

export const TurnStartModal: React.FC<TurnStartModalProps> = ({ turnNumber, currentClass, onStart }) => {
  const isGameStart = turnNumber === 0 && currentClass === SocialClass.WorkingClass;
  const isWC = currentClass === SocialClass.WorkingClass;
  const className = isWC ? 'Working Class' : 'Capitalist Class';

  return (
    <div className="start-game-overlay">
      <div className="start-game-content">
        {isGameStart ? (
          <>
            <div className="start-game-title">CLASS WAR</div>
            <div className="start-game-subtitle">International</div>
          </>
        ) : (
          <>
            <div className={`start-game-title ${isWC ? 'start-game-title-wc' : 'start-game-title-cc'}`}>
              {className}
            </div>
            <div className="start-game-subtitle">Turn {turnNumber + 1}</div>
          </>
        )}
        <button className="start-game-button" onClick={onStart}>
          {isGameStart ? 'Start Game' : `Start ${className} Turn`}
        </button>
      </div>
    </div>
  );
};
