import { createContext, useContext } from "react";

export interface GameNavContextValue {
  onReturnToStart: (() => void) | null;
  onReturnToLobby: (() => void) | null;
}

export const GameNavContext = createContext<GameNavContextValue>({
  onReturnToStart: null,
  onReturnToLobby: null,
});

export function useGameNav(): GameNavContextValue {
  return useContext(GameNavContext);
}
