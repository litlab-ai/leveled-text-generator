import type { Word } from "./types.js";
import { tokenize } from "./util/text.js";

export interface ValidationResult {
  found: string[];
  missing: string[];
}

/** Checks which of the required words actually appear in the passage. */
export function checkRequiredWords(passage: string, words: Word[]): ValidationResult {
  const tokens = new Set(tokenize(passage));
  const found: string[] = [];
  const missing: string[] = [];

  for (const word of words) {
    if (tokens.has(word.text)) {
      found.push(word.text);
    } else {
      missing.push(word.text);
    }
  }

  return { found, missing };
}
