import { isLevel, isWithinLevel } from "./levels.js";
import type { Level, Word } from "./types.js";

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
  if (!isLevel(target)) {
    throw new Error(`Unknown level "${String(target)}"`);
  }
  const max = options.max ?? DEFAULT_MAX_WORDS;

  const wanted = requested?.length
    ? new Set(requested.map((text) => text.trim().toLowerCase()))
    : null;
  const pool = wanted ? bank.filter((word) => wanted.has(word.text.toLowerCase())) : bank;
  const allowed = pool.filter((word) => isWithinLevel(word.level, target));

  const seen = new Set<string>();
  const unique = allowed.filter((word) => {
    const key = word.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, max);
}
