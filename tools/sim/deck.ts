/**
 * Synthetic text-question decks for the simulation harness. Pure fixture
 * generation — no rule logic here (grep-checked, PH-A3 criterion 2).
 */

import type { Question } from '../../src/contracts';

export function generateDeck(n: number): Question[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `sim-q${i + 1}`,
    text: `سؤال محاكاة رقم ${i + 1}؟`,
    options: ['خيار أ', 'خيار ب', 'خيار ج', 'خيار د'],
    correctIndex: (i % 4) as 0 | 1 | 2 | 3,
    media: { kind: 'none' as const },
  }));
}

export function computeDeckHash(deck: readonly Question[]): string {
  return deck.map((q) => q.id).join('|');
}
