/**
 * The branching-maze generator and move resolver — game-systems-expert
 * 2026-08-08 §10.3. Supersedes the old congruent-corridor `buildMaze(N)`
 * that lived inline in `reducer.ts` (D-24: the user's «مو تحط لي خط» ruling).
 *
 * Two proofs this module exists to make trivially true, not to re-derive:
 *   Theorem 1 (§6.1) — every route reaches its goal in <= N+1 moves. Holds
 *     because a junction has AT MOST one dead-end exit (a single scalar
 *     field, never a set) and the one-stumble cap (`wasted === 0` guard in
 *     `resolveMove`) means non-advancing moves are bounded by 1 per game.
 *   M-GEN-1 — the two teams' routes never share a junction. Holds because
 *     `buildMaze` always allocates two fresh, disjoint arrays of fresh
 *     object literals — nothing here is EVER aliased across `routes[0]` and
 *     `routes[1]`. See `tools/sim/invariants.ts`'s `noSharedJunctions` for
 *     the mutation-tested guard.
 */

import type { MazeJunction, MazeLayout, TeamId, TeamRoute } from '../../contracts';

export const MAZE_GEN_VERSION = 1;
export const MAZE_STREAM_TAG = 0x4d415a45; // 'MAZE'
export const DECOR_STREAM_TAG = 0x4445434f; // 'DECO'
export const EXITS_PER_JUNCTION = 3;

/** 32-bit deterministic mix, independent of `src/core/rng.ts`'s `hash32`
 *  (M-RNG-1: `buildMaze` must never consume from `rng.drawIndex` — it derives
 *  its own stream here, entirely separate from the question/shuffle RNG). */
function mix(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ b, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function streamHash(seed: number, tag: number, ...parts: number[]): number {
  let h = mix(seed >>> 0, tag >>> 0);
  for (const p of parts) h = mix(h, p >>> 0);
  return h;
}

const TEAM_ORDER: readonly TeamId[] = ['A', 'B'];

/**
 * Pure, deterministic, version-stamped. Never touches `rng.drawIndex`
 * (M-RNG-1) — its own `MAZE_STREAM_TAG`/`DECOR_STREAM_TAG` streams are
 * derived solely from `(seed, N)`, so question selection and option
 * shuffling stay byte-identical to before this redesign (G5 determinism).
 */
export function buildMaze(seed: number, N: number): MazeLayout {
  const routes = TEAM_ORDER.map((team, teamIdx): TeamRoute => {
    const junctions: MazeJunction[] = [];
    for (let i = 0; i < N; i++) {
      const deadEndExit = streamHash(seed, MAZE_STREAM_TAG, teamIdx, i) % EXITS_PER_JUNCTION;
      junctions.push({ index: i, exits: EXITS_PER_JUNCTION, deadEndExit });
    }
    return { team, junctions };
  }) as [TeamRoute, TeamRoute];

  const decorSeed = streamHash(seed, DECOR_STREAM_TAG, 0);

  return { N, routes, decorSeed, genVersion: MAZE_GEN_VERSION };
}

function routeFor(layout: MazeLayout, team: TeamId): TeamRoute {
  const idx = team === 'A' ? 0 : 1;
  const route = layout.routes[idx];
  if (!route) throw new Error(`buildMaze: missing route for team ${team}`);
  return route;
}

/**
 * The exits an operator may legally tap right now — all exits of the team's
 * current junction minus whichever one(s) are already closed. Never includes
 * `deadEndExit` as a special case; the trap is a normal exit that MAY have
 * already resolved 'deadEnd' once already had it been tried, hence excluded
 * only via `closedExits`, never via `deadEndExit` itself (M-SECRET-1: this
 * function must not leak which exit is the trap by omitting it).
 */
export function availableExits(
  layout: MazeLayout,
  team: TeamId,
  junctionIndex: number,
  closedExits: readonly number[],
): number[] {
  const route = routeFor(layout, team);
  const junction = route.junctions[junctionIndex];
  if (!junction) return [];
  const exits: number[] = [];
  for (let e = 0; e < junction.exits; e++) {
    if (!closedExits.includes(e)) exits.push(e);
  }
  return exits;
}

/**
 * The single place a move is resolved. `'deadEnd'` iff `exit ===
 * junction.deadEndExit && wasted === 0` — that one condition IS the
 * one-stumble rule (game-systems-expert §10.3), and it lives in exactly one
 * line so I11's mutation test (delete `&& wasted === 0`) is unambiguous.
 */
export function resolveMove(
  layout: MazeLayout,
  team: TeamId,
  junctionIndex: number,
  closedExits: readonly number[],
  wasted: number,
  exit: number,
): 'advance' | 'deadEnd' {
  const route = routeFor(layout, team);
  const junction = route.junctions[junctionIndex];
  if (!junction) {
    throw new Error(`resolveMove: no junction ${junctionIndex} on team ${team}'s route (N=${layout.N})`);
  }
  void closedExits; // exit legality is `legal.ts`'s job (availableExits); resolveMove trusts its input.
  if (exit === junction.deadEndExit && wasted === 0) return 'deadEnd';
  return 'advance';
}
