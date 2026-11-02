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
