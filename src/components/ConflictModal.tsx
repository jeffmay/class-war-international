/**
 * ConflictModal
 *
 * Full-screen overlay shown during an active conflict.
 * Displays the target card, both sides' cards, power totals, and phase-appropriate action buttons.
 * Supports adding figures and tactics from the activeConflictPlayer's in-play area / hand.
 *
 * Layout:
 *   - Strike: leader row (first maxStrikeLeaders of workingClassCards) above supporter rows
 *   - Election: head-to-head row (candidate vs incumbent) above supporter columns
 *   - Legislation: side-by-side columns as before
 */

import React, { useState } from 'react';
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
  /** Swap card at leaderSlotIndex with card at conflictCardIndex within the relevant cards array */
  onChangeLeader: (leaderSlotIndex: number, conflictCardIndex: number) => void;
  onPlanResponse: () => void;
  onEscalate: () => void;
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

function renderEffectsList(cards: ConflictCardInPlay[], label: string): React.ReactNode {
  const effects = cards
    .map(card => ({ name: getAnyCardData(card.id).name, rules: getAnyCardData(card.id).rules }))
    .filter(({ rules }) => rules);
  if (effects.length === 0) return null;
  return (
    <div className="conflict-modal-effects-list">
      <div className="conflict-modal-section-label">{label} Effects</div>
      <ul>
        {effects.map(({ name, rules }, i) => (
          <li key={i}><strong>{name}:</strong> {rules}</li>
        ))}
      </ul>
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
  onChangeLeader,
  onPlanResponse,
  onEscalate,
  onResolve,
}) => {
  // null = not in swap mode; number = leader slot index being replaced
  const [swappingLeaderSlot, setSwappingLeaderSlot] = useState<number | null>(null);

  const isInitiating = conflict.phase === ConflictPhase.Initiating;
  const isResponding = conflict.phase === ConflictPhase.Responding;
  const isResolving = conflict.phase === ConflictPhase.Resolving;
  const isMyTurn = viewingClass === activeConflictPlayer;

  const myCards = viewingClass === SocialClass.WorkingClass
    ? conflict.workingClassCards
    : conflict.capitalistCards;
  const hasAddedCards = myCards.some(c => c.addedThisStep);

  const conflictTypeLabel =
    conflict.conflictType === ConflictType.Strike ? "Strike" :
    conflict.conflictType === ConflictType.Election ? "Election" : "Legislation";

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

  // ── Strike-specific layout helpers ────────────────────────────────────────────

  const renderStrikeLeaderRow = () => {
    if (conflict.conflictType !== ConflictType.Strike) return null;
    const { maxStrikeLeaders, workingClassCards } = conflict;
    const leaders = workingClassCards.slice(0, maxStrikeLeaders);
    const canChangeLeader = isInitiating && isMyTurn && viewingClass === SocialClass.WorkingClass;
    return (
      <div className="conflict-modal-leader-row">
        <div className="conflict-modal-section-label">Strike Leader{maxStrikeLeaders > 1 ? "s" : ""}</div>
        <div className="conflict-modal-card-row">
          {leaders.map((card, i) => (
            <div key={i} className="conflict-modal-leader-card">
              <CardComponent card={getAnyCardData(card.id)} borderVariant="other" />
              {canChangeLeader && (
                <button
                  className="conflict-modal-change-btn"
                  onClick={() => setSwappingLeaderSlot(swappingLeaderSlot === i ? null : i)}
                >
                  {swappingLeaderSlot === i ? "Cancel" : "Change"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStrikeSupporters = () => {
    if (conflict.conflictType !== ConflictType.Strike) return null;
    const { maxStrikeLeaders, workingClassCards } = conflict;
    const supporters = workingClassCards.slice(maxStrikeLeaders);
    const canSwap = swappingLeaderSlot !== null && isInitiating && isMyTurn;
    return (
      <div className="conflict-modal-card-row">
        {supporters.map((card, i) => {
          const conflictIdx = maxStrikeLeaders + i;
          if (canSwap) {
            return (
              <div key={i} className="conflict-modal-leader-card">
                <CardComponent card={getAnyCardData(card.id)} borderVariant="actionable" />
                <button
                  className="conflict-modal-change-btn"
                  onClick={() => { onChangeLeader(swappingLeaderSlot!, conflictIdx); setSwappingLeaderSlot(null); }}
                >
                  Set as Leader
                </button>
              </div>
            );
          }
          return renderConflictCard(card, conflictIdx, SocialClass.WorkingClass);
        })}
        {activeConflictPlayer === SocialClass.WorkingClass && !isResolving && !canSwap && (
          <div className="card-slot">
            <div className="card-slot-placeholder card-slot-placeholder-add">
              <span className="card-slot-add-icon">+</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Election-specific layout helpers ─────────────────────────────────────────

  const renderElectionHthRow = () => {
    if (conflict.conflictType !== ConflictType.Election) return null;
    const initiatingCards = conflict.initiatingClass === SocialClass.WorkingClass
      ? conflict.workingClassCards
      : conflict.capitalistCards;
    const candidateCard = initiatingCards[0];
    const canChangeCandidate = isInitiating && isMyTurn && viewingClass === conflict.initiatingClass;
    const hasSupportersToSwap = initiatingCards.length > 1;
    return (
      <div className="conflict-modal-hth-row">
        <div className="conflict-modal-hth-side">
          <div className="conflict-modal-section-label">
            {conflict.initiatingClass === SocialClass.WorkingClass ? "WC" : "CC"} Candidate
          </div>
          {candidateCard && (
            <div className="conflict-modal-leader-card">
              <CardComponent card={getAnyCardData(candidateCard.id)} borderVariant="other" />
              {canChangeCandidate && hasSupportersToSwap && (
                <button
                  className="conflict-modal-change-btn"
                  onClick={() => setSwappingLeaderSlot(swappingLeaderSlot === 0 ? null : 0)}
                >
                  {swappingLeaderSlot === 0 ? "Cancel" : "Change"}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="conflict-modal-vs-label">vs</div>
        <div className="conflict-modal-hth-side">
          <div className="conflict-modal-section-label">Incumbent</div>
          <CardComponent
            card={targetCard}
            borderVariant={incumbentDefendingClass === SocialClass.WorkingClass ? "wc" : "cc"}
          />
          {incumbentPower > 0 && (
            <div className="conflict-modal-power-source">+{incumbentPower} ⚫</div>
          )}
        </div>
      </div>
    );
  };

  const renderElectionSupporters = (forClass: SocialClass) => {
    if (conflict.conflictType !== ConflictType.Election) return null;
    const isInitiatingClass = forClass === conflict.initiatingClass;
    const cards = forClass === SocialClass.WorkingClass
      ? conflict.workingClassCards
      : conflict.capitalistCards;
    // Skip the first card (candidate) for the initiating class
    const supporters = isInitiatingClass ? cards.slice(1) : cards;
    const canSwap = swappingLeaderSlot === 0 && isInitiatingClass && isInitiating && isMyTurn;
    return (
      <div className="conflict-modal-card-row">
        {supporters.map((card, i) => {
          // conflictIdx accounts for the skipped candidate at index 0
          const conflictIdx = isInitiatingClass ? 1 + i : i;
          if (canSwap) {
            return (
              <div key={i} className="conflict-modal-leader-card">
                <CardComponent card={getAnyCardData(card.id)} borderVariant="actionable" />
                <button
                  className="conflict-modal-change-btn"
                  onClick={() => { onChangeLeader(0, conflictIdx); setSwappingLeaderSlot(null); }}
                >
                  Set as Candidate
                </button>
              </div>
            );
          }
          return renderConflictCard(card, conflictIdx, forClass);
        })}
        {activeConflictPlayer === forClass && !isResolving && !canSwap && (
          <div className="card-slot">
            <div className="card-slot-placeholder card-slot-placeholder-add">
              <span className="card-slot-add-icon">+</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Available cards section ───────────────────────────────────────────────────

  const renderAvailableCards = () => {
    if (!isMyTurn) return null;
    // In swap mode, figures are shown inline as "Set as Leader/Candidate" buttons; hide the normal add section
    if (swappingLeaderSlot !== null) return null;
    return (
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
    );
  };

  // ── Strike sides layout ───────────────────────────────────────────────────────

  const renderStrikeSides = () => {
    if (conflict.conflictType !== ConflictType.Strike) return null;
    return (
    <>
      {renderStrikeLeaderRow()}
      <div className="conflict-modal-sides">
        <div className="conflict-modal-side">
          <div className="conflict-modal-side-title">Working Class Supporters</div>
          {renderStrikeSupporters()}
          {renderPowerBreakdown(
            conflict.workingClassCards,
            conflict.workingClassPower.diceCount,
            conflict.workingClassPower.establishedPower,
            "WC Power",
          )}
          {renderEffectsList(conflict.workingClassCards, "WC")}
        </div>
        <div className="conflict-modal-side">
          <div className="conflict-modal-side-title">Capitalist Class</div>
          <div className="conflict-modal-card-row">
            {conflict.capitalistCards.map((card, i) =>
              renderConflictCard(card, i, SocialClass.CapitalistClass)
            )}
            {/* Workplace always sides with CC */}
            <CardComponent card={targetCard} borderVariant="cc" />
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
            { workplacePower: conflict.targetWorkplace.established_power },
          )}
          {renderEffectsList(conflict.capitalistCards, "CC")}
        </div>
      </div>
    </>
    );
  };

  // ── Election layout ───────────────────────────────────────────────────────────

  const renderElectionLayout = () => (
    <>
      {renderElectionHthRow()}
      <div className="conflict-modal-sides">
        <div className="conflict-modal-side">
          <div className="conflict-modal-side-title">Working Class Supporters</div>
          {renderElectionSupporters(SocialClass.WorkingClass)}
          {renderPowerBreakdown(
            conflict.workingClassCards,
            conflict.workingClassPower.diceCount,
            conflict.workingClassPower.establishedPower,
            "WC Power",
            { incumbentPower: incumbentDefendingClass === SocialClass.WorkingClass ? incumbentPower : undefined },
          )}
          {renderEffectsList(conflict.workingClassCards, "WC")}
        </div>
        <div className="conflict-modal-side">
          <div className="conflict-modal-side-title">Capitalist Class Supporters</div>
          {renderElectionSupporters(SocialClass.CapitalistClass)}
          {renderPowerBreakdown(
            conflict.capitalistCards,
            conflict.capitalistPower.diceCount,
            conflict.capitalistPower.establishedPower,
            "CC Power",
            { incumbentPower: incumbentDefendingClass === SocialClass.CapitalistClass ? incumbentPower : undefined },
          )}
          {renderEffectsList(conflict.capitalistCards, "CC")}
        </div>
      </div>
    </>
  );

  // ── Legislation layout (unchanged) ───────────────────────────────────────────

  const renderLegislationLayout = () => (
    <>
      <div className="conflict-modal-target">
        <div className="conflict-modal-section-label">Demand</div>
        <CardComponent card={targetCard} borderVariant="other" />
      </div>
      <div className="conflict-modal-sides">
        <div className="conflict-modal-side">
          <div className="conflict-modal-side-title">Working Class</div>
          <div className="conflict-modal-card-row">
            {conflict.workingClassCards.map((card, i) =>
              renderConflictCard(card, i, SocialClass.WorkingClass)
            )}
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
          {renderEffectsList(conflict.workingClassCards, "WC")}
        </div>
        <div className="conflict-modal-side">
          <div className="conflict-modal-side-title">Capitalist Class</div>
          <div className="conflict-modal-card-row">
            {conflict.capitalistCards.map((card, i) =>
              renderConflictCard(card, i, SocialClass.CapitalistClass)
            )}
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
          {renderEffectsList(conflict.capitalistCards, "CC")}
        </div>
      </div>
    </>
  );

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

        {conflict.conflictType === ConflictType.Strike && renderStrikeSides()}
        {conflict.conflictType === ConflictType.Election && renderElectionLayout()}
        {conflict.conflictType === ConflictType.Legislation && renderLegislationLayout()}

        {renderAvailableCards()}

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
              ? hasAddedCards
                ? <button className="conflict-modal-button conflict-modal-button-respond" onClick={onPlanResponse}>
                    ✓ Plan Response
                  </button>
                : <button className="conflict-modal-button conflict-modal-button-resolve" onClick={onResolve}>
                    🎲 Resolve Conflict
                  </button>
              : <button className="conflict-modal-button" disabled>
                  ⏳ Must wait for your turn
                </button>
          )}
          {isResolving && (
            isMyTurn
              ? hasAddedCards
                ? <button className="conflict-modal-button conflict-modal-button-escalate" onClick={onEscalate}>
                    ⚔ Escalate Conflict
                  </button>
                : <button className="conflict-modal-button conflict-modal-button-resolve" onClick={onResolve}>
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
