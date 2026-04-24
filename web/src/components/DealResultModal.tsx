/**
 * DealResultModal
 *
 * Shown after the player completes the Theorize step of the Reproduction phase.
 * Displays the cards sent to the Dustbin and the newly drawn cards side-by-side.
 * The modal has its own "End Turn" button and a floating close button (upper-left).
 * Closing the modal does NOT end the turn — the "End Turn" button in the player
 * control bar remains available.
 */

import React from 'react';
import { CardSlotEntity } from '../types/cards';
import { CardComponent } from './CardComponent';

interface DealResultModalProps {
  /** Cards sent to the Dustbin (may be empty if Theorizing was skipped) */
  theorizedCards: CardSlotEntity[];
  /** Newly drawn cards to replace theorized ones */
  newCards: CardSlotEntity[];
  onEndTurn: () => void;
  onClose: () => void;
}

export const DealResultModal: React.FC<DealResultModalProps> = ({
  theorizedCards,
  newCards,
  onEndTurn,
  onClose,
}) => {
  return (
    <div className="deal-result-overlay" role="dialog" aria-label="Deal result">
      <div className="deal-result-modal">
        <button
          className="deal-result-close-button"
          onClick={onClose}
          aria-label="Close deal result"
        >
          ✕
        </button>

        <div className="deal-result-sections">
          <div className="deal-result-section">
            <div className="deal-result-section-title">
              {theorizedCards.length > 0 ? "Sent to Dustbin" : "No Cards Theorized"}
            </div>
            {theorizedCards.length > 0 ? (
              <div className="deal-result-card-row">
                {theorizedCards.map((card, i) => (
                  <CardComponent key={i} card={card} borderVariant="other" />
                ))}
              </div>
            ) : (
              <div className="deal-result-empty">Theorizing skipped</div>
            )}
          </div>

          <div className="deal-result-section">
            <div className="deal-result-section-title">
              {newCards.length > 0 ? "Cards Drawn" : "No Cards Drawn"}
            </div>
            {newCards.length > 0 ? (
              <div className="deal-result-card-row">
                {newCards.map((card, i) => (
                  <CardComponent key={i} card={card} borderVariant="actionable" />
                ))}
              </div>
            ) : (
              <div className="deal-result-empty">No new cards</div>
            )}
          </div>
        </div>

        <button className="deal-result-end-turn-button" onClick={onEndTurn}>
          ⏭ End Turn
        </button>
      </div>
    </div>
  );
};
