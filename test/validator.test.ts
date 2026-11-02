import { describe, expect, it } from "vitest";
import { checkRequiredWords } from "../src/validator.js";

describe("checkRequiredWords", () => {
  it("finds required words used in the passage", () => {
    const result = checkRequiredWords("We walked along the river and into the forest at dawn", [
      { text: "river", level: "easy" },
      { text: "forest", level: "medium" },
    ]);

    expect(result).toEqual({ found: ["river", "forest"], missing: [] });
  });

  it("reports words that are not in the passage", () => {
    const result = checkRequiredWords("We walked along the river at dawn", [
      { text: "river", level: "easy" },
      { text: "lantern", level: "medium" },
    ]);

    expect(result).toEqual({ found: ["river"], missing: ["lantern"] });
  });
});
