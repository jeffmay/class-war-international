import { allCards, allDemandCards, allFigureCards, allInstitutionCards, allTacticCards, CardID, DemandCardID, FigureCardID, InstitutionCardID, TacticCardID } from "../data/cards";
import { CardType, DemandCardInPlay, FigureCardInPlay, InstitutionCardInPlay, TacticCardInPlay } from "../types/cards";

export function isDemandCardID(cardId: string): cardId is DemandCardID {
  return cardId in allDemandCards
}

export function playDemandCard(cardId: DemandCardID): DemandCardInPlay {
  return {
    id: cardId,
    card_type: CardType.Demand,
    in_play: true,
  };
}

export function isFigureCardID(cardId: string): cardId is FigureCardID {
  return cardId in allFigureCards
}

export function playFigureCard(cardId: FigureCardID): FigureCardInPlay {
  return {
    id: cardId,
    card_type: CardType.Figure,
    in_play: true,
    exhausted: false,
    in_training: true,
  };
}

export function isInstitutionCardID(cardId: string): cardId is InstitutionCardID {
  return cardId in allInstitutionCards
}

export function playInstitutionCard(cardId: InstitutionCardID): InstitutionCardInPlay {
  return {
    id: cardId,
    card_type: CardType.Institution,
    in_play: true,
  };
}

export function isTacticCardID(cardId: string): cardId is TacticCardID {
  return cardId in allTacticCards
}

export function playTacticCard(cardId: TacticCardID): TacticCardInPlay {
  return {
    id: cardId,
    card_type: CardType.Tactic,
    in_play: true,
  };
}

export function isCardID(cardId: string): cardId is CardID {
  return cardId in allCards
}
