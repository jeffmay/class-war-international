import type { Game, LongFormMove, Move, MoveFn, MoveMap, PlayerID } from "boardgame.io";
import { Client } from 'boardgame.io/client';
import type { _ClientImpl, ClientOpts } from "boardgame.io/dist/types/src/client/client";


export type StrictGame<G, PluginAPIs extends Record<string, unknown>, M extends MoveMap<G, PluginAPIs>> = Omit<Game<G, PluginAPIs>, 'moves'> & {
  moves: M
}

export type StrictGameOf<Moves> = Moves extends MoveMap<infer G, infer PluginAPIs> ? StrictGame<G, PluginAPIs, Moves> : never

export type StrictClientOpts<G, PluginAPIs extends Record<string, unknown>, M extends MoveMap<G, PluginAPIs>> =
  Omit<ClientOpts<G, PluginAPIs>, 'game'> & {
    game: StrictGame<G, PluginAPIs, M>
  }

export function StrictClient<
  G,
  PluginAPIs extends Record<string, unknown>,
  M extends MoveMap<G, PluginAPIs>,
>(opts: StrictClientOpts<G, PluginAPIs, M>) {
  return Client(opts) as unknown as StrictClient<G, PluginAPIs, M>
}

export type StrictClient<
  G,
  PluginAPIs extends Record<string, unknown>,
  M extends MoveMap<G, PluginAPIs>,
> = Omit<_ClientImpl<G, PluginAPIs>, 'moves'> & {
  moves: StrictMoveMap<M>
}

export type StrictClientOf<Game> = Game extends StrictGame<infer G, infer PluginAPIs, infer M> ? StrictClient<G, PluginAPIs, M> : never

type DropFirst<T extends unknown[]> = T extends [unknown, ...infer U] ? U : never

export type StrictMove<M extends Move> =
  M extends MoveFn
  ? StrictMoveFn<M>
  : M extends LongFormMove
  ? StrictLongFormMove<M>
  : never

export type StrictMoveFn<Fn extends MoveFn> = {
  (playerId: PlayerID, ...args: DropFirst<Parameters<Fn>>): ReturnType<Fn>,
  (...args: DropFirst<Parameters<Fn>>): ReturnType<Fn>,
}

export type StrictLongFormMove<LFM extends LongFormMove> = Omit<LFM, 'move'> & {
  move: StrictMoveFn<LFM['move']>
}

export type StrictMoveMap<M> =
  M extends MoveMap
  ? {
    [k in keyof M]: StrictMove<M[k]>
  }
  : never
