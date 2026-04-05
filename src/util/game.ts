import { allCards, workplaceCardById, demandCardById, figureCardById, institutionCardById, tacticCardById, CardID, DemandCardID, FigureCardID, InstitutionCardID, TacticCardID, WorkplaceCardID } from "../data/cards";
import { CardType, DemandCardInPlay, FigureCardInPlay, InstitutionCardInPlay, TacticCardInPlay } from "../types/cards";

export function isDemandCardID(cardId: string): cardId is DemandCardID {
  return cardId in demandCardById
}

export function playDemandCard(cardId: DemandCardID, props?: Partial<DemandCardInPlay>): DemandCardInPlay {
  return {
    id: cardId,
    card_type: CardType.Demand,
    in_play: true,
    ...props,
  };
}

export function isFigureCardID(cardId: string): cardId is FigureCardID {
  return cardId in figureCardById
}

export function playFigureCard(cardId: FigureCardID, props?: Partial<FigureCardInPlay>): FigureCardInPlay {
  return {
    id: cardId,
    card_type: CardType.Figure,
    in_play: true,
    exhausted: false,
    in_training: true,
    ...props,
  };
}

export function isInstitutionCardID(cardId: string): cardId is InstitutionCardID {
  return cardId in institutionCardById
}

export function playInstitutionCard(cardId: InstitutionCardID, props?: Partial<InstitutionCardInPlay>): InstitutionCardInPlay {
  return {
    id: cardId,
    card_type: CardType.Institution,
    in_play: true,
    ...props,
  };
}

export function isTacticCardID(cardId: string): cardId is TacticCardID {
  return cardId in tacticCardById
}

export function isWorkplaceCardID(cardId: string): cardId is WorkplaceCardID {
  return cardId in workplaceCardById
}

export function playTacticCard(cardId: TacticCardID, props?: Partial<TacticCardInPlay>): TacticCardInPlay {
  return {
    id: cardId,
    card_type: CardType.Tactic,
    in_play: true,
    ...props,
  };
}

export function isCardID(cardId: string): cardId is CardID {
  return cardId in allCards
}
