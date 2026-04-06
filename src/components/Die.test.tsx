/**
 * Component tests for Die
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { SocialClass } from "../types/cards";
import { Die } from "./Die";

describe("Die", () => {
  test('applies die-working-class when socialClass is WorkingClass', () => {
    render(<Die value={1} socialClass={SocialClass.WorkingClass} />);
    expect(screen.getByTestId("die")).toHaveClass("die-working-class");
  });

  test('applies die-capitalist-class when socialClass is CapitalistClass', () => {
    render(<Die value={1} socialClass={SocialClass.CapitalistClass} />);
    expect(screen.getByTestId("die")).toHaveClass("die-capitalist-class");
  });

  test('shows ✕ for value 0', () => {
    render(<Die value={0} socialClass={SocialClass.WorkingClass} />);
    expect(screen.getByTestId("die")).toHaveTextContent("✕");
  });

  test('shows • for value 1', () => {
    render(<Die value={1} socialClass={SocialClass.WorkingClass} />);
    expect(screen.getByTestId("die")).toHaveTextContent("•");
  });

  test('shows •• for value 2', () => {
    render(<Die value={2} socialClass={SocialClass.WorkingClass} />);
    expect(screen.getByTestId("die")).toHaveTextContent("••");
  });

  test('sets data-value attribute to the die value', () => {
    render(<Die value={2} socialClass={SocialClass.CapitalistClass} />);
    expect(screen.getByTestId("die")).toHaveAttribute("data-value", "2");
  });
});
