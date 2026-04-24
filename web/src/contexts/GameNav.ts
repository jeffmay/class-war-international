import { createContext, useContext } from "react";

export interface GameNavContextValue {
  onReturnToStart: (() => void) | null;
  onReturnToLobby: (() => void) | null;
  onLeaveMatch: (() => Promise<void>) | null;
  onHandoff: (() => void) | null;
}

export const GameNavContext = createContext<GameNavContextValue>({
  onReturnToStart: null,
  onReturnToLobby: null,
  onLeaveMatch: null,
  onHandoff: null,
});

export function useGameNav(): GameNavContextValue {
  return useContext(GameNavContext);
}
