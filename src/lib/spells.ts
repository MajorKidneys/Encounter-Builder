import { useEffect, useState } from "react";
import { uid } from "./encounters";
import { usePersistedState } from "./store";

export type Spell = {
  id: string; name: string; level: number; school: string; classes: string[];
  time: string; range: string; components: string; material: string; duration: string;
  conc: boolean; ritual: boolean; desc: string; higher: string;
  damage?: string; heal?: string; save?: string; attack?: string; area?: string;
};
export type SpellEntry = { name: string; level: number; spellId?: string | undefined; note?: string | undefined };

let cache: Spell[] | null = null;
export async function loadSpells(): Promise<Spell[]> {
  if (!cache) cache = (await import("@/data/srd-spells.json")).default as Spell[];
  return cache;
}
export function useSpells() {
  const [spells, setSpells] = useState<Spell[] | null>(cache);
  useEffect(() => {
    if (!spells) loadSpells().then(setSpells);
  }, [spells]);
  return spells;
}

// 2014 PHB full-caster (wizard/cleric) slot table, index 0 = 1st-level slots.
const TABLE: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
export function slotsFor(casterLevel: number): number[] {
  const row = TABLE[Math.min(20, Math.max(1, Math.floor(casterLevel))) - 1] ?? [];
  return Array.from({ length: 9 }, (_, i) => row[i] ?? 0);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
/** Turns legacy "Fireball (3), Light (cantrip)" text into entries, linking SRD spells by name. */
export function parseList(list: string, spells: Spell[] | null): SpellEntry[] {
  return list.split(",").map((p) => p.trim()).filter(Boolean).map((p) => {
    const m = p.match(/^(.*?)\s*\((cantrip|\d)\)\s*$/i);
    const name = (m?.[1] ?? p).trim();
    const hit = spells?.find((s) => norm(s.name) === norm(name));
    const level = m ? (m[2]!.toLowerCase() === "cantrip" ? 0 : Number(m[2])) : hit?.level ?? 0;
    return { name, level, spellId: hit?.id };
  });
}

export const levelLabel = (l: number) => (l === 0 ? "Cantrips" : `${l}${["st", "nd", "rd"][l - 1] ?? "th"} level`);

export type SpellList = { id: string; name: string; spellIds: string[] };
const KEY = "dm-spell-lists-v1";
export function useSpellLists() {
  const [lists, setLists] = usePersistedState<SpellList[]>(KEY, [], {
    isValid: Array.isArray,
    fallback: () => [{ id: uid(), name: "Favorites", spellIds: [] }],
  });
  return { lists, setLists };
}
