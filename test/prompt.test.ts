import { describe, expect, it } from "vitest";
import { buildPrompt } from "../src/prompt.js";

describe("buildPrompt", () => {
  it("includes the reading level and every required word", () => {
    const prompt = buildPrompt("medium", [
      { text: "forest", level: "medium" },
      { text: "river", level: "easy" },
    ]);

    expect(prompt).toContain("Reading level: medium");
    expect(prompt).toContain("Required words: forest, river");
  });
});
