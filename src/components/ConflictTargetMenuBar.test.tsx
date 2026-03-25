/**
 * Component tests for ConflictTargetMenuBar
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConflictTargetMenuBar } from './ConflictTargetMenuBar';
import { SocialClass } from '../types/cards';
import { ConflictType } from '../types/conflicts';
import { setup } from '../game/ClassWarGame';

const { workplaces, politicalOffices } = setup({});

describe('ConflictTargetMenuBar', () => {
  describe('Strike target selection', () => {
    const defaultProps = {
      conflictType: ConflictType.Strike as const,
      figureName: 'Cashier',
      playerClass: SocialClass.WorkingClass,
      workplaces,
      onSelectTarget: jest.fn(),
      onCancel: jest.fn(),
    };

    beforeEach(() => jest.clearAllMocks());

    test('renders strike target prompt with figure name', () => {
      render(<ConflictTargetMenuBar {...defaultProps} />);
      expect(screen.getByText(/Choose a workplace for Cashier to strike/i)).toBeInTheDocument();
    });

    test('renders a button for each workplace', () => {
      render(<ConflictTargetMenuBar {...defaultProps} />);
      const buttons = screen.getAllByRole('button', { name: /corner store|parts producer|empty slot/i });
      expect(buttons).toHaveLength(workplaces.length);
    });

    test('empty workplace slot button is disabled', () => {
      render(<ConflictTargetMenuBar {...defaultProps} />);
      expect(screen.getByRole('button', { name: /empty slot/i })).toBeDisabled();
    });

    test('non-empty workplace buttons are enabled', () => {
      render(<ConflictTargetMenuBar {...defaultProps} />);
      expect(screen.getByRole('button', { name: /corner store/i })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: /parts producer/i })).not.toBeDisabled();
    });

    test('calls onSelectTarget with correct index when workplace is clicked', () => {
      const onSelectTarget = jest.fn();
      render(<ConflictTargetMenuBar {...defaultProps} onSelectTarget={onSelectTarget} />);
      fireEvent.click(screen.getByRole('button', { name: /corner store/i }));
      expect(onSelectTarget).toHaveBeenCalledWith(0);
    });

    test('calls onCancel when close button is clicked', () => {
      const onCancel = jest.fn();
      render(<ConflictTargetMenuBar {...defaultProps} onCancel={onCancel} />);
      fireEvent.click(screen.getByLabelText('Cancel conflict'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    test('uses working-class modifier for WorkingClass player', () => {
      render(<ConflictTargetMenuBar {...defaultProps} playerClass={SocialClass.WorkingClass} />);
      expect(screen.getByRole('region', { name: 'Conflict target selector' })).toHaveClass(
        'menu-bar-working',
      );
    });
  });

  describe('Election target selection', () => {
    const defaultProps = {
      conflictType: ConflictType.Election as const,
      figureName: 'Manager',
      playerClass: SocialClass.CapitalistClass,
      politicalOffices,
      onSelectTarget: jest.fn(),
      onCancel: jest.fn(),
    };

    beforeEach(() => jest.clearAllMocks());

    test('renders election target prompt with figure name', () => {
      render(<ConflictTargetMenuBar {...defaultProps} />);
      expect(screen.getByText(/Choose an office for Manager to run for/i)).toBeInTheDocument();
    });

    test('renders a button for each political office', () => {
      render(<ConflictTargetMenuBar {...defaultProps} />);
      expect(screen.getByRole('button', { name: /The Populist/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /The Centrist/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /The Opportunist/i })).toBeInTheDocument();
    });

    test('calls onSelectTarget with correct index when office is clicked', () => {
      const onSelectTarget = jest.fn();
      render(<ConflictTargetMenuBar {...defaultProps} onSelectTarget={onSelectTarget} />);
      // politicalOffices[0] is 'populist'
      fireEvent.click(screen.getByRole('button', { name: /The Populist/i }));
      expect(onSelectTarget).toHaveBeenCalledWith(0);
    });

    test('uses capitalist modifier for CapitalistClass player', () => {
      render(<ConflictTargetMenuBar {...defaultProps} playerClass={SocialClass.CapitalistClass} />);
      expect(screen.getByRole('region', { name: 'Conflict target selector' })).toHaveClass(
        'menu-bar-capitalist',
      );
    });
  });
});
