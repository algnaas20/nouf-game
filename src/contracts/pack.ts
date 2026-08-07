/**
 * Pack manifest contract — frozen PH-00 (types only, no logic).
 * The shape of the exported/imported ZIP pack manifest (WL-D writes the
 * reader/writer; this file only fixes the shape everyone agrees on).
 */

import type { Question } from './question';

export interface PackMediaEntry {
  sha256: string;
  ext: string;
  bytes: number;
}

export interface PackManifest {
  formatVersion: number;
  /** Arabic title, user-facing product copy. */
  title: string;
  /** ISO 8601 timestamp string. */
  preparedAt: string;
  questions: Question[];
  media: PackMediaEntry[];
}
