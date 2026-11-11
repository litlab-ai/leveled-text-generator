import type { Word } from "./types.js";
import { containsWord } from "./util/text.js";

export interface ValidationResult {
  found: string[];
  missing: string[];
}

/**
 * Checks which of the required words actually appear in the passage.
 *
 * A word counts when it appears as a whole word, ignoring case and punctuation.
 * A word listed more than once (in any case) is reported once.
 */
export function checkRequiredWords(passage: string, words: Word[]): ValidationResult {
  const found: string[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();

  for (const word of words) {
    const key = word.text.normalize("NFC").trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    if (containsWord(passage, word.text)) {
      found.push(word.text);
    } else {
      missing.push(word.text);
    }
  }

  return { found, missing };
}
