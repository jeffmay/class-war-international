/**
 * Component tests for DealResultModal
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { allFigureCards } from '../data/cards';
import { DealResultModal } from './DealResultModal';

const cashierCard = allFigureCards.cashier;
const activistCard = allFigureCards.activist;

describe('DealResultModal', () => {
  const baseProps = {
    theorizedCards: [],
    newCards: [],
    onEndTurn: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  // --- Structure ---

  test('renders as a dialog region', () => {
    render(<DealResultModal {...baseProps} />);
    expect(screen.getByRole('dialog', { name: 'Deal result' })).toBeInTheDocument();
  });

  test('renders close button in upper-left', () => {
    render(<DealResultModal {...baseProps} />);
    expect(screen.getByLabelText('Close deal result')).toBeInTheDocument();
  });

  test('renders End Turn button', () => {
    render(<DealResultModal {...baseProps} />);
    expect(screen.getByText(/End Turn/)).toBeInTheDocument();
  });

  // --- Theorized cards ---

  test('shows "Sent to Dustbin" section title when cards are theorized', () => {
    render(<DealResultModal {...baseProps} theorizedCards={[cashierCard]} />);
    expect(screen.getByText('Sent to Dustbin')).toBeInTheDocument();
  });

  test('shows "No Cards Theorized" when theorized list is empty', () => {
    render(<DealResultModal {...baseProps} />);
    expect(screen.getByText('No Cards Theorized')).toBeInTheDocument();
  });

  test('shows empty message when theorized list is empty', () => {
    render(<DealResultModal {...baseProps} />);
    expect(screen.getByText('Theorizing skipped')).toBeInTheDocument();
  });

  test('renders theorized card names', () => {
    render(<DealResultModal {...baseProps} theorizedCards={[cashierCard, activistCard]} />);
    expect(screen.getByText(cashierCard.name)).toBeInTheDocument();
    expect(screen.getByText(activistCard.name)).toBeInTheDocument();
  });

  // --- New cards ---

  test('shows "Cards Drawn" section title when new cards exist', () => {
    render(<DealResultModal {...baseProps} newCards={[cashierCard]} />);
    expect(screen.getByText('Cards Drawn')).toBeInTheDocument();
  });

  test('shows "No Cards Drawn" when new cards list is empty', () => {
    render(<DealResultModal {...baseProps} />);
    expect(screen.getByText('No Cards Drawn')).toBeInTheDocument();
  });

  test('renders new card names', () => {
    render(<DealResultModal {...baseProps} newCards={[activistCard]} />);
    expect(screen.getByText(activistCard.name)).toBeInTheDocument();
  });

  // --- Interactions ---

  test('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<DealResultModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close deal result'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('calls onEndTurn when End Turn button is clicked', () => {
    const onEndTurn = jest.fn();
    render(<DealResultModal {...baseProps} onEndTurn={onEndTurn} />);
    fireEvent.click(screen.getByText(/End Turn/));
    expect(onEndTurn).toHaveBeenCalledTimes(1);
  });
});
