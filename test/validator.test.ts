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

describe("checkRequiredWords matching rules", () => {
  const check = (word: string, passage: string) =>
    checkRequiredWords(passage, [{ text: word, level: "easy" }]).found.length === 1;

  it.each([
    // case
    ["apple", "an apple a day", true],
    ["apple", "Apple pie", true],
    ["apple", "APPLE PIE", true],
    ["Apple", "an apple a day", true],
    ["aPPle", "An ApPlE tree", true],
    // punctuation around the word
    ["river", "We swam in the river.", true],
    ["river", "the river, then home", true],
    ["river", "What a river!", true],
    ["river", "a stream (river) ran by", true],
    ['river', 'she said "river" twice', true],
    ["river", "Is that the river?", true],
    ["river", "river: a stream", true],
    ["journey", "a long journey—then rest", true],
    ["river", "the river's edge", true],
    // whitespace
    ["river", "   river   ", true],
    ["  river ", "the river", true],
    ["river", "the\n\nriver\tran", true],
    ["ice cream", "we ate ice   cream", true],
    ["ice cream", "we ate ice\ncream", true],
    ["ice cream", "we ate ice and cream", false],
    // whole words only
    ["art", "artificial flowers", false],
    ["art", "we made a start", false],
    ["art", "a smart idea", false],
    ["sun", "sunny days", false],
    // different forms are not the same word
    ["apple", "two apples", false],
    ["run", "running fast", false],
    // characters that mean something in a regular expression
    ["C++", "I am learning C++.", true],
    ["C++", "I am learning C.", false],
    ["a.b", "a.b is a name", true],
    ["a.b", "axb is a name", false],
    ["(maybe)", "it is (maybe) fine", true],
    ["$5", "it costs $5 today", true],
    ["co-op", "the co-op opened", true],
    ["[x]", "tick [x] here", true],
    ["x*", "xxxx", false],
    // Unicode
    ["café", "We met at the CAFÉ.", true],
    ["café", "We met at the café.", true],
    ["naïve", "a naïve plan", true],
    ["река", "Широкая Река, тихая.", true],
    ["ήλιος", "Ο Ήλιος λάμπει.", true],
    ["über", "überall", false],
  ] as const)('"%s" in %j -> %s', (word, passage, expected) => {
    expect(check(word, passage)).toBe(expected);
  });

  it("reports words in the order they were required", () => {
    const result = checkRequiredWords("Pebble. Kite!", [
      { text: "meadow", level: "medium" },
      { text: "kite", level: "easy" },
      { text: "harbor", level: "medium" },
      { text: "pebble", level: "easy" },
    ]);

    expect(result).toEqual({ found: ["kite", "pebble"], missing: ["meadow", "harbor"] });
  });

  it("reports a duplicated required word once", () => {
    const result = checkRequiredWords("The kite flew.", [
      { text: "kite", level: "easy" },
      { text: "Kite", level: "easy" },
      { text: "meadow", level: "medium" },
      { text: "Meadow", level: "medium" },
    ]);

    expect(result).toEqual({ found: ["kite"], missing: ["meadow"] });
  });

  it("reports every word as missing from an empty passage", () => {
    const result = checkRequiredWords("", [{ text: "kite", level: "easy" }]);
    expect(result).toEqual({ found: [], missing: ["kite"] });
  });

  it("returns empty lists when no words are required", () => {
    expect(checkRequiredWords("Any passage.", [])).toEqual({ found: [], missing: [] });
  });

  it("treats a blank required word as missing", () => {
    expect(checkRequiredWords("Any passage.", [{ text: "  ", level: "easy" }])).toEqual({
      found: [],
      missing: ["  "],
    });
  });
});
