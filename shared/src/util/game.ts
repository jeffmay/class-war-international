import { AnyWorkplaceCardID, CardID, DefaultWorkplaceID, DemandCardID, FigureCardID, InstitutionCardID, TacticCardID, WorkplaceCardID, allCards, anyWorkplaceCardById, defaultWorkplaceCardById, demandCardById, figureCardById, institutionCardById, tacticCardById, workplaceCardById } from "../data/cards";
import { CardType, DemandCardInPlay, FigureCardInPlay, InstitutionCardInPlay, SocialClass, TacticCardInPlay, WorkplaceCardInPlay } from "../types/cards";
import { GameState } from "../types/game";

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

export function playWorkplaceCard(cardId: AnyWorkplaceCardID, props?: Partial<WorkplaceCardInPlay>): WorkplaceCardInPlay {
  const workplaceData = anyWorkplaceCardById[cardId];
  return {
    id: cardId,
    card_type: CardType.Workplace,
    in_play: true,
    established_power: workplaceData.established_power,
    wages: workplaceData.starting_wages,
    profits: workplaceData.starting_profits,
    unionized: false,
    ...props,
  };
}

export function playTacticCard(cardId: TacticCardID, props?: Partial<TacticCardInPlay>): TacticCardInPlay {
  return {
    id: cardId,
    card_type: CardType.Tactic,
    in_play: true,
    ...props,
  };
}

export function isDefaultWorkplaceCard(cardId: string): cardId is DefaultWorkplaceID {
  return cardId in defaultWorkplaceCardById;
}

export function isAnyWorkplaceCardID(cardId: string): cardId is AnyWorkplaceCardID {
  return cardId in anyWorkplaceCardById;
}

export function isCardID(cardId: string): cardId is CardID {
  return cardId in allCards
}

/**
 * Compute the established power a demand card contributes to a legislation conflict.
 * The `demand_power_basis` field on each demand card describes what to count.
 */
export function computeDemandPower(
  G: GameState,
  demandId: DemandCardID,
  proposingClass: SocialClass,
): number {
  const demandData = demandCardById[demandId];
  const basis = demandData.demand_power_basis;

  if (basis === "Number of your hero Figures in play.") {
    const heroesInFigures = G.players[proposingClass].figures.filter(
      f => figureCardById[f.id].hero,
    ).length;
    const heroesInOffices = G.politicalOffices.filter(office => {
      if (office.card_type !== CardType.Figure) return false;
      const data = figureCardById[office.id];
      return data.hero && data.social_class === proposingClass;
    }).length;
    return heroesInFigures + heroesInOffices;
  }

  if (basis === "Number of your elected Figures.") {
    return G.politicalOffices.filter(office => {
      if (office.card_type !== CardType.Figure) return false;
      return figureCardById[office.id].social_class === proposingClass;
    }).length;
  }

  if (basis === "Number of Workplaces with wages at $1.") {
    return G.workplaces.filter(
      (w): w is WorkplaceCardInPlay => typeof w !== "string" && w.wages === 1,
    ).length;
  }

  if (basis === "Number of unionized Workplaces.") {
    return G.workplaces.filter(
      (w): w is WorkplaceCardInPlay => typeof w !== "string" && w.unionized,
    ).length;
  }

  return 0;
}
