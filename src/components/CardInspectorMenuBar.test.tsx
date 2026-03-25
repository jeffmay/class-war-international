/**
 * Component tests for CardInspectorMenuBar
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CardInspectorMenuBar } from './CardInspectorMenuBar';
import { getCardData } from '../data/cards';
import { CardType, SocialClass, type FigureCardInPlay } from '../types/cards';
import { TurnPhase } from '../types/game';

const cashierCard = getCardData('cashier');

const readyFigureInPlay: FigureCardInPlay = {
  id: 'cashier',
  card_type: CardType.Figure,
  exhausted: false,
  in_training: false,
};

const exhaustedFigureInPlay: FigureCardInPlay = {
  id: 'cashier',
  card_type: CardType.Figure,
  exhausted: true,
  in_training: false,
};

const inTrainingFigureInPlay: FigureCardInPlay = {
  id: 'cashier',
  card_type: CardType.Figure,
  exhausted: false,
  in_training: true,
};

describe('CardInspectorMenuBar', () => {
  const defaultHandProps = {
    card: cashierCard,
    playerClass: SocialClass.WorkingClass,
    turnPhase: TurnPhase.Action,
    playerWealth: 10,
    isMyTurn: true,
    cardLocation: 'hand' as const,
    onClose: jest.fn(),
    onTrainFigure: jest.fn(),
  };

  const defaultFiguresProps = {
    card: cashierCard,
    playerClass: SocialClass.WorkingClass,
    turnPhase: TurnPhase.Action,
    playerWealth: 10,
    isMyTurn: true,
    cardLocation: 'figures' as const,
    figureInPlay: readyFigureInPlay,
    onClose: jest.fn(),
    onLeadStrike: jest.fn(),
    onRunForOffice: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  // --- Header ---

  test('renders card name in the menu bar header', () => {
    render(<CardInspectorMenuBar {...defaultHandProps} />);
    expect(screen.getByText('Cashier', { selector: '.menu-bar-title' })).toBeInTheDocument();
  });

  test('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<CardInspectorMenuBar {...defaultHandProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close card inspector'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // --- Train (figure in hand) ---

  test('shows "Train" button when figure is in hand during action phase on my turn', () => {
    render(<CardInspectorMenuBar {...defaultHandProps} />);
    expect(screen.getByText(`Train ($${cashierCard.cost})`)).toBeInTheDocument();
  });

  test('"Train" button is enabled when player can afford the card', () => {
    render(<CardInspectorMenuBar {...defaultHandProps} playerWealth={cashierCard.cost} />);
    expect(screen.getByText(`Train ($${cashierCard.cost})`)).not.toBeDisabled();
  });

  test('"Train" button is disabled when player cannot afford the card', () => {
    render(<CardInspectorMenuBar {...defaultHandProps} playerWealth={cashierCard.cost - 1} />);
    expect(screen.getByText(`Train ($${cashierCard.cost})`)).toBeDisabled();
  });

  test('calls onTrainFigure with card id when "Train" is clicked', () => {
    const onTrainFigure = jest.fn();
    render(<CardInspectorMenuBar {...defaultHandProps} onTrainFigure={onTrainFigure} />);
    fireEvent.click(screen.getByText(`Train ($${cashierCard.cost})`));
    expect(onTrainFigure).toHaveBeenCalledWith(cashierCard.id);
  });

  test('does not show "Train" button outside Action phase', () => {
    render(<CardInspectorMenuBar {...defaultHandProps} turnPhase={TurnPhase.Production} />);
    expect(screen.queryByText(`Train ($${cashierCard.cost})`)).not.toBeInTheDocument();
  });

  test('does not show "Train" button when it is not my turn', () => {
    render(<CardInspectorMenuBar {...defaultHandProps} isMyTurn={false} />);
    expect(screen.queryByText(`Train ($${cashierCard.cost})`)).not.toBeInTheDocument();
  });

  // --- Figures in play ---

  test('shows "Lead Strike" and "Run for Office" for a ready WC figure in play', () => {
    render(<CardInspectorMenuBar {...defaultFiguresProps} />);
    expect(screen.getByText('Lead Strike')).toBeInTheDocument();
    expect(screen.getByText('Run for Office')).toBeInTheDocument();
  });

  test('shows only "Run for Office" (no "Lead Strike") for a ready CC figure in play', () => {
    const ccCard = getCardData('manager');
    render(
      <CardInspectorMenuBar
        {...defaultFiguresProps}
        card={ccCard}
        playerClass={SocialClass.CapitalistClass}
        figureInPlay={{ ...readyFigureInPlay, id: 'manager' }}
      />,
    );
    expect(screen.queryByText('Lead Strike')).not.toBeInTheDocument();
    expect(screen.getByText('Run for Office')).toBeInTheDocument();
  });

  test('calls onLeadStrike when "Lead Strike" is clicked', () => {
    const onLeadStrike = jest.fn();
    render(<CardInspectorMenuBar {...defaultFiguresProps} onLeadStrike={onLeadStrike} />);
    fireEvent.click(screen.getByText('Lead Strike'));
    expect(onLeadStrike).toHaveBeenCalledTimes(1);
  });

  test('calls onRunForOffice when "Run for Office" is clicked', () => {
    const onRunForOffice = jest.fn();
    render(<CardInspectorMenuBar {...defaultFiguresProps} onRunForOffice={onRunForOffice} />);
    fireEvent.click(screen.getByText('Run for Office'));
    expect(onRunForOffice).toHaveBeenCalledTimes(1);
  });

  test('shows "Figure is exhausted" (disabled) for an exhausted figure', () => {
    render(<CardInspectorMenuBar {...defaultFiguresProps} figureInPlay={exhaustedFigureInPlay} />);
    expect(screen.getByText('Figure is exhausted')).toBeDisabled();
    expect(screen.queryByText('Lead Strike')).not.toBeInTheDocument();
  });

  test('shows "Figure is in training" (disabled) for a figure in training', () => {
    render(<CardInspectorMenuBar {...defaultFiguresProps} figureInPlay={inTrainingFigureInPlay} />);
    expect(screen.getByText('Figure is in training')).toBeDisabled();
    expect(screen.queryByText('Lead Strike')).not.toBeInTheDocument();
  });

  test('does not show conflict actions when it is not my turn', () => {
    render(<CardInspectorMenuBar {...defaultFiguresProps} isMyTurn={false} />);
    expect(screen.queryByText('Lead Strike')).not.toBeInTheDocument();
    expect(screen.queryByText('Run for Office')).not.toBeInTheDocument();
  });

  // --- Non-figure card ---

  test('does not show action buttons for a non-figure card', () => {
    const demandCard = getCardData('wealth_tax');
    render(
      <CardInspectorMenuBar
        {...defaultHandProps}
        card={demandCard}
        playerClass={demandCard.social_class}
      />,
    );
    expect(screen.queryByRole('button', { name: /Train|Strike|Office/i })).not.toBeInTheDocument();
  });

  // --- Class modifier ---

  test('uses working-class modifier class for WorkingClass player', () => {
    render(<CardInspectorMenuBar {...defaultHandProps} playerClass={SocialClass.WorkingClass} />);
    expect(screen.getByRole('region', { name: 'Card inspector' })).toHaveClass('menu-bar-working');
  });

  test('uses capitalist modifier class for CapitalistClass player', () => {
    render(
      <CardInspectorMenuBar {...defaultHandProps} playerClass={SocialClass.CapitalistClass} />,
    );
    expect(screen.getByRole('region', { name: 'Card inspector' })).toHaveClass(
      'menu-bar-capitalist',
    );
  });
});
