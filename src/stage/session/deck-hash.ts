/**
 * A deterministic string identifying the active deck, for
 * `GameEvent.GAME_STARTED.deckHash` only. This is NOT the "reject resume on
 * a modified pack" integrity primitive (that guard is PH-A4/WL-A's, over a
 * real pack loaded through `src/pack`) — this worktree has no pack loader
 * wired in yet, so the stage plays a self-contained demo deck. A stable
 * join-and-hash of every field that defines a question's on-screen identity
 * is sufficient for that: it changes if and only if the deck's playable
 * content changes, which is all `deckHash` is asked to witness here.
 */
import type { Question } from '../../contracts';

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function computeDeckHash(deck: readonly Question[]): string {
  const signature = deck
    .map((q) => [q.id, q.text, q.options.join('~'), q.correctIndex, q.media.kind].join('|'))
    .join('\n');
  return fnv1a(signature);
}
