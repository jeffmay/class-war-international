/**
 * E2E tests for conflict step card tracking: addFigureToConflict, addTacticToConflict,
 * removeCardFromConflict, and the Resolving phase card addition.
 *
 * Verifies:
 * - addedThisStep flag is set when cards are added
 * - Removing a figure returns it to player.figures
 * - Removing a tactic returns it to hand and refunds wealth
 * - addedThisStep is cleared after initiateConflict / planResponse
 * - Initiating class can add cards during Resolving phase
 */

import { SocialClass } from '../types/cards';
import { ConflictPhase, ConflictType } from '../types/conflicts';
import { playFigureCard } from '../util/game';
import { clientFromFixture, makeActionPhaseState, makePlayerState, withCardInHand } from './generate';
import { buildDeck } from '../data/cards';

const readyCashier = playFigureCard('cashier', { in_training: false });
const readyCleaningCrew = playFigureCard('cleaning_crew', { in_training: false });

// union_drive: WC tactic, cost $4, enabled for Strike conflicts only
const wcTacticId = 'union_drive';
const wcTacticCost = 4;

describe('Conflict Step Card Tracking', () => {
  describe('addFigureToConflict', () => {
    test('adds figure with addedThisStep=true and removes from player figures', () => {
      const G = makeActionPhaseState({ figures: [readyCashier, readyCleaningCrew] });
      const client = clientFromFixture(G);

      client.moves.planStrike('cashier', 0);
      // conflict is now Initiating, cashier is strike leader (not addedThisStep)
      client.moves.addFigureToConflict('cleaning_crew');

      const state = client.getStateOrThrow();
      const conflict = state.G.activeConflict!;
      expect(conflict.workingClassCards).toHaveLength(2);

      // cleaning_crew was added this step
      const addedCard = conflict.workingClassCards.find(c => c.id === 'cleaning_crew');
      expect(addedCard?.addedThisStep).toBe(true);

      // cashier (strike leader) was NOT added via addFigureToConflict — no addedThisStep
      const leaderCard = conflict.workingClassCards.find(c => c.id === 'cashier');
      expect(leaderCard?.addedThisStep).toBeFalsy();

      // cleaning_crew removed from player figures
      expect(state.G.players[SocialClass.WorkingClass].figures).toHaveLength(0);
    });

    test('allows adding figures during Resolving phase', () => {
      const G = makeActionPhaseState({ figures: [readyCashier, readyCleaningCrew] });
      const client = clientFromFixture(G);

      // WC plans and initiates
      client.moves.planStrike('cashier', 0);
      client.moves.initiateConflict();
      // CC responds (no cards)
      client.moves.planResponse();
      // Now in Resolving — WC's turn again

      const beforeState = client.getStateOrThrow();
      expect(beforeState.G.activeConflict?.phase).toBe(ConflictPhase.Resolving);
      expect(beforeState.G.players[SocialClass.WorkingClass].figures).toHaveLength(1); // cleaning_crew still there

      client.moves.addFigureToConflict('cleaning_crew');

      const state = client.getStateOrThrow();
      const conflict = state.G.activeConflict!;
      expect(conflict.workingClassCards).toHaveLength(2);
      expect(conflict.workingClassCards.find(c => c.id === 'cleaning_crew')?.addedThisStep).toBe(true);
    });
  });

  describe('removeCardFromConflict', () => {
    test('removing a figure returns it to player.figures', () => {
      const G = makeActionPhaseState({ figures: [readyCashier, readyCleaningCrew] });
      const client = clientFromFixture(G);

      client.moves.planStrike('cashier', 0);
      client.moves.addFigureToConflict('cleaning_crew');

      // cleaning_crew is at index 1 in workingClassCards (cashier is at 0)
      const beforeState = client.getStateOrThrow();
      const cleaningCrewIndex = beforeState.G.activeConflict!.workingClassCards
        .findIndex(c => c.id === 'cleaning_crew');
      expect(cleaningCrewIndex).toBe(1);

      client.moves.removeCardFromConflict(cleaningCrewIndex, SocialClass.WorkingClass);

      const state = client.getStateOrThrow();
      expect(state.G.activeConflict?.workingClassCards).toHaveLength(1);
      expect(state.G.players[SocialClass.WorkingClass].figures).toHaveLength(1);
      expect(state.G.players[SocialClass.WorkingClass].figures[0].id).toBe('cleaning_crew');
    });

    test('cannot remove a card that was not addedThisStep', () => {
      const G = makeActionPhaseState({ figures: [readyCashier] });
      const client = clientFromFixture(G);

      client.moves.planStrike('cashier', 0);
      // cashier (index 0) was NOT added via addFigureToConflict — addedThisStep is falsy
      client.moves.removeCardFromConflict(0, SocialClass.WorkingClass);

      const state = client.getStateOrThrow();
      // Strike leader still in conflict; figure not returned
      expect(state.G.activeConflict?.workingClassCards).toHaveLength(1);
      expect(state.G.players[SocialClass.WorkingClass].figures).toHaveLength(0);
    });
  });

  describe('addTacticToConflict and removeCardFromConflict', () => {
    test('adding a tactic deducts wealth; removing it refunds wealth and returns to hand', () => {
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardInHand(wcDeck, wcTacticId);
      const G = makeActionPhaseState({
        figures: [readyCashier],
        hand,
        deck,
        wealth: 20,
      });
      const client = clientFromFixture(G);

      client.moves.planStrike('cashier', 0);

      // Find tactic in hand
      const beforeState = client.getStateOrThrow();
      const handIndex = beforeState.G.players[SocialClass.WorkingClass].hand.indexOf(wcTacticId);
      expect(handIndex).toBeGreaterThanOrEqual(0);

      client.moves.addTacticToConflict(handIndex);

      const afterAdd = client.getStateOrThrow();
      expect(afterAdd.G.players[SocialClass.WorkingClass].wealth).toBe(20 - wcTacticCost);
      expect(afterAdd.G.players[SocialClass.WorkingClass].hand).not.toContain(wcTacticId);

      const conflict = afterAdd.G.activeConflict!;
      const tacticIndex = conflict.workingClassCards.findIndex(c => c.id === wcTacticId);
      expect(tacticIndex).toBeGreaterThanOrEqual(0);
      expect(conflict.workingClassCards[tacticIndex].addedThisStep).toBe(true);

      // Remove the tactic
      client.moves.removeCardFromConflict(tacticIndex, SocialClass.WorkingClass);

      const afterRemove = client.getStateOrThrow();
      // Wealth refunded
      expect(afterRemove.G.players[SocialClass.WorkingClass].wealth).toBe(20);
      // Tactic back in hand
      expect(afterRemove.G.players[SocialClass.WorkingClass].hand).toContain(wcTacticId);
      // Gone from conflict
      expect(afterRemove.G.activeConflict?.workingClassCards.find(c => c.id === wcTacticId)).toBeUndefined();
    });
  });

  describe('addedThisStep cleared on phase transitions', () => {
    test('initiateConflict clears addedThisStep on all cards', () => {
      const G = makeActionPhaseState({ figures: [readyCashier, readyCleaningCrew] });
      const client = clientFromFixture(G);

      client.moves.planStrike('cashier', 0);
      client.moves.addFigureToConflict('cleaning_crew');

      // Verify addedThisStep is set before initiating
      const beforeInitiate = client.getStateOrThrow();
      expect(beforeInitiate.G.activeConflict?.workingClassCards.some(c => c.addedThisStep)).toBe(true);

      client.moves.initiateConflict();

      const afterInitiate = client.getStateOrThrow();
      const conflict = afterInitiate.G.activeConflict!;
      expect(conflict.phase).toBe(ConflictPhase.Responding);
      // All cards are now committed — none addedThisStep
      expect(conflict.workingClassCards.every(c => !c.addedThisStep)).toBe(true);
    });

    test('planResponse clears addedThisStep on all cards', () => {
      const ccDeck = buildDeck(SocialClass.CapitalistClass);
      const { hand, deck } = withCardInHand(ccDeck, 'hire_scabs');

      const ccPlayer = makePlayerState(SocialClass.CapitalistClass, {
        hand,
        deck,
        wealth: 20,
        figures: [playFigureCard('manager', { in_training: false })],
      });

      const G = makeActionPhaseState(
        { figures: [readyCashier] },
        { hand: ccPlayer.hand, deck: ccPlayer.deck, wealth: 20, figures: ccPlayer.figures },
      );
      const client = clientFromFixture(G);

      client.moves.planStrike('cashier', 0);
      client.moves.initiateConflict();
      // Now CC's turn (Responding)
      client.moves.addFigureToConflict('manager');

      const beforePlan = client.getStateOrThrow();
      expect(beforePlan.G.activeConflict?.capitalistCards.some(c => c.addedThisStep)).toBe(true);

      client.moves.planResponse();

      const afterPlan = client.getStateOrThrow();
      const conflict = afterPlan.G.activeConflict!;
      expect(conflict.phase).toBe(ConflictPhase.Resolving);
      expect(conflict.capitalistCards.every(c => !c.addedThisStep)).toBe(true);
    });
  });

  describe('conflict type verification', () => {
    test('tactic conflictType must match — strike tactic rejected in election', () => {
      const wcDeck = buildDeck(SocialClass.WorkingClass);
      const { hand, deck } = withCardInHand(wcDeck, wcTacticId);
      const G = makeActionPhaseState({
        figures: [readyCashier],
        hand,
        deck,
        wealth: 20,
      });
      const client = clientFromFixture(G);

      // Plan election instead of strike
      client.moves.planElection('cashier', 0);

      const state = client.getStateOrThrow();
      expect(state.G.activeConflict?.conflictType).toBe(ConflictType.Election);

      const handIndex = state.G.players[SocialClass.WorkingClass].hand.indexOf(wcTacticId);
      // canvass is Strike-only — should not add to election
      client.moves.addTacticToConflict(handIndex);

      const afterAttempt = client.getStateOrThrow();
      // Tactic still in hand; wealth unchanged
      expect(afterAttempt.G.players[SocialClass.WorkingClass].hand).toContain(wcTacticId);
      expect(afterAttempt.G.players[SocialClass.WorkingClass].wealth).toBe(20);
    });
  });
});
