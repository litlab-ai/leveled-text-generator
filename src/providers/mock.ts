import { REQUIRED_WORDS_LABEL } from "../prompt.js";
import type { LLMProvider } from "./types.js";

export interface MockProviderOptions {
  /** Simulated response time in milliseconds. */
  latencyMs?: number;
}

const OPENING = "Maya and her brother started the day early.";
const CLOSING = "It had been an extraordinary day, and Maya's heart was full.";

const TEMPLATES: Array<(word: string) => string> = [
  (word) => `${capitalize(word)} was the first thing Maya noticed that morning.`,
  (word) => `She grabbed her bag and walked toward the ${word}.`,
  (word) => `Her brother said the ${word} looked different today.`,
];

/**
 * A deterministic stand-in for a real LLM. It reads the required words out of
 * the prompt and writes a simple passage that uses each one, so the app runs
 * without an API key and gives the same output every time.
 */
export class MockProvider implements LLMProvider {
  readonly name = "mock";
  private readonly latencyMs: number;

  constructor(options: MockProviderOptions = {}) {
    this.latencyMs = options.latencyMs ?? 400;
  }

  async generate(prompt: string): Promise<string> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }

    const words = parseRequiredWords(prompt);
    const sentences = words.map((word, i) => TEMPLATES[i % TEMPLATES.length]!(word));
    return [OPENING, ...sentences, CLOSING].join(" ");
  }
}

function parseRequiredWords(prompt: string): string[] {
  const line = prompt.split("\n").find((l) => l.startsWith(REQUIRED_WORDS_LABEL));
  if (!line) return [];
  return line
    .slice(REQUIRED_WORDS_LABEL.length)
    .split(",")
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
