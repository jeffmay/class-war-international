/**
 * Component tests for CardComponent
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { figureCardById } from '../data/cards';
import { CardBorderVariant, CardComponent } from './CardComponent';

const cashierCard = figureCardById.cashier;

describe('CardComponent', () => {
  // --- borderVariant ---

  test('applies card-border-actionable class when borderVariant is "actionable"', () => {
    render(<CardComponent card={cashierCard} borderVariant="actionable" />);
    expect(screen.getByTestId('card-component')).toHaveClass('card-border-actionable');
  });

  test('applies card-border-cannot-use class when borderVariant is "cannot-use"', () => {
    render(<CardComponent card={cashierCard} borderVariant="cannot-use" />);
    expect(screen.getByTestId('card-component')).toHaveClass('card-border-cannot-use');
  });

  test('applies card-border-other class when borderVariant is "other"', () => {
    render(<CardComponent card={cashierCard} borderVariant="other" />);
    expect(screen.getByTestId('card-component')).toHaveClass('card-border-other');
  });

  test('applies card-border-wc class when borderVariant is "wc"', () => {
    render(<CardComponent card={cashierCard} borderVariant="wc" />);
    expect(screen.getByTestId('card-component')).toHaveClass('card-border-wc');
  });

  test('applies card-border-cc class when borderVariant is "cc"', () => {
    render(<CardComponent card={cashierCard} borderVariant="cc" />);
    expect(screen.getByTestId('card-component')).toHaveClass('card-border-cc');
  });

  test('does not apply any card-border-* class when borderVariant is omitted', () => {
    render(<CardComponent card={cashierCard} />);
    const el = screen.getByTestId('card-component');
    const borderVariants: CardBorderVariant[] = ['actionable', 'cannot-use', 'other', 'wc', 'cc'];
    borderVariants.forEach(v => {
      expect(el).not.toHaveClass(`card-border-${v}`);
    });
  });

  // --- statusBanner ---

  test('renders status banner when provided', () => {
    render(<CardComponent card={cashierCard} statusBanner={{ line1: 'In Training' }} />);
    expect(screen.getByText('In Training')).toBeInTheDocument();
  });

  test('renders banner line2 when provided', () => {
    render(<CardComponent card={cashierCard} statusBanner={{ line1: 'Exhausted', line2: '(until next turn)' }} />);
    expect(screen.getByText('(until next turn)')).toBeInTheDocument();
  });

  test('does not render banner when statusBanner is omitted', () => {
    render(<CardComponent card={cashierCard} />);
    expect(screen.queryByText('In Training')).not.toBeInTheDocument();
  });

  // --- extra className ---

  test('applies extra className to the card element', () => {
    render(<CardComponent card={cashierCard} className="card-theorize-selected" />);
    expect(screen.getByTestId('card-component')).toHaveClass('card-theorize-selected');
  });
});
