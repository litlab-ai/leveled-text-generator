import { describe, expect, it } from "vitest";
import { selectWords } from "../src/selection.js";
import type { Word } from "../src/types.js";
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

describe("atMost", () => {
  it("keeps items at or below the limit", () => {
    const scores = [{ score: 3 }, { score: 10 }, { score: 12 }];
    expect(scores.filter(atMost("score", 10))).toEqual([{ score: 3 }, { score: 10 }]);
  });
});
