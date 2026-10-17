const STOP = new Set(["the", "a", "an", "of"]);

const tokens = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t && !STOP.has(t));

/**
 * How well `candidate` matches `query`: 3 exact, 2 every query word starts a candidate word
 * ("captain" finds "Brother-Captain"), 0 no match. An empty query matches everything at 1.
 */
export function matchScore(query: string, candidate: string): number {
  const q = tokens(query);
  if (q.length === 0) return 1;
  const c = tokens(candidate);
  if (q.join(" ") === c.join(" ")) return 3;
  return q.every((qt) => c.some((ct) => ct.startsWith(qt))) ? 2 : 0;
}

/** Best score across a name and its aliases. */
export function bestScore(query: string, names: string[]): number {
  return Math.max(0, ...names.map((n) => matchScore(query, n)));
}

export function rank<T>(items: T[], score: (item: T) => number, limit: number): T[] {
  return items
    .map((item) => ({ item, s: score(item) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.item);
}
