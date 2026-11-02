import { describe, expect, it } from "vitest";
import { generatePassage } from "../src/generate.js";
import { MockProvider } from "../src/providers/mock.js";

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
