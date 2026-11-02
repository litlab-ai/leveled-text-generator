/** Splits a passage into its individual words. */
export function tokenize(passage: string): string[] {
  return passage.split(/\s+/).filter((token) => token.length > 0);
}
