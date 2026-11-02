import { buildPrompt } from "./prompt.js";
import { getProvider, type LLMProvider } from "./providers/index.js";
import { selectWords } from "./selection.js";
import type { GenerationResult, Level, Word } from "./types.js";
import { checkRequiredWords } from "./validator.js";
import { loadWordBank } from "./words.js";

export interface GenerateRequest {
  level: Level;
  /** Words the teacher picked. If empty, the whole word bank is used. */
  words?: string[];
}

export interface GenerateDeps {
  provider?: LLMProvider;
  bank?: Word[];
}

export async function generatePassage(
  request: GenerateRequest,
  deps: GenerateDeps = {},
): Promise<GenerationResult> {
  const provider = deps.provider ?? getProvider();
  const bank = deps.bank ?? loadWordBank();

  const words = selectWords(bank, request.words, request.level);
  const prompt = buildPrompt(request.level, words);
  const passage = await provider.generate(prompt);
  const { found, missing } = checkRequiredWords(passage, words);

  return { level: request.level, words, prompt, passage, found, missing };
}
