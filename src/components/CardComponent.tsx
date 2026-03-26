import React from 'react';
import { CardData, CardType, SocialClass } from '../types/cards';

interface CardComponentProps {
  card: CardData;
  showAsCardBack?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  className?: string;
  /** When set, renders a status overlay banner bisecting the card */
  statusBanner?: { line1: string; line2?: string };
}

export const CardComponent: React.FC<CardComponentProps> = ({
  card,
  showAsCardBack = false,
  onClick,
  onDoubleClick,
  className = '',
  statusBanner,
}) => {
  const getCardColorClass = () => {
    switch (card.card_type) {
      case CardType.Demand:
        return card.social_class === SocialClass.CapitalistClass
          ? 'card-color-demand-capitalist'
          : 'card-color-demand-working';
      default:
        return 'card-color-default';
    }
  };

  const cardClasses = [
    'card-component',
    showAsCardBack ? 'card-back' : getCardColorClass(),
    onClick ? 'interactive' : 'non-interactive',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (showAsCardBack) {
    return (
      <div className={cardClasses} onClick={onClick} onDoubleClick={onDoubleClick}>
        <div className="card-back-content">
          <span className="card-back-question">?</span>
        </div>
      </div>
    );
  }

  const getCardIcon = () => {
    switch (card.card_type) {
      case CardType.Figure:
        return '👤';
      case CardType.Workplace:
        return '🏭';
      case CardType.Tactic:
        return '⚠️';
      case CardType.Institution:
        return '🏠';
      case CardType.Demand:
        return '💬';
      default:
        return '';
    }
  };

  const getBorderClass = () => {
    return card.social_class === SocialClass.CapitalistClass
      ? 'demand-border-capitalist'
      : 'demand-border-working';
  };

  const getStarColorClass = () => {
    return card.social_class === SocialClass.CapitalistClass
      ? 'star-color-capitalist'
      : 'star-color-working';
  };

  const getRulesColorClass = () => {
    if (card.card_type === CardType.Figure) {
      return card.social_class === SocialClass.CapitalistClass
        ? 'rules-color-figure-capitalist'
        : 'rules-color-figure-working';
    }
    if (card.card_type === CardType.Tactic) {
      return 'rules-color-tactic';
    }
    if (card.card_type === CardType.Institution) {
      return 'rules-color-institution';
    }
    if (card.card_type === CardType.Demand) {
      return 'rules-color-demand';
    }
    return '';
  };

  return (
    <div className={cardClasses} onClick={onClick} onDoubleClick={onDoubleClick}>
      {/* Status Banner Overlay */}
      {statusBanner && (
        <div className="card-status-banner">
          <div className="card-status-banner-line1">{statusBanner.line1}</div>
          {statusBanner.line2 && (
            <div className="card-status-banner-line2">{statusBanner.line2}</div>
          )}
        </div>
      )}
      {/* Top-left: Name and Cost */}
      <div className="card-top-left-block">
        <div className="card-name">{card.name}</div>
        {
          <div className="card-cost-icon">
            {getCardIcon()}{card.cost > 0 && ` $${card.cost}`}
          </div>
        }
      </div>

      {/* Top-right: Power indicators */}
      {card.card_type === CardType.Demand ? (
        <div className={`card-top-right-float ${getBorderClass()}`}>
          <span className={`demand-star ${getStarColorClass()}`}>★</span>
        </div>
      ) : (
        <>
          {(card.card_type === CardType.Figure || (card.card_type === CardType.Tactic && 'dice' in card)) &&
            card.dice &&
            card.dice > 0 && (
              <div className="card-top-right-float power-color-dice">
                {card.dice} 🎲
              </div>
            )}
          {(card.card_type === CardType.Institution ||
            card.card_type === CardType.Workplace ||
            (card.card_type === CardType.Tactic && 'established_power' in card)) &&
            'established_power' in card &&
            card.established_power &&
            card.established_power > 0 && (
              <div className="card-top-right-float power-color-established">
                <span className="institution-power">
                  {card.established_power} ⚫️
                </span>
              </div>
            )}
        </>
      )}

      {/* Bottom: Quote and Rules */}
      <div className="card-bottom-block">
        {card.quote && <div className="card-quote">{card.quote}</div>}
        {card.rules && (
          <div className={`card-rules ${getRulesColorClass()}`}>
            {card.rules}
          </div>
        )}
      </div>
    </div>
  );
};
