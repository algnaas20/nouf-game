/**
 * A small, fast (vitest-speed) smoke test over the PH-A3 simulation
 * harness — the same real functions (`tools/sim/harness.ts`,
 * `tools/sim/invariants.ts`) the full ≥10,000-game run uses, on a much
 * smaller sample so `npm test` stays fast. The full-scale run and its
 * real numbers live in `docs/بروتوكولات/simulated-playthrough.md`.
 */

import { describe, expect, it } from 'vitest';
import type { TeamId } from '../../src/contracts';
import { playGame } from '../../tools/sim/harness';
import { alwaysCorrect, alwaysWrong, makeUniformRandomPolicy } from '../../tools/sim/policies';
import { checkGameInvariants, checkG1, checkG3, checkG7, freshCounts, mergeCounts } from '../../tools/sim/invariants';
import { generateDeck } from '../../tools/sim/deck';
import { fold, undo } from '../../src/core/fold';

describe('PH-A3 smoke: I1–I10 hold, G1/G3/G7 hold, over a small sample', () => {
  it('50 S5-style games (p=0.6, N=10, D=30): all invariants pass, counts > 0', () => {
    const deck = generateDeck(30);
    let counts = freshCounts();
    for (let seed = 1; seed <= 50; seed++) {
      const firstTeam: TeamId = seed % 2 === 0 ? 'A' : 'B';
      const { events, states } = playGame(seed, firstTeam, 10, deck, makeUniformRandomPolicy(0.6));
      checkG1(seed, events, deck);
      counts = mergeCounts(counts, checkGameInvariants(seed, events, states, deck));
    }
    expect(counts.I1).toBeGreaterThan(0);
    expect(counts.I9).toBeGreaterThan(0);
  });

  it('G3: S2 (always wrong) ends with positions [0,0] and outcome draw', () => {
    const deck = generateDeck(10);
    const { states } = playGame(1, 'A', 10, deck, alwaysWrong);
    checkG3(1, states[states.length - 1]!);
  });

  it('G7: maze completability holds for S1 games', () => {
    const deck = generateDeck(30);
    const { states } = playGame(1, 'A', 10, deck, alwaysCorrect);
    checkG7(1, states[states.length - 1]!);
  });

  it('G5: same seed + policy ⇒ byte-identical event log (20 seeds)', () => {
    const deck = generateDeck(30);
    let checked = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const firstTeam: TeamId = seed % 2 === 0 ? 'A' : 'B';
      const run1 = playGame(seed, firstTeam, 10, deck, makeUniformRandomPolicy(0.6), seed);
      const run2 = playGame(seed, firstTeam, 10, deck, makeUniformRandomPolicy(0.6), seed);
      expect(JSON.stringify(run1.events)).toBe(JSON.stringify(run2.events));
      checked++;
    }
    expect(checked).toBe(20);
  });

  it('G6: undo restores position AND usedQuestionIds AND rng.drawIndex at every step (S5-style games)', () => {
    const deck = generateDeck(25);
    let checks = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const firstTeam: TeamId = seed % 2 === 0 ? 'A' : 'B';
      const { events } = playGame(seed, firstTeam, 10, deck, makeUniformRandomPolicy(0.6));
      for (let i = 1; i <= events.length; i++) {
        const priorEvents = events.slice(0, i - 1);
        const priorState = fold(priorEvents);
        const undone = undo(events.slice(0, i));
        expect(undone.events).toEqual(priorEvents);
        expect(undone.state.usedQuestionIds).toEqual(priorState.usedQuestionIds);
        expect(undone.state.rng.drawIndex).toBe(priorState.rng.drawIndex);
        expect(undone.state).toEqual(priorState);
        checks++;
      }
    }
    expect(checks).toBeGreaterThan(0);
  });
});
