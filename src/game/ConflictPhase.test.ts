/**
 * Tests for Conflict Phase mechanics - Planning strikes and elections
 *
 * Every test builds its own GameState fixture with explicit pre-conditions
 * so no test is skipped or branched on randomly generated values.
 */

import { CardType, SocialClass, type FigureCardInPlay } from '../types/cards';
import { ConflictPhase, ConflictType } from '../types/conflicts';
import { TurnPhase } from '../types/game';
import { clientFromFixture, makeActionPhaseState } from './generate';

// A ready (not exhausted, not in_training) WC figure fixture
const readyWcFigure: FigureCardInPlay = {
  id: 'cashier',
  card_type: CardType.Figure,
  in_play: true,
  exhausted: false,
  in_training: false,
};

const exhaustedWcFigure: FigureCardInPlay = {
  id: 'cashier',
  card_type: CardType.Figure,
  in_play: true,
  exhausted: true,
  in_training: false,
};

const inTrainingWcFigure: FigureCardInPlay = {
  id: 'cashier',
  card_type: CardType.Figure,
  in_play: true,
  exhausted: false,
  in_training: true,
};

// A ready CC figure for election tests
const readyCcFigure: FigureCardInPlay = {
  id: 'manager',
  card_type: CardType.Figure,
  in_play: true,
  exhausted: false,
  in_training: false,
};

describe('Conflict Phase - Planning', () => {
  describe('planStrike', () => {
    test('successfully plans a strike with a ready WC figure', () => {
      const G = makeActionPhaseState({ figures: [readyWcFigure] });
      const client = clientFromFixture(G);

      const state = client.getStateOrThrow();
      expect(state.G.players[SocialClass.WorkingClass].figures).toHaveLength(1);
      expect(state.G.activeConflict).toBeUndefined();

      // Workplace index 0 is 'corner_store', a real workplace
      client.moves.planStrike('cashier', 0);
      const newState = client.getStateOrThrow();

      // Conflict was created
      expect(newState.G.activeConflict).toBeDefined();
      const conflict = newState.G.activeConflict!;
      expect(conflict.conflictType).toBe(ConflictType.Strike);
      expect(conflict.phase).toBe(ConflictPhase.Initiating);
      expect(conflict.initiatingClass).toBe(SocialClass.WorkingClass);

      if (conflict.conflictType !== ConflictType.Strike) throw new Error('wrong type');
      expect(conflict.strikeLeader.id).toBe('cashier');
      expect(conflict.targetWorkplaceIndex).toBe(0);
      expect(conflict.targetWorkplace.id).toBe('corner_store');

      // Figure removed from player's figures
      expect(newState.G.players[SocialClass.WorkingClass].figures).toHaveLength(0);

      // Power: cashier has 1 die
      expect(conflict.workingClassPower.diceCount).toBe(1);
      expect(conflict.workingClassPower.establishedPower).toBe(0);
      expect(conflict.capitalistPower.diceCount).toBe(0);
    });

    test('cannot plan strike with an exhausted figure', () => {
      const G = makeActionPhaseState({ figures: [exhaustedWcFigure] });
      const client = clientFromFixture(G);

      client.moves.planStrike('cashier', 0);
      const newState = client.getStateOrThrow();

      expect(newState.G.activeConflict).toBeUndefined();
      expect(newState.G.players[SocialClass.WorkingClass].figures).toHaveLength(1);
    });

    test('cannot plan strike with a figure in training', () => {
      const G = makeActionPhaseState({ figures: [inTrainingWcFigure] });
      const client = clientFromFixture(G);

      client.moves.planStrike('cashier', 0);
      const newState = client.getStateOrThrow();

      expect(newState.G.activeConflict).toBeUndefined();
    });

    test('cannot plan strike targeting an empty workplace slot', () => {
      const G = makeActionPhaseState({ figures: [readyWcFigure] });
      const client = clientFromFixture(G);

      const state = client.getStateOrThrow();
      // Find the empty slot index
      const emptyIndex = state.G.workplaces.findIndex(w => w.id.startsWith('empty'));
      expect(emptyIndex).toBeGreaterThanOrEqual(0);

      client.moves.planStrike('cashier', emptyIndex);
      const newState = client.getStateOrThrow();

      expect(newState.G.activeConflict).toBeUndefined();
      // Figure still in play
      expect(newState.G.players[SocialClass.WorkingClass].figures).toHaveLength(1);
    });

    test('cannot plan strike with a figure not in player figures', () => {
      const G = makeActionPhaseState({ figures: [] });
      const client = clientFromFixture(G);

      client.moves.planStrike('cashier', 0);
      const newState = client.getStateOrThrow();

      expect(newState.G.activeConflict).toBeUndefined();
    });

    test('cannot plan strike outside Action phase', () => {
      const G = makeActionPhaseState({ figures: [readyWcFigure] });
      const client = clientFromFixture(G);

      client.moves.endActionPhase();
      expect(client.getStateOrThrow().G.turnPhase).toBe(TurnPhase.Reproduction);

      client.moves.planStrike('cashier', 0);
      expect(client.getStateOrThrow().G.activeConflict).toBeUndefined();
    });
  });

  describe('planElection', () => {
    test('successfully plans an election with a ready WC figure', () => {
      const G = makeActionPhaseState({ figures: [readyWcFigure] });
      const client = clientFromFixture(G);

      // Office index 0 is 'populist'
      client.moves.planElection('cashier', 0);
      const newState = client.getStateOrThrow();

      expect(newState.G.activeConflict).toBeDefined();
      const conflict = newState.G.activeConflict!;
      expect(conflict.conflictType).toBe(ConflictType.Election);
      expect(conflict.phase).toBe(ConflictPhase.Initiating);
      expect(conflict.initiatingClass).toBe(SocialClass.WorkingClass);

      if (conflict.conflictType !== ConflictType.Election) throw new Error('wrong type');
      expect(conflict.candidate.id).toBe('cashier');
      expect(conflict.targetOfficeIndex).toBe(0);
      expect(conflict.targetIncumbent.id).toBe('populist');

      // Figure removed from player's figures
      expect(newState.G.players[SocialClass.WorkingClass].figures).toHaveLength(0);

      // WC has the candidate; capitalist side is empty
      expect(conflict.workingClassCards).toHaveLength(1);
      expect(conflict.capitalistCards).toHaveLength(0);
    });

    test('successfully plans an election with a ready CC figure (player 1)', () => {
      const G = makeActionPhaseState(
        {},
        { figures: [readyCcFigure] },
      );
      const client = clientFromFixture(G);

      // Verify CC figures exist in the fixture
      expect(client.getStateOrThrow().G.players[SocialClass.CapitalistClass].figures).toHaveLength(1);

      // Skip WC action + reproduction phase (fixture starts in Action, skip collectProduction)
      client.moves.endActionPhase();
      client.moves.endReproductionPhase();

      // Verify CC's turn started with figures intact
      const ccTurnStart = client.getStateOrThrow();
      expect(ccTurnStart.G.turnPhase).toBe(TurnPhase.Production);
      expect(ccTurnStart.G.players[SocialClass.CapitalistClass].figures).toHaveLength(1);

      // CC collects production (enters Action phase)
      client.moves.collectProduction('1');
      const ccActionState = client.getStateOrThrow();
      expect(ccActionState.G.turnPhase).toBe(TurnPhase.Action);
      expect(ccActionState.G.players[SocialClass.CapitalistClass].figures).toHaveLength(1);

      // CC plans an election (no playerID prefix — boardgame.io uses currentPlayer='1')
      client.moves.planElection('manager', 0);
      const newState = client.getStateOrThrow();

      expect(newState.G.activeConflict).toBeDefined();
      const conflict = newState.G.activeConflict!;
      if (conflict.conflictType !== ConflictType.Election) throw new Error('wrong type');
      expect(conflict.initiatingClass).toBe(SocialClass.CapitalistClass);
      expect(conflict.candidate.id).toBe('manager');
      // CC has the candidate; WC side is empty
      expect(conflict.capitalistCards).toHaveLength(1);
      expect(conflict.workingClassCards).toHaveLength(0);
    });

    test('cannot plan election with an exhausted figure', () => {
      const G = makeActionPhaseState({ figures: [exhaustedWcFigure] });
      const client = clientFromFixture(G);

      client.moves.planElection('cashier', 0);
      expect(client.getStateOrThrow().G.activeConflict).toBeUndefined();
    });

    test('cannot plan election with a figure in training', () => {
      const G = makeActionPhaseState({ figures: [inTrainingWcFigure] });
      const client = clientFromFixture(G);

      client.moves.planElection('cashier', 0);
      expect(client.getStateOrThrow().G.activeConflict).toBeUndefined();
    });

    test('cannot plan election with a figure not in player figures', () => {
      const G = makeActionPhaseState({ figures: [] });
      const client = clientFromFixture(G);

      client.moves.planElection('cashier', 0);
      expect(client.getStateOrThrow().G.activeConflict).toBeUndefined();
    });
  });
});
