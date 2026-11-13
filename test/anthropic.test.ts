import { describe, expect, it } from "vitest";
import { generatePassage } from "../src/generate.js";
import { buildPrompt } from "../src/prompt.js";
import { AnthropicProvider, type AnthropicProviderOptions } from "../src/providers/anthropic.js";
import type { Word } from "../src/types.js";

type Client = NonNullable<AnthropicProviderOptions["client"]>;

/** A stand-in for the Anthropic SDK client that records requests and returns `reply()`. */
function fakeClient(reply: () => unknown) {
  const requests: any[] = [];
  const client = {
    messages: {
      create: async (params: unknown) => {
        requests.push(params);
        return reply();
      },
    },
  } as unknown as Client;
  return { client, requests };
}

const text = (...parts: string[]) => ({
  stop_reason: "end_turn",
  content: parts.map((part) => ({ type: "text", text: part })),
});

const bank: Word[] = [
  { text: "pebble", level: "easy" },
  { text: "meadow", level: "medium" },
  { text: "kaleidoscope", level: "hard" },
];

describe("AnthropicProvider", () => {
  it("sends the prompt unchanged as one user message", async () => {
    const { client, requests } = fakeClient(() => text("A passage."));
    const provider = new AnthropicProvider({ client, model: "test-model" });
    const prompt = buildPrompt("hard", bank);

    await provider.generate(prompt);

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ model: "test-model", messages: [{ role: "user", content: prompt }] });
  });

  it("joins the text blocks and trims the result", async () => {
    const { client } = fakeClient(() => ({
      stop_reason: "end_turn",
      content: [
        { type: "text", text: "  Once upon " },
        { type: "thinking", thinking: "ignored" },
        { type: "text", text: "a time.  " },
      ],
    }));

    expect(await new AnthropicProvider({ client }).generate("prompt")).toBe("Once upon a time.");
  });

  it("throws when the model refuses", async () => {
    const { client } = fakeClient(() => ({ stop_reason: "refusal", content: [] }));
    await expect(new AnthropicProvider({ client }).generate("prompt")).rejects.toThrow("declined");
  });

  it("returns an empty string when the reply has no usable content", async () => {
    for (const reply of [{ stop_reason: "end_turn", content: [] }, { stop_reason: "end_turn" }]) {
      const { client } = fakeClient(() => reply);
      expect(await new AnthropicProvider({ client }).generate("prompt")).toBe("");
    }
  });

  it("passes API errors through", async () => {
    const { client } = fakeClient(() => {
      throw new Error("529 overloaded");
    });
    await expect(new AnthropicProvider({ client }).generate("prompt")).rejects.toThrow("529 overloaded");
  });
});

describe("generatePassage with the Anthropic provider", () => {
  it("sends the same level rules and words as the mock gets", async () => {
    const { client, requests } = fakeClient(() => text("The PEBBLE rolled into the meadow."));
    const provider = new AnthropicProvider({ client });

    const result = await generatePassage({ level: "medium" }, { provider, bank });

    expect(result.words.map((w) => w.text)).toEqual(["pebble", "meadow"]);
    expect(requests[0].messages[0].content).toBe(buildPrompt("medium", result.words));
    expect(result.prompt).toContain("Reading level: medium");
    expect(result.prompt).toContain("Required words: pebble, meadow");
    expect(result.found).toEqual(["pebble", "meadow"]);
    expect(result.valid).toBe(true);
  });

  it("reports a passage that leaves out a word as not valid", async () => {
    const { client } = fakeClient(() => text("A pebble, a stone, a rock."));
    const result = await generatePassage(
      { level: "hard" },
      { provider: new AnthropicProvider({ client }), bank },
    );

    expect(result.missing).toEqual(["meadow", "kaleidoscope"]);
    expect(result.valid).toBe(false);
  });

  it("rejects an empty reply instead of reporting it as a passage", async () => {
    const { client } = fakeClient(() => ({ stop_reason: "end_turn", content: [] }));
    await expect(
      generatePassage({ level: "easy" }, { provider: new AnthropicProvider({ client }), bank }),
    ).rejects.toThrow("The anthropic provider returned an empty passage.");
  });
});
