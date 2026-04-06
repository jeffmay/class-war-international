/**
 * ConflictOutcomeModal
 *
 * Full-screen overlay shown after a conflict is resolved.
 * Displays dice rolls, power totals, winner, and a breakdown of what changed.
 * Each player must dismiss this modal independently; the board tracks who has dismissed.
 */

import React from 'react';
import { CardType, SocialClass } from '../types/cards';
import { ConflictOutcome, ConflictType } from '../types/conflicts';
import { getAnyCardData } from '../data/cards';
import { CardComponent } from './CardComponent';

interface ConflictOutcomeModalProps {
  outcome: ConflictOutcome;
  /** The class viewing this modal on this device */
  viewingClass: SocialClass;
  onDismiss: () => void;
}

export const ConflictOutcomeModal: React.FC<ConflictOutcomeModalProps> = ({
  outcome,
  viewingClass,
  onDismiss,
}) => {
  const { conflict, winner, workingClassPower, capitalistPower } = outcome;
  const alreadyDismissed = outcome.dismissedBy.includes(viewingClass);

  const winnerLabel = winner === SocialClass.WorkingClass ? "Working Class" : "Capitalist Class";
  const winnerClass = winner === SocialClass.WorkingClass ? "outcome-wc-wins" : "outcome-cc-wins";

  const [outcomeTitle, outcomeDetail] = (() => {
    if (conflict.conflictType === ConflictType.Strike) {
      const wp = getAnyCardData(conflict.targetWorkplace.id);
      if (winner === SocialClass.WorkingClass) {
        return [
          "Strike Successful!",
          `Workers win! Wages at ${wp.name} increase.`,
        ];
      }
      return [
        "Strike Defeated!",
        `The strike was broken at ${wp.name}. Wages unchanged.`,
      ];
    }
    if (conflict.conflictType === ConflictType.Election) {
      const candidateName = getAnyCardData(conflict.candidate.id).name;
      const incumbentName = getAnyCardData(conflict.targetIncumbent.id).name;
      if (winner === conflict.initiatingClass) {
        return [
          `${candidateName} Elected!`,
          `${candidateName} defeats ${incumbentName} and takes office.`,
        ];
      }
      return [
        `${incumbentName} Re-Elected!`,
        `${incumbentName} holds office — ${candidateName} loses.`,
      ];
    }
    // Legislation
    const demandName = getAnyCardData(conflict.demandCardId).name;
    if (winner === conflict.initiatingClass) {
      return [
        `${demandName} Passed!`,
        `The demand becomes law and takes effect immediately.`,
      ];
    }
    return [
      `${demandName} Rejected!`,
      `The legislation failed. The demand remains on the table.`,
    ];
  })();

  const dieFaceLabel = (value: number): string => {
    if (value === 0) return "❌";
    if (value === 1) return "•";
    return "••";
  };

  const renderPowerSection = (
    label: string,
    power: ConflictOutcome["workingClassPower"],
    cards: typeof conflict.workingClassCards,
  ) => (
    <div className="conflict-outcome-section">
      <div className="conflict-outcome-section-title">{label}</div>
      <div className="conflict-outcome-dice-row">
        <span className="conflict-outcome-dice-label">🎲 {power.diceCount} dice:</span>
        <span className="conflict-outcome-dice-rolls">
          {power.diceRolls.length > 0 ? power.diceRolls.map(dieFaceLabel).join(" ") : "—"}
        </span>
        <span className="conflict-outcome-dice-sum">
          = {power.diceRolls.reduce((a, b) => a + b, 0)}
        </span>
      </div>
      {power.establishedPower > 0 && (
        <div className="conflict-outcome-established">
          ⚫ Established power: +{power.establishedPower}
        </div>
      )}
      <div className="conflict-outcome-total">Total: {power.total}</div>
      {cards.length > 0 && (
        <div className="conflict-outcome-cards">
          {cards.map((card, i) => (
            <CardComponent
              key={i}
              card={getAnyCardData(card.id)}
              borderVariant={card.card_type === CardType.Figure ? "in-play" : "other"}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="conflict-outcome-overlay" role="dialog" aria-label="Conflict outcome">
      <div className={`conflict-outcome-modal ${winnerClass}`}>
        <button
          className="conflict-outcome-close-button"
          onClick={alreadyDismissed ? undefined : onDismiss}
          disabled={alreadyDismissed}
          aria-label="Dismiss conflict outcome"
        >
          ✕
        </button>

        <div className="conflict-outcome-title">{outcomeTitle}</div>
        <div className="conflict-outcome-winner">{winnerLabel} Wins!</div>
        <div className="conflict-outcome-detail">{outcomeDetail}</div>

        <div className="conflict-outcome-powers">
          {renderPowerSection("Working Class", workingClassPower, conflict.workingClassCards)}
          {renderPowerSection("Capitalist Class", capitalistPower, conflict.capitalistCards)}
        </div>

        {alreadyDismissed ? (
          <div className="conflict-outcome-waiting">
            Waiting for the other player to dismiss…
          </div>
        ) : (
          <button className="conflict-outcome-dismiss-button" onClick={onDismiss}>
            ✓ Continue
          </button>
        )}
      </div>
    </div>
  );
};
