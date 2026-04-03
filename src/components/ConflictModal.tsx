/**
 * ConflictModal
 *
 * Full-screen overlay shown during an active conflict.
 * Displays the target card, both sides' cards, power totals, and phase-appropriate action buttons.
 * Supports adding figures and tactics from the activeConflictPlayer's in-play area / hand.
 */

import React from 'react';
import { CardSlotEntity, CardType, SocialClass } from '../types/cards';
import { ConflictCardInPlay, ConflictPhase, ConflictState, ConflictType } from '../types/conflicts';
import { PlayerState } from '../types/game';
import { getAnyCardData } from '../data/cards';
import { CardComponent } from './CardComponent';

interface ConflictModalProps {
  conflict: ConflictState;
  /** The player whose hand/figures we show for adding cards */
  activeConflictPlayer: SocialClass;
  /** Full player states so we can show available figures and hand */
  players: { [SocialClass.WorkingClass]: PlayerState; [SocialClass.CapitalistClass]: PlayerState };
  /** The card being contested (workplace, office, or demand) */
  targetCard: CardSlotEntity;
  onCancel: () => void;
  onInitiate: () => void;
  onAddFigure: (figureId: string) => void;
  onAddTactic: (handIndex: number) => void;
  onPlanResponse: () => void;
  onResolve: () => void;
}

function renderPowerBreakdown(
  cards: ConflictCardInPlay[],
  diceCount: number,
  establishedPower: number,
  label: string,
): React.ReactNode {
  const sources: string[] = [];
  for (const card of cards) {
    const data = getAnyCardData(card.id);
    if (data.card_type === CardType.Figure && data.dice > 0) {
      sources.push(`${data.name}: ${data.dice} 🎲`);
    } else if (data.card_type === CardType.Tactic && data.dice) {
      sources.push(`${data.name}: ${data.dice} 🎲`);
    }
  }
  return (
    <div className="conflict-modal-power-breakdown">
      <div className="conflict-modal-power-label">{label}</div>
      <div className="conflict-modal-power-total">
        {diceCount} 🎲 + {establishedPower} ⚫ established
      </div>
      {sources.length > 0 && (
        <div className="conflict-modal-power-sources">
          {sources.map((s, i) => <div key={i} className="conflict-modal-power-source">{s}</div>)}
        </div>
      )}
    </div>
  );
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  conflict,
  activeConflictPlayer,
  players,
  targetCard,
  onCancel,
  onInitiate,
  onAddFigure,
  onAddTactic,
  onPlanResponse,
  onResolve,
}) => {
  const activePlayer = players[activeConflictPlayer];
  const isInitiating = conflict.phase === ConflictPhase.Initiating;
  const isResponding = conflict.phase === ConflictPhase.Responding;
  const isResolving = conflict.phase === ConflictPhase.Resolving;

  const conflictTypeLabel =
    conflict.conflictType === ConflictType.Strike ? "Strike" :
    conflict.conflictType === ConflictType.Election ? "Election" : "Legislation";
  const targetLabel =
    conflict.conflictType === ConflictType.Strike ? "Workplace" :
    conflict.conflictType === ConflictType.Election ? "Office" : "Demand";

  const phaseLabel = (() => {
    if (isInitiating) return `${conflict.initiatingClass}: Add cards to your side`;
    if (isResponding) {
      const respondingClass = conflict.initiatingClass === SocialClass.WorkingClass
        ? SocialClass.CapitalistClass
        : SocialClass.WorkingClass;
      return `${respondingClass}: Respond in secret`;
    }
    return `${conflict.initiatingClass}: Add more cards or resolve`;
  })();

  // Available figures and hand for the active conflict player
  const availableFigures = activePlayer.figures.filter(f => !f.exhausted && !f.in_training);
  const handTactics = activePlayer.hand
    .map((cardId, idx) => ({ cardId, idx }))
    .filter(({ cardId }) => {
      const data = getAnyCardData(cardId);
      return data.card_type === CardType.Tactic;
    });

  return (
    <div className="conflict-modal-overlay" role="dialog" aria-label="Active conflict">
      <div className="conflict-modal">
        <button
          className="conflict-modal-close-button"
          onClick={isInitiating ? onCancel : undefined}
          disabled={!isInitiating}
          aria-label={isInitiating ? "Cancel conflict" : "Cannot cancel after initiating"}
        >
          ✕
        </button>

        <div className="conflict-modal-title">{conflictTypeLabel}</div>
        <div className="conflict-modal-phase">{phaseLabel}</div>

        {/* Target card */}
        <div className="conflict-modal-target">
          <div className="conflict-modal-section-label">{targetLabel}</div>
          <CardComponent card={targetCard} borderVariant="other" />
        </div>

        {/* Both sides */}
        <div className="conflict-modal-sides">
          {/* Working Class side */}
          <div className="conflict-modal-side">
            <div className="conflict-modal-side-title">Working Class</div>
            <div className="conflict-modal-card-row">
              {conflict.workingClassCards.map((card, i) => (
                <CardComponent
                  key={i}
                  card={getAnyCardData(card.id)}
                  borderVariant={
                    card.card_type === CardType.Figure
                      ? "in-play"
                      : "other"
                  }
                />
              ))}
              {/* Empty slot hint when it's WC's turn to add */}
              {activeConflictPlayer === SocialClass.WorkingClass && !isResolving && (
                <div className="card-slot">
                  <div className="card-slot-placeholder card-slot-placeholder-add">
                    <span className="card-slot-add-icon">+</span>
                  </div>
                </div>
              )}
            </div>
            {renderPowerBreakdown(
              conflict.workingClassCards,
              conflict.workingClassPower.diceCount,
              conflict.workingClassPower.establishedPower,
              "WC Power",
            )}
          </div>

          {/* Capitalist Class side */}
          <div className="conflict-modal-side">
            <div className="conflict-modal-side-title">Capitalist Class</div>
            <div className="conflict-modal-card-row">
              {conflict.capitalistCards.map((card, i) => (
                <CardComponent
                  key={i}
                  card={getAnyCardData(card.id)}
                  borderVariant={
                    card.card_type === CardType.Figure
                      ? "in-play"
                      : "other"
                  }
                />
              ))}
              {/* Empty slot hint when it's CC's turn to add */}
              {activeConflictPlayer === SocialClass.CapitalistClass && !isResolving && (
                <div className="card-slot">
                  <div className="card-slot-placeholder card-slot-placeholder-add">
                    <span className="card-slot-add-icon">+</span>
                  </div>
                </div>
              )}
            </div>
            {renderPowerBreakdown(
              conflict.capitalistCards,
              conflict.capitalistPower.diceCount,
              conflict.capitalistPower.establishedPower,
              "CC Power",
            )}
          </div>
        </div>

        {/* Cards available to add */}
        {!isResolving && (
          <div className="conflict-modal-available">
            {availableFigures.length > 0 && (
              <div className="conflict-modal-available-section">
                <div className="conflict-modal-section-label">Add a Figure</div>
                <div className="conflict-modal-card-row">
                  {availableFigures.map((figure) => (
                    <button
                      key={figure.id}
                      className="conflict-modal-add-card-button"
                      onClick={() => onAddFigure(figure.id)}
                    >
                      <CardComponent
                        card={getAnyCardData(figure.id)}
                        borderVariant="in-play"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {handTactics.length > 0 && (
              <div className="conflict-modal-available-section">
                <div className="conflict-modal-section-label">Play a Tactic</div>
                <div className="conflict-modal-card-row">
                  {handTactics.map(({ cardId, idx }) => {
                    const data = getAnyCardData(cardId);
                    const canAfford = activePlayer.wealth >= (data.cost ?? 0);
                    return (
                      <button
                        key={idx}
                        className="conflict-modal-add-card-button"
                        onClick={canAfford ? () => onAddTactic(idx) : undefined}
                        disabled={!canAfford}
                        title={canAfford ? undefined : `Need $${data.cost ?? 0} (have $${activePlayer.wealth})`}
                      >
                        <CardComponent
                          card={data}
                          borderVariant="hand"
                          className={canAfford ? undefined : "card-cannot-afford"}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="conflict-modal-actions">
          {isInitiating && (
            <>
              <button className="conflict-modal-button conflict-modal-button-initiate" onClick={onInitiate}>
                ⚔ Initiate Conflict
              </button>
              <button className="conflict-modal-button conflict-modal-button-cancel" onClick={onCancel}>
                ✕ Cancel Plan
              </button>
            </>
          )}
          {isResponding && (
            <button className="conflict-modal-button conflict-modal-button-respond" onClick={onPlanResponse}>
              ✓ Plan Response
            </button>
          )}
          {isResolving && (
            <button className="conflict-modal-button conflict-modal-button-resolve" onClick={onResolve}>
              🎲 Resolve Conflict
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
