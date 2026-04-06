/**
 * Die
 *
 * Renders a single ternary die (0/1/2) as a rounded square bordered div,
 * colored by the social class that rolled it.
 */

import React from "react";
import { SocialClass } from "../types/cards";

export interface DieProps {
  value: number;
  socialClass: SocialClass;
}

const dieFace = (value: number): string => {
  if (value === 0) return "✕";
  if (value === 1) return "•";
  return "••";
};

export const Die: React.FC<DieProps> = ({ value, socialClass }) => {
  const classModifier =
    socialClass === SocialClass.WorkingClass
      ? "die-working-class"
      : "die-capitalist-class";
  return (
    <div
      className={`die ${classModifier}`}
      data-testid="die"
      data-value={value}
    >
      {dieFace(value)}
    </div>
  );
};
