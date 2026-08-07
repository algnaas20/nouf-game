/**
 * Question contract — frozen PH-00 (types only, no logic).
 * Consumed by WL-A (core), WL-B (stage), WL-C (editor), WL-D (pack).
 */

/** The four on-screen positions of an answer option. */
export type OptionIndex = 0 | 1 | 2 | 3;

/** A question's media attachment. `kind: 'none'` covers plain text questions. */
export type QuestionMedia =
  | { kind: 'none' }
  | { kind: 'image' | 'audio'; sha256: string; ext: string };

export interface Question {
  id: string;
  /** Arabic question text, user-facing product copy. */
  text: string;
  options: [string, string, string, string];
  correctIndex: OptionIndex;
  media: QuestionMedia;
  /** Reserved, unused in v1 — D-09.3 / D-23. A future filter mechanic. */
  category?: string;
  /** Reserved, unused in v1 — D-09.3 / D-23. A future weighting mechanic. */
  difficulty?: number;
}
