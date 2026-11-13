import { describe, expect, it } from "vitest";
import { isLevel, isWithinLevel, LEVELS, levelRank } from "../src/levels.js";

describe("levelRank", () => {
  it("orders levels from easiest to hardest", () => {
    expect(LEVELS.map(levelRank)).toEqual([0, 1, 2]);
  });

  it("returns -1 for anything that isn't a level", () => {
    expect(levelRank("expert")).toBe(-1);
    expect(levelRank("Hard")).toBe(-1);
    expect(levelRank(undefined)).toBe(-1);
  });
});

describe("isWithinLevel", () => {
  it.each([
    ["easy", "easy", true],
    ["easy", "medium", true],
    ["easy", "hard", true],
    ["medium", "easy", false],
    ["medium", "medium", true],
    ["medium", "hard", true],
    ["hard", "easy", false],
    ["hard", "medium", false],
    ["hard", "hard", true],
  ] as const)("a %s word is allowed in a %s passage: %s", (level, target, expected) => {
    expect(isWithinLevel(level, target)).toBe(expected);
  });

  it("never allows a missing or unknown level", () => {
    expect(isWithinLevel(undefined, "hard")).toBe(false);
    expect(isWithinLevel("expert", "hard")).toBe(false);
    expect(isWithinLevel("", "hard")).toBe(false);
  });
});

describe("isLevel", () => {
  it("rejects values that aren't one of the levels", () => {
    expect(isLevel("expert")).toBe(false);
    expect(isLevel("Hard")).toBe(false);
    expect(isLevel(undefined)).toBe(false);
    expect(isLevel(2)).toBe(false);
  });
});
