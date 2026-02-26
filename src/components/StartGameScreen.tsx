import React from 'react';

interface StartGameScreenProps {
  onStart: () => void;
}

export const StartGameScreen: React.FC<StartGameScreenProps> = ({ onStart }) => {
  return (
    <div className="start-game-overlay">
      <div className="start-game-content">
        <div className="start-game-title">
          CLASS WAR
        </div>
        <div className="start-game-subtitle">
          International
        </div>
        <button
          onClick={onStart}
          className="start-game-button"
        >
          Start
        </button>
      </div>
    </div>
  );
};
