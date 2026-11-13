/** A letter, combining mark or digit in any script. */
const WORD_CHAR = String.raw`[\p{L}\p{M}\p{N}]`;

/** Escapes text so it matches itself literally inside a regular expression. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whether `word` appears in `passage` as a whole word.
 *
 * Matching ignores case and the punctuation around the word ("River," counts
 * for "river"), but a word inside a longer word doesn't count ("start" is not
 * "art"). Any whitespace between the parts of a phrase matches any whitespace
 * in the passage, including line breaks.
 */
export function containsWord(passage: string, word: string): boolean {
  const parts = word.normalize("NFC").trim().split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 0) return false;

  const phrase = parts.map(escapeRegExp).join(String.raw`\s+`);
  const pattern = new RegExp(`(?<!${WORD_CHAR})${phrase}(?!${WORD_CHAR})`, "iu");
  return pattern.test(passage.normalize("NFC"));
}
