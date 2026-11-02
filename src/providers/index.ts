import { AnthropicProvider } from "./anthropic.js";
import { MockProvider } from "./mock.js";
import type { LLMProvider } from "./types.js";

export type { LLMProvider } from "./types.js";

export function getProvider(name = process.env.LLM_PROVIDER ?? "mock"): LLMProvider {
  switch (name) {
    case "mock":
      return new MockProvider();
    case "anthropic":
      return new AnthropicProvider();
    default:
      throw new Error(`Unknown LLM_PROVIDER "${name}". Use "mock" or "anthropic".`);
  }
}
