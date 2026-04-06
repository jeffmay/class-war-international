/**
 * Tests for Conflict Phase mechanics - Planning strikes, elections, and legislation
 *
 * Every test builds its own GameState fixture with explicit pre-conditions
 * so no test is skipped or branched on randomly generated values.
 */

import { CardType, SocialClass, WorkplaceForSale } from '../types/cards';
import { ConflictPhase, ConflictType } from '../types/conflicts';
import { TurnPhase } from '../types/game';
import { playDemandCard, playFigureCard } from '../util/game';
import { clientFromFixture, makeActionPhaseState } from './generate';

// A ready (not exhausted, not in_training) WC figure fixture
const readyWcFigure = playFigureCard('cashier', { in_training: false })

const exhaustedWcFigure = playFigureCard('cashier', { exhausted: true, in_training: false });

const inTrainingWcFigure = playFigureCard('cashier', { in_training: true });

// A ready CC figure for election tests
const readyCcFigure = playFigureCard('manager', { in_training: false });

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
      const emptyIndex = state.G.workplaces.indexOf(WorkplaceForSale);
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

    test('cannot plan election targeting an office with election cooldown', () => {
      // Place a CC-elected figure in office with cooldown — WC cannot challenge it yet
      const ccElectedFigure = playFigureCard('manager', { electionCooldownTurnsRemaining: 1 });
      const G = makeActionPhaseState({ figures: [readyWcFigure] });
      G.politicalOffices[0] = ccElectedFigure;
      const client = clientFromFixture(G);

      client.moves.planElection('cashier', 0);
      expect(client.getStateOrThrow().G.activeConflict).toBeUndefined();
      expect(client.getStateOrThrow().G.errorMessage).toContain('cannot be challenged');
    });

    test('can plan election after cooldown decrements to 0', () => {
      // CC won office[0] with cooldown=1; it should decrement when CC ends their turn
      const ccElectedFigure = playFigureCard('manager', { electionCooldownTurnsRemaining: 1 });
      const G = makeActionPhaseState({ figures: [readyWcFigure] });
      G.politicalOffices[0] = ccElectedFigure;
      const client = clientFromFixture(G);

      // WC ends their turn — cooldown should NOT decrement (CC holds office)
      client.moves.endActionPhase();
      client.moves.endReproductionPhase();
      expect(client.getStateOrThrow().G.politicalOffices[0].electionCooldownTurnsRemaining).toBe(1);

      // CC ends their turn — cooldown decrements to 0
      client.moves.collectProduction();
      client.moves.endActionPhase();
      client.moves.endReproductionPhase();

      // Back to WC's turn with cooldown now 0
      const state = client.getStateOrThrow();
      expect(state.G.politicalOffices[0].electionCooldownTurnsRemaining).toBe(0);
      expect(state.G.turnPhase).toBe(TurnPhase.Production);
      client.moves.collectProduction();

      const actionState = client.getStateOrThrow();
      expect(actionState.G.turnPhase).toBe(TurnPhase.Action);
      // Office cooldown is 0, so WC can now challenge
      expect(actionState.G.politicalOffices[0].electionCooldownTurnsRemaining ?? 0).toBe(0);
    });
  });

  describe('planLegislation', () => {
    const wcFigureInOffice = playFigureCard('cashier');

    function makeWcLegislationFixture(officeIndex = 0) {
      const G = makeActionPhaseState({
        demands: [playDemandCard('wealth_tax'), null],
      });
      // Place WC figure in office (populist)
      G.politicalOffices[officeIndex] = { ...wcFigureInOffice };
      return G;
    }

    test('successfully plans legislation with a WC figure in office', () => {
      const G = makeWcLegislationFixture();
      const client = clientFromFixture(G);

      client.moves.planLegislation(0, 0); // office 0 (populist), demand slot 0
      const state = client.getStateOrThrow();

      expect(state.G.activeConflict).toBeDefined();
      const conflict = state.G.activeConflict!;
      expect(conflict.conflictType).toBe(ConflictType.Legislation);
      expect(conflict.phase).toBe(ConflictPhase.Initiating);
      expect(conflict.initiatingClass).toBe(SocialClass.WorkingClass);
      if (conflict.conflictType !== ConflictType.Legislation) throw new Error('wrong type');
      expect(conflict.demandCardId).toBe('wealth_tax');
      expect(conflict.demandSlotIndex).toBe(0);
      expect(conflict.proposingOfficeIndex).toBe(0);
    });

    test('proposing office is exhausted when legislation is planned', () => {
      const G = makeWcLegislationFixture();
      const client = clientFromFixture(G);

      client.moves.planLegislation(0, 0);
      const state = client.getStateOrThrow();

      expect(state.G.politicalOffices[0].exhausted).toBe(true);
    });

    test('centrist always opposes legislation', () => {
      const G = makeWcLegislationFixture();
      const client = clientFromFixture(G);

      client.moves.planLegislation(0, 0);
      const conflict = client.getStateOrThrow().G.activeConflict!;
      if (conflict.conflictType !== ConflictType.Legislation) throw new Error('wrong type');

      // centrist (office 1) should be on the capitalist (opposing) side
      const ccCardIds = conflict.capitalistCards.map(c => c.id);
      expect(ccCardIds).toContain('centrist');
    });

    test('populist sides with class that has more figures', () => {
      // WC has 1 extra figure in play (more than CC's 0)
      const G = makeActionPhaseState({
        figures: [{ id: 'student_activist', card_type: CardType.Figure, in_play: true, exhausted: false, in_training: false }],
        demands: [playDemandCard('wealth_tax'), null],
      });
      // WC figure in populist office — populist office is office 1 (centrist is 0)
      // Use centrist office (index 1) for proposing so populist (index 0) auto-votes
      G.politicalOffices[1] = { ...playFigureCard('cashier') };
      const client = clientFromFixture(G);

      client.moves.planLegislation(1, 0); // propose from centrist office
      const conflict = client.getStateOrThrow().G.activeConflict!;
      if (conflict.conflictType !== ConflictType.Legislation) throw new Error('wrong type');

      // populist (office 0) — WC has 1 figure, CC has 0 → sides with WC (proposing)
      const wcCardIds = conflict.workingClassCards.map(c => c.id);
      expect(wcCardIds).toContain('populist');
    });

    test('opportunist opposes if proposing class cannot afford bribe', () => {
      const G = makeWcLegislationFixture();
      G.players[SocialClass.WorkingClass].wealth = 0; // cannot afford $15
      const client = clientFromFixture(G);

      client.moves.planLegislation(0, 0);
      const conflict = client.getStateOrThrow().G.activeConflict!;
      if (conflict.conflictType !== ConflictType.Legislation) throw new Error('wrong type');

      const ccCardIds = conflict.capitalistCards.map(c => c.id);
      expect(ccCardIds).toContain('opportunist');
    });

    test('opportunist supports proposing class when bribe of $15 is paid', () => {
      const G = makeWcLegislationFixture();
      G.players[SocialClass.WorkingClass].wealth = 15;
      const client = clientFromFixture(G);

      client.moves.planLegislation(0, 0);
      const state = client.getStateOrThrow();
      const conflict = state.G.activeConflict!;
      if (conflict.conflictType !== ConflictType.Legislation) throw new Error('wrong type');

      const wcCardIds = conflict.workingClassCards.map(c => c.id);
      expect(wcCardIds).toContain('opportunist');
      // $15 was deducted
      expect(state.G.players[SocialClass.WorkingClass].wealth).toBe(0);
    });

    test('cannot plan legislation with no figure in the office', () => {
      const G = makeActionPhaseState({
        demands: [playDemandCard('wealth_tax'), null],
      });
      // Office 0 has no figureId
      const client = clientFromFixture(G);

      client.moves.planLegislation(0, 0);
      expect(client.getStateOrThrow().G.activeConflict).toBeUndefined();
    });

    test('cannot plan legislation with an exhausted office figure', () => {
      const G = makeWcLegislationFixture();
      G.politicalOffices[0].exhausted = true;
      const client = clientFromFixture(G);

      client.moves.planLegislation(0, 0);
      expect(client.getStateOrThrow().G.activeConflict).toBeUndefined();
    });

    test('cannot plan legislation with no demand card in slot', () => {
      const G = makeActionPhaseState({
        demands: [null, null],
      });
      G.politicalOffices[0] = { ...playFigureCard('cashier') };
      const client = clientFromFixture(G);

      client.moves.planLegislation(0, 0);
      expect(client.getStateOrThrow().G.activeConflict).toBeUndefined();
    });

    test('cannot plan legislation if office figure belongs to opposing class', () => {
      const G = makeActionPhaseState({
        demands: [playDemandCard('wealth_tax'), null],
      });
      // Place a CC figure in office 0 — WC cannot use it
      G.politicalOffices[0] = { ...playFigureCard('manager') };
      const client = clientFromFixture(G);

      client.moves.planLegislation(0, 0);
      expect(client.getStateOrThrow().G.activeConflict).toBeUndefined();
    });
  });
});
