/**
 * Turn Start Modal and Waiting Interstitial
 *
 * TurnStartModal: shown as a full-screen overlay at the start of the game (turn 0, Working Class)
 * and at the start of each subsequent turn after the previous player theorizes.
 * Clicking the button calls collectProduction() to advance from Production to Action.
 *
 * WaitingInterstitial: shown to the non-current player in multiplayer while the other
 * player is taking their turn. Cycles through class-specific flavor messages.
 */

import React, { useEffect, useState } from 'react';
import { SocialClass } from '../types/cards';

const WAITING_MESSAGES: Record<SocialClass, string[]> = {
  [SocialClass.WorkingClass]: [
    "The Capitalists are scheming...",
    "Capitalism spreads its tentacles...",
    "Imperialism intensifies...",
    "The bourgeoisie confers...",
    "Management holds a meeting...",
  ],
  [SocialClass.CapitalistClass]: [
    "The Working Class is organizing...",
    "The Working Class is radicalizing...",
    "Communism is spreading...",
    "The workers are agitating...",
    "Class consciousness rises...",
  ],
};

interface WaitingInterstitialProps {
  /** The class of the player who is WAITING (not the active player) */
  waitingClass: SocialClass;
  onClose: () => void;
}

export const WaitingInterstitial: React.FC<WaitingInterstitialProps> = ({ waitingClass, onClose }) => {
  const messages = WAITING_MESSAGES[waitingClass];
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex(i => (i + 1) % messages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [messages.length]);

  const isWC = waitingClass === SocialClass.WorkingClass;

  return (
    <div className="start-game-overlay">
      <div className="start-game-content">
        <div className={`start-game-title ${isWC ? 'start-game-title-wc' : 'start-game-title-cc'}`}>
          {isWC ? 'Working Class' : 'Capitalist Class'}
        </div>
        <div className="start-game-subtitle waiting-message">
          {messages[msgIndex]}
        </div>
        <button className="start-game-button" onClick={onClose}>
          ✕ Dismiss
        </button>
      </div>
    </div>
  );
};

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
