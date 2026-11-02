import { readFileSync } from "node:fs";
import { isLevel } from "./levels.js";
import type { Word } from "./types.js";

const WORDS_FILE = new URL("../data/words.json", import.meta.url);

export function loadWordBank(): Word[] {
  const raw: unknown = JSON.parse(readFileSync(WORDS_FILE, "utf8"));
  if (!Array.isArray(raw)) {
    throw new Error("data/words.json must contain an array");
  }

  return raw.map((entry, i) => {
    if (typeof entry?.text !== "string" || !isLevel(entry?.level)) {
      throw new Error(`data/words.json: invalid entry at index ${i}`);
    }
    return { text: entry.text, level: entry.level };
  });
}
