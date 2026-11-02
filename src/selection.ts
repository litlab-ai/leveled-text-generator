import type { Level, Word } from "./types.js";
import { atMost } from "./util/compare.js";

/** A passage shouldn't have to carry more required words than this. */
export const DEFAULT_MAX_WORDS = 8;

export interface SelectOptions {
  max?: number;
}

/**
 * Picks the required words for a passage.
 *
 * Starts from the teacher's requested words (or the whole bank if none were
 * requested), keeps the ones that are appropriate for the target level, and
 * caps the list so the passage stays short.
 */
export function selectWords(
  bank: Word[],
  requested: string[] | undefined,
  target: Level,
  options: SelectOptions = {},
): Word[] {
  const max = options.max ?? DEFAULT_MAX_WORDS;

  const wanted = requested?.length
    ? new Set(requested.map((text) => text.trim().toLowerCase()))
    : null;
  const pool = wanted ? bank.filter((word) => wanted.has(word.text.toLowerCase())) : bank;

  const seen = new Set<string>();
  const unique = pool.filter((word) => {
    const key = word.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.filter(atMost("level", target)).slice(0, max);
}
