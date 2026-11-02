/**
 * Builds a filter predicate that keeps items whose `key` is at most `limit`.
 *
 *   scores.filter(atMost("points", 10))
 *   posts.filter(atMost("publishedOn", "2024-12-31"))
 */
export function atMost<K extends PropertyKey>(key: K, limit: number): (item: Record<K, number>) => boolean;
export function atMost<K extends PropertyKey>(key: K, limit: string): (item: Record<K, string>) => boolean;
export function atMost<K extends PropertyKey>(key: K, limit: number | string) {
  return (item: Record<K, number | string>): boolean => item[key] <= limit;
}
