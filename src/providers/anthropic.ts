import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider } from "./types.js";

export interface AnthropicProviderOptions {
  model?: string;
  /** A client to use instead of a new one, for example a fake in tests. */
  client?: Pick<Anthropic, "messages">;
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private readonly client: Pick<Anthropic, "messages">;
  private readonly model: string;

  constructor(options: AnthropicProviderOptions = {}) {
    // A new client reads ANTHROPIC_API_KEY from the environment.
    this.client = options.client ?? new Anthropic();
    this.model = options.model ?? process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5";
  }

  async generate(prompt: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: prompt }],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("The model declined to write this passage.");
    }

    return (response.content ?? [])
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
  }
}
