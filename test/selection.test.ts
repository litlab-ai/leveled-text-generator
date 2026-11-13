import { describe, expect, it } from "vitest";
import { selectWords } from "../src/selection.js";
import { isWithinLevel, LEVELS } from "../src/levels.js";
import type { Level, Word } from "../src/types.js";
import { atMost } from "../src/util/compare.js";

const bank: Word[] = [
  { text: "river", level: "easy" },
  { text: "forest", level: "medium" },
  { text: "labyrinth", level: "hard" },
  { text: "sun", level: "easy" },
  { text: "bread", level: "easy" },
];

describe("selectWords", () => {
  it("keeps only easy words for an easy passage", () => {
    const words = selectWords(bank, undefined, "easy");
    expect(words.map((w) => w.text)).toEqual(["river", "sun", "bread"]);
  });

  it("only uses the words the teacher requested", () => {
    const words = selectWords(bank, ["Sun", " river "], "easy");
    expect(words.map((w) => w.text)).toEqual(["river", "sun"]);
  });

  it("caps the number of words", () => {
    const words = selectWords(bank, undefined, "easy", { max: 2 });
    expect(words).toHaveLength(2);
  });
});

// Words that aren't in data/words.json, so these tests don't depend on the sample bank.
const leveled: Word[] = [
  { text: "pebble", level: "easy" },
  { text: "meadow", level: "medium" },
  { text: "kaleidoscope", level: "hard" },
  { text: "kite", level: "easy" },
  { text: "harbor", level: "medium" },
  { text: "ephemeral", level: "hard" },
];

describe("selectWords level filtering", () => {
  it.each([
    ["easy", ["pebble", "kite"]],
    ["medium", ["pebble", "meadow", "kite", "harbor"]],
    ["hard", ["pebble", "meadow", "kaleidoscope", "kite", "harbor", "ephemeral"]],
  ] as const)("a %s passage uses the words at or below that level", (level, expected) => {
    expect(selectWords(leveled, undefined, level).map((w) => w.text)).toEqual(expected);
  });

  it("drops requested words that are harder than the target level", () => {
    const words = selectWords(leveled, ["meadow", "kaleidoscope", "pebble"], "medium");
    expect(words.map((w) => w.text)).toEqual(["pebble", "meadow"]);
  });

  it("keeps lower-level requested words in a hard passage", () => {
    const words = selectWords(leveled, ["meadow", "kaleidoscope", "pebble"], "hard");
    expect(words.map((w) => w.text)).toEqual(["pebble", "meadow", "kaleidoscope"]);
  });

  it("returns the original word objects", () => {
    const words = selectWords(leveled, undefined, "hard");
    expect(words[0]).toBe(leveled[0]);
  });

  it("returns no words for an empty bank", () => {
    expect(selectWords([], undefined, "hard")).toEqual([]);
  });

  it("returns no words when nothing is easy enough", () => {
    const hardOnly: Word[] = [{ text: "ephemeral", level: "hard" }];
    expect(selectWords(hardOnly, undefined, "easy")).toEqual([]);
  });

  it("skips words with a missing or unknown level", () => {
    const messy = [
      { text: "pebble", level: "easy" },
      { text: "mystery", level: undefined },
      { text: "jargon", level: "expert" },
    ] as unknown as Word[];
    expect(selectWords(messy, undefined, "hard").map((w) => w.text)).toEqual(["pebble"]);
  });

  it("throws for an unknown target level", () => {
    expect(() => selectWords(leveled, undefined, "expert" as Level)).toThrow(/level/);
  });

  it("keeps the entry that fits the level when a word is listed twice", () => {
    const twice: Word[] = [
      { text: "Echo", level: "hard" },
      { text: "echo", level: "easy" },
    ];
    expect(selectWords(twice, undefined, "easy")).toEqual([{ text: "echo", level: "easy" }]);
  });

  // Builds a bank of `size` words that cycles through the levels.
  const makeBank = (size: number): Word[] =>
    Array.from({ length: size }, (_, i) => ({ text: `word${i}`, level: LEVELS[i % LEVELS.length]! }));

  it.each([
    [0, "easy"],
    [1, "hard"],
    [5, "medium"],
    [30, "medium"],
    [30, "hard"],
  ] as const)("with %s words at %s, picks only allowed levels up to the cap", (size, level) => {
    const bankOfSize = makeBank(size);
    const allowed = bankOfSize.filter((w) => isWithinLevel(w.level, level));
    const words = selectWords(bankOfSize, undefined, level);

    expect(words).toEqual(allowed.slice(0, 8));
  });
});

describe("atMost", () => {
  it("keeps items at or below the limit", () => {
    const scores = [{ score: 3 }, { score: 10 }, { score: 12 }];
    expect(scores.filter(atMost("score", 10))).toEqual([{ score: 3 }, { score: 10 }]);
  });
});
