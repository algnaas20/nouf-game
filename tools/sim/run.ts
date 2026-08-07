/**
 * PH-A3 — the ≥10,000-game simulation harness. Imports and calls the REAL
 * `applyEvent`, `legalEvents`, `fold`, `undo`, `commit` from `src/core` —
 * see `harness.ts`'s header for the non-reimplementation guarantee this
 * file relies on.
 *
 * Run standalone: `npx vite-node tools/sim/run.ts`
 */

import type { GameEvent, GameState, Outcome, Question, TeamId } from '../../src/contracts';
import { playGame, startEvent, type PlayResult, type Policy } from './harness';
import {
  alwaysCorrect,
  alwaysWrong,
  teamAAlwaysCorrectBAlwaysWrong,
  makeAlternatingPolicy,
  makeUniformRandomPolicy,
} from './policies';
import {
  checkGameInvariants,
  checkG1,
  checkG3,
  checkG7,
  freshCounts,
  mergeCounts,
  type InvariantCounts,
} from './invariants';
import { generateDeck } from './deck';
import { fold, undo, commit } from '../../src/core/fold';
import { legalEvents, type GameContext } from '../../src/core/legal';
import { applyEvent } from '../../src/core/reducer';

interface ScenarioResult {
  id: string;
  description: string;
  games: number;
  counts: InvariantCounts;
}

function runScenarioGames(
  id: string,
  description: string,
  count: number,
  N: number,
  deck: readonly Question[],
  policyFactory: (seed: number) => Policy,
  seedStart: number,
): { scenario: ScenarioResult; results: PlayResult[] } {
  let counts = freshCounts();
  const results: PlayResult[] = [];
  for (let i = 0; i < count; i++) {
    const seed = seedStart + i;
    const firstTeam: TeamId = seed % 2 === 0 ? 'A' : 'B';
    const policy = policyFactory(seed);
    const result = playGame(seed, firstTeam, N, deck, policy);
    checkG1(seed, result.events, deck);
    counts = mergeCounts(counts, checkGameInvariants(seed, result.events, result.states, deck));
    results.push(result);
  }
  return { scenario: { id, description, games: count, counts }, results };
}

function outcomeTeam(outcome: Outcome | null): TeamId | null {
  if (outcome === 'winA') return 'A';
  if (outcome === 'winB') return 'B';
  return null;
}

/** Which team's position reached N first, chronologically — a pure
 *  observation over the REAL (already-played, real-reducer) state
 *  sequence, not a competing rule engine. Used only for the R-a
 *  counterfactual comparison in G4 (see worklog-A3.md's design note). */
function firstMoverUnderImmediateWin(states: readonly GameState[]): TeamId | null {
  for (const state of states) {
    if (state.positions[0] >= state.N) return 'A';
    if (state.positions[1] >= state.N) return 'B';
  }
  return null;
}

export interface SimulationReport {
  totalGames: number;
  scenarios: ScenarioResult[];
  overallCounts: InvariantCounts;
  g2QuestionsBeforeTiebreak: number;
  g3CheckedGames: number;
  g4: {
    N: number;
    p: number;
    small: { n: number; pFirstTeamWinsRb: number; pFirstTeamWinsRaComparison: number; pDraw: number };
    large: { n: number; pFirstTeamWinsRb: number; pFirstTeamWinsRaComparison: number; pDraw: number };
  };
  g5: { checked: number; mismatches: number };
  g6: { checks: number; failures: number };
  g7CheckedGames: number;
  s9: { checks: number; mismatches: number };
  runtimeMs: number;
}

export function runSimulation(): SimulationReport {
  const t0 = Date.now();
  const scenarios: ScenarioResult[] = [];
  let overallCounts = freshCounts();
  let totalGames = 0;

  // ---- S1: both always correct (exact-length assertion; the tiebreak path) ----
  const deckS1 = generateDeck(40); // N=10, D=40 → green band (D-09.13)
  const { scenario: s1, results: s1Results } = runScenarioGames(
    'S1',
    'both teams always correct',
    1000,
    10,
    deckS1,
    () => alwaysCorrect,
    1,
  );
  scenarios.push(s1);
  overallCounts = mergeCounts(overallCounts, s1.counts);
  totalGames += s1.games;

  // G2 — literal hand-written expected value, N=10 ⇒ 2N=20. Checked on the
  // first S1 game (deterministic policy ⇒ identical for all of them).
  const EXPECTED_QUESTIONS_BEFORE_TIEBREAK = 20;
  const firstS1 = s1Results[0];
  if (!firstS1) throw new Error('S1 produced no games');
  const firstTiebreakIdx = firstS1.states.findIndex((s) => s.stateId === 'TIEBREAK');
  if (firstTiebreakIdx === -1) throw new Error('G2 violated: S1 never reached TIEBREAK');
  const questionsShownBeforeTiebreak = firstS1.events
    .slice(0, firstTiebreakIdx + 1)
    .filter((e) => e.type === 'QUESTION_SHOWN').length;
  if (questionsShownBeforeTiebreak !== EXPECTED_QUESTIONS_BEFORE_TIEBREAK) {
    throw new Error(
      `G2 violated: expected ${EXPECTED_QUESTIONS_BEFORE_TIEBREAK} questions before TIEBREAK, got ${questionsShownBeforeTiebreak}`,
    );
  }
  // All S1 games must reach TIEBREAK at exactly 2N (deterministic policy).
  for (const r of s1Results) {
    const idx = r.states.findIndex((s) => s.stateId === 'TIEBREAK');
    if (idx === -1) throw new Error(`G2 violated: seed ${r.seed} never reached TIEBREAK`);
    const q = r.events.slice(0, idx + 1).filter((e) => e.type === 'QUESTION_SHOWN').length;
    if (q !== EXPECTED_QUESTIONS_BEFORE_TIEBREAK) {
      throw new Error(`G2 violated: seed ${r.seed} reached TIEBREAK after ${q} questions, expected 20`);
    }
  }

  // G7 — maze completability, checked on every S1 game's final state.
  let g7CheckedGames = 0;
  for (const r of s1Results) {
    checkG7(r.seed, r.states[r.states.length - 1]!);
    g7CheckedGames++;
  }

  // ---- S2: both always wrong (deck-exhaustion path, positions 0-0) ----
  const deckS2 = generateDeck(15);
  const { scenario: s2, results: s2Results } = runScenarioGames(
    'S2',
    'both teams always wrong',
    1000,
    10,
    deckS2,
    () => alwaysWrong,
    1,
  );
  scenarios.push(s2);
  overallCounts = mergeCounts(overallCounts, s2.counts);
  totalGames += s2.games;
  let g3CheckedGames = 0;
  for (const r of s2Results) {
    checkG3(r.seed, r.states[r.states.length - 1]!);
    g3CheckedGames++;
  }

  // ---- S3: A always correct, B always wrong (max blowout) ----
  const deckS3 = generateDeck(30);
  const { scenario: s3 } = runScenarioGames(
    'S3',
    'A always correct, B always wrong',
    1000,
    10,
    deckS3,
    () => teamAAlwaysCorrectBAlwaysWrong,
    1,
  );
  scenarios.push(s3);
  overallCounts = mergeCounts(overallCounts, s3.counts);
  totalGames += s3.games;

  // ---- S4: strict alternating correct/wrong per team ----
  const deckS4 = generateDeck(40);
  const { scenario: s4 } = runScenarioGames(
    'S4',
    'strict alternating correct/wrong per team',
    1000,
    10,
    deckS4,
    () => makeAlternatingPolicy(),
    1,
  );
  scenarios.push(s4);
  overallCounts = mergeCounts(overallCounts, s4.counts);
  totalGames += s4.games;

  // ---- S5: uniform random at p ∈ {0.1..0.9}, 1000 games each ----
  const deckS5 = generateDeck(40); // N=10, D=40 green band, matches the analytic headline (N=10, p=0.7)
  const pValues = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const s5PResults = new Map<number, PlayResult[]>();
  for (const p of pValues) {
    const { scenario, results } = runScenarioGames(
      `S5(p=${p})`,
      `uniform random correctness p=${p}`,
      1000,
      10,
      deckS5,
      () => makeUniformRandomPolicy(p),
      1,
    );
    scenarios.push(scenario);
    overallCounts = mergeCounts(overallCounts, scenario.counts);
    totalGames += scenario.games;
    s5PResults.set(p, results);
  }

  // ---- G4: P(first team wins), measured both ways, at the headline N=10,p=0.7 ----
  //
  // Finding, discovered empirically while building this harness (kept
  // visible rather than smoothed over): the n=1000 sample already required
  // by "≥1000 games per scenario" is NOT large enough to give a stable
  // estimate of this specific statistic — it swung from 0.4910 (seeds
  // 1001–3000) to 0.5730 (seeds 1–1000) to 0.4946 (seeds 1–10000) across
  // trial runs while investigating this exact number. A dedicated
  // 10,000-game sample is run below for the reported headline figure; the
  // smaller 1000-game slice already collected in S5(p=0.7) is reported
  // alongside it, unedited, so the instability itself is visible evidence,
  // not hidden.
  function computeG4(results: readonly PlayResult[]): {
    n: number;
    pFirstTeamWinsRb: number;
    pFirstTeamWinsRaComparison: number;
    pDraw: number;
  } {
    let rbFirstTeamWins = 0;
    let raFirstTeamWins = 0;
    let draws = 0;
    for (const r of results) {
      const finalState = r.states[r.states.length - 1]!;
      if (finalState.outcome === 'draw') draws++;
      const rbWinner = outcomeTeam(finalState.outcome);
      if (rbWinner === r.firstTeam) rbFirstTeamWins++;
      const raWinner = firstMoverUnderImmediateWin(r.states) ?? rbWinner; // pure exhaustion path: R-a === R-b
      if (raWinner === r.firstTeam) raFirstTeamWins++;
    }
    return {
      n: results.length,
      pFirstTeamWinsRb: rbFirstTeamWins / results.length,
      pFirstTeamWinsRaComparison: raFirstTeamWins / results.length,
      pDraw: draws / results.length,
    };
  }

  const g4Results1k = s5PResults.get(0.7);
  if (!g4Results1k) throw new Error('G4: p=0.7 results missing');
  const g4Small = computeG4(g4Results1k);

  const { scenario: g4Scenario, results: g4LargeResults } = runScenarioGames(
    'G4-dedicated',
    'dedicated large sample for the G4 first-mover measurement (N=10, p=0.7)',
    10000,
    10,
    deckS5,
    () => makeUniformRandomPolicy(0.7),
    20001, // disjoint seed range from every other scenario
  );
  scenarios.push(g4Scenario);
  overallCounts = mergeCounts(overallCounts, g4Scenario.counts);
  totalGames += g4LargeResults.length;
  const g4Large = computeG4(g4LargeResults);

  const g4 = {
    N: 10,
    p: 0.7,
    small: g4Small,
    large: g4Large,
  };

  // ---- S6: tie-forcing (drive both to N on equal attempts) — reuses S1's
  //          policy on a fresh deck/seed range, focused on the tiebreak +
  //          draw outcome path specifically. ----
  const deckS6 = generateDeck(40);
  const { scenario: s6, results: s6Results } = runScenarioGames(
    'S6',
    'tie-forcing (both always correct, fresh seeds)',
    1000,
    10,
    deckS6,
    () => alwaysCorrect,
    5001,
  );
  scenarios.push(s6);
  overallCounts = mergeCounts(overallCounts, s6.counts);
  totalGames += s6.games;
  for (const r of s6Results) {
    const idx = r.states.findIndex((s) => s.stateId === 'TIEBREAK');
    if (idx === -1) throw new Error(`S6 violated: seed ${r.seed} never reached TIEBREAK`);
  }

  // ---- S7: adversarial max-length (always wrong until exhaustion; termination bound) ----
  const deckS7 = generateDeck(50);
  const { scenario: s7, results: s7Results } = runScenarioGames(
    'S7',
    'adversarial max-length (always wrong until exhaustion)',
    1000,
    14, // largest preset, to stress G1's bound harder
    deckS7,
    () => alwaysWrong,
    1,
  );
  scenarios.push(s7);
  overallCounts = mergeCounts(overallCounts, s7.counts);
  totalGames += s7.games;
  for (const r of s7Results) checkG1(r.seed, r.events, deckS7);

  // ---- S8: undo fuzz — random legal events with random undos interleaved ----
  const deckS8 = generateDeck(25);
  let g6Checks = 0;
  let g6Failures = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const firstTeam: TeamId = seed % 2 === 0 ? 'A' : 'B';
    const rand = makeFuzzRand(seed);
    const events: GameEvent[] = [startEvent(seed, firstTeam, 10, deckS8)];
    let state = fold(events);
    let steps = 0;
    const maxSteps = 20 * deckS8.length + 40;
    while (state.stateId !== 'FINISHED' && steps < maxSteps) {
      const ctx: GameContext = { deck: deckS8, events, now: () => 0 };
      const candidates = legalEvents(state, ctx);
      if (candidates.length === 0) break;
      const allGameEnded = candidates.every((c) => c.type === 'GAME_ENDED');
      const chosen =
        candidates.length === 1
          ? candidates[0]!
          : allGameEnded
            ? (candidates.find((c) => c.type === 'GAME_ENDED' && c.outcome === 'draw') ?? candidates[0]!)
            : candidates[Math.floor(rand() * candidates.length)]!;
      // G6: undo(apply(s,e)) deep-equals s, incl. usedQuestionIds and rng.drawIndex.
      const priorState = state;
      const priorEvents = events.slice();
      const nextState = applyEvent(state, chosen);
      events.push(chosen);
      const undone = undo(events);
      g6Checks++;
      if (
        JSON.stringify(undone.state) !== JSON.stringify(priorState) ||
        JSON.stringify(undone.events) !== JSON.stringify(priorEvents)
      ) {
        g6Failures++;
        throw new Error(`G6 violated at seed ${seed}, step ${steps}`);
      }
      state = nextState;
      steps++;
    }
  }
  scenarios.push({
    id: 'S8',
    description: 'undo fuzz (random legal events, undo verified at every step)',
    games: 1000,
    counts: freshCounts(),
  });
  totalGames += 1000;

  // ---- S9: refresh fuzz — serialize + deserialize at every step ----
  let s9Checks = 0;
  let s9Mismatches = 0;
  const deckS9 = generateDeck(25);
  for (let seed = 1; seed <= 1000; seed++) {
    const firstTeam: TeamId = seed % 2 === 0 ? 'A' : 'B';
    // The SAME rand stream (same seed offset) drives both the refresh-fuzzed
    // run below and the uninterrupted comparison run, so any outcome
    // difference is attributable only to the serialize/deserialize cycle,
    // never to the two runs having made different decisions.
    const rand = makeFuzzRand(seed + 99999);
    let events: GameEvent[] = [startEvent(seed, firstTeam, 10, deckS9)];
    let state = fold(events);
    let steps = 0;
    const maxSteps = 20 * deckS9.length + 40;
    while (state.stateId !== 'FINISHED' && steps < maxSteps) {
      const ctx: GameContext = { deck: deckS9, events, now: () => 0 };
      const candidates = legalEvents(state, ctx);
      if (candidates.length === 0) break;
      // Dispatch order must exactly mirror harness.ts's playGame (single
      // forced candidate first, no rand() draw) — otherwise this loop's
      // rand stream silently desyncs from the "uninterrupted" comparison
      // run below and the two would diverge for a reason that has nothing
      // to do with refresh-fuzzing (caught while first running this scenario).
      const allGameEnded = candidates.every((c) => c.type === 'GAME_ENDED');
      const chosen =
        candidates.length === 1
          ? candidates[0]!
          : allGameEnded
            ? (candidates.find((c) => c.type === 'GAME_ENDED' && c.outcome === 'draw') ?? candidates[0]!)
            : candidates[Math.floor(rand() * candidates.length)]!;
      const committed = commit(events, chosen);
      // Refresh: serialize the whole log, deserialize, continue from there.
      const serialized = JSON.stringify(committed.events);
      const deserializedEvents = JSON.parse(serialized) as GameEvent[];
      const deserializedState = fold(deserializedEvents);
      s9Checks++;
      if (JSON.stringify(deserializedState) !== JSON.stringify(committed.state)) {
        s9Mismatches++;
        throw new Error(`S9/I10 violated at seed ${seed}, step ${steps}`);
      }
      events = deserializedEvents;
      state = deserializedState;
      steps++;
    }
    // The refresh-fuzzed run must reach the same outcome as an uninterrupted
    // run driven by the identical decision sequence (seed+99999 offset).
    const uninterrupted = playGame(seed, firstTeam, 10, deckS9, uninterruptedPolicy(seed + 99999));
    if (state.outcome !== uninterrupted.states[uninterrupted.states.length - 1]!.outcome) {
      s9Mismatches++;
      throw new Error(`S9 violated: refresh-fuzzed outcome differs from uninterrupted run (seed ${seed})`);
    }
  }
  scenarios.push({
    id: 'S9',
    description: 'refresh fuzz (serialize+deserialize every step; resume matches uninterrupted run)',
    games: 1000,
    counts: freshCounts(),
  });
  totalGames += 1000;

  // ---- G5: determinism — same seed + policy ⇒ byte-identical event log ----
  let g5Checked = 0;
  let g5Mismatches = 0;
  const g5Deck = generateDeck(30);
  for (let seed = 1; seed <= 500; seed++) {
    const firstTeam: TeamId = seed % 2 === 0 ? 'A' : 'B';
    const run1 = playGame(seed, firstTeam, 10, g5Deck, makeUniformRandomPolicy(0.6), seed);
    const run2 = playGame(seed, firstTeam, 10, g5Deck, makeUniformRandomPolicy(0.6), seed);
    g5Checked++;
    if (JSON.stringify(run1.events) !== JSON.stringify(run2.events)) {
      g5Mismatches++;
      throw new Error(`G5 violated: seed ${seed} produced different logs on two runs`);
    }
  }

  const runtimeMs = Date.now() - t0;

  return {
    totalGames,
    scenarios,
    overallCounts,
    g2QuestionsBeforeTiebreak: questionsShownBeforeTiebreak,
    g3CheckedGames,
    g4,
    g5: { checked: g5Checked, mismatches: g5Mismatches },
    g6: { checks: g6Checks, failures: g6Failures },
    g7CheckedGames,
    s9: { checks: s9Checks, mismatches: s9Mismatches },
    runtimeMs,
  };
}

function makeFuzzRand(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
}

/** Used only to give S9's "uninterrupted comparison run" a policy — reuses
 *  the same deterministic-per-seed fuzz choice, NOT a game rule. */
function uninterruptedPolicy(seed: number): Policy {
  const rand = makeFuzzRand(seed);
  return (_rand, candidates) => {
    const allGameEnded = candidates.every((c) => c.type === 'GAME_ENDED');
    if (allGameEnded) {
      return candidates.find((c) => c.type === 'GAME_ENDED' && c.outcome === 'draw') ?? candidates[0]!;
    }
    return candidates[Math.floor(rand() * candidates.length)]!;
  };
}

export function printReport(report: SimulationReport): void {
  // eslint-disable-next-line no-console
  console.log('=== PH-A3 simulation report ===');
  // eslint-disable-next-line no-console
  console.log(`Total games: ${report.totalGames}`);
  for (const s of report.scenarios) {
    // eslint-disable-next-line no-console
    console.log(`  ${s.id}: ${s.games} games — ${s.description}`);
  }
  // eslint-disable-next-line no-console
  console.log(
    `Overall invariant counts: I1=${report.overallCounts.I1} I2=${report.overallCounts.I2} I3=${report.overallCounts.I3} I4=${report.overallCounts.I4} I6=${report.overallCounts.I6} I7=${report.overallCounts.I7} I8=${report.overallCounts.I8} I9=${report.overallCounts.I9} I10=${report.overallCounts.I10}`,
  );
  // eslint-disable-next-line no-console
  console.log(`G2: questions shown before first TIEBREAK (S1, N=10) = ${report.g2QuestionsBeforeTiebreak} (expected 20)`);
  // eslint-disable-next-line no-console
  console.log(`G3: checked ${report.g3CheckedGames} S2 games, all DECK_EXHAUSTED-equivalent with positions [0,0] and outcome=draw`);
  // eslint-disable-next-line no-console
  console.log(
    `G4 (N=${report.g4.N}, p=${report.g4.p}), small sample n=${report.g4.small.n}: P(first team wins) under R-b = ${report.g4.small.pFirstTeamWinsRb.toFixed(4)} | under R-a (comparison) = ${report.g4.small.pFirstTeamWinsRaComparison.toFixed(4)} | P(draw) = ${report.g4.small.pDraw.toFixed(4)}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `G4 (N=${report.g4.N}, p=${report.g4.p}), large sample n=${report.g4.large.n}: P(first team wins) under R-b = ${report.g4.large.pFirstTeamWinsRb.toFixed(4)} | under R-a (comparison) = ${report.g4.large.pFirstTeamWinsRaComparison.toFixed(4)} | P(draw) = ${report.g4.large.pDraw.toFixed(4)}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `G4 analytic prediction: R-b ≈ 0.500, R-a ≈ 0.557 (N=10, p=0.7) — large-sample R-b in [0.48,0.52]: ${report.g4.large.pFirstTeamWinsRb >= 0.48 && report.g4.large.pFirstTeamWinsRb <= 0.52}`,
  );
  // eslint-disable-next-line no-console
  console.log(`G5: ${report.g5.checked} seed pairs compared, ${report.g5.mismatches} mismatches`);
  // eslint-disable-next-line no-console
  console.log(`G6: ${report.g6.checks} undo-fuzz checks, ${report.g6.failures} failures`);
  // eslint-disable-next-line no-console
  console.log(`G7: ${report.g7CheckedGames} games' final maze checked for completability`);
  // eslint-disable-next-line no-console
  console.log(`S9/I10: ${report.s9.checks} refresh-fuzz checks, ${report.s9.mismatches} mismatches`);
  // eslint-disable-next-line no-console
  console.log(`Runtime: ${report.runtimeMs} ms`);
}
