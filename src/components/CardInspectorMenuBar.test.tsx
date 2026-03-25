/**
 * Component tests for CardInspectorMenuBar
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CardInspectorMenuBar } from './CardInspectorMenuBar';
import { getCardData } from '../data/cards';
import { SocialClass } from '../types/cards';
import { TurnPhase } from '../types/game';

const cashierCard = getCardData('cashier');

describe('CardInspectorMenuBar', () => {
  const defaultProps = {
    card: cashierCard,
    playerClass: SocialClass.WorkingClass,
    turnPhase: TurnPhase.Action,
    playerWealth: 10,
    isMyTurn: true,
    cardLocation: 'hand' as const,
    onClose: jest.fn(),
    onPlayFigure: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders card name in the menu bar header', () => {
    render(<CardInspectorMenuBar {...defaultProps} />);
    expect(screen.getByText('Cashier', { selector: '.menu-bar-title' })).toBeInTheDocument();
  });

  test('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<CardInspectorMenuBar {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close card inspector'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('shows "Play Figure" button when card is a figure in hand during action phase on my turn', () => {
    render(<CardInspectorMenuBar {...defaultProps} />);
    expect(screen.getByText(`Play Figure ($${cashierCard.cost})`)).toBeInTheDocument();
  });

  test('"Play Figure" button is enabled when player can afford the card', () => {
    render(<CardInspectorMenuBar {...defaultProps} playerWealth={cashierCard.cost} />);
    expect(screen.getByText(`Play Figure ($${cashierCard.cost})`)).not.toBeDisabled();
  });

  test('"Play Figure" button is disabled when player cannot afford the card', () => {
    render(<CardInspectorMenuBar {...defaultProps} playerWealth={cashierCard.cost - 1} />);
    expect(screen.getByText(`Play Figure ($${cashierCard.cost})`)).toBeDisabled();
  });

  test('calls onPlayFigure with card id when "Play Figure" is clicked', () => {
    const onPlayFigure = jest.fn();
    render(<CardInspectorMenuBar {...defaultProps} onPlayFigure={onPlayFigure} />);
    fireEvent.click(screen.getByText(`Play Figure ($${cashierCard.cost})`));
    expect(onPlayFigure).toHaveBeenCalledWith(cashierCard.id);
  });

  test('does not show "Play Figure" button outside Action phase', () => {
    render(<CardInspectorMenuBar {...defaultProps} turnPhase={TurnPhase.Production} />);
    expect(screen.queryByText(`Play Figure ($${cashierCard.cost})`)).not.toBeInTheDocument();
  });

  test('does not show "Play Figure" button when it is not my turn', () => {
    render(<CardInspectorMenuBar {...defaultProps} isMyTurn={false} />);
    expect(screen.queryByText(`Play Figure ($${cashierCard.cost})`)).not.toBeInTheDocument();
  });

  test('does not show "Play Figure" button when card is in figures (not hand)', () => {
    render(<CardInspectorMenuBar {...defaultProps} cardLocation="figures" />);
    expect(screen.queryByText(`Play Figure ($${cashierCard.cost})`)).not.toBeInTheDocument();
  });

  test('uses working-class modifier class for WorkingClass player', () => {
    render(<CardInspectorMenuBar {...defaultProps} playerClass={SocialClass.WorkingClass} />);
    expect(screen.getByRole('region', { name: 'Card inspector' })).toHaveClass('menu-bar-working');
  });

  test('uses capitalist modifier class for CapitalistClass player', () => {
    render(<CardInspectorMenuBar {...defaultProps} playerClass={SocialClass.CapitalistClass} />);
    expect(screen.getByRole('region', { name: 'Card inspector' })).toHaveClass(
      'menu-bar-capitalist',
    );
  });

  test('does not show action buttons for a non-figure card', () => {
    // Use a demand card (cost 0, CardType.Demand)
    const demandCard = getCardData('wealth_tax');
    render(
      <CardInspectorMenuBar
        {...defaultProps}
        card={demandCard}
        playerClass={demandCard.social_class}
      />,
    );
    expect(screen.queryByRole('button', { name: /Play/i })).not.toBeInTheDocument();
  });
});
