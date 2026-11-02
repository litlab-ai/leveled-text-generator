import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider } from "./types.js";

export interface AnthropicProviderOptions {
  model?: string;
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(options: AnthropicProviderOptions = {}) {
    // Reads ANTHROPIC_API_KEY from the environment.
    this.client = new Anthropic();
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

    return response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
  }
}
