/**
 * Component tests for ActionMenuBar
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ActionMenuBar } from './ActionMenuBar';
import { getCardData } from '../data/cards';
import { SocialClass } from '../types/cards';

const cashierCard = getCardData('cashier');

describe('ActionMenuBar', () => {
  const baseProps = {
    playerClass: SocialClass.WorkingClass,
    options: [] as Array<[string, (() => void) | undefined]>,
  };

  beforeEach(() => jest.clearAllMocks());

  // --- Basic rendering ---

  test('renders without a card', () => {
    render(<ActionMenuBar {...baseProps} />);
    expect(screen.getByRole('region', { name: 'Action menu' })).toBeInTheDocument();
  });

  test('renders close button when onClose is provided', () => {
    render(<ActionMenuBar {...baseProps} onClose={jest.fn()} />);
    expect(screen.getByLabelText('Close action menu')).toBeInTheDocument();
  });

  test('does not render close button when onClose is omitted', () => {
    render(<ActionMenuBar {...baseProps} />);
    expect(screen.queryByLabelText('Close action menu')).not.toBeInTheDocument();
  });

  test('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<ActionMenuBar {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close action menu'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // --- Options rendering ---

  test('renders an enabled option', () => {
    const handler = jest.fn();
    render(<ActionMenuBar {...baseProps} options={[['Train ($5)', handler]]} />);
    expect(screen.getByText('Train ($5)')).not.toBeDisabled();
  });

  test('enabled option calls handler when clicked', () => {
    const handler = jest.fn();
    render(<ActionMenuBar {...baseProps} options={[['Do Something', handler]]} />);
    fireEvent.click(screen.getByText('Do Something'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('renders a disabled option when handler is undefined', () => {
    render(<ActionMenuBar {...baseProps} options={[['Cannot Do', undefined]]} />);
    expect(screen.getByText('Cannot Do')).toBeDisabled();
  });

  test('renders multiple options', () => {
    render(
      <ActionMenuBar
        {...baseProps}
        options={[
          ['Lead Strike', jest.fn()],
          ['Run for Office', jest.fn()],
        ]}
      />,
    );
    expect(screen.getByText('Lead Strike')).toBeInTheDocument();
    expect(screen.getByText('Run for Office')).toBeInTheDocument();
  });

  test('renders no option buttons when options is empty', () => {
    render(<ActionMenuBar {...baseProps} />);
    expect(screen.queryByRole('button', { name: /./i })).not.toBeInTheDocument();
  });

  // --- Card display ---

  test('renders card component when card is provided', () => {
    render(<ActionMenuBar {...baseProps} card={cashierCard} />);
    // CardComponent renders the card name inside it
    expect(screen.getByText('Cashier')).toBeInTheDocument();
  });

  test('does not render card display when no card is provided', () => {
    render(<ActionMenuBar {...baseProps} />);
    expect(screen.queryByText('Cashier')).not.toBeInTheDocument();
  });

  // --- Class modifier ---

  test('uses working-class modifier for WorkingClass player', () => {
    render(<ActionMenuBar {...baseProps} playerClass={SocialClass.WorkingClass} />);
    expect(screen.getByRole('region', { name: 'Action menu' })).toHaveClass('menu-bar-working');
  });

  test('uses capitalist modifier for CapitalistClass player', () => {
    render(<ActionMenuBar {...baseProps} playerClass={SocialClass.CapitalistClass} />);
    expect(screen.getByRole('region', { name: 'Action menu' })).toHaveClass('menu-bar-capitalist');
  });
});
