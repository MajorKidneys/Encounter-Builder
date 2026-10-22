import raw from "@/data/dm-reference.json";

export type RefCategory = "start" | "conditions" | "combat" | "movement" | "hazards" | "rulings";

export type RefEntry = {
  id: string;
  term: string;
  aliases?: string[];
  category: RefCategory;
  short: string;
  body: string;
  table?: { columns: string[]; rows: string[][] };
  related?: string[];
  edition: "2014";
  changedIn2024?: string;
  source: "SRD 5.1" | "Written for this app";
};

export const CATEGORIES: { id: RefCategory; label: string }[] = [
  { id: "start", label: "Start Here" },
  { id: "conditions", label: "Conditions" },
  { id: "combat", label: "Combat" },
  { id: "movement", label: "Movement & Exploration" },
  { id: "hazards", label: "Hazards" },
  { id: "rulings", label: "Rulings" },
];

const entries = raw as RefEntry[];
const byId = new Map(entries.map((entry) => [entry.id, entry]));

export const FIRST_ENTRY_ID = "when-in-doubt";

export function allEntries(): readonly RefEntry[] {
  return entries;
}

export function getEntry(id: string): RefEntry | undefined {
  return byId.get(id);
}

export function entriesByCategory(category: RefCategory): RefEntry[] {
  return entries.filter((entry) => entry.category === category);
}

/** Term, alias, and the short tooltip line. Body text stays out of search. */
export function searchEntries(query: string): RefEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return entries.filter((entry) => {
    if (entry.term.toLowerCase().includes(needle)) return true;
    if (entry.short.toLowerCase().includes(needle)) return true;
    return entry.aliases?.some((alias) => alias.toLowerCase().includes(needle)) ?? false;
  });
}

/** Condition names in the tracker, mapped to glossary ids. */
export function conditionEntryId(name: string): string {
  return name === "Concentrating" ? "concentration" : name.toLowerCase();
}

export function categoryLabel(category: RefCategory): string {
  return CATEGORIES.find((item) => item.id === category)?.label ?? category;
}
