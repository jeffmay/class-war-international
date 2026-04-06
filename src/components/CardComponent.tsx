import React from 'react';
import { getAnyCardData } from '../data/cards';
import { CardSlotEntity, CardType, SocialClass, WorkplaceForSale } from '../types/cards';

/**
 * Overrides the default interactive/non-interactive border color.
 * - 'hand': yellow — card is in the current player's hand
 * - 'in-play': green — activated figure in play
 * - 'training': light grey — figure in training
 * - 'exhausted': red — exhausted figure
 * - 'other': dark grey — opponent card, shared board card, or non-actionable card
 */
export type CardBorderVariant = 'hand' | 'in-play' | 'training' | 'exhausted' | 'other';

interface CardComponentProps {
  card: CardSlotEntity;
  effects?: string[]; // TODO: Implement effect icons and descriptions
  showAsCardBack?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  className?: string;
  /** When set, renders a status overlay banner bisecting the card */
  statusBanner?: { line1: string; line2?: string };
  /** When set, overrides the default interactive/non-interactive border color */
  borderVariant?: CardBorderVariant;
}

export const CardComponent: React.FC<CardComponentProps> = ({
  card,
  effects = [],
  showAsCardBack = false,
  onClick,
  onDoubleClick,
  className = '',
  statusBanner,
  borderVariant,
}) => {
  if (card === WorkplaceForSale) {
    // TODO: Migrate the for sale logic from Board
    return <div>FOR SALE</div>
  }

  const interactionClass = onClick ? 'interactive' : 'non-interactive';
  const borderVariantClass = borderVariant ? `card-border-${borderVariant}` : '';

  const statusBannerEl = statusBanner && (
    <div className="card-status-banner">
      <div className="card-status-banner-line1">{statusBanner.line1}</div>
      {statusBanner.line2 && (
        <div className="card-status-banner-line2">{statusBanner.line2}</div>
      )}
    </div>
  );

  const effectsEl = effects.length > 0 && <div className="card-effects">{effects.map((effect, i) => (
    <div key={i} className="card-effect">
      {effect}
    </div>
  ))}</div>;

  // ── Card back ───────────────────────────────────────────────────────────────
  if (showAsCardBack) {
    return (
      <div
        className={['card-component', 'card-back', interactionClass, className].filter(Boolean).join(' ')}
        data-testid="card-component"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      >
        <div className="card-back-content">
          <span className="card-back-question">?</span>
        </div>
      </div>
    );
  }

  const cardData = card.in_play ? getAnyCardData(card.id) : card;
  const cardProps = card.in_play ? card : undefined;

  // ── State figure (board-only: political offices) ────────────────────────────
  // Uses card_type: CardType.StateFigure as the discriminator.
  // TypeScript narrows to StateFigureCardData inside this block.
  if (cardData.card_type === CardType.DefaultStateFigure) {
    return (
      <div
        className={['card-component', 'card-color-default', interactionClass, borderVariantClass, className].filter(Boolean).join(' ')}
        data-testid="card-component"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      >
        {statusBannerEl}
        <div className="card-top-left-block">
          <div className="card-name">{cardData.name}</div>
          {effectsEl}
        </div>
        <div className="card-top-right-float power-color-established">
          {cardData.established_power} ⚫️
        </div>
        <div className="card-bottom-block">
          <div className="card-rules rules-color-state-figure">{cardData.rules}</div>
        </div>
      </div>
    );
  }

  // ── Player cards (CardData) ─────────────────────────────────────────────────
  // TypeScript narrows `card` to CardData after the StateFigure branch above.

  const getCardColorClass = (): string => {
    switch (card.card_type) {
      case CardType.Demand:
        return card.social_class === SocialClass.CapitalistClass
          ? 'card-color-demand-capitalist'
          : 'card-color-demand-working';
      default:
        return 'card-color-default';
    }
  };

  const getCardIcon = (): string => {
    switch (card.card_type) {
      case CardType.Figure: return '👤';
      case CardType.Workplace: return '🏭';
      case CardType.Tactic: return '⚠️';
      case CardType.Institution: return '🏠';
      case CardType.Demand: return '💬';
      default: return '';
    }
  };

  const getRulesColorClass = (): string => {
    switch (card.card_type) {
      case CardType.Figure:
        return card.social_class === SocialClass.CapitalistClass
          ? 'rules-color-figure-capitalist'
          : 'rules-color-figure-working';
      case CardType.Tactic: return 'rules-color-tactic';
      case CardType.Institution: return 'rules-color-institution';
      case CardType.Demand: return 'rules-color-demand';
      default: return '';
    }
  };

  const cardClasses = ['card-component', getCardColorClass(), interactionClass, borderVariantClass, className]
    .filter(Boolean)
    .join(' ');


  const cardName = cardProps?.card_type === CardType.Workplace && (cardProps.expansionCount ?? 0) > 0
    ? `${cardData.name} (x${cardProps.expansionCount})`
    : cardData.name;

  return (
    <div className={cardClasses} data-testid="card-component" onClick={onClick} onDoubleClick={onDoubleClick}>
      {statusBannerEl}

      {/* Top-left: Name and Cost */}
      <div className="card-top-left-block">
        <div className="card-name">{cardName}</div>
        <div className="card-cost-icon">
          {getCardIcon()}{cardData.cost > 0 && ` $${cardData.cost}`}
        </div>
        {effectsEl}
      </div>

      {/* Top-right: Power indicators — use card_type discriminators only */}
      {cardData.card_type === CardType.Demand ? (
        <div className={`card-top-right-float ${card.social_class === SocialClass.CapitalistClass ? 'demand-border-capitalist' : 'demand-border-working'}`}>
          <span className={`demand-star ${card.social_class === SocialClass.CapitalistClass ? 'star-color-capitalist' : 'star-color-working'}`}>★</span>
        </div>
      ) : (
        <>
          {cardData.card_type === CardType.Figure && cardData.dice > 0 && (
            <div className="card-top-right-float power-color-dice">
              {cardData.dice} 🎲
            </div>
          )}
          {cardData.card_type === CardType.Tactic && cardData.dice !== undefined && cardData.dice > 0 && (
            <div className="card-top-right-float power-color-dice">
              {cardData.dice} 🎲
            </div>
          )}
          {(cardData.card_type === CardType.Institution || cardData.card_type === CardType.Workplace) &&
            cardData.established_power > 0 && (
              <div className="card-top-right-float power-color-established">
                <span className="institution-power">{cardData.established_power} ⚫️</span>
              </div>
            )}
          {cardData.card_type === CardType.Tactic &&
            cardData.established_power !== undefined &&
            cardData.established_power > 0 && (
              <div className="card-top-right-float power-color-established">
                <span className="institution-power">{cardData.established_power} ⚫️</span>
              </div>
            )}
        </>
      )}

      {/* Bottom block */}
      <div className="card-bottom-block">
        {/* Workplace: wages/profits panel */}
        {cardProps?.card_type === CardType.Workplace && (
          <div className="card-workplace-revenue-container">
            <div className="workplace-wages">
              <div>Wages: ${cardProps.wages}</div>
            </div>
            <div className="workplace-profits">
              <div>Profits: ${cardProps.profits}</div>
            </div>
          </div>
        )}
        {/* Quote and rules for non-workplace cards */}
        {cardData.card_type !== CardType.Workplace && cardData.quote && (
          <div className="card-quote">{cardData.quote}</div>
        )}
        {cardData.card_type !== CardType.Workplace && cardData.rules && (
          <div className={`card-rules ${getRulesColorClass()}`}>{cardData.rules}</div>
        )}
      </div>
    </div>
  );
};
