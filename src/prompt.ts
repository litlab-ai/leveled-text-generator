import { READING_GUIDANCE } from "./levels.js";
import type { Level, Word } from "./types.js";

export const REQUIRED_WORDS_LABEL = "Required words:";

export function buildPrompt(target: Level, words: Word[]): string {
  const list = words.map((word) => word.text).join(", ");

  return [
    "You write short reading passages for students.",
    "",
    `Reading level: ${target}`,
    READING_GUIDANCE[target],
    "",
    "Write one passage of 80-120 words that tells a small, complete story.",
    "Use every required word below at least once, exactly as written.",
    "Return only the passage text, with no title and no commentary.",
    "",
    `${REQUIRED_WORDS_LABEL} ${list}`,
  ].join("\n");
}
