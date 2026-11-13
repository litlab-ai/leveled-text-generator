import type { Level } from "./types.js";

export const LEVELS: readonly Level[] = ["easy", "medium", "hard"];

export const READING_GUIDANCE: Record<Level, string> = {
  easy: "Write for an early reader (ages 6-8). Use short sentences of 5-10 words and everyday vocabulary.",
  medium:
    "Write for a developing reader (ages 9-11). Use varied sentence lengths and some descriptive language.",
  hard: "Write for a confident reader (ages 12-14). Use longer sentences, richer vocabulary, and some figurative language.",
};

export function isLevel(value: unknown): value is Level {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value);
}

/** Position of a level in LEVELS, from 0 (easiest) up, or -1 if it isn't a level. */
export function levelRank(level: unknown): number {
  return isLevel(level) ? LEVELS.indexOf(level) : -1;
}

/**
 * True if a word tagged `level` belongs in a `target` passage: an easy passage
 * uses easy words, medium uses easy and medium, and hard uses all three.
 * Levels are compared by their order in LEVELS, never by name.
 */
export function isWithinLevel(level: unknown, target: Level): boolean {
  const rank = levelRank(level);
  return rank !== -1 && rank <= levelRank(target);
}
