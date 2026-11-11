import { describe, expect, it } from "vitest";
import { generatePassage } from "../src/generate.js";
import { LEVELS } from "../src/levels.js";
import type { LLMProvider } from "../src/providers/index.js";
import { MockProvider } from "../src/providers/mock.js";
import type { Word } from "../src/types.js";

const mock = () => new MockProvider({ latencyMs: 0 });

/** A provider that records the prompt it gets and replies with a fixed passage. */
function fakeProvider(reply: () => Promise<string>) {
  const prompts: string[] = [];
  const provider: LLMProvider = {
    name: "fake",
    generate: async (prompt) => {
      prompts.push(prompt);
      return reply();
    },
  };
  return { provider, prompts };
}

describe("generatePassage", () => {
  it("generates an easy passage with the mock provider", async () => {
    const result = await generatePassage(
      { level: "easy" },
      { provider: new MockProvider({ latencyMs: 0 }) },
    );

    expect(result.words.every((w) => w.level === "easy")).toBe(true);
    expect(result.prompt).toContain("Reading level: easy");
    expect(result.passage.length).toBeGreaterThan(0);
    expect(result.found.length + result.missing.length).toBe(result.words.length);
  });
});

// The teacher's report, reproduced with the real word bank and the mock provider.
describe("generatePassage regression: the reported Easy, Medium and Hard passages", () => {
  it.each([
    ["easy", ["easy"]],
    ["medium", ["easy", "medium"]],
    ["hard", ["easy", "medium", "hard"]],
  ] as const)("a %s passage uses words from %j and finds every one", async (level, levels) => {
    const result = await generatePassage({ level }, { provider: mock() });

    const usedLevels = LEVELS.filter((l) => result.words.some((w) => w.level === l));
    expect(usedLevels).toEqual(levels);
    expect(result.missing).toEqual([]);
    expect(result.found).toEqual(result.words.map((w) => w.text));
    expect(result.valid).toBe(true);
  });
});

describe("generatePassage with any word bank and any provider", () => {
  const bank: Word[] = [
    { text: "pebble", level: "easy" },
    { text: "café", level: "easy" },
    { text: "co-op", level: "medium" },
    { text: "ice cream", level: "medium" },
    { text: "C++", level: "hard" },
    { text: "naïveté", level: "hard" },
  ];

  it.each(LEVELS)("the mock passage at %s uses every selected word", async (level) => {
    const result = await generatePassage({ level }, { provider: mock(), bank });

    expect(result.words.length).toBeGreaterThan(0);
    expect(result.missing).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("sends the provider the prompt for the selected words only", async () => {
    const { provider, prompts } = fakeProvider(async () => "A pebble sat by the café.");
    const result = await generatePassage({ level: "easy" }, { provider, bank });

    expect(prompts).toEqual([result.prompt]);
    expect(result.prompt).toContain("Reading level: easy");
    expect(result.prompt).toContain("Required words: pebble, café");
  });

  it("validates any provider's passage with the same rules", async () => {
    const { provider } = fakeProvider(async () => "PEBBLE! Then ice\ncream at the co-op.");
    const result = await generatePassage({ level: "medium" }, { provider, bank });

    expect(result.found).toEqual(["pebble", "co-op", "ice cream"]);
    expect(result.missing).toEqual(["café"]);
    expect(result.valid).toBe(false);
  });

  it.each([[""], ["   \n "]])("rejects an empty passage (%j)", async (passage) => {
    const { provider } = fakeProvider(async () => passage);
    await expect(generatePassage({ level: "easy" }, { provider, bank })).rejects.toThrow(
      "The fake provider returned an empty passage.",
    );
  });

  it("rejects a provider reply that isn't text", async () => {
    const { provider } = fakeProvider(async () => undefined as unknown as string);
    await expect(generatePassage({ level: "easy" }, { provider, bank })).rejects.toThrow(
      "The fake provider returned an empty passage.",
    );
  });

  it("passes provider errors through unchanged", async () => {
    const { provider } = fakeProvider(async () => {
      throw new Error("rate limited");
    });
    await expect(generatePassage({ level: "easy" }, { provider, bank })).rejects.toThrow("rate limited");
  });

  it("handles an empty word bank", async () => {
    const result = await generatePassage({ level: "hard" }, { provider: mock(), bank: [] });

    expect(result.words).toEqual([]);
    expect(result.missing).toEqual([]);
    expect(result.valid).toBe(true);
  });
});
