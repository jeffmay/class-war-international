/**
 * Component tests for ActionMenuBar
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { figureCardById } from '../data/cards';
import { SocialClass } from '../types/cards';
import { ActionMenuBar } from './ActionMenuBar';

const cashierCard = figureCardById.cashier;

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

  // --- Title ---

  test('renders title when provided', () => {
    render(<ActionMenuBar {...baseProps} title="Choose a target" />);
    expect(screen.getByText('Choose a target')).toBeInTheDocument();
  });

  test('does not render title when omitted', () => {
    render(<ActionMenuBar {...baseProps} />);
    expect(screen.queryByText('Choose a target')).not.toBeInTheDocument();
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

  // --- Preview content ---

  test('renders preview content above button when provided as 3rd tuple element', () => {
    const preview = <span data-testid="target-preview">Corner Store</span>;
    render(<ActionMenuBar {...baseProps} options={[['Strike Here', jest.fn(), preview]]} />);
    expect(screen.getByTestId('target-preview')).toBeInTheDocument();
    // Preview appears before the button in the DOM
    const previewEl = screen.getByTestId('target-preview');
    const button = screen.getByText('Strike Here');
    expect(previewEl.compareDocumentPosition(button)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  test('does not render preview wrapper when 3rd tuple element is omitted', () => {
    render(<ActionMenuBar {...baseProps} options={[['No Preview', jest.fn()]]} />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    // Just the button should be there
    expect(screen.getByText('No Preview')).toBeInTheDocument();
  });

  // --- Card display ---

  test('renders card component when card is provided', () => {
    render(<ActionMenuBar {...baseProps} card={cashierCard} />);
    expect(screen.getByText('Cashier')).toBeInTheDocument();
  });

  test('does not render card display when no card is provided', () => {
    render(<ActionMenuBar {...baseProps} />);
    expect(screen.queryByText('Cashier')).not.toBeInTheDocument();
  });

  // --- Navigation buttons ---

  test('renders prev/next buttons when onPrev and onNext are provided', () => {
    render(<ActionMenuBar {...baseProps} onPrev={jest.fn()} onNext={jest.fn()} />);
    expect(screen.getByLabelText('Previous card')).toBeInTheDocument();
    expect(screen.getByLabelText('Next card')).toBeInTheDocument();
  });

  test('renders nav buttons when only onPrev is provided', () => {
    render(<ActionMenuBar {...baseProps} onPrev={jest.fn()} />);
    expect(screen.getByLabelText('Previous card')).toBeInTheDocument();
    expect(screen.getByLabelText('Next card')).toBeInTheDocument();
  });

  test('prev button is enabled when onPrev is provided', () => {
    render(<ActionMenuBar {...baseProps} onPrev={jest.fn()} onNext={jest.fn()} />);
    expect(screen.getByLabelText('Previous card')).not.toBeDisabled();
  });

  test('next button is disabled when onNext is undefined', () => {
    render(<ActionMenuBar {...baseProps} onPrev={jest.fn()} onNext={undefined} />);
    expect(screen.getByLabelText('Next card')).toBeDisabled();
  });

  test('calls onPrev when prev button is clicked', () => {
    const onPrev = jest.fn();
    render(<ActionMenuBar {...baseProps} onPrev={onPrev} onNext={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Previous card'));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  test('calls onNext when next button is clicked', () => {
    const onNext = jest.fn();
    render(<ActionMenuBar {...baseProps} onPrev={jest.fn()} onNext={onNext} />);
    fireEvent.click(screen.getByLabelText('Next card'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  test('does not render nav buttons when neither onPrev nor onNext are provided', () => {
    render(<ActionMenuBar {...baseProps} />);
    expect(screen.queryByLabelText('Previous card')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Next card')).not.toBeInTheDocument();
  });

  test('nav buttons and card are all inside the card area when both card and nav props are provided', () => {
    render(<ActionMenuBar {...baseProps} card={cashierCard} onPrev={jest.fn()} onNext={jest.fn()} />);
    const cardArea = screen.getByTestId('menu-bar-card-area');
    // Both nav buttons and the card are contained in the flanking area
    expect(within(cardArea).getByLabelText('Previous card')).toBeInTheDocument();
    expect(within(cardArea).getByLabelText('Next card')).toBeInTheDocument();
    expect(within(cardArea).getByText('Cashier')).toBeInTheDocument();
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
