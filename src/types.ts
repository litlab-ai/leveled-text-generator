export type Level = "easy" | "medium" | "hard";

export interface Word {
  text: string;
  level: Level;
}

export interface GenerationResult {
  level: Level;
  words: Word[];
  prompt: string;
  passage: string;
  found: string[];
  missing: string[];
  /** True when every required word appears in the passage. */
  valid: boolean;
}
