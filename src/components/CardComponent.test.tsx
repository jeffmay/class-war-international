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

  test('applies card-border-hand class when borderVariant is "hand"', () => {
    render(<CardComponent card={cashierCard} borderVariant="hand" />);
    expect(screen.getByTestId('card-component')).toHaveClass('card-border-hand');
  });

  test('applies card-border-in-play class when borderVariant is "in-play"', () => {
    render(<CardComponent card={cashierCard} borderVariant="in-play" />);
    expect(screen.getByTestId('card-component')).toHaveClass('card-border-in-play');
  });

  test('applies card-border-training class when borderVariant is "training"', () => {
    render(<CardComponent card={cashierCard} borderVariant="training" />);
    expect(screen.getByTestId('card-component')).toHaveClass('card-border-training');
  });

  test('applies card-border-exhausted class when borderVariant is "exhausted"', () => {
    render(<CardComponent card={cashierCard} borderVariant="exhausted" />);
    expect(screen.getByTestId('card-component')).toHaveClass('card-border-exhausted');
  });

  test('applies card-border-other class when borderVariant is "other"', () => {
    render(<CardComponent card={cashierCard} borderVariant="other" />);
    expect(screen.getByTestId('card-component')).toHaveClass('card-border-other');
  });

  test('does not apply any card-border-* class when borderVariant is omitted', () => {
    render(<CardComponent card={cashierCard} />);
    const el = screen.getByTestId('card-component');
    const borderVariants: CardBorderVariant[] = ['hand', 'in-play', 'training', 'exhausted', 'other'];
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
