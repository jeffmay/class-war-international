/**
 * ConflictModal
 *
 * Full-screen overlay shown during an active conflict.
 * Displays the target card, both sides' cards, power totals, and phase-appropriate action buttons.
 * Supports adding figures and tactics from the activeConflictPlayer's in-play area / hand.
 */

import React from 'react';
import { CardSlotEntity, CardType, ConflictType, SocialClass } from '../types/cards';
import { ConflictCardInPlay, ConflictPhase, ConflictState } from '../types/conflicts';
import { PlayerState } from '../types/game';
import { getAnyCardData, getTacticDataById } from '../data/cards';
import { isTacticCardID } from '../util/game';
import { CardComponent } from './CardComponent';

interface ConflictModalProps {
  conflict: ConflictState;
  /** Which class is currently viewing this modal (drives tactic/figure visibility and button states) */
  viewingClass: SocialClass;
  /** The class whose turn it currently is within the conflict */
  activeConflictPlayer: SocialClass;
  /** Full player states so we can show available figures and hand */
  players: { [SocialClass.WorkingClass]: PlayerState; [SocialClass.CapitalistClass]: PlayerState };
  /** The card being contested (workplace, office, or demand) */
  targetCard: CardSlotEntity;
  onClose: () => void;
  onCancel: () => void;
  onInitiate: () => void;
  onAddFigure: (figureId: string) => void;
  onAddTactic: (handIndex: number, forClass?: SocialClass) => void;
  /** Called when the viewer clicks one of their own addedThisStep cards to remove it */
  onRemoveCard: (cardIndex: number, forClass: SocialClass) => void;
  onPlanResponse: () => void;
  onResolve: () => void;
}

function renderPowerBreakdown(
  cards: ConflictCardInPlay[],
  diceCount: number,
  establishedPower: number,
  label: string,
  extras?: { workplacePower?: number; incumbentPower?: number },
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
  const totalEstablished = establishedPower
    + (extras?.workplacePower ?? 0)
    + (extras?.incumbentPower ?? 0);
  return (
    <div className="conflict-modal-power-breakdown">
      <div className="conflict-modal-power-label">{label}</div>
      <div className="conflict-modal-power-total">
        {diceCount} 🎲 + {totalEstablished} ⚫ established
      </div>
      {extras?.workplacePower !== undefined && extras.workplacePower > 0 && (
        <div className="conflict-modal-power-source">
          Workplace: {extras.workplacePower} ⚫
        </div>
      )}
      {extras?.incumbentPower !== undefined && extras.incumbentPower > 0 && (
        <div className="conflict-modal-power-source">
          Incumbent: {extras.incumbentPower} ⚫
        </div>
      )}
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
  viewingClass,
  activeConflictPlayer,
  players,
  targetCard,
  onClose,
  onCancel,
  onInitiate,
  onAddFigure,
  onAddTactic,
  onRemoveCard,
  onPlanResponse,
  onResolve,
}) => {
  const isInitiating = conflict.phase === ConflictPhase.Initiating;
  const isResponding = conflict.phase === ConflictPhase.Responding;
  const isResolving = conflict.phase === ConflictPhase.Resolving;
  const isMyTurn = viewingClass === activeConflictPlayer;

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

  // Only show the viewing player's own available figures and tactics — never the opponent's.
  const viewingPlayer = players[viewingClass];
  const availableFigures = viewingPlayer.figures.filter(f => !f.exhausted && !f.in_training);
  const handTactics = viewingPlayer.hand
    .map((cardId, idx) => ({ cardId, idx }))
    .filter(({ cardId }) => {
      if (!isTacticCardID(cardId)) return false;
      const data = getTacticDataById(cardId);
      return data.enabled_by_conflict?.includes(conflict.conflictType) ?? false;
    });

  // For elections: the incumbent sides with the class opposing the challenger.
  const incumbentData = conflict.conflictType === ConflictType.Election
    ? getAnyCardData(conflict.targetIncumbent.id)
    : undefined;
  const incumbentPower = incumbentData?.card_type === CardType.DefaultStateFigure
    ? incumbentData.established_power
    : 0;
  const incumbentDefendingClass = conflict.conflictType === ConflictType.Election
    ? (conflict.initiatingClass === SocialClass.WorkingClass ? SocialClass.CapitalistClass : SocialClass.WorkingClass)
    : undefined;

  // During Responding, hide the responding class's addedThisStep cards from the opponent.
  const shouldHideCard = (card: ConflictCardInPlay, ownerClass: SocialClass): boolean =>
    isResponding && card.addedThisStep === true && ownerClass !== viewingClass;

  const renderConflictCard = (card: ConflictCardInPlay, index: number, ownerClass: SocialClass) => {
    if (shouldHideCard(card, ownerClass)) return null;
    const isMyCard = ownerClass === viewingClass && card.addedThisStep;
    const borderVariant = isMyCard ? "actionable" as const : "other" as const;
    const handleClick = isMyCard ? () => onRemoveCard(index, ownerClass) : undefined;
    return (
      <div key={index} className={isMyCard ? "conflict-modal-removable-card" : undefined}>
        <CardComponent
          card={getAnyCardData(card.id)}
          borderVariant={borderVariant}
          onClick={handleClick}
        />
        {isMyCard && <div className="conflict-modal-remove-hint">Click to remove</div>}
      </div>
    );
  };

  return (
    <div className="conflict-modal-overlay" role="dialog" aria-label="Active conflict">
      <div className="conflict-modal">
        <button
          className="conflict-modal-close-button"
          onClick={onClose}
          aria-label="Close conflict window"
        >
          ✕
        </button>

        <div className="conflict-modal-title">{conflictTypeLabel}</div>
        <div className="conflict-modal-phase">{phaseLabel}</div>

        {/* Wealth display */}
        <div className="conflict-modal-wealth-row">
          <span className="conflict-modal-wealth-item conflict-modal-wealth-wc">
            WC: ${players[SocialClass.WorkingClass].wealth}
          </span>
          <span className="conflict-modal-wealth-item conflict-modal-wealth-cc">
            CC: ${players[SocialClass.CapitalistClass].wealth}
          </span>
        </div>

        {/* Target card — only shown separately for legislation */}
        {conflict.conflictType === ConflictType.Legislation && (
          <div className="conflict-modal-target">
            <div className="conflict-modal-section-label">{targetLabel}</div>
            <CardComponent card={targetCard} borderVariant="other" />
          </div>
        )}

        {/* Both sides */}
        <div className="conflict-modal-sides">
          {/* Working Class side */}
          <div className="conflict-modal-side">
            <div className="conflict-modal-side-title">Working Class</div>
            <div className="conflict-modal-card-row">
              {conflict.workingClassCards.map((card, i) =>
                renderConflictCard(card, i, SocialClass.WorkingClass)
              )}
              {/* Incumbent sides with WC when CC initiates an election */}
              {conflict.conflictType === ConflictType.Election && incumbentDefendingClass === SocialClass.WorkingClass && (
                <CardComponent card={targetCard} borderVariant="wc" />
              )}
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
              {
                incumbentPower: incumbentDefendingClass === SocialClass.WorkingClass ? incumbentPower : undefined,
              },
            )}
          </div>

          {/* Capitalist Class side */}
          <div className="conflict-modal-side">
            <div className="conflict-modal-side-title">Capitalist Class</div>
            <div className="conflict-modal-card-row">
              {conflict.capitalistCards.map((card, i) =>
                renderConflictCard(card, i, SocialClass.CapitalistClass)
              )}
              {/* Target workplace always sides with CC in a strike */}
              {conflict.conflictType === ConflictType.Strike && (
                <CardComponent card={targetCard} borderVariant="cc" />
              )}
              {/* Incumbent sides with CC when WC initiates an election */}
              {conflict.conflictType === ConflictType.Election && incumbentDefendingClass === SocialClass.CapitalistClass && (
                <CardComponent card={targetCard} borderVariant="cc" />
              )}
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
              {
                workplacePower: conflict.conflictType === ConflictType.Strike ? conflict.targetWorkplace.established_power : undefined,
                incumbentPower: incumbentDefendingClass === SocialClass.CapitalistClass ? incumbentPower : undefined,
              },
            )}
          </div>
        </div>

        {/* Cards available to add — only shown when it is the viewer's turn to act */}
        {isMyTurn && (
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
                      <CardComponent card={getAnyCardData(figure.id)} borderVariant="actionable" />
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
                    const canAffordTactic = viewingPlayer.wealth >= (data.cost ?? 0);
                    return (
                      <button
                        key={idx}
                        className="conflict-modal-add-card-button"
                        onClick={canAffordTactic ? () => onAddTactic(idx, viewingClass) : undefined}
                        disabled={!canAffordTactic}
                      >
                        <div className="conflict-tactic-wrapper">
                          <CardComponent card={data} borderVariant={canAffordTactic ? "actionable" : "cannot-use"} />
                          {!canAffordTactic && <div className="conflict-tactic-cannot-afford">Cannot Afford</div>}
                        </div>
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
            isMyTurn
              ? <button className="conflict-modal-button conflict-modal-button-respond" onClick={onPlanResponse}>
                  ✓ Plan Response
                </button>
              : <button className="conflict-modal-button" disabled>
                  ⏳ Must wait for your turn
                </button>
          )}
          {isResolving && (
            isMyTurn
              ? <button className="conflict-modal-button conflict-modal-button-resolve" onClick={onResolve}>
                  🎲 Resolve Conflict
                </button>
              : <button className="conflict-modal-button" disabled>
                  ⏳ Must wait for your turn
                </button>
          )}
        </div>
      </div>
    </div>
  );
};
